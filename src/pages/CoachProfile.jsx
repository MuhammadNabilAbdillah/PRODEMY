import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchAll, removeFile, supabase } from '../lib/supabase';
import { useData } from '../lib/hooks';
import { Avatar, Chip, Empty, ErrorBox, Loading, WaBtn, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

export default function CoachProfile() {
  useTitle('Detail Coach');
  const { id } = useParams();
  const nav = useNavigate(), toast = useToast();
  const { data, loading, error } = useData(async () => {
    const { data: c, error: e } = await supabase.from('coaches').select('*').eq('id', id).single();
    if (e) throw e;
    const att = await fetchAll('coach_attendances', '*', (q) => q.eq('coach_id', id));
    return { c, att: att.sort((a, b) => (a.date < b.date ? 1 : -1)) };
  }, [id]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const { c, att } = data;
  const sum = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
  att.forEach((a) => { sum[a.status]++; });
  const rate = U.pct(sum.hadir, att.length);
  const thisMonth = att.filter((a) => a.date.startsWith(U.todayStr().slice(0, 7)));

  const del = async () => {
    if (!(await toast.confirm(`Hapus ${c.name}? Riwayat absennya ikut terhapus.`, { title: 'Hapus data coach', okText: 'Ya, hapus', danger: true }))) return;
    const { error: e } = await supabase.from('coaches').delete().eq('id', c.id);
    if (e) return toast.error(U.cleanMsg(e));
    await removeFile('photos', c.photo); toast('Data coach berhasil dihapus.'); nav('/coaches');
  };

  return (
    <div className="prof">
      <div className="card prof-side">
        <Avatar photo={c.photo} name={c.name} className="big" />
        <h2 className="disp prof-name">{c.name}</h2>
        <div className="prof-chips"><Chip>{c.role}</Chip></div>
        <dl className="kv">
          <dt>Tanggal lahir</dt><dd>{U.fmtLong(c.birth_date)} ({U.age(c.birth_date)} th)</dd>
          <dt>Nomor HP</dt><dd>{c.phone}</dd>
          <dt>Posisi</dt><dd>{c.role}</dd>
          <dt>Terdata sejak</dt><dd>{U.fmtLong(c.created_at.slice(0, 10))}</dd>
        </dl>
        <div className="prof-acts">
          <WaBtn href={U.waLink(c.phone, `Halo ${c.name}, salam dari Brother Academy.`)}>Hubungi</WaBtn>
          <Link className="btn ghost sm" to={`/coaches/${c.id}/edit`}><i className="bi bi-pencil" /> Edit</Link>
          <button className="btn red sm" onClick={del}><i className="bi bi-trash" /> Hapus</button>
        </div>
        <Link className="btn ghost sm prof-back" to="/coaches"><i className="bi bi-arrow-left" /> Kembali ke Data Coach</Link>
      </div>

      <div className="prof-main">
        <div className="card">
          <h3 className="disp">Riwayat absensi</h3>
          <div className="mini">
            <div><b style={{ color: 'var(--gd)' }}>{sum.hadir}</b><span>Hadir</span></div>
            <div><b style={{ color: 'var(--blue)' }}>{sum.izin}</b><span>Izin</span></div>
            <div><b style={{ color: 'var(--amb)' }}>{sum.sakit}</b><span>Sakit</span></div>
            <div><b style={{ color: 'var(--red)' }}>{sum.alpa}</b><span>Tidak hadir</span></div>
          </div>
          {att.length ? (
            <>
              <div className="rate-row"><span>Tingkat kehadiran</span><b>{rate}%</b></div>
              <div className="track"><div className="track-fill" style={{ width: `${rate}%` }} /></div>
              <p className="prof-note">Bulan ini: {thisMonth.filter((a) => a.status === 'hadir').length} hadir dari {thisMonth.length} latihan tercatat.</p>
              <div className="bd-list">
                {att.slice(0, 12).map((a) => <div className="bd" key={a.id}><span>{U.fmtDayLong(a.date)}</span><Chip tone={U.ATT_CHIP[a.status]} className="tag">{U.STATUS_LABEL[a.status]}</Chip></div>)}
              </div>
              {att.length > 12 && <p className="prof-note">Menampilkan 12 dari {att.length} catatan terakhir.</p>}
            </>
          ) : <Empty>Belum ada catatan absensi untuk coach ini.</Empty>}
        </div>
      </div>
    </div>
  );
}
