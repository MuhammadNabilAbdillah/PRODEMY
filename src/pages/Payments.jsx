import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAll, removeFile, supabase, upload } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, FileLink, Loading, WaBtn, useTitle, useToast } from '../components/ui';
import { paymentsPdf } from '../lib/exports';
import * as U from '../lib/utils';

function PayForm({ label, onSave }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <details className="pay">
      <summary className={`btn sm${label === 'Ubah bukti' ? ' ghost' : ''}`}>{label}</summary>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onSave(file); setBusy(false); }}>
        <label>Bukti pembayaran (foto/PDF)</label>
        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} style={{ marginBottom: 10 }} />
        <button className="btn sm" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
      </form>
    </details>
  );
}

/** Hapus file bukti hanya bila tidak dipakai pembayaran lain (satu transfer bisa untuk beberapa anak) */
async function dropProof(path, exceptId = -1) {
  if (!path) return;
  const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('proof', path).neq('id', exceptId);
  if (!count) await removeFile('proofs', path);
}

export default function Payments() {
  useTitle('Payment Member');
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const t = U.todayStr();
  const year = Math.max(2024, Math.min(2080, +sp.get('year') || +t.slice(0, 4)));
  const month = Math.max(1, Math.min(12, +sp.get('month') || +t.slice(5, 7)));
  const period = U.ymd(year, month), end = U.monthEnd(period);
  const go = (k, v) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n); };

  const { data, loading, error, reload } = useData(async () => {
    const [students, pays] = await Promise.all([fetchAll('students', '*', (q) => q.eq('status', 'member')), fetchAll('payments', '*', (q) => q.eq('period', period))]);
    return { students, payments: Object.fromEntries(pays.map((p) => [p.student_id, p])) };
  }, [period]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const members = data.students.filter((s) => s.member_since && s.member_since <= end).sort((a, b) => a.name.localeCompare(b.name));
  const paid = members.filter((m) => data.payments[m.id]), unpaid = members.filter((m) => !data.payments[m.id]);
  const income = paid.reduce((a, m) => a + data.payments[m.id].amount, 0), target = members.length * U.FEE;

  const pay = async (m, file) => {
    try {
      let proof = data.payments[m.id]?.proof || null;
      if (file) { if (proof) await dropProof(proof, data.payments[m.id]?.id); proof = await upload('proofs', 'proofs', file); }
      const { error: e } = await supabase.from('payments').upsert({ student_id: m.id, period, amount: U.FEE, paid_at: t, proof }, { onConflict: 'student_id,period' });
      if (e) throw e;
      toast(`Pembayaran ${m.name} bulan ${U.monthLabel(period)} dicatat lunas.`); reload();
    } catch (x) { toast.error(U.cleanMsg(x)); }
  };
  const cancel = async (m) => {
    if (!(await toast.confirm('Kembalikan ke belum bayar?', { title: 'Batalkan pembayaran', okText: 'Ya, kembalikan', danger: true }))) return;
    const p = data.payments[m.id];
    const { error: e } = await supabase.from('payments').delete().eq('id', p.id);
    if (e) return toast.error(U.cleanMsg(e));
    await dropProof(p.proof); toast('Status pembayaran dikembalikan menjadi belum bayar.'); reload();
  };

  return (
    <>
      <div className="bar">
        <select value={month} onChange={(e) => go('month', e.target.value)}>{U.MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select value={year} onChange={(e) => go('year', e.target.value)}>{U.YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <Link className="btn ghost" to="/payments/proofs"><i className="bi bi-receipt" /> Bukti dari orang tua</Link>
        <Link className="btn ghost sp" to="/payments/arrears"><i className="bi bi-exclamation-circle" /> Tunggakan</Link>
        <button className="btn dark" onClick={() => paymentsPdf({ period, members, paid, unpaid, payments: data.payments, income, target })}><i className="bi bi-file-earmark-pdf" /> Download laporan PDF</button>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat c1"><div className="n">{paid.length}</div><span>Sudah bayar</span></div>
        <div className="card stat c4"><div className="n">{unpaid.length}</div><span>Belum bayar</span></div>
        <div className="card stat c5"><div className="n" style={{ fontSize: 36 }}>{U.rupiah(income)}</div><span>Terkumpul</span></div>
        <div className="card stat"><div className="n" style={{ fontSize: 36 }}>{U.rupiah(target)}</div><span>Target ({U.rupiah(U.FEE)} × {members.length})</span></div>
      </div>

      <div className="card" style={{ padding: '8px 12px', overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Member</th><th>Kategori</th><th>Status {U.MONTHS[month - 1]}</th><th>Tanggal bayar</th><th>Bukti</th><th /></tr></thead>
          <tbody>
            {members.map((m) => {
              const p = data.payments[m.id];
              return (
                <tr key={m.id}>
                  <td><div className="who"><Avatar photo={m.photo} name={m.name} /><b>{m.name}</b></div></td>
                  <td><Chip>KU {m.category}</Chip></td>
                  <td>{p ? <Chip>Lunas</Chip> : <Chip tone="red">Belum bayar</Chip>}</td>
                  <td>{p ? U.fmtLong(p.paid_at) : '-'}</td>
                  <td>{p?.proof ? <FileLink bucket="proofs" path={p.proof} /> : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!p && <><WaBtn href={U.waLink(m.parent_phone, U.waIuran(m, U.monthLabel(period)))} />{' '}</>}
                    <PayForm label={p ? 'Ubah bukti' : 'Tandai lunas'} onSave={(f) => pay(m, f)} />{' '}
                    {p && <button className="btn red sm" onClick={() => cancel(m)}>Batalkan</button>}
                  </td>
                </tr>
              );
            })}
            {!members.length && <tr><td colSpan={6}><Empty>Belum ada member aktif pada bulan ini.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
