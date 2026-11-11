-- PRODEMY: orang tua transfer Bank Mandiri lalu unggah bukti bayar, otomatis masuk ke admin.
-- Jalankan SETELAH 20260102000000_portal.sql, di Supabase Studio > SQL Editor.
--
-- Alur:
--   1. Orang tua (tanpa login) transfer, lalu unggah bukti di /anak/pembayaran.
--   2. Data masuk ke tabel payment_submissions dengan status 'menunggu' (muncul di menu admin "Bukti Bayar").
--   3. Admin/bendahara menekan "Setujui" -> tabel payments terisi (status Lunas + bukti), atau "Tolak".

-- ---------- tabel kiriman bukti bayar ----------
create table if not exists public.payment_submissions (
  id bigint generated always as identity primary key,
  student_ids bigint[] not null,                       -- anak-anak yang dibayar dalam satu transfer
  period date not null,                                -- selalu tanggal 1 pada bulan yang dibayar
  amount integer not null check (amount > 0),          -- total transfer (semua anak)
  proof text not null unique,                          -- path file di bucket 'proofs'
  note text,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists payment_submissions_status_idx on public.payment_submissions (status, created_at desc);

alter table public.payment_submissions enable row level security;
-- pengunjung tidak punya akses langsung; staf hanya boleh membaca (perubahan lewat fungsi di bawah)
drop policy if exists "staff baca kiriman bayar" on public.payment_submissions;
create policy "staff baca kiriman bayar" on public.payment_submissions for select to authenticated
  using (public.my_role() in ('admin', 'bendahara'));

-- ---------- penyimpanan: pengunjung hanya boleh MENGUNGGAH ke folder submissions/ ----------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
 where id = 'proofs';

drop policy if exists "publik unggah bukti" on storage.objects;
create policy "publik unggah bukti" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'proofs' and name like 'submissions/%');

-- ---------- kirim bukti bayar (dipanggil orang tua) ----------
create or replace function public.portal_submit_payment(
  p_name text, p_student_ids bigint[], p_period date, p_amount integer, p_proof text, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, storage as
$$
declare
  today date := (now() at time zone 'Asia/Makassar')::date;
  this_month date := date_trunc('month', today)::date;
  per date;
  ids bigint[];
  ok int;
  new_id bigint;
begin
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Nama anak wajib diisi.'; end if;

  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_student_ids, '{}')) as x;
  if coalesce(array_length(ids, 1), 0) < 1 or array_length(ids, 1) > 8 then
    raise exception 'Pilih minimal 1 anak.';
  end if;
  if p_amount is null or p_amount < 1000 or p_amount > 10000000 then
    raise exception 'Jumlah pembayaran tidak valid.';
  end if;

  per := date_trunc('month', p_period)::date;
  if per is null or per < (this_month - interval '1 month')::date or per > (this_month + interval '1 month')::date then
    raise exception 'Periode pembayaran tidak valid.';
  end if;

  if p_proof is null or p_proof not like 'submissions/%'
     or not exists (select 1 from storage.objects where bucket_id = 'proofs' and name = p_proof) then
    raise exception 'File bukti pembayaran tidak ditemukan. Unggah ulang.';
  end if;

  -- semua anak harus: berstatus member, dan satu keluarga dengan anak yang namanya dimasukkan
  with me as (
    select id, family_id from public.students where public.norm_name(name) = public.norm_name(p_name)
  )
  select count(*) into ok from public.students s
   where s.id = any(ids) and s.status = 'member'
     and (s.id in (select id from me)
          or (s.family_id is not null and s.family_id in (select family_id from me where family_id is not null)));
  if ok <> array_length(ids, 1) then
    raise exception 'Data anak tidak cocok, atau anak belum berstatus member.';
  end if;

  if exists (select 1 from public.payments where student_id = any(ids) and period = per) then
    raise exception 'Pembayaran bulan ini untuk salah satu anak sudah tercatat lunas.';
  end if;
  if exists (select 1 from public.payment_submissions where status = 'menunggu' and period = per and student_ids && ids) then
    raise exception 'Bukti pembayaran periode ini sudah dikirim dan sedang menunggu verifikasi admin.';
  end if;

  insert into public.payment_submissions (student_ids, period, amount, proof, note)
  values (ids, per, p_amount, p_proof, nullif(btrim(left(coalesce(p_note, ''), 300)), ''))
  returning id into new_id;

  return jsonb_build_object('id', new_id);
