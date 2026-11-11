import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { configured } from '../lib/supabase';
import { toggleTheme } from '../components/Layout';
import { useToast } from '../components/ui';

export default function Login() {
  const { signIn, session, profile, loading, isAdmin } = useAuth();
  const toast = useToast();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && session && profile) return <Navigate to={isAdmin ? '/dashboard' : '/payments'} replace />;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await signIn(u, p); toast('Login berhasil. Selamat datang kembali.'); }
    catch (x) { toast.error(x.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <button type="button" className="theme" onClick={toggleTheme} aria-label="Ganti mode terang atau gelap">
        <i className="bi bi-moon-stars moon" /><i className="bi bi-sun sun" />
      </button>
      <div className="lbox">
        <div className="lside">
          <span className="logo-tile"><img src="/images/logo.png" alt="Brother Academy" /></span>
          <div>
            <h1>PRODEMY</h1>
            <p>Portofolio dan absensi Brother Academy</p>
          </div>
        </div>
        <form className="lform" onSubmit={submit}>
          <h2>Masuk</h2>
          <p className="s">Khusus admin dan bendahara. Gunakan akun yang sudah dibuat.</p>
          {!configured && <div className="alert red">File .env belum diisi (VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY).</div>}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="lu">Username</label>
            <div className="ic"><i className="bi bi-person" /><input id="lu" value={u} onChange={(e) => setU(e.target.value)} autoFocus autoCapitalize="none" autoComplete="username" /></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="lp">Password</label>
            <div className="ic"><i className="bi bi-lock" /><input id="lp" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></div>
          </div>
          <button className="btn" disabled={busy || !u || !p}>{busy ? 'Masuk...' : 'Masuk'}</button>
          <p style={{ textAlign: 'center', marginTop: 16 }}><Link to="/" style={{ color: 'var(--mut)', fontWeight: 600 }}><i className="bi bi-arrow-left" /> Kembali ke beranda</Link></p>
        </form>
      </div>
    </div>
  );
}
