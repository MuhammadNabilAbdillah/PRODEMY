import { useState } from 'react';
import * as XLSX from 'xlsx';
import { fetchAll, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Chip, ErrorBox, Loading, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

// ---------- kelola akun: fungsi SQL di database (migrasi 20260106), tanpa Edge Function ----------
const adminMsg = (e) => {
  const m = e?.message || String(e || '');
  if (/could not find the function|schema cache|does not exist/i.test(m)) return 'Fungsi akun belum ada di database. Jalankan file supabase/migrations/20260106000000_accounts_profile_nonik.sql di Supabase SQL Editor (lihat README).';
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.';
  return m;
};
const callAdmin = async (fn, args) => {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(adminMsg(error));
};

function PasswordInput({ value, onChange, placeholder, required, autoComplete = 'new-password', style }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw" style={style}>
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} required={required} minLength={6} autoComplete={autoComplete} />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}><i className={`bi bi-eye${show ? '-slash' : ''}`} /></button>
    </div>
  );
}

const EMPTY_ACC = { name: '', username: '', password: '', role: 'admin' };

function Accounts() {
  const toast = useToast();
  const { session } = useAuth();
  const { data, loading, error, reload } = useData(async () => {
    const { data: rows, error: e } = await supabase.from('profiles').select('*').order('username');
    if (e) throw e;
    return rows || [];
  }, []);
  const [f, setF] = useState(EMPTY_ACC);
  const [pw, setPw] = useState({});
  const [busy, setBusy] = useState(false);

  const run = async (fn, args, ok) => {
    setBusy(true);
    try { await callAdmin(fn, args); toast(ok); reload(); return true; }
    catch (e) { toast.error(e.message); return false; }
    finally { setBusy(false); }
  };

  const create = async (e) => {
    e.preventDefault();
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,50}$/.test(username)) return toast.error('Username 3-50 karakter: huruf kecil, angka, titik, garis bawah, atau strip.');
    if (f.password.length < 6) return toast.error('Password minimal 6 karakter.');
    if (await run('admin_create_user', { p_name: f.name.trim(), p_username: username, p_password: f.password, p_role: f.role }, `Akun ${username} berhasil dibuat.`)) setF(EMPTY_ACC);
  };
  const reset = async (a) => {
    const v = pw[a.id] || '';
    if (v.length < 6) return toast.error('Password baru minimal 6 karakter.');
    if (!(await toast.confirm(`Reset password untuk ${a.username}?`, { title: 'Reset password', okText: 'Ya, reset' }))) return;
    if (await run('admin_reset_password', { p_id: a.id, p_password: v }, `Password ${a.username} berhasil direset.`)) setPw({ ...pw, [a.id]: '' });
  };
  const remove = async (a) => {
    if (!(await toast.confirm(`Hapus akun ${a.username}?`, { title: 'Hapus akun', okText: 'Ya, hapus', danger: true }))) return;
    await run('admin_delete_user', { p_id: a.id }, 'Akun dihapus.');
  };

  return (
    <section className="set-sec">
      <div className="set-head">
        <h2 className="disp">Kelola akun</h2>
        <p>Admin punya akses penuh. Bendahara hanya bisa membuka menu pembayaran.</p>
      </div>
      <div className="set-grid acc-grid">
        <div className="card">
          <h3 className="disp">Akun pengguna</h3>
          {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
            <ul className="acc-list">
              {data.map((a) => (
                <li className="acc" key={a.id}>
                  <span className="acc-av">{(a.name || a.username).charAt(0).toUpperCase()}</span>
                  <div className="acc-id">
                    <b>{a.name}</b>
                    <small>@{a.username}</small>
                  </div>
                  <Chip tone={a.role === 'admin' ? '' : 'amb'}>{a.role === 'admin' ? 'Admin' : 'Bendahara'}</Chip>
                  <div className="acc-acts">
                    <PasswordInput placeholder="Password baru" autoComplete="off" value={pw[a.id] || ''} onChange={(e) => setPw({ ...pw, [a.id]: e.target.value })} />
                    <button type="button" className="btn ghost sm" disabled={busy} onClick={() => reset(a)}>Reset</button>
                    {a.id !== session.user.id && <button type="button" className="btn red sm" disabled={busy} onClick={() => remove(a)} aria-label={`Hapus akun ${a.username}`}><i className="bi bi-trash" /></button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form className="card" onSubmit={create}>
          <h3 className="disp">Tambah akun</h3>
          <div className="stack">
            <div><label>Nama</label><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" /></div>
            <div><label>Username</label><input required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" autoCorrect="off" autoComplete="off" placeholder="contoh: bendahara1" /></div>
            <div><label>Password (min. 6 karakter)</label><PasswordInput required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            <div><label>Peran</label>
              <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="admin">Admin (akses penuh)</option><option value="bendahara">Bendahara (hanya pembayaran)</option></select></div>
          </div>
          <button className="btn set-submit" disabled={busy}>{busy ? 'Membuat akun...' : 'Buat akun'}</button>
        </form>
      </div>
    </section>
  );
}

// ---------- backup ----------
const BACKUP_TABLES = [
  ['students', 'Murid'], ['coaches', 'Coach'], ['attendances', 'Absensi murid'], ['coach_attendances', 'Absensi coach'],
  ['payments', 'Pembayaran'], ['payment_submissions', 'Bukti bayar'], ['profiles', 'Akun'],
];
const LAST_KEY = 'prodemy-last-backup';
const getLast = () => { try { return localStorage.getItem(LAST_KEY) || ''; } catch { return ''; } };
const fmtWhen = (iso) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));

/** Foto kecil (avatar) berbentuk teks panjang, tidak perlu ikut di backup: foto aslinya ada di Storage */
const clean = (rows) => rows.map(({ avatar, ...r }) => r); // eslint-disable-line no-unused-vars
const save = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

function Backup() {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [step, setStep] = useState('');
  const [last, setLast] = useState(getLast());

  const collect = async () => {
    const out = {};
    for (const [t, label] of BACKUP_TABLES) {
      setStep(`Mengambil data ${label.toLowerCase()}...`);
      try { out[t] = clean(await fetchAll(t)); }
      catch (e) { if (t === 'payment_submissions') out[t] = []; else throw e; } // tabel bukti bayar baru ada setelah migrasi 20260103
    }
    return out;
  };
  const done = (kind) => {
    const now = new Date().toISOString();
    try { localStorage.setItem(LAST_KEY, now); } catch { /* abaikan */ }
    setLast(now); toast(`Backup ${kind} berhasil diunduh.`);
  };
  const run = (kind) => async () => {
    setBusy(kind);
    try {
      const data = await collect();
      setStep('Menyiapkan file...');
      if (kind === 'JSON') {
        save(new Blob([JSON.stringify({ dibuat: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' }), `prodemy-backup-${U.todayStr()}.json`);
      } else {
        const wb = XLSX.utils.book_new();
        BACKUP_TABLES.forEach(([t, label]) => {
          const rows = data[t] || [];
          XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['(kosong)']]), label.slice(0, 31));
        });
        XLSX.writeFile(wb, `prodemy-backup-${U.todayStr()}.xlsx`);
      }
      done(kind);
    } catch (x) { toast.error(U.cleanMsg(x)); } finally { setBusy(''); setStep(''); }
  };

  return (
    <div className="card bk">
      <div className="bk-head">
        <span className="bk-ico"><i className="bi bi-database-down" /></span>
        <div>
          <h3 className="disp">Backup data</h3>
          <p className="bk-last">{last ? <>Terakhir diunduh <b>{fmtWhen(last)}</b></> : 'Belum pernah diunduh dari perangkat ini.'}</p>
        </div>
      </div>
      <p className="set-mut">Satu file berisi seluruh data aplikasi. Simpan secara berkala di tempat yang aman, misalnya Google Drive atau flashdisk.</p>
      <ul className="bk-incl">
        {BACKUP_TABLES.map(([, label]) => <li key={label}><i className="bi bi-check2" /> {label}</li>)}
      </ul>
      <div className="bk-acts">
        <button type="button" className="btn" onClick={run('JSON')} disabled={Boolean(busy)}><i className="bi bi-filetype-json" /> {busy === 'JSON' ? 'Menyiapkan...' : 'Unduh backup (.json)'}</button>
        <button type="button" className="btn ghost" onClick={run('Excel')} disabled={Boolean(busy)}><i className="bi bi-file-earmark-excel" /> {busy === 'Excel' ? 'Menyiapkan...' : 'Unduh Excel (.xlsx)'}</button>
      </div>
      {busy && <p className="bk-step" role="status"><i className="bi bi-arrow-repeat" /> {step}</p>}
      <p className="set-fine"><i className="bi bi-info-circle" /><span>Foto dan bukti bayar tersimpan di Supabase Storage (bucket <b>photos</b> dan <b>proofs</b>) dan bisa diunduh lewat Supabase Studio. File JSON hanya mencatat lokasi fotonya.</span></p>
    </div>
  );
}

export default function Settings() {
  useTitle('Pengaturan');
  const { isAdmin, verifyPassword } = useAuth();
  const toast = useToast();
  const [p, setP] = useState({ current: '', next: '', again: '' });
  const [busy, setBusy] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (p.next.length < 6) return toast.error('Password baru minimal 6 karakter.');
    if (p.next !== p.again) return toast.error('Konfirmasi password tidak sama.');
    setBusy(true);
    if (!(await verifyPassword(p.current))) { setBusy(false); return toast.error('Password saat ini salah.'); }
    const { error } = await supabase.auth.updateUser({ password: p.next });
    setBusy(false);
    if (error) return toast.error(error.message);
    setP({ current: '', next: '', again: '' }); toast('Password berhasil diganti.');
  };

  return (
    <div className="set">
      <section className="set-sec">
        <div className="set-head"><h2 className="disp">Akun saya</h2><p>Ganti password yang kamu pakai untuk masuk.</p></div>
        <div className="set-grid">
          <form className="card" onSubmit={changePassword}>
            <h3 className="disp">Ganti password</h3>
            <div className="stack">
              <div><label>Password saat ini</label><PasswordInput autoComplete="current-password" required value={p.current} onChange={(e) => setP({ ...p, current: e.target.value })} /></div>
              <div><label>Password baru (min. 6 karakter)</label><PasswordInput required value={p.next} onChange={(e) => setP({ ...p, next: e.target.value })} /></div>
              <div><label>Ulangi password baru</label><PasswordInput required value={p.again} onChange={(e) => setP({ ...p, again: e.target.value })} /></div>
            </div>
            <button className="btn set-submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan password'}</button>
          </form>
        </div>
      </section>
      {isAdmin && (
        <section className="set-sec">
          <div className="set-head"><h2 className="disp">Data &amp; backup</h2><p>Simpan salinan data aplikasi di luar Supabase.</p></div>
          <div className="set-grid"><Backup /></div>
        </section>
      )}
      {isAdmin && <Accounts />}
    </div>
  );
}
