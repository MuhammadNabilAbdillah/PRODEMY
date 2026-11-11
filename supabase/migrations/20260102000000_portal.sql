-- PRODEMY: portal publik untuk orang tua (daftar online + dashboard anak)
-- Jalankan SETELAH 20260101000000_init.sql, di Supabase Studio > SQL Editor.
--
-- Prinsip keamanan: pengunjung (anon) TIDAK diberi akses langsung ke tabel apa pun.
-- Mereka hanya boleh memanggil dua fungsi di bawah (portal_register dan portal_data),
-- yang berjalan dengan hak khusus tetapi hanya mengembalikan data terbatas
-- (tanpa NIK, nomor HP, pekerjaan orang tua, dan foto).

-- ---------- kolom tambahan di tabel murid ----------
alter table public.students
  add column if not exists plan text not null default 'reguler' check (plan in ('reguler','member')),
  add column if not exists family_id uuid,          -- sama untuk anak-anak yang didaftarkan sekaligus
  add column if not exists source text not null default 'admin' check (source in ('admin','online'));

create index if not exists students_family_idx on public.students (family_id);

-- nama dinormalkan (huruf kecil, spasi rapi) agar pencarian tidak sensitif huruf besar/kecil
create or replace function public.norm_name(t text) returns text
language sql immutable set search_path = public as
$$ select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))) $$;

create index if not exists students_norm_name_idx on public.students (public.norm_name(name));

-- ---------- pendaftaran online ----------
-- Semua anak dalam satu pendaftaran disimpan sekaligus (atau gagal semua).
-- Anak masuk sebagai status 'trial' sehingga langsung muncul di menu Data Trial milik admin.
create or replace function public.portal_register(
  p_parent_name text, p_parent_job text, p_parent_phone text, p_plan text, p_children jsonb
) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  fam   uuid := gen_random_uuid();
  today date := (now() at time zone 'Asia/Makassar')::date;
  phone text := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9+]', '', 'g');
  c jsonb; n int; nm text; nk text; bd date; yrs int; cat text;
  result jsonb := '[]'::jsonb;
begin
  if length(btrim(coalesce(p_parent_name, ''))) < 2 or length(btrim(coalesce(p_parent_job, ''))) < 2 then
    raise exception 'Nama dan pekerjaan orang tua wajib diisi.';
  end if;
  if length(regexp_replace(phone, '\D', '', 'g')) not between 9 and 15 then
    raise exception 'Nomor WhatsApp orang tua tidak valid.';
  end if;
  if p_plan is null or p_plan not in ('reguler', 'member') then
    raise exception 'Paket tidak valid.';
  end if;
  if p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception 'Data anak tidak valid.';
  end if;
  n := jsonb_array_length(p_children);
  if n < 1 or n > 8 then
    raise exception 'Jumlah anak dalam satu pendaftaran harus 1 sampai 8.';
  end if;

  for c in select value from jsonb_array_elements(p_children) loop
    nm := btrim(regexp_replace(coalesce(c ->> 'name', ''), '\s+', ' ', 'g'));
    nk := coalesce(c ->> 'nik', '');
    if length(nm) < 2 or length(nm) > 100 then
      raise exception 'Nama lengkap anak wajib diisi.';
    end if;
    if nk !~ '^[0-9]{16}$' then
      raise exception 'NIK % harus 16 digit angka.', nm;
    end if;
    begin
      bd := (c ->> 'birth_date')::date;
    exception when others then
      raise exception 'Tanggal lahir % tidak valid.', nm;
    end;
    if bd is null or bd >= today then
      raise exception 'Tanggal lahir % tidak valid.', nm;
    end if;
    yrs := date_part('year', age(today, bd))::int;
    if yrs < 3 or yrs > 12 then
      raise exception 'Usia % harus 3 sampai 12 tahun.', nm;
    end if;
    cat := case when yrs < 6 then '3-6' when yrs < 9 then '6-9' else '9-12' end;

    begin
      insert into public.students
        (name, parent_name, parent_job, birth_date, nik, parent_phone, category, status, joined_at, plan, family_id, source)
      values
        (nm, btrim(p_parent_name), btrim(p_parent_job), bd, nk, phone, cat, 'trial', today, p_plan, fam, 'online');
    exception when unique_violation then
      raise exception 'NIK % sudah terdaftar. Jika anak sudah mendaftar, pilih "Sudah mendaftar" lalu tulis nama lengkap anak.', nm;
    end;

    result := result || jsonb_build_object('name', nm, 'category', cat);
  end loop;

  return jsonb_build_object('family_id', fam, 'count', n, 'children', result);
end
$$;

-- ---------- data dashboard orang tua ----------
-- Dicari lewat nama lengkap anak (persis, tidak sensitif huruf besar/kecil).
-- Mengembalikan anak yang cocok + saudara yang didaftarkan bersama (family_id sama),
-- beserta absensi dan riwayat pembayarannya. Kolom sensitif tidak ikut dikirim.
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
                            from public.payments p where p.student_id = f.id), '[]'::jsonb)
    ) order by f.is_me desc, f.name
  ), '[]'::jsonb))
  from fam f
$$;

-- hanya dua fungsi ini yang boleh dipanggil pengunjung tanpa login
revoke all on function public.portal_register(text, text, text, text, jsonb) from public;
revoke all on function public.portal_data(text) from public;
grant execute on function public.portal_register(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.portal_data(text) to anon, authenticated;
