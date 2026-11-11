import { useSearchParams } from 'react-router-dom';
import { fetchAll } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Chip, Empty, ErrorBox, Loading, WaBtn, useTitle } from '../components/ui';
import { reportPdf } from '../lib/exports';
import * as U from '../lib/utils';

function build({ students, att, payments }, start) {
  const end = U.monthEnd(start);
  const active = U.activeAt(students, end);
  const isMember = (s) => s.member_since && s.member_since <= end;
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const hadir = (rows) => U.pct(rows.filter((a) => a.status === 'hadir').length, rows.length);

  const perKu = {};
  U.CATS.forEach((c) => {
    const list = active.filter((s) => s.category === c), rows = att.filter((a) => byId[a.student_id]?.category === c);
    const member = list.filter(isMember).length;
    perKu[c] = { total: list.length, member, trial: list.length - member, sessions: new Set(rows.map((a) => a.date)).size, rate: hadir(rows) };
  });

  const members = active.filter(isMember).sort((a, b) => a.name.localeCompare(b.name));
  const paidNow = new Set(payments.filter((p) => p.period === start).map((p) => p.student_id));
  const paidAll = new Set(payments.map((p) => `${p.student_id}|${p.period}`));
  const unpaid = members.filter((m) => !paidNow.has(m.id)).map((m) => {
    let due = 0;
    for (let d = U.monthStart(m.member_since); d <= start; d = U.addMonths(d, 1)) if (!paidAll.has(`${m.id}|${d}`)) due++;
    return { m, due };
  });
  const inMonth = (d) => d && d >= start && d <= end;

  return {
    start, perKu, unpaid, activeTotal: active.length, memberTotal: members.length,
    newStudents: students.filter((s) => inMonth(U.joinedAt(s))), newMembers: students.filter((s) => inMonth(s.member_since)),
    stopped: students.filter((s) => inMonth(U.stoppedAt(s))), rate: hadir(att), paidCount: members.length - unpaid.length,
    income: payments.filter((p) => p.period === start && members.some((m) => m.id === p.student_id)).reduce((a, p) => a + p.amount, 0),
    target: members.length * U.FEE,
  };
}

export default function Reports() {
  useTitle('Laporan Bulanan');
  const [sp, setSp] = useSearchParams();
  const t = U.todayStr();
  const year = Math.max(2024, Math.min(2080, +sp.get('year') || +t.slice(0, 4)));
  const month = Math.max(1, Math.min(12, +sp.get('month') || +t.slice(5, 7)));
  const start = U.ymd(year, month);
  const go = (k, v) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n); };

  const { data, loading, error } = useData(async () => {
    const [students, att, payments] = await Promise.all([
      fetchAll('students'), fetchAll('attendances', 'student_id,date,status', (q) => q.gte('date', start).lte('date', U.monthEnd(start))), fetchAll('payments', 'student_id,period,amount'),
    ]);
    return { students, att, payments };
  }, [start]);

  const r = data && build(data, start);
  return (
    <>
      <div className="bar">
        <select value={month} onChange={(e) => go('month', e.target.value)}>{U.MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select value={year} onChange={(e) => go('year', e.target.value)}>{U.YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <button className="btn sp" disabled={!r} onClick={() => reportPdf(r)}><i className="bi bi-file-earmark-pdf" /> Download laporan PDF</button>
      </div>
      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <div className="card stat c5"><div className="n">{r.activeTotal}</div><span>Murid aktif akhir bulan</span></div>
            <div className="card stat c1"><div className="n">{r.newStudents.length}</div><span>Murid baru</span></div>
            <div className="card stat c4"><div className="n">{r.stopped.length}</div><span>Berhenti</span></div>
            <div className="card stat"><div className="n">{r.rate}%</div><span>Rata-rata kehadiran</span></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
            <div className="card" style={{ padding: '8px 12px' }}>
              <h3 className="disp" style={{ fontSize: 22, padding: '12px 8px 0' }}>Per kategori</h3>
              <table>
                <thead><tr><th>Kategori</th><th>Murid</th><th>Member</th><th>Trial</th><th>Kehadiran</th></tr></thead>
                <tbody>{U.CATS.map((c) => <tr key={c}><td><b>KU {c}</b></td><td>{r.perKu[c].total}</td><td>{r.perKu[c].member}</td><td>{r.perKu[c].trial}</td><td>{r.perKu[c].sessions ? r.perKu[c].rate + '%' : '-'}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="card">
              <h3 className="disp" style={{ fontSize: 22 }}>Pemasukan {U.MONTHS[month - 1]}</h3>
              <div className="money">{U.rupiah(r.income)}</div>
              <p style={{ color: 'var(--mut)', marginTop: 6 }}>dari target {U.rupiah(r.target)} · {r.paidCount} dari {r.memberTotal} member sudah bayar</p>
              <div className="track" style={{ marginTop: 12 }}><div style={{ height: '100%', width: `${U.pct(r.income, r.target)}%`, background: 'var(--g)', borderRadius: 99 }} /></div>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: 16 }}>
            {[['Murid baru', r.newStudents, ''], ['Member baru', r.newMembers, ''], ['Berhenti', r.stopped, 'red']].map(([title, list, tone]) => (
              <div className="card" key={title}>
                <h3 className="disp" style={{ fontSize: 20 }}>{title} ({list.length})</h3>
                {list.length ? list.map((s) => <div className="bd" key={s.id}><b>{s.name}</b><Chip tone={tone} className="tag">KU {s.category}</Chip></div>) : <Empty>Tidak ada.</Empty>}
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 16, padding: '8px 12px', overflowX: 'auto' }}>
            <h3 className="disp" style={{ fontSize: 22, padding: '12px 8px 0' }}>Belum bayar bulan {U.MONTHS[month - 1]} ({r.unpaid.length})</h3>
            <table>
              <thead><tr><th>Member</th><th>Kategori</th><th>Total bulan belum bayar</th><th /></tr></thead>
              <tbody>
                {r.unpaid.map((u) => (
                  <tr key={u.m.id}><td><b>{u.m.name}</b></td><td><Chip>KU {u.m.category}</Chip></td><td><Chip tone={u.due > 1 ? 'red' : 'amb'}>{u.due} bulan</Chip></td>
                    <td><WaBtn href={U.waLink(u.m.parent_phone, U.waIuran(u.m, U.monthLabel(start)))} /></td></tr>
                ))}
                {!r.unpaid.length && <tr><td colSpan={4}><Empty>Semua member sudah membayar.</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
