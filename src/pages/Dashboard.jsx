import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAll } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Avatar, Empty, ErrorBox, Loading, WaBtn, useTitle, Chip } from '../components/ui';
import * as U from '../lib/utils';

function compute({ students, payments, att, coaches }) {
  const t = U.todayStr(), ms = U.monthStart(t), me = U.monthEnd(t);
  const active = students.filter((s) => s.status !== 'berhenti');
  const counts = Object.fromEntries(U.CATS.map((c) => [c, active.filter((s) => s.category === c).length]));
  const trials = active.filter((s) => s.status === 'trial');
  const membersNow = active.filter((s) => s.status === 'member' && s.member_since && s.member_since <= me);
  const paidIds = new Set(payments.filter((p) => p.period === ms).map((p) => p.student_id));
  const monthAtt = att.filter((a) => a.date >= ms);

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const st = U.addMonths(ms, -i), en = U.monthEnd(st);
    const rows = att.filter((a) => a.date >= st && a.date <= en);
    trend.push({ label: U.shortMonth(st), income: payments.filter((p) => p.period === st).reduce((a, p) => a + p.amount, 0),
      rate: U.pct(rows.filter((a) => a.status === 'hadir').length, rows.length), students: U.activeAt(students, en).length });
  }

  const byStudent = {};
  [...att].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((a) => { (byStudent[a.student_id] ||= []).push(a); });
  const absentees = active.filter((s) => { const l = byStudent[s.id]; return l && l.length >= 3 && l.slice(0, 3).every((a) => a.status === 'alpa'); })
    .map((s) => ({ ...s, lastAbsent: byStudent[s.id][0].date }));

  const birthdays = active.map((s) => {
    const [y, m, d] = s.birth_date.split('-');
    let next = `${t.slice(0, 4)}-${m}-${d}`;
    if (next < t) next = `${+t.slice(0, 4) + 1}-${m}-${d}`;
    return { ...s, next, daysLeft: U.diffDays(t, next), turning: +next.slice(0, 4) - +y };
  }).filter((s) => s.daysLeft <= 7).sort((a, b) => a.daysLeft - b.daysLeft);

  const h = U.hourNow();
  return {
    t, active, counts, trend, absentees, birthdays,
    trialCount: trials.length,
    trialExpired: trials.filter((s) => U.trialDaysLeft(s) < 0),
    trialSoon: trials.filter((s) => { const d = U.trialDaysLeft(s); return d >= 0 && d <= 7; }),
    memberCount: active.filter((s) => s.status === 'member').length,
    unpaid: membersNow.filter((s) => !paidIds.has(s.id)).length,
    income: payments.filter((p) => p.period === ms).reduce((a, p) => a + p.amount, 0),
    rate: U.pct(monthAtt.filter((a) => a.status === 'hadir').length, monthAtt.length),
    todayCats: U.CATS.filter((c) => U.SCHEDULE[c].days.includes(U.weekday(t))),
    coachCount: coaches.length,
    greeting: h < 4 ? 'Selamat malam' : h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam',
    latest: [...students].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5),
  };
}

const SEG = { '3-6': '#34d27b', '6-9': '#19b8a6', '9-12': '#c9e43e' };
const METRICS = {
  income: { tab: 'Pemasukan', title: 'Pemasukan iuran per bulan', fmt: U.compactRp },
  rate: { tab: 'Kehadiran', title: 'Persentase kehadiran', fmt: (v) => v + '%', max: 100 },
  students: { tab: 'Murid', title: 'Jumlah murid aktif', fmt: (v) => v },
};

