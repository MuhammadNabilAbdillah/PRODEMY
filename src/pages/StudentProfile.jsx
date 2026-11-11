import { Link, useParams } from 'react-router-dom';
import { fetchAll, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, FileLink, Loading, WaBtn, useTitle } from '../components/ui';
import * as U from '../lib/utils';

export default function StudentProfile() {
  useTitle('Profil Murid');
  const { id } = useParams();
  const { data, loading, error } = useData(async () => {
    const { data: s, error: e } = await supabase.from('students').select('*').eq('id', id).single();
    if (e) throw e;
    const [att, pays] = await Promise.all([fetchAll('attendances', '*', (q) => q.eq('student_id', id)), fetchAll('payments', '*', (q) => q.eq('student_id', id))]);
    return { s, att: att.sort((a, b) => (a.date < b.date ? 1 : -1)), pays };
  }, [id]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const { s, att, pays } = data;
  const sum = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
  att.forEach((a) => sum[a.status]++);
  const rate = U.pct(sum.hadir, att.length);
  const paid = Object.fromEntries(pays.map((p) => [p.period.slice(0, 7), p]));
  const months = [];
  if (s.status === 'member' && s.member_since) for (let d = U.monthStart(s.member_since); d <= U.monthStart(U.todayStr()); d = U.addMonths(d, 1)) months.unshift(d);

  return (
    <div className="prof">
      <div className="card" style={{ textAlign: 'center' }}>
        <Avatar photo={s.photo} name={s.name} className="big" />
        <h2 className="disp" style={{ fontSize: 30 }}>{s.name}</h2>
        <div style={{ margin: '8px 0 14px' }}><Chip>KU {s.category}</Chip> <Chip tone={U.STATUS_CHIP[s.status]}>{s.status[0].toUpperCase() + s.status.slice(1)}</Chip></div>
        <dl className="kv" style={{ textAlign: 'left' }}>
          <dt>Tanggal lahir</dt><dd>{U.fmtLong(s.birth_date)} ({U.age(s.birth_date)} th)</dd>
          <dt>Orang tua</dt><dd>{s.parent_name}</dd>
          <dt>Pekerjaan</dt><dd>{s.parent_job}</dd>
          <dt>No. WA</dt><dd>{s.parent_phone}</dd>
          <dt>Terdaftar</dt><dd>{U.fmtLong(U.joinedAt(s))}</dd>
          {s.member_since && <><dt>Member sejak</dt><dd>{U.fmtLong(s.member_since)}</dd></>}
          {s.status === 'trial' && <><dt>Trial berakhir</dt><dd>{U.fmtLong(U.trialEnds(s))}</dd></>}
        </dl>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18, justifyContent: 'center' }}>
          <WaBtn href={U.waLink(s.parent_phone, `Halo Bapak/Ibu ${s.parent_name}, salam dari Brother Academy.`)}>Hubungi orang tua</WaBtn>
          <Link className="btn ghost sm" to={`/students/${s.id}/edit`}><i className="bi bi-pencil" /> Edit</Link>
          <Link className="btn ghost sm" to="/students">Kembali</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div className="card">
          <h3 className="disp" style={{ fontSize: 22 }}>Riwayat absensi</h3>
          <div className="mini">
            <div><b style={{ color: 'var(--gd)' }}>{sum.hadir}</b><span>Hadir</span></div>
            <div><b style={{ color: 'var(--blue)' }}>{sum.izin}</b><span>Izin</span></div>
            <div><b style={{ color: 'var(--amb)' }}>{sum.sakit}</b><span>Sakit</span></div>
            <div><b style={{ color: 'var(--red)' }}>{sum.alpa}</b><span>Tidak hadir</span></div>
          </div>
          {att.length ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Tingkat kehadiran</span><span>{rate}%</span></div>
              <div className="track" style={{ marginBottom: 14 }}><div style={{ height: '100%', width: `${rate}%`, background: 'var(--g)', borderRadius: 99 }} /></div>
              {att.slice(0, 10).map((a) => <div className="bd" key={a.id}><span>{U.fmtDayLong(a.date)}</span><Chip tone={U.ATT_CHIP[a.status]} className="tag">{U.STATUS_LABEL[a.status]}</Chip></div>)}
              {att.length > 10 && <div style={{ color: 'var(--mut)', marginTop: 8 }}>Menampilkan 10 dari {att.length} catatan terakhir.</div>}
            </>
          ) : <Empty>Belum ada catatan absensi.</Empty>}
        </div>

        <div className="card">
          <h3 className="disp" style={{ fontSize: 22 }}>Riwayat pembayaran</h3>
          {s.status === 'member' ? months.map((m) => {
            const p = paid[m.slice(0, 7)];
            return (
              <div className="bd" key={m}>
                <span>{U.monthLabel(m)}</span>
                {p ? (
                  <span className="tag" style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Chip>Lunas {U.fmtLong(p.paid_at, { day: '2-digit', month: 'short', year: 'numeric' })}</Chip><FileLink bucket="proofs" path={p.proof} /></span>
                ) : (
                  <span className="tag" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Chip tone="red">Belum bayar</Chip><WaBtn href={U.waLink(s.parent_phone, U.waIuran(s, U.monthLabel(m)))}>Ingatkan</WaBtn></span>
                )}
              </div>
            );
          }) : <Empty>{s.status === 'trial' ? 'Masih masa trial gratis. Iuran dimulai setelah lanjut menjadi member.' : 'Murid ini berstatus berhenti.'}</Empty>}
        </div>
      </div>
    </div>
  );
}
