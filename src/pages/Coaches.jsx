import { Link } from 'react-router-dom';
import { fetchAll, removeFile, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, Loading, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

export default function Coaches() {
  useTitle('Data Coach');
  const toast = useToast();
  const { data, loading, error, reload } = useData(() => fetchAll('coaches'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const list = [...data].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));

  const del = async (c) => {
    if (!(await toast.confirm(`Hapus ${c.name}?`, { title: 'Hapus data coach', okText: 'Ya, hapus', danger: true }))) return;
    const { error: e } = await supabase.from('coaches').delete().eq('id', c.id);
    if (e) return toast.error(U.cleanMsg(e));
    await removeFile('photos', c.photo); toast('Data coach berhasil dihapus.'); reload();
  };

  return (
    <>
      <div className="bar"><Link className="btn sp" to="/coaches/new"><i className="bi bi-plus-lg" /> Tambah coach</Link></div>
      <div className="cgrid">
        {list.map((c) => (
          <div className="card coach" key={c.id}>
            <Link to={`/coaches/${c.id}`} className="coach-link" aria-label={`Lihat detail ${c.name}`}>
              <Avatar photo={c.photo} name={c.name} />
              <b className="coach-name">{c.name}</b>
              <Chip>{c.role}</Chip>
            </Link>
            <ul className="coach-info">
              <li><i className="bi bi-cake2" /> {U.fmtLong(c.birth_date)}</li>
              <li><i className="bi bi-telephone" /> {c.phone}</li>
            </ul>
            <div className="coach-acts">
              <Link className="btn sm" to={`/coaches/${c.id}`}><i className="bi bi-person-lines-fill" /> Detail</Link>
              <Link className="btn ghost sm" to={`/coaches/${c.id}/edit`}>Edit</Link>
              <button className="btn red sm" onClick={() => del(c)} aria-label={`Hapus ${c.name}`}><i className="bi bi-trash" /></button>
            </div>
          </div>
        ))}
        {!list.length && <div className="card" style={{ gridColumn: '1/-1' }}><Empty>Belum ada data coach.</Empty></div>}
      </div>
    </>
  );
}
