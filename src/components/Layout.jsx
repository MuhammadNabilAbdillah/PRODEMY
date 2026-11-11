import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { TitleCtx } from './ui';
import { todayStr } from '../lib/utils';

const fmtClock = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtDate = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export function toggleTheme() {
  const d = document.documentElement, t = d.dataset.theme === 'dark' ? 'light' : 'dark';
  d.dataset.theme = t;
  try { localStorage.setItem('prodemy-theme', t); } catch { /* abaikan */ }
}

const Item = ({ to, icon, children }) => (
  <NavLink to={to} className={({ isActive }) => (isActive ? 'on' : '')}><i className={`bi bi-${icon}`} /> {children}</NavLink>
);

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth();
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [bdays, setBdays] = useState(0);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const nav = useNavigate();
  const loc = useLocation();
  const [pendingProofs, setPendingProofs] = useState(0);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  // menu samping (HP): tutup saat pindah halaman, kunci gulir latar saat terbuka, tutup dengan tombol Esc
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);
  // jumlah bukti pembayaran dari orang tua yang menunggu verifikasi (dihitung ulang tiap pindah halaman)
  useEffect(() => {
    supabase.from('payment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'menunggu')
      .then(({ count }) => setPendingProofs(count || 0));
  }, [loc.pathname]);
  useEffect(() => {
    if (!isAdmin) return;
    const md = todayStr().slice(5);
    supabase.from('students').select('birth_date').neq('status', 'berhenti')
      .then(({ data }) => setBdays((data || []).filter((s) => s.birth_date.slice(5) === md).length));
  }, [isAdmin]);

  return (
    <TitleCtx.Provider value={setTitle}>
      {open && <div className="side-back" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`side${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">
          <span className="logo-tile"><img src="/images/logo.png" alt="" /></span>
          <div><b className="disp">PRODEMY</b><small>Brother Academy</small></div>
        </div>
        <nav>
          {isAdmin ? (
            <>
              <Item to="/dashboard" icon="grid-1x2">Dashboard</Item>
              <div className="grp">Akademi</div>
              <Item to="/students" icon="person-vcard">Data Academy</Item>
              <Item to="/attendance" icon="calendar2-check">Absensi</Item>
              <Item to="/reports" icon="file-earmark-bar-graph">Laporan Bulanan</Item>
              <div className="grp">Keanggotaan</div>
              <Item to="/trials" icon="hourglass-split">Data Trial</Item>
            </>
          ) : <div className="grp">Keanggotaan</div>}
          <Item to="/members" icon="award">Data Member</Item>
          <Item to="/payments" icon="cash-coin">Payment Member</Item>
          <Item to="/payments/proofs" icon="receipt">Bukti Bayar{pendingProofs > 0 && <span className="nbadge">{pendingProofs}</span>}</Item>
          {isAdmin && (
            <>
              <div className="grp">Tim</div>
              <Item to="/coaches" icon="person-badge">Data Coach</Item>
              <Item to="/coach-attendance" icon="clipboard2-check">Absen Coach</Item>
            </>
          )}
          <div className="grp">Sistem</div>
          <Item to="/settings" icon="gear">Pengaturan</Item>
        </nav>
        <div className="me">
          <div className="a">{(profile?.name || 'A').charAt(0).toUpperCase()}</div>
          <div><b>{profile?.name}</b><small>{isAdmin ? 'Admin' : 'Bendahara'}</small></div>
        </div>
        <div className="out"><button onClick={signOut}><i className="bi bi-box-arrow-left" /> Keluar</button></div>
      </aside>

      <main>
        <header className="top">
          <button type="button" className="burger" onClick={() => setOpen((o) => !o)} aria-label="Buka menu" aria-expanded={open}><i className="bi bi-list" /></button>
          <div>
            <h1 className="disp">{title}</h1>
            <p>{fmtDate.format(now)} · <b>{fmtClock.format(now).replace(/:/g, '.')}</b> WITA</p>
          </div>
          <div className="tools">
            {isAdmin && (
              <>
                <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }}>
                  <i className="bi bi-search" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari murid atau coach" autoComplete="off" />
                </form>
                {bdays > 0 && <Link to="/dashboard" className="bell"><i className="bi bi-cake2" /> {bdays} ulang tahun hari ini</Link>}
              </>
            )}
            <button type="button" className="theme" onClick={toggleTheme} title="Ganti mode terang / gelap" aria-label="Ganti mode terang atau gelap">
              <i className="bi bi-moon-stars moon" /><i className="bi bi-sun sun" />
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </TitleCtx.Provider>
  );
}
