import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicShell from '../../components/PublicShell';
import { useTitle, useToast } from '../../components/ui';
import * as P from '../../lib/portal';

/** "Sudah mendaftar": cukup tulis nama lengkap anak, lalu masuk ke dashboard */
export default function Enter() {
  useTitle('Sudah Mendaftar');
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const nm = name.trim().replace(/\s+/g, ' ');
    if (nm.length < 2) return;
    setBusy(true);
    try {
      const data = await P.loadPortal(nm);
      if (!data.children.length) return toast.error('Nama anak tidak ditemukan. Tulis nama lengkap persis seperti saat mendaftar.');
      P.saveName(nm);
      nav('/anak');
    } catch (x) { toast.error(P.cleanErr(x)); } finally { setBusy(false); }
  };

  return (
    <PublicShell>
      <form className="card pb-enter" onSubmit={submit}>
        <span className="pb-ok soft"><i className="bi bi-person-check" /></span>
        <h1 className="disp">Sudah Mendaftar</h1>
        <p className="pb-mut">Tulis nama lengkap anak untuk melihat kehadiran, jadwal latihan, dan pembayaran.</p>
        <label htmlFor="cn">Nama lengkap anak</label>
        <input id="cn" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" placeholder="Contoh: Muhammad Rafi Pratama" />
        <button className="btn" disabled={busy || name.trim().length < 2}>{busy ? 'Mencari...' : 'Masuk ke dashboard'}</button>
        <p className="pb-mut pb-fine">Belum mendaftar? <Link to="/daftar" style={{ color: 'var(--gd)', fontWeight: 700 }}>Daftar Academy</Link></p>
      </form>
    </PublicShell>
  );
}
