import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicShell, { PriceTable } from '../../components/PublicShell';
import { Field, PhotoPicker, useTitle, useToast } from '../../components/ui';
import * as P from '../../lib/portal';
import * as U from '../../lib/utils';

let seq = 0;
const blank = () => ({ key: ++seq, name: '', birth_date: '', photo: null, photo_path: '' });

export default function Register() {
  useTitle('Daftar Academy');
  const toast = useToast();
  const [parent, setParent] = useState({ name: '', job: '', phone: '' });
  const [plan, setPlan] = useState('reguler');
  const [kids, setKids] = useState([blank()]);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const n = kids.length;
  const q = P.quote(plan, n);
  const setKid = (key, k, v) => setKids((ks) => ks.map((x) => (x.key === key ? { ...x, [k]: v } : x)));
  const onParent = (k) => (e) => setParent({ ...parent, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const er = { kids: {} };
    if (parent.name.trim().length < 2) er.pname = 'Wajib diisi.';
    if (parent.job.trim().length < 2) er.pjob = 'Wajib diisi.';
    if (parent.phone.replace(/\D/g, '').length < 9) er.pphone = 'Nomor WhatsApp tidak valid.';
    const seen = new Set();
    kids.forEach((k) => {
      const x = {};
      if (k.name.trim().length < 2) x.name = 'Nama lengkap anak wajib diisi.';
      else if (seen.has(k.name.trim().toLowerCase())) x.name = 'Nama ini sama dengan anak lain di formulir.';
      seen.add(k.name.trim().toLowerCase());
      if (!k.photo) x.photo = 'Foto anak wajib diunggah.';
      if (!k.birth_date) x.birth_date = 'Wajib diisi.';
      else if (k.birth_date >= U.todayStr()) x.birth_date = 'Tanggal lahir harus sebelum hari ini.';
      else if (!P.categoryFor(k.birth_date)) x.birth_date = 'Usia anak harus 3 sampai 12 tahun.';
      if (Object.keys(x).length) er.kids[k.key] = x;
    });
    setErrs(er);
    if (er.pname || er.pjob || er.pphone || Object.keys(er.kids).length) return toast.error('Pendaftaran belum bisa dikirim. Periksa kolom yang ditandai merah.');

    setBusy(true);
    try {
      const res = await P.registerFamily({ parent, plan, kids, onPhoto: (key, path) => setKid(key, 'photo_path', path) });
      P.saveName(res.children[0].name);
      setDone({ ...res, plan, quote: P.quote(plan, res.count) });
      window.scrollTo({ top: 0 });
    } catch (x) { toast.error(P.cleanErr(x)); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <PublicShell back={null}>
        <div className="card pb-done">
          <span className="pb-ok"><i className="bi bi-check-lg" /></span>
          <h2 className="disp">Pendaftaran berhasil</h2>
          <p className="pb-mut">{TRIAL(done.count)}</p>
          <ul className="pb-list">
            {done.children.map((c) => <li key={c.name}><b>{c.name}</b><span>KU {c.category} · {U.SCHEDULE[c.category].label} · {P.TRAIN_TIME} WITA</span></li>)}
          </ul>
          <div className="pb-sumline"><span>Paket {done.quote.label} · {done.count} anak{done.quote.promo ? ' (harga promo)' : ''}</span><b>{U.rupiah(done.quote.total)}<small> /{done.quote.period}</small></b></div>
          <p className="pb-mut">{P.TRIAL_TEXT}</p>
          <div className="pb-acts">
            <a className="btn wa" href={P.WA_GROUP} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" /> Gabung grup WhatsApp</a>
            <Link className="btn" to="/anak">Masuk ke dashboard <i className="bi bi-arrow-right" /></Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  const next = n < P.PROMO_MIN ? P.quote(plan, P.PROMO_MIN) : null;

  return (
    <PublicShell>
      <div className="pb-head">
        <h1 className="disp">Daftar Academy</h1>
        <p className="pb-mut">Isi data orang tua, pilih paket, lalu tambahkan anak. Bisa mendaftarkan beberapa anak sekaligus.</p>
      </div>
      <PriceTable />

      <form onSubmit={submit} className="pb-grid" noValidate>
        <div className="pb-col">
          <section className="card">
            <h3><i className="bi bi-person-heart" /> Data orang tua</h3>
            <div className="form">
              <Field label="Nama orang tua" error={errs.pname}><input value={parent.name} onChange={onParent('name')} autoComplete="name" /></Field>
              <Field label="Pekerjaan orang tua" error={errs.pjob}><input value={parent.job} onChange={onParent('job')} /></Field>
              <Field label="Nomor WhatsApp orang tua" error={errs.pphone} full><input value={parent.phone} onChange={onParent('phone')} placeholder="08xxxxxxxxxx" inputMode="tel" autoComplete="tel" /></Field>
            </div>
          </section>

          <section className="card">
            <h3><i className="bi bi-tags" /> Pilih paket</h3>
            <div className="pb-plans" role="radiogroup" aria-label="Paket">
              {Object.entries(P.PLANS).map(([k, p]) => (
                <label key={k} className={`pb-plan${plan === k ? ' on' : ''}`}>
                  <input type="radio" name="plan" value={k} checked={plan === k} onChange={() => setPlan(k)} />
                  <b>{p.label}</b>
                  <span>{U.rupiah(p.base)} <small>/ {p.period} per anak</small></span>
                </label>
              ))}
            </div>
          </section>

          {kids.map((k, i) => {
            const er = errs.kids?.[k.key] || {};
            const cat = P.categoryFor(k.birth_date);
            return (
              <section className="card" key={k.key}>
                <div className="pb-kid-h">
                  <h3><i className="bi bi-emoji-smile" /> Anak ke-{i + 1}</h3>
                  {n > 1 && <button type="button" className="btn red sm" onClick={() => setKids(kids.filter((x) => x.key !== k.key))}><i className="bi bi-trash" /> Hapus</button>}
                </div>
                <div className="form">
                  <Field label="Nama lengkap anak" error={er.name} full><input value={k.name} onChange={(e) => setKid(k.key, 'name', e.target.value)} autoComplete="off" /></Field>
                  <Field label="Foto anak (wajib)" error={er.photo} full>
                    <PhotoPicker value={k.photo} onChange={(f) => setKids((ks) => ks.map((x) => (x.key === k.key ? { ...x, photo: f, photo_path: '' } : x)))} disabled={busy} />
                  </Field>
                  <Field label="Tanggal lahir" error={er.birth_date} full><input type="date" max={U.todayStr()} value={k.birth_date} onChange={(e) => setKid(k.key, 'birth_date', e.target.value)} /></Field>
                </div>
                {cat && <div className="pb-cat"><i className="bi bi-calendar2-check" /> Masuk <b>KU {cat}</b> · latihan {U.SCHEDULE[cat].label}, {P.TRAIN_TIME} WITA</div>}
              </section>
            );
          })}

          {n < P.MAX_CHILDREN && (
            <button type="button" className="btn ghost pb-add" onClick={() => setKids([...kids, blank()])}>
              <i className="bi bi-plus-circle" /> Tambah anak (saudara kandung)
            </button>
          )}
        </div>

        <aside className="pb-side">
          <div className="card pb-sum">
            <h3><i className="bi bi-receipt" /> Ringkasan biaya</h3>
            <div className="pb-sumline"><span>Paket</span><b>{q.label}</b></div>
            <div className="pb-sumline"><span>Jumlah anak</span><b>{n}</b></div>
            <div className="pb-sumline"><span>Harga per anak</span><b>{U.rupiah(q.per)}</b></div>
            {q.promo && <div className="pb-sumline old"><span>Harga normal</span><s>{U.rupiah(q.normal)}</s></div>}
            <div className="pb-total"><span>Total / {q.period}</span><b>{U.rupiah(q.total)}</b></div>
            {q.promo
              ? <div className="alert amb" style={{ marginTop: 14, marginBottom: 0 }}><i className="bi bi-stars" /> Promo sekeluarga aktif. Hemat {U.rupiah(q.save)}.</div>
              : next && <div className="pb-hint"><i className="bi bi-lightbulb" /> Daftarkan {P.PROMO_MIN} anak untuk harga promo: {U.rupiah(next.total)} / {next.period} (hemat {U.rupiah(next.save)}).</div>}
            <button className="btn pb-submit" disabled={busy}>{busy ? 'Mengirim...' : `Daftarkan ${n} anak`}</button>
            <p className="pb-mut pb-fine">{P.TRIAL_TEXT}</p>
          </div>
        </aside>
      </form>
    </PublicShell>
  );
}

const TRIAL = (n) => `Data ${n > 1 ? `${n} anak` : 'anak'} sudah tersimpan dan langsung masuk ke data admin.`;
