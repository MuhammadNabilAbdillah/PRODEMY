import { Link } from 'react-router-dom';
import { fetchAll, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, Loading, WaBtn, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

export default function Trials() {
  useTitle('Data Trial');
  const toast = useToast();
  const { data, loading, error, reload } = useData(() => fetchAll('students', '*', (q) => q.eq('status', 'trial')), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const list = [...data].sort((a, b) => U.trialDaysLeft(a) - U.trialDaysLeft(b));
  const expired = list.filter((s) => U.trialDaysLeft(s) < 0).length;
  const soon = list.filter((s) => { const d = U.trialDaysLeft(s); return d >= 0 && d <= 7; }).length;

  const convert = async (s) => {
    if (!(await toast.confirm(`Jadikan ${s.name} member? Iuran ${U.rupiah(U.FEE)}/bulan.`, { title: 'Jadikan member', okText: 'Ya, jadikan member' }))) return;
    const { error: e } = await supabase.from('students').update({ status: 'member', member_since: U.todayStr() }).eq('id', s.id);
    if (e) return toast.error(U.cleanMsg(e));
    toast(`${s.name} sekarang menjadi member. Iuran ${U.rupiah(U.FEE)}/bulan.`); reload();
  };
  const stop = async (s) => {
    if (!(await toast.confirm(`Tandai ${s.name} tidak lanjut?`, { title: 'Tidak lanjut', okText: 'Ya, tandai', danger: true }))) return;
    const { error: e } = await supabase.from('students').update({ status: 'berhenti', stopped_at: U.todayStr() }).eq('id', s.id);
    if (e) return toast.error(U.cleanMsg(e));
    toast(`${s.name} ditandai tidak lanjut (berhenti).`); reload();
  };

  return (
    <>
      {expired > 0 && <div className="alert red">{expired} murid masa trial gratisnya sudah habis. Konfirmasi lanjut menjadi member atau tandai tidak lanjut.</div>}
      {soon > 0 && <div className="alert amb">{soon} murid masa trialnya akan habis dalam 7 hari.</div>}
      <div className="card" style={{ padding: '8px 12px', overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Murid</th><th>Kategori</th><th>Tanggal daftar</th><th>Trial berakhir</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((s) => {
              const d = U.trialDaysLeft(s);
              return (
                <tr key={s.id}>
                  <td><div className="who"><Avatar photo={s.photo} name={s.name} /><div><b>{s.name}</b>{s.source === 'online' && <> <Chip tone="blue">Daftar online · {s.plan === 'member' ? 'Member' : 'Reguler'}</Chip></>}<small>{s.parent_name} · {s.parent_phone}</small></div></div></td>
                  <td><Chip>KU {s.category}</Chip></td>
                  <td>{U.fmtLong(U.joinedAt(s))}</td>
                  <td>{U.fmtLong(U.trialEnds(s))}</td>
                  <td>{d < 0 ? <Chip tone="red">Trial habis {Math.abs(d)} hari lalu</Chip> : d <= 7 ? <Chip tone="amb">Habis {d === 0 ? 'hari ini' : `${d} hari lagi`}</Chip> : <Chip>Trial aktif · {d} hari lagi</Chip>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <WaBtn href={U.waLink(s.parent_phone, U.waTrial(s))} />{' '}
                    <button className="btn sm" onClick={() => convert(s)}>Lanjut jadi member</button>{' '}
                    <button className="btn red sm" onClick={() => stop(s)}>Tidak lanjut</button>{' '}
                    <Link className="btn ghost sm" to={`/students/${s.id}/edit`}>Edit</Link>
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={6}><Empty>Tidak ada murid trial saat ini.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
