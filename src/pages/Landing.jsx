import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getSavedName } from '../lib/portal';
import { PriceTable, ThemeBtn } from '../components/PublicShell';
import { useTitle } from '../components/ui';

/** Halaman depan (tanpa login): pilih daftar atau sudah mendaftar, admin login di bawah */
export default function Landing() {
  useTitle('Beranda');
  const { session, profile } = useAuth();
  const saved = getSavedName();

  return (
    <div className="login land">
      <div className="land-theme"><ThemeBtn /></div>
      <div className="land-in">
        <span className="logo-tile big"><img src="/images/logo.png" alt="Brother Academy" /></span>
        <h1 className="disp">BROTHER ACADEMY</h1>
        <p className="land-sub">Pendaftaran dan portal orang tua. Latihan setiap hari yang dijadwalkan, pukul 16.00 - 17.30 WITA.</p>

        <div className="land-choices">
          <Link to="/daftar" className="land-card main">
            <i className="bi bi-person-plus" />
            <b>Daftar Academy</b>
            <span>Daftarkan satu anak atau lebih sekaligus</span>
          </Link>
          <Link to={saved ? '/anak' : '/masuk'} className="land-card">
            <i className="bi bi-person-check" />
            <b>Sudah Mendaftar</b>
            <span>{saved ? 'Lanjut ke dashboard anak' : 'Lihat kehadiran, jadwal, dan pembayaran'}</span>
          </Link>
        </div>

        <PriceTable />

        <div className="land-admin">
          {session && profile
            ? <Link to={profile.role === 'admin' ? '/dashboard' : '/payments'}><i className="bi bi-speedometer2" /> Buka dashboard admin</Link>
            : <Link to="/login"><i className="bi bi-shield-lock" /> Login sebagai admin</Link>}
        </div>
      </div>
    </div>
  );
}
