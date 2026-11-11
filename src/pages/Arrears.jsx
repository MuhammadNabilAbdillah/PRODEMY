import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAll, supabase, upload } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, Loading, WaBtn, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

function Row({ m, due, overdue, onDone }) {
  const toast = useToast();
  const [sel, setSel] = useState(due);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const total = due.length * U.FEE;
  const label = due.map(U.monthLabel).join(', ');
  const toggle = (d) => setSel(sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d]);

  const submit = async (e) => {
    e.preventDefault();
    if (!sel.length) return toast.error('Pilih minimal satu bulan yang dibayar.');
    setBusy(true);
    try {
      let first = file ? await upload('proofs', 'proofs', file) : null;
      const rows = [];
      for (let i = 0; i < sel.length; i++) {
        let proof = first;
        if (first && i > 0) { // salinan terpisah agar membatalkan satu bulan tidak menghapus bukti bulan lain
          proof = `proofs/${crypto.randomUUID()}.${first.split('.').pop()}`;
          const { error } = await supabase.storage.from('proofs').copy(first, proof);
          if (error) throw error;
        }
        rows.push({ student_id: m.id, period: sel[i], amount: U.FEE, paid_at: U.todayStr(), proof });
      }
      const { error } = await supabase.from('payments').upsert(rows, { onConflict: 'student_id,period' });
      if (error) throw error;
      toast(`${sel.length} bulan pembayaran ${m.name} dicatat lunas.`); onDone();
    } catch (x) { toast.error(U.cleanMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="who" style={{ flexWrap: 'wrap' }}>
        <Avatar photo={m.photo} name={m.name} />
        <div style={{ flex: 1, minWidth: 200 }}><b style={{ fontSize: 16 }}>{m.name}</b><small>KU {m.category} · member sejak {U.monthLabel(m.member_since)}</small></div>
        <Chip tone={overdue > 1 ? 'red' : 'amb'}>{due.length} bulan belum bayar · {U.rupiah(total)}</Chip>
        <WaBtn href={U.waLink(m.parent_phone, U.waIuran(m, label, total))}>Ingatkan</WaBtn>
      </div>
      <form onSubmit={submit} style={{ marginTop: 14 }}>
        <label>Pilih bulan yang dibayar sekarang</label>
        <div className="checks" style={{ marginBottom: 12 }}>
          {due.map((d) => <label key={d}><input type="checkbox" checked={sel.includes(d)} onChange={() => toggle(d)} /> {U.monthLabel(d)}</label>)}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} style={{ maxWidth: 320 }} />
          <button className="btn sm" disabled={busy}>{busy ? 'Menyimpan...' : 'Tandai lunas bulan terpilih'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Arrears() {
  useTitle('Tunggakan Member');
  const { data, loading, error, reload } = useData(async () => {
    const [students, pays] = await Promise.all([fetchAll('students', '*', (q) => q.eq('status', 'member')), fetchAll('payments', 'student_id,period')]);
    return { students, paid: new Set(pays.map((p) => `${p.student_id}|${p.period}`)) };
  }, []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const thisMonth = U.monthStart(U.todayStr());
  const rows = data.students.filter((m) => m.member_since).map((m) => {
    const due = [];
    for (let d = U.monthStart(m.member_since); d <= thisMonth; d = U.addMonths(d, 1)) if (!data.paid.has(`${m.id}|${d}`)) due.push(d);
    return { m, due, overdue: due.filter((d) => d < thisMonth).length };
  }).filter((r) => r.due.length).sort((a, b) => b.overdue - a.overdue);

  return (
    <>
      <div className="bar"><Link className="btn ghost" to="/payments"><i className="bi bi-arrow-left" /> Kembali ke Payment</Link></div>
      {rows.length ? rows.map((r) => <Row key={r.m.id} {...r} onDone={reload} />) : <div className="card"><Empty>Tidak ada tunggakan. Semua member sudah membayar sampai bulan ini.</Empty></div>}
    </>
  );
}
