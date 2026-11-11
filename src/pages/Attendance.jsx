import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAll, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Empty, ErrorBox, Loading, useTitle, useToast } from '../components/ui';
import { attendanceExcel } from '../lib/exports';
import * as U from '../lib/utils';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const OPTS = [['hadir', 'h'], ['izin', 'i'], ['sakit', 's'], ['alpa', 'a']];

/** Satu halaman untuk absensi murid (mode="students") dan absen coach (mode="coaches") */
export default function Attendance({ mode }) {
  const coach = mode === 'coaches';
  useTitle(coach ? 'Absen Coach' : 'Absensi');
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const t = U.todayStr();
  const category = !coach && U.CATS.includes(sp.get('category')) ? sp.get('category') : '3-6';
  const year = clamp(+sp.get('year') || +t.slice(0, 4), 2024, 2080);
  const month = clamp(+sp.get('month') || +t.slice(5, 7), 1, 12);
  const days = coach ? U.COACH_DAYS : U.SCHEDULE[category].days;
  const dates = useMemo(() => U.trainingDates(year, month, days), [year, month, coach, category]); // eslint-disable-line
  const date = dates.includes(sp.get('date')) ? sp.get('date') : U.defaultDate(dates);
  const table = coach ? 'coach_attendances' : 'attendances', fk = coach ? 'coach_id' : 'student_id';

  const go = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n); };

  const { data, loading, error, reload } = useData(async () => {
    const people = coach
      ? await fetchAll('coaches', 'id,name,role,photo')
      : await fetchAll('students', 'id,name,photo', (q) => q.eq('category', category).neq('status', 'berhenti'));
    people.sort((a, b) => a.name.localeCompare(b.name));
    let recs = [];
    if (date) {
      const { data: r, error: e } = await supabase.from(table).select(`${fk},status`).eq('date', date);
      if (e) throw e; recs = r;
    }
    return { people, recs: Object.fromEntries(recs.map((r) => [r[fk], r.status])) };
  }, [coach, category, date]);

  const [st, setSt] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setSt(data.recs); }, [data]);

  const save = async () => {
    setBusy(true);
    const rows = data.people.map((p) => ({ [fk]: p.id, date, status: st[p.id] || 'hadir' }));
    const { error: e } = await supabase.from(table).upsert(rows, { onConflict: `${fk},date` });
    setBusy(false);
    if (e) return toast.error(U.cleanMsg(e));
    toast(`Absensi tanggal ${U.fmtLong(date)} berhasil disimpan.`); reload();
  };

  const exportExcel = async () => {
    const first = U.ymd(year, month), last = U.monthEnd(first);
    const ids = new Set(data.people.map((p) => p.id));
    const rows = (await fetchAll(table, '*', (q) => q.gte('date', first).lte('date', last))).filter((r) => ids.has(r[fk]));
    const map = {};
    rows.forEach((r) => { (map[r[fk]] ||= {})[r.date] = r.status; });
    const title = coach ? `Absensi Coach - ${U.monthLabel(first)}` : `Absensi KU ${category} - ${U.monthLabel(first)}`;
    attendanceExcel(title, coach ? `absen-coach-${first.slice(0, 7)}.xlsx` : `absensi-ku-${category}-${first.slice(0, 7)}.xlsx`, data.people, dates, map);
  };

  return (
    <>
      {!coach && (
        <div className="tabs">
          {U.CATS.map((c) => <a key={c} href="#kategori" className={`tab${c === category ? ' on' : ''}`} onClick={(e) => { e.preventDefault(); go({ category: c, date: '' }); }}>KU {c}</a>)}
        </div>
      )}
      <div className="bar">
        <select value={month} onChange={(e) => go({ month: e.target.value, date: '' })}>{U.MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select value={year} onChange={(e) => go({ year: e.target.value, date: '' })}>{U.YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <span style={{ color: 'var(--mut)' }}>{coach ? <>Hari latihan: <b>Jumat, Sabtu &amp; Minggu</b></> : <>Jadwal latihan KU {category}: <b>{U.SCHEDULE[category].label}</b></>}</span>
        <button className="btn sp" onClick={exportExcel} disabled={!data}><i className="bi bi-file-earmark-excel" /> Download Excel {U.MONTHS[month - 1]} {year}</button>
      </div>

      <div className="bar">
        {dates.map((d) => (
          <a key={d} href="#tanggal" className={`date${d === date ? ' on' : ''}`} onClick={(e) => { e.preventDefault(); go({ date: d }); }}>
            <small>{U.DAYS[U.weekday(d)]}</small><b>{+d.slice(8)}</b><small>{U.MONTHS[month - 1]}</small>
          </a>
        ))}
      </div>

      {!date ? <div className="card"><Empty>Tidak ada jadwal latihan pada bulan ini.</Empty></div>
        : loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
          <div className="card">
            <h3 className="disp" style={{ fontSize: 24 }}>{U.fmtDayLong(date)}{coach ? '' : ` · KU ${category}`}</h3>
            {data.people.map((p) => (
              <div className="bd" style={{ flexWrap: 'wrap' }} key={p.id}>
                <div className="who" style={{ minWidth: 200, flex: 1 }}>
                  <Avatar photo={p.photo} name={p.name} />
                  <div><b>{p.name}</b>{coach && <small>{p.role}</small>}</div>
                </div>
                <div className="st">
                  {OPTS.map(([v, c]) => (
                    <span key={v} style={{ display: 'contents' }}>
                      <input type="radio" id={`${v}${p.id}`} name={`s${p.id}`} checked={(st[p.id] || 'hadir') === v} onChange={() => setSt({ ...st, [p.id]: v })} />
                      <label className={c} htmlFor={`${v}${p.id}`}>{U.STATUS_LABEL[v]}</label>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!data.people.length && <Empty>{coach ? 'Belum ada data coach.' : `Belum ada murid di KU ${category}.`}</Empty>}
            {data.people.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn" onClick={save} disabled={busy}><i className="bi bi-check2-circle" /> {busy ? 'Menyimpan...' : 'Simpan absensi'}</button>
                <span style={{ color: 'var(--mut)', fontSize: 13 }}>Yang belum diubah otomatis tercatat hadir.</span>
              </div>
            )}
          </div>
        )}
    </>
  );
}
