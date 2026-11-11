-- PRODEMY: masuk ke dashboard orang tua wajib nama lengkap + tanggal lahir anak.
-- Jalankan SETELAH 20260106000000_accounts_profile_nonik.sql, di Supabase Studio > SQL Editor (cukup sekali).
--
-- Sebelumnya portal hanya memeriksa nama anak, sehingga anak yang namanya sama membuka data orang lain.
-- Sekarang nama DAN tanggal lahir harus cocok. Fungsi lama yang hanya memakai nama DIHAPUS
-- supaya tidak ada jalan pintas lewat API.

drop function if exists public.portal_data(text);
drop function if exists public.portal_update_profile(text, bigint, text, date, text, text, text, text);
drop function if exists public.portal_submit_payment(text, bigint[], date, integer, text, text);

-- ---------- data dashboard ----------
create or replace function public.portal_data(p_name text, p_birth date) returns jsonb
language sql stable security definer set search_path = public as
$$
  with me as (
    select id, family_id from public.students
    where btrim(coalesce(p_name, '')) <> '' and p_birth is not null
      and public.norm_name(name) = public.norm_name(p_name) and birth_date = p_birth
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
      'birth_date', f.birth_date, 'parent_name', f.parent_name, 'avatar', f.avatar,
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
revoke all on function public.portal_data(text, date) from public;
grant execute on function public.portal_data(text, date) to anon, authenticated;

-- ---------- ubah profil anak ----------
-- p_name + p_birth : identitas masuk (nama dan tanggal lahir anak yang dipakai login)
-- p_id             : anak yang diubah (anak itu sendiri atau saudara satu pendaftaran)
-- p_birth_date     : tanggal lahir BARU (opsional)
create or replace function public.portal_update_profile(
  p_name text, p_birth date, p_id bigint, p_parent_name text, p_birth_date date,
  p_parent_phone text, p_parent_job text, p_photo text, p_avatar text
) returns jsonb
language plpgsql security definer set search_path = public, storage as
$$
declare
  today date := (now() at time zone 'Asia/Makassar')::date;
  s public.students;
  phone text := nullif(regexp_replace(coalesce(p_parent_phone, ''), '[^0-9+]', '', 'g'), '');
  pname text := nullif(btrim(coalesce(p_parent_name, '')), '');
  pjob  text := nullif(btrim(coalesce(p_parent_job, '')), '');
  yrs int; cat text;
begin
  select st.* into s from public.students st
   where st.id = p_id and p_birth is not null
     and exists (
       select 1 from public.students m
        where public.norm_name(m.name) = public.norm_name(p_name) and m.birth_date = p_birth
          and (m.id = st.id or (m.family_id is not null and m.family_id = st.family_id))
     );
  if not found then raise exception 'Data anak tidak ditemukan.'; end if;

  if pname is not null and length(pname) < 2 then raise exception 'Nama orang tua terlalu pendek.'; end if;
  if phone is not null and length(regexp_replace(phone, '\D', '', 'g')) not between 9 and 15 then
    raise exception 'Nomor WhatsApp tidak valid.';
  end if;

  cat := s.category;
  if p_birth_date is not null and p_birth_date <> s.birth_date then
    if p_birth_date >= today then raise exception 'Tanggal lahir tidak valid.'; end if;
    yrs := date_part('year', age(today, p_birth_date))::int;
    if yrs < 3 or yrs > 12 then raise exception 'Usia anak harus 3 sampai 12 tahun.'; end if;
    cat := case when yrs < 6 then '3-6' when yrs < 9 then '6-9' else '9-12' end;
  else
    p_birth_date := s.birth_date;
  end if;

  if p_photo is not null and p_photo <> '' then
    if p_photo !~ '^registrations/[A-Za-z0-9_./-]+$'
       or not exists (select 1 from storage.objects where bucket_id = 'photos' and name = p_photo) then
      raise exception 'Foto tidak valid. Unggah ulang.';
    end if;
    if p_avatar is null or p_avatar not like 'data:image/jpeg;base64,%' or length(p_avatar) > 200000 then
      raise exception 'Foto tidak valid. Unggah ulang.';
    end if;
  end if;

  update public.students set
    parent_name  = coalesce(pname, parent_name),
    parent_phone = coalesce(phone, parent_phone),
    parent_job   = coalesce(pjob, parent_job),
    birth_date   = p_birth_date,
    category     = cat,
    photo        = case when coalesce(p_photo, '') <> '' then p_photo else photo end,
    avatar       = case when coalesce(p_photo, '') <> '' then p_avatar else avatar end
  where id = p_id;

  return jsonb_build_object('ok', true, 'category', cat);
end
$$;
revoke all on function public.portal_update_profile(text, date, bigint, text, date, text, text, text, text) from public;
grant execute on function public.portal_update_profile(text, date, bigint, text, date, text, text, text, text) to anon, authenticated;

-- ---------- kirim bukti pembayaran ----------
create or replace function public.portal_submit_payment(
  p_name text, p_birth date, p_student_ids bigint[], p_period date, p_amount integer, p_proof text, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public, storage as
$$
declare
  ids bigint[];
  this_month date := date_trunc('month', (now() at time zone 'Asia/Makassar')::date)::date;
  per date;
  ok int;
  new_id bigint;
begin
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

  with me as (
    select id, family_id from public.students
     where p_birth is not null and public.norm_name(name) = public.norm_name(p_name) and birth_date = p_birth
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
revoke all on function public.portal_submit_payment(text, date, bigint[], date, integer, text, text) from public;
grant execute on function public.portal_submit_payment(text, date, bigint[], date, integer, text, text) to anon, authenticated;
