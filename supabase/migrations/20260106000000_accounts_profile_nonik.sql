-- PRODEMY: pembaruan besar (jalankan SETELAH 20260105000000_portal_profile.sql di Supabase Studio > SQL Editor)
--
--  1. Kelola akun (tambah / reset password / hapus) langsung lewat fungsi SQL.
--     Tidak perlu lagi men-deploy Edge Function "manage-users".
--  2. NIK dihapus dari persyaratan (kolom lama dibiarkan agar data lama tidak hilang, tapi tidak wajib & tidak unik).
--  3. Batas ukuran foto naik dari 2 MB menjadi 5 MB.
--  4. Dashboard orang tua: foto anak (kolom avatar) dan fitur edit profil oleh orang tua.

-- ======================================================================
-- 1. KELOLA AKUN
-- ======================================================================
create or replace function public.admin_create_user(p_name text, p_username text, p_password text, p_role text)
returns void
language plpgsql security definer set search_path = public, auth, extensions as
$$
declare
  uid   uuid := gen_random_uuid();
  uname text := lower(btrim(coalesce(p_username, '')));
  em    text;
begin
  if coalesce(public.my_role(), '') <> 'admin' then raise exception 'Hanya admin yang boleh mengelola akun.'; end if;
  if uname !~ '^[a-z0-9_.-]{3,50}$' then raise exception 'Username 3-50 karakter (huruf kecil, angka, titik, strip).'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter.'; end if;
  if p_role not in ('admin', 'bendahara') then raise exception 'Peran tidak valid.'; end if;
  em := uname || '@prodemy.app';
  if exists (select 1 from auth.users where email = em) or exists (select 1 from public.profiles where username = uname) then
    raise exception 'Username "%" sudah dipakai.', uname;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', uid::text, now(), now(), now());

  insert into public.profiles (id, name, username, role)
  values (uid, coalesce(nullif(btrim(p_name), ''), uname), uname, p_role);
end
$$;

create or replace function public.admin_reset_password(p_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, auth, extensions as
$$
begin
  if coalesce(public.my_role(), '') <> 'admin' then raise exception 'Hanya admin yang boleh mengelola akun.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter.'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then raise exception 'Akun tidak ditemukan.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
end
$$;

create or replace function public.admin_delete_user(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth, extensions as
$$
begin
  if coalesce(public.my_role(), '') <> 'admin' then raise exception 'Hanya admin yang boleh mengelola akun.'; end if;
  if p_id = auth.uid() then raise exception 'Akun yang sedang dipakai tidak bisa dihapus.'; end if;
  if (select role from public.profiles where id = p_id) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Harus ada minimal satu admin.';
  end if;
  delete from auth.users where id = p_id;  -- profil ikut terhapus (on delete cascade)
end
$$;

revoke all on function public.admin_create_user(text, text, text, text) from public, anon;
revoke all on function public.admin_reset_password(uuid, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ======================================================================
-- 2. NIK TIDAK DIPAKAI LAGI
-- ======================================================================
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as t, conname from pg_constraint
    where conrelid in ('public.students'::regclass, 'public.coaches'::regclass) and conname ilike '%nik%'
  loop
    execute format('alter table %s drop constraint %I', r.t, r.conname);
  end loop;
end $$;
alter table public.students alter column nik drop not null;
alter table public.coaches  alter column nik drop not null;

-- ======================================================================
-- 3. FOTO MAKSIMAL 5 MB
-- ======================================================================
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
 where id = 'photos';

-- ======================================================================
-- 4. FOTO ANAK DI PORTAL ORANG TUA
-- ======================================================================
-- Foto asli tetap di bucket privat. Untuk portal (tanpa login) disimpan versi kecil (data URL JPEG)
-- di kolom avatar, supaya bisa tampil tanpa membuka akses ke bucket.
alter table public.students add column if not exists avatar text;
alter table public.students drop constraint if exists students_avatar_check;
alter table public.students add constraint students_avatar_check
  check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and length(avatar) <= 200000));

-- ---------- pendaftaran online (tanpa NIK) ----------
create or replace function public.portal_register(
  p_parent_name text, p_parent_job text, p_parent_phone text, p_plan text, p_children jsonb
) returns jsonb
language plpgsql security definer set search_path = public, storage as
$$
declare
  fam   uuid := gen_random_uuid();
  today date := (now() at time zone 'Asia/Makassar')::date;
  phone text := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9+]', '', 'g');
  c jsonb; n int; nm text; ph text; av text; bd date; yrs int; cat text;
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
    ph := coalesce(c ->> 'photo', '');
    av := nullif(c ->> 'avatar', '');
    if length(nm) < 2 or length(nm) > 100 then
      raise exception 'Nama lengkap anak wajib diisi.';
    end if;
    if ph !~ '^registrations/[A-Za-z0-9_./-]+$'
       or not exists (select 1 from storage.objects where bucket_id = 'photos' and name = ph) then
      raise exception 'Foto % wajib diunggah.', nm;
    end if;
    if exists (select 1 from public.students where photo = ph) then
      raise exception 'Foto % sudah dipakai. Unggah ulang foto.', nm;
    end if;
    if av is not null and (av not like 'data:image/jpeg;base64,%' or length(av) > 200000) then
      av := null;
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
    -- pengganti NIK: nama + tanggal lahir yang sama dianggap sudah terdaftar
    if exists (select 1 from public.students where public.norm_name(name) = public.norm_name(nm) and birth_date = bd) then
      raise exception '% (lahir %) sudah terdaftar. Jika anak sudah mendaftar, pilih "Sudah mendaftar" lalu tulis nama lengkap anak.', nm, to_char(bd, 'DD-MM-YYYY');
    end if;
    cat := case when yrs < 6 then '3-6' when yrs < 9 then '6-9' else '9-12' end;

    insert into public.students
      (name, parent_name, parent_job, birth_date, parent_phone, category, status, joined_at, plan, family_id, source, photo, avatar)
    values
      (nm, btrim(p_parent_name), btrim(p_parent_job), bd, phone, cat, 'trial', today, p_plan, fam, 'online', ph, av);

    result := result || jsonb_build_object('name', nm, 'category', cat);
  end loop;

  return jsonb_build_object('family_id', fam, 'count', n, 'children', result);
end
$$;
revoke all on function public.portal_register(text, text, text, text, jsonb) from public;
grant execute on function public.portal_register(text, text, text, text, jsonb) to anon, authenticated;

-- ---------- data dashboard orang tua (kini membawa foto kecil) ----------
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
revoke all on function public.portal_data(text) from public;
grant execute on function public.portal_data(text) to anon, authenticated;

-- ---------- orang tua mengubah profil anak ----------
-- p_name  : nama anak yang dipakai untuk masuk (kunci akses, sama seperti portal_data)
-- p_id    : anak yang diubah (harus anak itu sendiri atau saudara satu pendaftaran)
-- Nomor HP dan pekerjaan sengaja "hanya tulis": tidak pernah dikirim balik ke portal. Kosong = tidak diubah.
create or replace function public.portal_update_profile(
  p_name text, p_id bigint, p_parent_name text, p_birth_date date,
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
   where st.id = p_id
     and exists (
       select 1 from public.students m
        where public.norm_name(m.name) = public.norm_name(p_name)
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
revoke all on function public.portal_update_profile(text, bigint, text, date, text, text, text, text) from public;
grant execute on function public.portal_update_profile(text, bigint, text, date, text, text, text, text) to anon, authenticated;
