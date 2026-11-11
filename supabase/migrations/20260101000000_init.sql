-- PRODEMY: skema database Supabase
-- Jalankan di Supabase Studio > SQL Editor (atau otomatis lewat `supabase db reset` untuk lokal).

create table public.students (
  id bigint generated always as identity primary key,
  photo text,
  name text not null,
  parent_name text not null,
  parent_job text not null,
  birth_date date not null,
  nik text not null unique check (nik ~ '^[0-9]{16}$'),
  parent_phone text not null,
  category text not null check (category in ('3-6','6-9','9-12')),
  status text not null default 'trial' check (status in ('trial','member','berhenti')),
  joined_at date not null default current_date,
  member_since date,
  stopped_at date,
  created_at timestamptz not null default now()
);

create table public.coaches (
  id bigint generated always as identity primary key,
  photo text,
  name text not null,
  birth_date date not null,
  phone text not null,
  nik text not null unique check (nik ~ '^[0-9]{16}$'),
  role text not null check (role in ('Coach','Asisten Coach')),
  created_at timestamptz not null default now()
);

create table public.attendances (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('hadir','izin','sakit','alpa')),
  unique (student_id, date)
);

create table public.coach_attendances (
  id bigint generated always as identity primary key,
  coach_id bigint not null references public.coaches(id) on delete cascade,
  date date not null,
  status text not null check (status in ('hadir','izin','sakit','alpa')),
  unique (coach_id, date)
);

create table public.payments (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  period date not null,              -- selalu tanggal 1 pada bulan yang dibayar
  amount integer not null default 125000,
  paid_at date not null default current_date,
  proof text,
  unique (student_id, period)
);

-- profil akun (terhubung ke Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  role text not null default 'admin' check (role in ('admin','bendahara'))
);

create index on public.attendances (date);
create index on public.payments (period);

-- peran pengguna yang sedang login
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

-- ===== Row Level Security: tanpa ini data terbuka untuk siapa pun =====
alter table public.students enable row level security;
alter table public.coaches enable row level security;
alter table public.attendances enable row level security;
alter table public.coach_attendances enable row level security;
alter table public.payments enable row level security;
alter table public.profiles enable row level security;

-- murid: admin & bendahara boleh baca, hanya admin yang boleh ubah
create policy "staff baca murid" on public.students for select to authenticated using (public.my_role() in ('admin','bendahara'));
create policy "admin ubah murid" on public.students for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "admin kelola coach" on public.coaches for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "admin kelola absen" on public.attendances for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "admin kelola absen coach" on public.coach_attendances for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "staff kelola pembayaran" on public.payments for all to authenticated
  using (public.my_role() in ('admin','bendahara')) with check (public.my_role() in ('admin','bendahara'));

create policy "baca profil sendiri atau admin" on public.profiles for select to authenticated using (id = auth.uid() or public.my_role() = 'admin');

-- ===== Penyimpanan file (privat) =====
insert into storage.buckets (id, name, public) values ('photos', 'photos', false), ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "staff baca file" on storage.objects for select to authenticated
  using (bucket_id in ('photos','proofs') and public.my_role() in ('admin','bendahara'));
create policy "admin kelola foto" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.my_role() = 'admin') with check (bucket_id = 'photos' and public.my_role() = 'admin');
create policy "staff kelola bukti" on storage.objects for all to authenticated
  using (bucket_id = 'proofs' and public.my_role() in ('admin','bendahara')) with check (bucket_id = 'proofs' and public.my_role() in ('admin','bendahara'));

-- ===== Akun admin pertama =====
-- 1) Buat user di Authentication > Users > Add user:
--      email: admin@prodemy.app   password: (pilih sendiri)   centang "Auto Confirm User"
-- 2) Lalu jalankan:
-- insert into public.profiles (id, name, username, role)
--   select id, 'Admin', 'admin', 'admin' from auth.users where email = 'admin@prodemy.app';
