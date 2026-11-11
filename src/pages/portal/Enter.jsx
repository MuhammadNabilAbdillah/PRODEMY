import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicShell from '../../components/PublicShell';
import { useTitle, useToast } from '../../components/ui';
import * as P from '../../lib/portal';
import * as U from '../../lib/utils';

/** "Sudah mendaftar": tulis nama lengkap DAN tanggal lahir anak. Keduanya harus cocok, supaya anak yang namanya sama tidak membuka data orang lain. */
export default function Enter() {
  useTitle('Sudah Mendaftar');
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const nm = name.trim().replace(/\s+/g, ' ');
    if (nm.length < 2 || !birth) return;
    setBusy(true);
    try {
      const data = await P.loadPortal(nm, birth);
      if (!data.children.length) return toast.error('Nama dan tanggal lahir tidak cocok dengan data pendaftaran. Tulis nama lengkap persis seperti saat mendaftar.');
      P.saveName(nm, birth);
      nav('/anak');
    } catch (x) { toast.error(P.cleanErr(x)); } finally { setBusy(false); }
  };

  return (
    <PublicShell>
      <form className="card pb-enter" onSubmit={submit}>
        <span className="pb-ok soft"><i className="bi bi-person-check" /></span>
        <h1 className="disp">Sudah Mendaftar</h1>
        <p className="pb-mut">Tulis nama lengkap dan tanggal lahir anak untuk melihat kehadiran, jadwal latihan, dan pembayaran.</p>
        <label htmlFor="cn">Nama lengkap anak</label>
        <input id="cn" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" placeholder="Contoh: Muhammad Rafi Pratama" />
        <label htmlFor="cb">Tanggal lahir anak</label>
        <input id="cb" type="date" max={U.todayStr()} value={birth} onChange={(e) => setBirth(e.target.value)} />
        <button className="btn" disabled={busy || name.trim().length < 2 || !birth}>{busy ? 'Mencari...' : 'Masuk ke dashboard'}</button>
        <p className="pb-mut pb-fine">Belum mendaftar? <Link to="/daftar" style={{ color: 'var(--gd)', fontWeight: 700 }}>Daftar Academy</Link></p>
      </form>
    </PublicShell>
  );
}
