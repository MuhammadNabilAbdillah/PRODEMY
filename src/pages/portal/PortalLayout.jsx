import { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import PublicShell from '../../components/PublicShell';
import { useData } from '../../lib/hooks';
import * as P from '../../lib/portal';

/** Dipakai halaman anak untuk mengambil data: { children, child, setChildId, name, familyKids } */
export const usePortal = () => useOutletContext();

/** Pembungkus halaman orang tua: butuh nama anak yang sudah tersimpan, memuat data, lalu menampilkan menu */
export default function PortalLayout() {
  const nav = useNavigate();
  const name = P.getSavedName();
  const birth = P.getSavedBirth();
  const [childId, setChildId] = useState(null);
  const { data, loading, error, reload, refresh } = useData(() => {
    const n = P.getSavedName(), b = P.getSavedBirth(); // dibaca saat dipanggil, supaya tanggal lahir yang baru diubah ikut terbaca
    return n && b ? P.loadPortal(n, b) : Promise.resolve(null);
  }, [name, birth]);

  const logout = () => { P.clearName(); nav('/', { replace: true }); };

  if (!name || !birth) return <Navigate to="/masuk" replace />;

  const exit = <button type="button" className="btn glass sm" onClick={logout}><i className="bi bi-box-arrow-left" /> Keluar</button>;

  if (loading) return <PublicShell back={null} right={exit}><div className="empty">Memuat data...</div></PublicShell>;
  if (error) return (
    <PublicShell back={null} right={exit}>
      <div className="alert red">Gagal memuat data: {P.cleanErr(error)}</div>
      <button className="btn" onClick={reload}>Coba lagi</button>
    </PublicShell>
  );
  const children = data?.children || [];
  if (!children.length) return (
    <PublicShell back={null}>
      <div className="card pb-enter">
        <h1 className="disp">Data tidak ditemukan</h1>
        <p className="pb-mut">Nama dan tanggal lahir yang tersimpan tidak cocok dengan data academy. Masuk ulang dengan nama lengkap dan tanggal lahir anak.</p>
        <button className="btn" onClick={logout}>Kembali</button>
      </div>
    </PublicShell>
  );

  const child = children.find((c) => c.id === childId) || children[0];
  const nav2 = (
    <nav className="pub-nav">
      <NavLink to="/anak" end className={({ isActive }) => (isActive ? 'on' : '')}><i className="bi bi-grid-1x2" /> Dashboard</NavLink>
      <NavLink to="/anak/pembayaran" className={({ isActive }) => (isActive ? 'on' : '')}><i className="bi bi-cash-coin" /> Pembayaran Member</NavLink>
    </nav>
  );

  return (
    <PublicShell back={null} right={exit} nav={nav2}>
      <Outlet context={{ children, child, setChildId, name, reload: refresh }} />
    </PublicShell>
  );
}
