-- PRODEMY: foto anak WAJIB diunggah saat pendaftaran online.
-- Jalankan SETELAH 20260103000000_payment_proofs.sql, di Supabase Studio > SQL Editor.

-- pengunjung hanya boleh MENGUNGGAH (tidak membaca/menghapus) ke folder registrations/ di bucket foto
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
 where id = 'photos';

drop policy if exists "publik unggah foto daftar" on storage.objects;
create policy "publik unggah foto daftar" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos' and name like 'registrations/%');

-- pendaftaran online: kini setiap anak wajib punya foto (path dari unggahan di atas)
create or replace function public.portal_register(
  p_parent_name text, p_parent_job text, p_parent_phone text, p_plan text, p_children jsonb
) returns jsonb
language plpgsql security definer set search_path = public, storage as
$$
declare
  fam   uuid := gen_random_uuid();
  today date := (now() at time zone 'Asia/Makassar')::date;
  phone text := regexp_replace(coalesce(p_parent_phone, ''), '[^0-9+]', '', 'g');
  c jsonb; n int; nm text; nk text; ph text; bd date; yrs int; cat text;
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
    ph := coalesce(c ->> 'photo', '');
    if length(nm) < 2 or length(nm) > 100 then
      raise exception 'Nama lengkap anak wajib diisi.';
    end if;
    if nk !~ '^[0-9]{16}$' then
      raise exception 'NIK % harus 16 digit angka.', nm;
    end if;
    if ph !~ '^registrations/[A-Za-z0-9_./-]+$'
       or not exists (select 1 from storage.objects where bucket_id = 'photos' and name = ph) then
      raise exception 'Foto % wajib diunggah.', nm;
    end if;
    if exists (select 1 from public.students where photo = ph) then
      raise exception 'Foto % sudah dipakai. Unggah ulang foto.', nm;
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
        (name, parent_name, parent_job, birth_date, nik, parent_phone, category, status, joined_at, plan, family_id, source, photo)
      values
        (nm, btrim(p_parent_name), btrim(p_parent_job), bd, nk, phone, cat, 'trial', today, p_plan, fam, 'online', ph);
    exception when unique_violation then
      raise exception 'NIK % sudah terdaftar. Jika anak sudah mendaftar, pilih "Sudah mendaftar" lalu tulis nama lengkap anak.', nm;
    end;

    result := result || jsonb_build_object('name', nm, 'category', cat);
  end loop;

  return jsonb_build_object('family_id', fam, 'count', n, 'children', result);
end
$$;

revoke all on function public.portal_register(text, text, text, text, jsonb) from public;
grant execute on function public.portal_register(text, text, text, text, jsonb) to anon, authenticated;