end
$$;

-- ---------- setujui / tolak (dipanggil admin atau bendahara yang login) ----------
create or replace function public.approve_payment_submission(p_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  s public.payment_submissions;
  per_child int;
begin
  if coalesce(public.my_role(), '') not in ('admin', 'bendahara') then raise exception 'Tidak diizinkan.'; end if;
  select * into s from public.payment_submissions where id = p_id for update;
  if not found then raise exception 'Data tidak ditemukan.'; end if;
  if s.status <> 'menunggu' then raise exception 'Bukti ini sudah diproses.'; end if;

  per_child := s.amount / array_length(s.student_ids, 1);
  insert into public.payments (student_id, period, amount, paid_at, proof)
  select sid, s.period, per_child, (s.created_at at time zone 'Asia/Makassar')::date, s.proof
    from unnest(s.student_ids) as sid
  on conflict (student_id, period)
  do update set amount = excluded.amount, paid_at = excluded.paid_at, proof = excluded.proof;

  update public.payment_submissions set status = 'disetujui', reviewed_at = now() where id = p_id;
end
$$;

create or replace function public.reject_payment_submission(p_id bigint, p_reason text default null) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if coalesce(public.my_role(), '') not in ('admin', 'bendahara') then raise exception 'Tidak diizinkan.'; end if;
  update public.payment_submissions
     set status = 'ditolak', reject_reason = nullif(btrim(left(coalesce(p_reason, ''), 300)), ''), reviewed_at = now()
   where id = p_id and status = 'menunggu';
  if not found then raise exception 'Data tidak ditemukan atau sudah diproses.'; end if;
end
$$;

revoke all on function public.portal_submit_payment(text, bigint[], date, integer, text, text) from public;
revoke all on function public.approve_payment_submission(bigint) from public;
revoke all on function public.reject_payment_submission(bigint, text) from public;
grant execute on function public.portal_submit_payment(text, bigint[], date, integer, text, text) to anon, authenticated;
grant execute on function public.approve_payment_submission(bigint) to authenticated;
grant execute on function public.reject_payment_submission(bigint, text) to authenticated;

-- ---------- portal_data: tambahkan riwayat kiriman bukti per anak ----------
create or replace function public.portal_data(p_name text) returns jsonb
language sql stable security definer set search_path = public as
$$
  with me as (
    select id, family_id from public.students
    where btrim(coalesce(p_name, '')) <> '' and public.norm_name(name) = public.norm_name(p_name)
  ),
  fam as (
    select s.*, (s.id in (select id from me)) as is_me
    from public.students s
    where s.id in (select id from me)
       or (s.family_id is not null and s.family_id in (select family_id from me where family_id is not null))
  )
  select jsonb_build_object('children', coalesce(jsonb_agg(
    jsonb_build_object(
      'id', f.id, 'name', f.name, 'category', f.category, 'status', f.status, 'plan', f.plan,
      'joined_at', f.joined_at, 'member_since', f.member_since, 'is_me', f.is_me,
      'attendance', coalesce((select jsonb_agg(jsonb_build_object('date', a.date, 'status', a.status) order by a.date desc)
                              from public.attendances a where a.student_id = f.id), '[]'::jsonb),
      'payments', coalesce((select jsonb_agg(jsonb_build_object('period', p.period, 'amount', p.amount, 'paid_at', p.paid_at) order by p.period desc)
                            from public.payments p where p.student_id = f.id), '[]'::jsonb),
      'submissions', coalesce((select jsonb_agg(jsonb_build_object(
                                 'id', ps.id, 'period', ps.period, 'amount', ps.amount, 'status', ps.status,
                                 'created_at', ps.created_at, 'reject_reason', ps.reject_reason) order by ps.created_at desc)
                               from public.payment_submissions ps where f.id = any(ps.student_ids)), '[]'::jsonb)
    ) order by f.is_me desc, f.name
  ), '[]'::jsonb))
  from fam f
$$;

revoke all on function public.portal_data(text) from public;
grant execute on function public.portal_data(text) to anon, authenticated;
