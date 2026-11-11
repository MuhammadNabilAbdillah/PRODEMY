// Edge Function untuk mengelola akun (butuh hak khusus sehingga tidak boleh dijalankan dari browser).
// Deploy: supabase functions deploy manage-users
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: 'Belum login' }, 401);
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return json({ error: 'Hanya admin' }, 403);

  const body = await req.json();

  if (body.action === 'create') {
    const username = String(body.username ?? '').toLowerCase().trim();
    if (!/^[a-z0-9_.-]{3,50}$/.test(username)) return json({ error: 'Username 3-50 karakter (huruf kecil, angka, titik, strip).' }, 400);
    if (String(body.password ?? '').length < 6) return json({ error: 'Password minimal 6 karakter.' }, 400);
    if (!['admin', 'bendahara'].includes(body.role)) return json({ error: 'Peran tidak valid.' }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email: `${username}@prodemy.app`, password: body.password, email_confirm: true });
    if (error) return json({ error: error.message }, 400);
    const { error: e2 } = await admin.from('profiles').insert({ id: data.user.id, name: body.name || username, username, role: body.role });
    if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400); }
    return json({ ok: true });
  }

  if (body.action === 'reset') {
    if (String(body.password ?? '').length < 6) return json({ error: 'Password minimal 6 karakter.' }, 400);
    const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  if (body.action === 'delete') {
    if (body.id === user.id) return json({ error: 'Akun yang sedang dipakai tidak bisa dihapus.' }, 400);
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    const target = await admin.from('profiles').select('role').eq('id', body.id).single();
    if (target.data?.role === 'admin' && (admins?.length ?? 0) <= 1) return json({ error: 'Harus ada minimal satu admin.' }, 400);
    const { error } = await admin.auth.admin.deleteUser(body.id);
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  return json({ error: 'Aksi tidak dikenal' }, 400);
});