/** Garis kecil di bawah angka KPI */
function Spark({ data }) {
  const max = Math.max(...data), min = Math.min(...data), rng = Math.max(1, max - min);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 27 - ((v - min) / rng) * 22]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L100,32 L0,32 Z`} className="sp-area" />
      <path d={line} className="sp-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Grafik area halus untuk tren 6 bulan */
function TrendChart({ trend, metric }) {
  const m = METRICS[metric], W = 640, H = 250, L = 18, R = 18, T = 38, B = 34;
  const vals = trend.map((t) => t[metric]);
  const top = m.max || Math.max(1, ...vals) * 1.18;
  const X = (i) => L + (i * (W - L - R)) / Math.max(1, vals.length - 1);
  const Y = (v) => T + (1 - v / top) * (H - T - B);
  let path = `M${X(0)},${Y(vals[0])}`;
  for (let i = 1; i < vals.length; i++) { const mx = (X(i - 1) + X(i)) / 2; path += ` C${mx},${Y(vals[i - 1])} ${mx},${Y(vals[i])} ${X(i)},${Y(vals[i])}`; }
  const area = `${path} L${X(vals.length - 1)},${H - B} L${X(0)},${H - B} Z`;
  const last = vals.length - 1;
  return (
    <svg className="tc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={m.title}>
      <defs><linearGradient id="tcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--g)" stopOpacity=".32" /><stop offset="1" stopColor="var(--g)" stopOpacity="0" /></linearGradient></defs>
      {[0, .5, 1].map((f) => <line key={f} className="tc-grid" x1={L} x2={W - R} y1={T + f * (H - T - B)} y2={T + f * (H - T - B)} />)}
      <path d={area} fill="url(#tcg)" />
      <path d={path} className="tc-line" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle className={`tc-dot${i === last ? ' last' : ''}`} cx={X(i)} cy={Y(v)} r={i === last ? 6 : 4} />
          <text className={`tc-val${i === last ? ' last' : ''}`} x={X(i)} y={Y(v) - 14} textAnchor="middle">{m.fmt(v)}</text>
          <text className="tc-m" x={X(i)} y={H - 10} textAnchor="middle">{trend[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Garis lapangan basket sebagai latar hero */
const Court = () => (
  <svg className="court" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g fill="none">
      <rect x="30" y="30" width="740" height="340" rx="4" />
      <line x1="400" y1="30" x2="400" y2="370" />
      <circle cx="400" cy="200" r="56" />
      {/* sisi kiri */}
      <rect x="30" y="145" width="153" height="110" />
      <path d="M183 153a47 47 0 0 1 0 94" /><path d="M183 153a47 47 0 0 0 0 94" strokeDasharray="6 6" />
      <path d="M30 54H174A178 178 0 0 1 174 346H30" />
      <line x1="57" y1="180" x2="57" y2="220" /><circle cx="72" cy="200" r="9" /><path d="M72 167a33 33 0 0 1 0 66" />
      {/* sisi kanan */}
      <rect x="617" y="145" width="153" height="110" />
      <path d="M617 153a47 47 0 0 0 0 94" /><path d="M617 153a47 47 0 0 1 0 94" strokeDasharray="6 6" />
      <path d="M770 54H626A178 178 0 0 0 626 346H770" />
      <line x1="743" y1="180" x2="743" y2="220" /><circle cx="728" cy="200" r="9" /><path d="M728 167a33 33 0 0 0 0 66" />
    </g>
  </svg>
);

export default function Dashboard() {
  useTitle('Dashboard');
  const { profile } = useAuth();
  const [metric, setMetric] = useState('income');
  const { data, loading, error } = useData(async () => {
    const since = U.addMonths(U.monthStart(U.todayStr()), -6);
    const [students, payments, att, coaches] = await Promise.all([
      fetchAll('students'), fetchAll('payments', 'student_id,period,amount'),
      fetchAll('attendances', 'student_id,date,status', (q) => q.gte('date', since)), fetchAll('coaches', 'role'),
    ]);
    return { students, payments, att, coaches };
  }, []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const d = compute(data);
  const names = (l) => l.map((s) => s.name).slice(0, 3).join(', ') + (l.length > 3 ? ', dll.' : '');
  const month = U.MONTHS[+d.t.slice(5, 7) - 1];
  const prev = d.trend[d.trend.length - 2]?.income || 0, cur = d.trend[d.trend.length - 1].income;
  const delta = prev ? Math.round(((cur - prev) / prev) * 100) : null;

  const attention = [
    d.trialExpired.length > 0 && { tone: 'red', text: `${d.trialExpired.length} murid masa trialnya sudah habis`, sub: names(d.trialExpired), to: '/trials', cta: 'Putuskan' },
    d.trialSoon.length > 0 && { tone: 'amb', text: `${d.trialSoon.length} trial habis dalam 7 hari`, sub: names(d.trialSoon), to: '/trials', cta: 'Lihat' },
    d.unpaid > 0 && { tone: 'amb', text: `${d.unpaid} member belum bayar iuran ${month}`, sub: 'Kirim pengingat lewat WhatsApp', to: '/payments', cta: 'Kelola' },
    d.absentees.length > 0 && { tone: 'red', text: `${d.absentees.length} murid 3 kali berturut-turut tidak hadir`, sub: names(d.absentees), href: '#absen', cta: 'Lihat' },
  ].filter(Boolean);

  return (
    <>
      <section className="hero">
        <Court />
        <div className="hero-l">
          <div className="hero-id">
            <span className="hero-logo"><img src="/images/logo.png" alt="" /></span>
            <span className="hero-hi">{d.greeting},</span>
          </div>
          <h2 className="disp hero-name">{profile.name}</h2>
          <div className="hero-sched">
            {U.CATS.map((c) => {
              const on = d.todayCats.includes(c);
              return <span key={c} className={`fx${on ? ' on' : ''}`}><b>KU {c}</b><small>{on ? 'Latihan hari ini' : U.SCHEDULE[c].label}</small></span>;
            })}
          </div>
          <div className="acts"><Link className="btn" to="/students/new">+ Tambah murid</Link><Link className="btn glass" to="/attendance">Isi absensi</Link></div>
        </div>
        <div className="hero-r">
          <div className="hero-big"><b className="disp">{d.active.length}</b><span>murid aktif<br />bersama {d.coachCount} coach</span></div>
          <div className="cats">
            {U.CATS.map((c) => (
              <div className="cat" key={c} style={{ '--cc': SEG[c] }}>
                <b className="disp">{d.counts[c]}</b>
                <span>KU {c}</span>
                <small>{U.pct(d.counts[c], d.active.length)}% murid</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card kpis">
        <div className="kpi">
          <span className="kl">Pemasukan {month}</span>
          <div className="kn money">{U.rupiah(d.income)}</div>
          <span className={`kd${delta !== null && delta < 0 ? ' down' : ''}`}>{delta === null ? 'Belum ada pembanding' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% dari bulan lalu`}</span>
          <Spark data={d.trend.map((t) => t.income)} />
        </div>
        <div className="kpi">
          <span className="kl">Kehadiran bulan ini</span>
          <div className="kn">{d.rate}<small>%</small></div>
          <span className="kd">Dari seluruh sesi latihan tercatat</span>
          <Spark data={d.trend.map((t) => t.rate)} />
        </div>
        <div className="kpi">
          <span className="kl">Member aktif</span>
          <div className="kn">{d.memberCount}</div>
          <span className="kd">{d.trialCount} murid masih trial</span>
          <Spark data={d.trend.map((t) => t.students)} />
        </div>
        <div className="kpi warn">
          <span className="kl">Belum bayar {month}</span>
          <div className="kn">{d.unpaid}</div>
          <span className="kd">{d.unpaid ? 'Perlu ditagih' : 'Semua member sudah lunas'}</span>
          <Link className="kgo" to="/payments">Buka pembayaran</Link>
        </div>
      </section>

      <div className="grid dash2">
        <div className="card">
          <div className="chart-head">
            <div><h3 className="disp">{METRICS[metric].title}</h3><small>6 bulan terakhir</small></div>
            <div className="mtabs" role="tablist">
              {Object.entries(METRICS).map(([k, v]) => <button key={k} role="tab" aria-selected={metric === k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{v.tab}</button>)}
            </div>
          </div>
          <TrendChart trend={d.trend} metric={metric} />
        </div>
        <div className="card">
          <h3 className="disp">Perlu perhatian</h3>
          {attention.length ? attention.map((a, i) => (
            <div className="att" key={i}>
              <span className={`dot ${a.tone}`} />
              <div><b>{a.text}</b><small>{a.sub}</small></div>
              {a.to ? <Link to={a.to}>{a.cta}</Link> : <a href={a.href}>{a.cta}</a>}
            </div>
          )) : <div className="att-ok"><i className="bi bi-check2-circle" /><b>Semuanya aman</b><small>Tidak ada trial habis, tunggakan, atau murid yang sering absen.</small></div>}
        </div>
      </div>

      {d.absentees.length > 0 && (
        <div className="card warn-card" id="absen" style={{ marginBottom: 18 }}>
          <h3 className="disp" style={{ fontSize: 22 }}>Perlu dihubungi: 3 kali berturut-turut tidak hadir</h3>
          {d.absentees.map((s) => (
            <div className="bd" style={{ flexWrap: 'wrap' }} key={s.id}>
              <div className="who" style={{ flex: 1, minWidth: 200 }}>
                <Avatar photo={s.photo} name={s.name} />
                <div><Link to={`/students/${s.id}`}><b>{s.name}</b></Link><small>KU {s.category} · terakhir tercatat tidak hadir {U.fmtLong(s.lastAbsent)}</small></div>
              </div>
              <span className="tag" style={{ display: 'flex', gap: 8 }}>
                <Link className="btn ghost sm" to={`/students/${s.id}`}>Profil</Link>
                <WaBtn href={U.waLink(s.parent_phone, U.waAbsen(s))}>Tanya kabar</WaBtn>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid g2">
        <div className="card">
          <h3 className="disp" style={{ fontSize: 22 }}>Murid terbaru</h3>
          {d.latest.length ? d.latest.map((s) => (
            <div className="bd" key={s.id}>
              <div className="who"><Avatar photo={s.photo} name={s.name} /><div><b>{s.name}</b><small>{U.age(s.birth_date)} tahun</small></div></div>
              <span className="tag" style={{ display: 'flex', gap: 6 }}><Chip>KU {s.category}</Chip><Chip tone={U.STATUS_CHIP[s.status]}>{s.status[0].toUpperCase() + s.status.slice(1)}</Chip></span>
            </div>
          )) : <Empty>Belum ada murid. <Link to="/students/new" style={{ color: 'var(--gd)', fontWeight: 700 }}>Tambah murid pertama</Link></Empty>}
        </div>
        <div className="card" id="ultah">
          <h3 className="disp" style={{ fontSize: 22 }}>Ulang tahun 7 hari ke depan</h3>
          {d.birthdays.length ? d.birthdays.map((s) => (
            <div className="bd" key={s.id}>
              <div><b>{s.name}</b><small style={{ display: 'block', color: 'var(--mut)' }}>{U.fmtLong(s.next, { day: '2-digit', month: 'long' })} · menjadi {s.turning} tahun · KU {s.category}</small></div>
              <span className="tag" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Chip tone={s.daysLeft === 0 ? 'today' : ''}>{s.daysLeft === 0 ? 'Hari ini' : `${s.daysLeft} hari lagi`}</Chip>
                <WaBtn href={U.waLink(s.parent_phone, U.waBirthday(s))}>Ucapkan</WaBtn>
              </span>
            </div>
          )) : <Empty>Tidak ada yang berulang tahun minggu ini.</Empty>}
        </div>
      </div>
    </>
  );
}
