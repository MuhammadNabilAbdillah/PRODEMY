import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAll, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Chip, Empty, ErrorBox, FileLink, Loading, WaBtn, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

const TABS = [['menunggu', 'Menunggu verifikasi'], ['disetujui', 'Disetujui'], ['ditolak', 'Ditolak']];
const TONE = { menunggu: 'amb', disetujui: '', ditolak: 'red' };
const LABEL = { menunggu: 'Sudah bayar, menunggu verifikasi', disetujui: 'Lunas', ditolak: 'Ditolak' };
const when = (iso) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export default function Submissions() {
  useTitle('Bukti Bayar');
  const toast = useToast();
  const [tab, setTab] = useState('menunggu');
  const [busyId, setBusyId] = useState(null);

  const { data, loading, error, reload } = useData(async () => {
    const [subs, students] = await Promise.all([
      fetchAll('payment_submissions'),
      fetchAll('students', 'id,name,category,parent_name,parent_phone'),
    ]);
    subs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { subs, byId: Object.fromEntries(students.map((s) => [s.id, s])) };
  }, []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const count = (st) => data.subs.filter((s) => s.status === st).length;
  const list = data.subs.filter((s) => s.status === tab);

  const approve = async (s, kids) => {
    const names = kids.map((k) => k.name).join(', ');
    if (!(await toast.confirm(`Setujui bukti pembayaran ${names} sebesar ${U.rupiah(s.amount)}? Status ${U.monthLabel(s.period)} akan menjadi Lunas.`, { title: 'Setujui pembayaran', okText: 'Ya, tandai lunas' }))) return;
    setBusyId(s.id);
    const { error: e } = await supabase.rpc('approve_payment_submission', { p_id: s.id });
    setBusyId(null);
    if (e) return toast.error(U.cleanMsg(e));
    toast(`Pembayaran ${names} bulan ${U.monthLabel(s.period)} dicatat lunas.`); reload();
  };
  const reject = async (s) => {
    const reason = window.prompt('Alasan penolakan (boleh dikosongkan, akan terlihat oleh orang tua):');
    if (reason === null) return;
    setBusyId(s.id);
    const { error: e } = await supabase.rpc('reject_payment_submission', { p_id: s.id, p_reason: reason });
    setBusyId(null);
    if (e) return toast.error(U.cleanMsg(e));
    toast('Bukti pembayaran ditolak.'); reload();
  };

  return (
    <>
      <div className="bar">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" className={`btn sm${tab === k ? '' : ' ghost'}`} onClick={() => setTab(k)}>
            {label} ({count(k)})
          </button>
        ))}
        <Link className="btn ghost sp" to="/payments"><i className="bi bi-cash-coin" /> Payment Member</Link>
      </div>

      <div className="card" style={{ padding: '8px 12px', overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Dikirim</th><th>Anak</th><th>Periode</th><th>Jumlah</th><th>Status</th><th>Bukti</th><th /></tr></thead>
          <tbody>
            {list.map((s) => {
              const kids = s.student_ids.map((id) => data.byId[id]).filter(Boolean);
              const parent = kids[0];
              return (
                <tr key={s.id}>
                  <td>{when(s.created_at)}</td>
                  <td>
                    {kids.map((k) => <div key={k.id}><b>{k.name}</b> <Chip>KU {k.category}</Chip></div>)}
                    {parent && <small style={{ color: 'var(--mut)' }}>Orang tua: {parent.parent_name}</small>}
                    {s.note && <div><small>Catatan: {s.note}</small></div>}
                  </td>
                  <td>{U.monthLabel(s.period)}</td>
                  <td><b>{U.rupiah(s.amount)}</b>{kids.length > 1 && <div><small>{kids.length} anak</small></div>}</td>
                  <td>
                    <Chip tone={TONE[s.status]}>{LABEL[s.status]}</Chip>
                    {s.status === 'ditolak' && s.reject_reason && <div><small>{s.reject_reason}</small></div>}
                  </td>
                  <td><FileLink bucket="proofs" path={s.proof} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {s.status === 'menunggu' && (
                      <>
                        <button className="btn sm" disabled={busyId === s.id} onClick={() => approve(s, kids)}>Setujui</button>{' '}
                        <button className="btn red sm" disabled={busyId === s.id} onClick={() => reject(s)}>Tolak</button>{' '}
                      </>
                    )}
                    {parent?.parent_phone && <WaBtn href={U.waLink(parent.parent_phone, `Halo Bapak/Ibu ${parent.parent_name}, salam dari Brother Academy. Terkait bukti pembayaran ${kids.map((k) => k.name).join(', ')} untuk ${U.monthLabel(s.period)}.`)} />}
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={7}><Empty>{tab === 'menunggu' ? 'Tidak ada bukti pembayaran yang menunggu verifikasi.' : 'Belum ada data.'}</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
