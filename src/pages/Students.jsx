import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAll, supabase, removeFile } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, Loading, useTitle, useToast } from '../components/ui';
import { studentsExcel, studentsPdf } from '../lib/exports';
import * as U from '../lib/utils';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Students() {
  useTitle('Data Academy');
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const category = sp.get('category') || '', status = sp.get('status') || '', q = sp.get('q') || '';
  const [text, setText] = useState(q);
  const { data, loading, error, reload } = useData(() => fetchAll('students'), []);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n); };

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const byName = (a, b) => a.name.localeCompare(b.name);
  const list = data.filter((s) => (!category || s.category === category) && (!status || s.status === status) && (!q || s.name.toLowerCase().includes(q.toLowerCase()))).sort(byName);

  const pdf = (c) => { const rows = data.filter((s) => !c || s.category === c).sort(byName); studentsPdf(rows, c ? `KU ${c}` : 'Semua Kategori'); };
  const del = async (s) => {
    if (!(await toast.confirm(`Hapus data ${s.name}? Riwayat absensi dan pembayarannya ikut terhapus.`, { title: 'Hapus data murid', okText: 'Ya, hapus', danger: true }))) return;
    const { error: e } = await supabase.from('students').delete().eq('id', s.id);
    if (e) return toast.error(U.cleanMsg(e));
    await removeFile('photos', s.photo); toast('Data murid berhasil dihapus.'); reload();
  };

  return (
    <>
      <div className="tabs">
        <a className={`tab${!category ? ' on' : ''}`} onClick={() => set('category', '')} href="#semua">Semua</a>
        {U.CATS.map((c) => <a key={c} href={`#ku${c}`} className={`tab${category === c ? ' on' : ''}`} onClick={(e) => { e.preventDefault(); set('category', c); }}>KU {c}</a>)}
      </div>
      <form className="bar" onSubmit={(e) => { e.preventDefault(); set('q', text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Cari nama murid" />
        <select value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Semua status</option><option value="trial">Trial</option><option value="member">Member</option><option value="berhenti">Berhenti</option>
        </select>
        <button className="btn ghost">Cari</button>
        <span className="sp" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <details className="dd"><summary className="btn ghost"><i className="bi bi-file-earmark-pdf" /> Download PDF</summary>
            <div className="menu">
              <a href="#pdf" onClick={(e) => { e.preventDefault(); pdf(''); }}>Semua kategori</a>
              {U.CATS.map((c) => <a key={c} href="#pdf" onClick={(e) => { e.preventDefault(); pdf(c); }}>Hanya KU {c}</a>)}
            </div></details>
          <button type="button" className="btn ghost" onClick={() => studentsExcel(list, category ? `ku-${category}` : 'semua')}><i className="bi bi-file-earmark-excel" /> Excel</button>
          <Link className="btn ghost" to="/students/import"><i className="bi bi-upload" /> Impor</Link>
          <Link className="btn" to="/students/new"><i className="bi bi-plus-lg" /> Tambah murid</Link>
        </span>
      </form>

      <div className="card" style={{ padding: '8px 12px', overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Murid</th><th>Kategori</th><th>Tanggal lahir</th><th>Orang tua</th><th>No. WA</th><th /></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td><div className="who"><Avatar photo={s.photo} name={s.name} /><div><Link to={`/students/${s.id}`}><b>{s.name}</b></Link><small>{U.age(s.birth_date)} tahun</small></div></div></td>
                <td><Chip>KU {s.category}</Chip> <Chip tone={U.STATUS_CHIP[s.status]}>{cap(s.status)}</Chip></td>
                <td>{U.fmtLong(s.birth_date)}</td>
                <td>{s.parent_name}<small style={{ display: 'block', color: 'var(--mut)' }}>{s.parent_job}</small></td>
                <td><a target="_blank" rel="noreferrer" href={U.waLink(s.parent_phone, '')} style={{ color: 'var(--gd)', fontWeight: 700 }}><i className="bi bi-whatsapp" /> {s.parent_phone}</a></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <Link className="btn ghost sm" to={`/students/${s.id}`}>Profil</Link>{' '}
                  <Link className="btn ghost sm" to={`/students/${s.id}/edit`}>Edit</Link>{' '}
                  <button className="btn red sm" onClick={() => del(s)}>Hapus</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7}><Empty>Belum ada data murid yang cocok.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
