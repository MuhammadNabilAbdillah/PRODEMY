import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Field, PhotoPicker, useTitle, useToast } from '../../components/ui';
import { usePortal } from './PortalLayout';
import * as P from '../../lib/portal';
import * as U from '../../lib/utils';

const ABSENT = ['izin', 'sakit', 'alpa'];

/** Cincin hadir vs tidak hadir */
function Donut({ hadir, absent }) {
  const total = hadir + absent, R = 52, C = 2 * Math.PI * R;
  const hv = total ? (hadir / total) * C : 0;
  return (
    <svg className="pb-donut" viewBox="0 0 140 140" role="img" aria-label={`Hadir ${hadir}, tidak hadir ${absent}`}>
      <circle cx="70" cy="70" r={R} fill="none" stroke={total ? 'var(--red)' : 'var(--line)'} strokeWidth="16" />
      {total > 0 && hadir > 0 && <circle cx="70" cy="70" r={R} fill="none" stroke="var(--g)" strokeWidth="16" strokeDasharray={`${hv} ${C - hv}`} transform="rotate(-90 70 70)" />}
      <text x="70" y="68" textAnchor="middle" className="pb-dn">{U.pct(hadir, total)}%</text>
      <text x="70" y="88" textAnchor="middle" className="pb-dl">hadir</text>
    </svg>
  );
}

