import { Link } from 'react-router-dom';
import { fetchAll } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Avatar, Chip, Empty, ErrorBox, Loading, useTitle } from '../components/ui';
import * as U from '../lib/utils';

export default function Members() {
  useTitle('Data Member');
  const { isAdmin } = useAuth();
  const { data, loading, error } = useData(() => fetchAll('students', '*', (q) => q.eq('status', 'member')), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const list = [...data].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="card" style={{ padding: '8px 12px', overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Member</th><th>Kategori</th><th>Member sejak</th><th>Orang tua</th><th>No. WA</th><th /></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td><div className="who"><Avatar photo={s.photo} name={s.name} /><div><b>{s.name}</b><small>{U.age(s.birth_date)} tahun</small></div></div></td>
              <td><Chip>KU {s.category}</Chip></td>
              <td>{s.member_since && U.fmtLong(s.member_since)}</td>
              <td>{s.parent_name}</td>
              <td>{s.parent_phone}</td>
              <td>{isAdmin && <Link className="btn ghost sm" to={`/students/${s.id}/edit`}>Edit</Link>}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6}><Empty>Belum ada member. Murid trial yang lanjut akan pindah ke sini.</Empty></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
