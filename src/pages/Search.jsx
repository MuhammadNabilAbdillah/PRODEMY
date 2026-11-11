import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, Loading, useTitle } from '../components/ui';
import * as U from '../lib/utils';

export default function Search() {
  useTitle('Pencarian');
  const [sp] = useSearchParams();
  const q = (sp.get('q') || '').trim().replace(/[,()%*]/g, ' ');
  const { data, loading, error } = useData(async () => {
    if (!q) return { students: [], coaches: [] };
    const like = `%${q}%`;
    const [s, c] = await Promise.all([
      supabase.from('students').select('*').or(`name.ilike.${like},parent_name.ilike.${like},parent_phone.ilike.${like}`).order('name'),
      supabase.from('coaches').select('*').or(`name.ilike.${like},phone.ilike.${like}`).order('name'),
    ]);
    if (s.error || c.error) throw s.error || c.error;
    return { students: s.data, coaches: c.data };
  }, [q]);

  if (!q) return <div className="card"><Empty>Ketik nama atau nomor WA di kolom pencarian di bagian atas.</Empty></div>;
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="disp" style={{ fontSize: 22 }}>Murid ({data.students.length})</h3>
        {data.students.length ? data.students.map((s) => (
          <Link className="bd" to={`/students/${s.id}`} key={s.id}>
            <Avatar photo={s.photo} name={s.name} />
            <div><b>{s.name}</b><small style={{ display: 'block', color: 'var(--mut)' }}>Orang tua: {s.parent_name} · {s.parent_phone}</small></div>
            <span className="tag" style={{ display: 'flex', gap: 6 }}><Chip>KU {s.category}</Chip><Chip tone={U.STATUS_CHIP[s.status]}>{s.status[0].toUpperCase() + s.status.slice(1)}</Chip></span>
          </Link>
        )) : <Empty>Tidak ada murid yang cocok dengan "{q}".</Empty>}
      </div>
      <div className="card">
        <h3 className="disp" style={{ fontSize: 22 }}>Coach ({data.coaches.length})</h3>
        {data.coaches.length ? data.coaches.map((c) => (
          <Link className="bd" to={`/coaches/${c.id}`} key={c.id}>
            <Avatar photo={c.photo} name={c.name} />
            <div><b>{c.name}</b><small style={{ display: 'block', color: 'var(--mut)' }}>{c.phone}</small></div>
            <Chip className="tag">{c.role}</Chip>
          </Link>
        )) : <Empty>Tidak ada coach yang cocok.</Empty>}
      </div>
    </>
  );
}
