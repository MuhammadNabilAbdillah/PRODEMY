-- PRODEMY: tambah tanggal lahir dan nama orang tua ke data dashboard anak (untuk kartu Profil Murid).
-- Jalankan SETELAH 20260103000000_payment_proofs.sql. NIK, nomor HP, pekerjaan orang tua, dan foto TETAP tidak dikirim.

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
      'birth_date', f.birth_date, 'parent_name', f.parent_name,
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