/** Batang hadir dan tidak hadir per bulan (6 bulan terakhir) */
function Bars({ rows }) {
  const W = 420, H = 190, L = 12, B = 30, T = 22, gw = (W - L * 2) / rows.length;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.hadir, r.absent)));
  const bh = (v) => (v / max) * (H - B - T);
  return (
    <svg className="pb-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kehadiran per bulan">
      <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="var(--line)" />
      {rows.map((r, i) => {
        const x = L + i * gw + gw / 2;
        return (
          <g key={r.label}>
            <rect x={x - 17} y={H - B - bh(r.hadir)} width="15" height={bh(r.hadir)} rx="4" fill="var(--g)" />
            <rect x={x + 2} y={H - B - bh(r.absent)} width="15" height={bh(r.absent)} rx="4" fill="var(--red)" />
            {r.hadir > 0 && <text x={x - 9.5} y={H - B - bh(r.hadir) - 5} textAnchor="middle" className="pb-bv">{r.hadir}</text>}
            {r.absent > 0 && <text x={x + 9.5} y={H - B - bh(r.absent) - 5} textAnchor="middle" className="pb-bv">{r.absent}</text>}
            <text x={x} y={H - 10} textAnchor="middle" className="pb-bm">{r.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Foto anak (avatar kecil dari database) atau inisial bila belum ada foto */
function Face({ child, size = '' }) {
  return child.avatar
    ? <img className={`pf-face ${size}`} src={child.avatar} alt={`Foto ${child.name}`} />
    : <span className={`pf-face pf-ini ${size}`} aria-hidden="true">{child.name.charAt(0).toUpperCase()}</span>;
}

const Empty = ({ icon = 'bi-inbox', children }) => <div className="pb-empty"><i className={`bi ${icon}`} /><p>{children}</p></div>;

/** Jendela ubah profil: orang tua boleh mengganti foto anak dan data dasar */
function EditProfile({ child, loginName, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ parentName: child.parent_name || '', birthDate: child.birth_date || '', phone: '', job: '' });
  const [photo, setPhoto] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [busy, onClose]);

  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.parentName.trim().length < 2) er.parentName = 'Nama orang tua wajib diisi.';
    if (!f.birthDate) er.birthDate = 'Tanggal lahir wajib diisi.';
    else if (f.birthDate !== child.birth_date && !P.categoryFor(f.birthDate)) er.birthDate = 'Usia anak harus 3 sampai 12 tahun.';
    if (f.phone.trim() && f.phone.replace(/\D/g, '').length < 9) er.phone = 'Nomor WhatsApp tidak valid.';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await P.updateProfile({ name: loginName, id: child.id, parentName: f.parentName, birthDate: f.birthDate, phone: f.phone, job: f.job, photo });
      await onSaved();
      toast('Profil berhasil diperbarui.');
      onClose();
    } catch (x) { toast.error(P.cleanErr(x)); setBusy(false); }
  };

  return (
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="ep-t" onSubmit={save} noValidate>
        <div className="sheet-head">
          <div><h2 className="disp" id="ep-t">Ubah profil</h2><p className="pb-mut">{child.name} · KU {child.category}</p></div>
          <button type="button" className="sheet-x" onClick={onClose} disabled={busy} aria-label="Tutup"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="sheet-body">
          <Field label="Foto anak" full><PhotoPicker value={photo} onChange={setPhoto} dataUrl={child.avatar} name={child.name} disabled={busy} /></Field>
          <div className="form">
            <Field label="Nama orang tua" error={errs.parentName} full><input value={f.parentName} onChange={on('parentName')} autoComplete="name" /></Field>
            <Field label="Tanggal lahir anak" error={errs.birthDate} full><input type="date" max={U.todayStr()} value={f.birthDate} onChange={on('birthDate')} /></Field>
            <Field label="Nomor WhatsApp baru" error={errs.phone}><input value={f.phone} onChange={on('phone')} inputMode="tel" placeholder="Kosongkan bila tidak diubah" autoComplete="tel" /></Field>
            <Field label="Pekerjaan orang tua baru"><input value={f.job} onChange={on('job')} placeholder="Kosongkan bila tidak diubah" /></Field>
          </div>
          <p className="pb-fine pb-note"><i className="bi bi-shield-lock" /> Nomor WhatsApp dan pekerjaan tidak ditampilkan di halaman ini demi keamanan, jadi kolomnya sengaja kosong. Untuk mengubah nama anak, hubungi admin.</p>
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan perubahan'}</button>
        </div>
      </form>
    </div>
  );
}

const WEEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function PortalDashboard() {
  useTitle('Dashboard Anak');
  const { children, child, setChildId, name, reload } = usePortal();
  const [editing, setEditing] = useState(false);
  const t = U.todayStr();

  const att = child.attendance;
  const hadir = att.filter((a) => a.status === 'hadir').length;
  const count = (st) => att.filter((a) => a.status === st).length;
  const absent = att.filter((a) => ABSENT.includes(a.status)).length;
  const rate = U.pct(hadir, att.length);
  const months = Array.from({ length: 6 }, (_, i) => {
    const st = U.addMonths(U.monthStart(t), i - 5), key = st.slice(0, 7);
    const rows = att.filter((a) => a.date.startsWith(key));
    return { label: U.shortMonth(st), hadir: rows.filter((a) => a.status === 'hadir').length, absent: rows.filter((a) => ABSENT.includes(a.status)).length };
  });

  // pemberitahuan jadwal: satu per kategori yang dimiliki keluarga
  const reminders = [];
  const seen = new Set();
  [child, ...children.filter((c) => c.id !== child.id)].forEach((c) => {
    if (c.status === 'berhenti' || seen.has(c.category)) return;
    seen.add(c.category);
    const nx = P.nextTraining(c.category);
    if (nx) reminders.push({ kids: children.filter((k) => k.category === c.category && k.status !== 'berhenti').map((k) => k.name), cat: c.category, ...nx });
  });

  const first = child.name.split(' ')[0];
  const next = child.status !== 'berhenti' ? P.nextTraining(child.category) : null;
  const sched = U.SCHEDULE[child.category];
  const bd = child.birth_date;
  const age = bd ? U.age(bd) : null;
  let bday = null; // hari menuju ulang tahun berikutnya
  if (bd) {
    const y = Number(t.slice(0, 4)), m = Number(bd.slice(5, 7)), d = Number(bd.slice(8, 10));
    let nx = U.ymd(y, m, d);
    if (nx < t) nx = U.ymd(y + 1, m, d);
    bday = U.diffDays(t, nx);
  }

  const period = U.monthStart(t);
  const paidNow = child.payments.some((p) => p.period === period);
  const waiting = (child.submissions || []).some((x) => x.period === period && x.status === 'menunggu');
  const trialLeft = child.status === 'trial' ? U.trialDaysLeft(child) : null;
  const trialUsed = trialLeft === null ? 0 : Math.min(100, Math.max(0, Math.round(((30 - trialLeft) / 30) * 100)));

  const info = [
    bd && ['bi-cake2', 'Tanggal lahir', U.fmtLong(bd), `${age} tahun`],
    child.parent_name && ['bi-person-heart', 'Orang tua', child.parent_name, 'Penanggung jawab'],
    ['bi-tags', 'Paket', P.PLANS[child.plan]?.label || '-', child.status === 'member' ? 'Anggota aktif' : child.status === 'trial' ? 'Masa trial' : 'Tidak aktif'],
    child.status === 'member' ? ['bi-award', 'Member sejak', U.fmtLong(child.member_since || child.joined_at), 'Terima kasih sudah bergabung']
      : child.status === 'trial' ? ['bi-hourglass-split', 'Trial berakhir', U.fmtLong(U.trialEnds(child)), trialLeft < 0 ? 'Sudah berakhir' : `${trialLeft} hari lagi`]
      : ['bi-calendar-check', 'Tanggal daftar', U.fmtLong(child.joined_at), ''],
  ].filter(Boolean);

  return (
    <div className="pd">
      {/* ===== hero ===== */}
      <section className="ph">
        <svg className="ph-court" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <circle cx="330" cy="100" r="70" /><circle cx="330" cy="100" r="22" /><line x1="330" y1="0" x2="330" y2="200" /><rect x="-30" y="55" width="110" height="90" />
        </svg>
        <div className="ph-top">
          <span className="ph-hi"><i className="bi bi-hand-thumbs-up" /> Halo, orang tua {first}</span>
          <span className="ph-date">{U.fmtDayLong(t)}</span>
        </div>
        <div className="ph-body">
          <div className="ph-who">
            <Face child={child} size="xl" />
            <div className="ph-id">
              <h1 className="disp ph-name">{child.name}</h1>
              <div className="ph-chips">
                <span className="ph-chip">KU {child.category}</span>
                <span className="ph-chip">Paket {P.PLANS[child.plan]?.label}</span>
                <span className={`ph-chip st-${child.status}`}>{child.status === 'member' ? 'Member' : child.status === 'trial' ? 'Trial' : 'Berhenti'}</span>
              </div>
            </div>
          </div>
          <div className="ph-next">
            {next ? (
              <>
                <small>Latihan berikutnya</small>
                <div className="ph-next-row">
                  <div className="ph-cal"><b className="disp">{Number(next.date.slice(8, 10))}</b><span>{U.shortMonth(next.date)}</span></div>
                  <div><b>{U.DAYS[U.weekday(next.date)]}</b><span>{P.TRAIN_TIME} WITA</span><em>{P.whenLabel(next.inDays)}</em></div>
                </div>
              </>
            ) : <><small>Latihan berikutnya</small><div className="ph-next-row"><div><b>{child.status === 'berhenti' ? 'Tidak aktif' : 'Belum terjadwal'}</b></div></div></>}
          </div>
        </div>
        {bday !== null && bday <= 14 && (
          <div className="ph-bday"><i className="bi bi-cake2" /> {bday === 0 ? <b>Selamat ulang tahun ke-{age}, {first}!</b> : <span><b>{bday} hari lagi</b> {first} berulang tahun ke-{age + 1}.</span>}</div>
        )}
        <div className="ph-acts">
          <button type="button" className="btn glass" onClick={() => setEditing(true)}><i className="bi bi-pencil-square" /> Ubah profil &amp; foto</button>
          {child.status === 'member' && <Link className="btn" to="/anak/pembayaran"><i className="bi bi-cash-coin" /> Bayar iuran</Link>}
          <a className="btn glass" href={P.WA_GROUP} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" /> Grup WhatsApp</a>
        </div>
      </section>

      {children.length > 1 && (
        <div className="pb-tabs" role="tablist" aria-label="Pilih anak">
          {children.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === child.id} className={c.id === child.id ? 'on' : ''} onClick={() => setChildId(c.id)}>
              <Face child={c} size="xs" />{c.name}
            </button>
          ))}
        </div>
      )}

      {reminders.length > 0 && (
        <div className="pd-rem">
          {reminders.map((r) => (
            <div key={r.cat} className={`alert ${r.inDays <= 1 ? 'amb' : ''} pb-rem`}>
              <i className="bi bi-bell" />
              <span><b>{P.whenLabel(r.inDays)}</b>: latihan KU {r.cat} ({r.kids.join(', ')}) pukul {P.TRAIN_TIME} WITA, {U.fmtDayLong(r.date)}.</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== info ringkas ===== */}
      <div className="pd-info">
        {info.map(([icon, label, value, sub]) => (
          <div className="pi" key={label}>
            <span className="pi-ico"><i className={`bi ${icon}`} /></span>
            <div><small>{label}</small><b>{value}</b>{sub && <em>{sub}</em>}</div>
          </div>
        ))}
      </div>

      {/* ===== angka kehadiran ===== */}
      <div className="pb-kpis">
        <div className="kp kp-g"><span className="kp-ico"><i className="bi bi-check2-circle" /></span><b className="disp">{hadir}</b><small>Hadir</small></div>
        <div className="kp kp-a"><span className="kp-ico"><i className="bi bi-x-circle" /></span><b className="disp">{absent}</b><small>Tidak hadir</small></div>
        <div className="kp"><span className="kp-ico"><i className="bi bi-calendar3" /></span><b className="disp">{att.length}</b><small>Latihan tercatat</small></div>
        <div className="kp"><span className="kp-ico"><i className="bi bi-graph-up-arrow" /></span><b className="disp">{rate}%</b><small>Tingkat kehadiran</small></div>
      </div>

      <div className="pb-two">
        <section className="card">
          <h3><i className="bi bi-pie-chart" /> Kehadiran {first}</h3>
          {att.length ? (
            <div className="pb-chart-row">
              <Donut hadir={hadir} absent={absent} />
              <ul className="pb-legend">
                <li><i style={{ background: 'var(--g)' }} /> Hadir <b>{hadir}</b></li>
                <li><i style={{ background: 'var(--red)' }} /> Tidak hadir <b>{absent}</b></li>
                <li className="sub">Izin {count('izin')} · Sakit {count('sakit')} · Alpa {count('alpa')}</li>
              </ul>
            </div>
          ) : <Empty icon="bi-clipboard-data">Belum ada data absensi. Kehadiran akan muncul setelah latihan pertama dicatat admin.</Empty>}
        </section>
        <section className="card">
          <h3><i className="bi bi-bar-chart" /> 6 bulan terakhir</h3>
          {att.length ? <><Bars rows={months} /><div className="pb-legend row"><span><i style={{ background: 'var(--g)' }} /> Hadir</span><span><i style={{ background: 'var(--red)' }} /> Tidak hadir</span></div></> : <Empty icon="bi-bar-chart">Grafik bulanan akan muncul setelah ada absensi.</Empty>}
        </section>
      </div>

      <div className="pb-two">
        <section className="card">
          <h3><i className="bi bi-calendar-week" /> Jadwal latihan</h3>
          <div className="wk" aria-label={`Latihan ${sched.label}`}>
            {WEEK.map((d, i) => <span key={d} className={sched.days.includes(i) ? 'on' : ''}>{d}</span>)}
          </div>
          <div className="pb-sched">
            <div><small>Kategori</small><b>KU {child.category}</b></div>
            <div><small>Hari</small><b>{sched.label}</b></div>
            <div><small>Jam</small><b>{P.TRAIN_TIME} WITA</b></div>
          </div>
          {next && <div className="pb-cat"><i className="bi bi-calendar-event" /> Latihan berikutnya: <b>{U.fmtDayLong(next.date)}</b> ({P.whenLabel(next.inDays)})</div>}
        </section>

        <section className="card">
          <h3><i className="bi bi-wallet2" /> Iuran &amp; keanggotaan</h3>
          {child.status === 'member' ? (
            <>
              <div className="pay-state">
                <div><small>Iuran {U.monthLabel(period)}</small>{paidNow ? <Chip>Lunas</Chip> : waiting ? <Chip tone="amb">Menunggu verifikasi</Chip> : <Chip tone="red">Belum bayar</Chip>}</div>
                {!paidNow && !waiting && <Link className="btn sm" to="/anak/pembayaran">Bayar sekarang</Link>}
              </div>
              {child.payments.length > 0 ? (
                <ul className="pay-list">
                  {child.payments.slice(0, 3).map((p) => (
                    <li key={p.period}><span>{U.monthLabel(p.period)}</span><b>{U.rupiah(p.amount)}</b></li>
                  ))}
                </ul>
              ) : <p className="pb-mut pb-fine pay-none">Belum ada pembayaran tercatat.</p>}
            </>
          ) : child.status === 'trial' ? (
            <>
              <div className="pay-state"><div><small>Masa trial gratis</small><Chip tone={trialLeft < 0 ? 'red' : 'amb'}>{trialLeft < 0 ? 'Sudah berakhir' : `${trialLeft} hari lagi`}</Chip></div></div>
              <div className="track"><div className="track-fill" style={{ width: `${trialUsed}%` }} /></div>
              <p className="pb-mut pb-fine pay-none">{P.TRIAL_TEXT}</p>
            </>
          ) : <Empty icon="bi-pause-circle">Anak ini berstatus berhenti. Hubungi admin bila ingin bergabung kembali.</Empty>}
        </section>
      </div>

      <section className="card">
        <h3><i className="bi bi-clock-history" /> Riwayat kehadiran terakhir</h3>
        {att.length ? (
          <ul className="tl">
            {att.slice(0, 8).map((a) => (
              <li key={a.date} className={`tl-${a.status}`}>
                <span className="tl-dot" />
                <span className="tl-date">{U.fmtDayLong(a.date)}</span>
                <Chip tone={U.ATT_CHIP[a.status]}>{U.STATUS_LABEL[a.status]}</Chip>
              </li>
            ))}
          </ul>
        ) : <Empty icon="bi-journal-text">Belum ada riwayat kehadiran.</Empty>}
      </section>

      {editing && <EditProfile key={child.id} child={child} loginName={name} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  );
}
