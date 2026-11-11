import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, upload, removeFile } from '../lib/supabase';
import { prepPhoto } from '../lib/photo';
import { ErrorBox, Field, Loading, PhotoPicker, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

const EMPTY = { name: '', parent_name: '', parent_job: '', birth_date: '', parent_phone: '', category: '', status: 'trial', joined_at: U.todayStr() };

export default function StudentForm() {
  const { id } = useParams();
  const edit = Boolean(id);
  useTitle(edit ? 'Edit Murid' : 'Tambah Murid');
  const nav = useNavigate(), toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [old, setOld] = useState(null);
  const [file, setFile] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(edit);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    if (!edit) return;
    supabase.from('students').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) setLoadErr(error); else { setOld(data); setF({ ...EMPTY, ...data }); }
      setLoading(false);
    });
  }, [id, edit]);

  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    ['name', 'parent_name', 'parent_job', 'parent_phone', 'category', 'birth_date', 'joined_at'].forEach((k) => { if (!String(f[k] || '').trim()) er[k] = 'Wajib diisi.'; });
    if (f.birth_date && f.birth_date >= U.todayStr()) er.birth_date = 'Tanggal lahir harus sebelum hari ini.';
    setErrs(er);
    if (Object.keys(er).length) return toast.error('Data belum bisa disimpan. Periksa kolom yang ditandai merah.');

    setBusy(true);
    try {
      const row = { name: f.name.trim(), parent_name: f.parent_name.trim(), parent_job: f.parent_job.trim(), birth_date: f.birth_date,
        parent_phone: f.parent_phone.trim(), category: f.category, status: f.status, joined_at: f.joined_at };
      row.member_since = f.status === 'member' ? (old?.member_since || (edit ? U.todayStr() : f.joined_at)) : null;
      row.stopped_at = f.status === 'berhenti' ? (old?.stopped_at || U.todayStr()) : null;
      if (file) {
        const p = await prepPhoto(file);
        row.photo = await upload('photos', 'students', p.file);
        if (p.avatar) row.avatar = p.avatar; // versi kecil untuk dashboard orang tua
      }

      const q = edit ? supabase.from('students').update(row).eq('id', id) : supabase.from('students').insert(row);
      const { error } = await q;
      if (error) { if (row.photo) await removeFile('photos', row.photo); throw error; }
      if (file && old?.photo) await removeFile('photos', old.photo);

      toast(edit ? 'Data murid berhasil diperbarui.' : `Data murid berhasil ditambahkan${row.status === 'trial' ? ' dan masuk ke Data Trial.' : '.'}`);
      nav(!edit && row.status === 'trial' ? '/trials' : '/students');
    } catch (x) { setErrs({ form: U.cleanMsg(x) }); toast.error(U.cleanMsg(x)); } finally { setBusy(false); }
  };

  if (loading) return <Loading />;
  if (loadErr) return <ErrorBox error={loadErr} />;

  return (
    <form className="fwrap" onSubmit={submit} noValidate>
      {errs.form && <div className="alert red">{errs.form}</div>}

      <section className="card">
        <h3 className="disp">Foto murid</h3>
        <PhotoPicker value={file} onChange={setFile} current={old?.photo} name={f.name} disabled={busy} />
      </section>

      <section className="card">
        <h3 className="disp">Data murid</h3>
        <div className="form">
          <Field label="Nama murid" error={errs.name} full><input value={f.name} onChange={on('name')} /></Field>
          <Field label="Tanggal lahir" error={errs.birth_date}><input type="date" value={f.birth_date} max={U.todayStr()} onChange={on('birth_date')} /></Field>
          <Field label="Kategori" error={errs.category}>
            <select value={f.category} onChange={on('category')}>
              <option value="">Pilih kategori</option>
              {U.CATS.map((c) => <option key={c} value={c}>KU {c} ({U.SCHEDULE[c].label})</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="card">
        <h3 className="disp">Data orang tua</h3>
        <div className="form">
          <Field label="Nama orang tua" error={errs.parent_name}><input value={f.parent_name} onChange={on('parent_name')} /></Field>
          <Field label="Pekerjaan orang tua" error={errs.parent_job}><input value={f.parent_job} onChange={on('parent_job')} /></Field>
          <Field label="Nomor WA orang tua" error={errs.parent_phone} full><input value={f.parent_phone} placeholder="08xxxxxxxxxx" inputMode="tel" onChange={on('parent_phone')} /></Field>
        </div>
      </section>

      <section className="card">
        <h3 className="disp">Keanggotaan</h3>
        <div className="form">
          <Field label="Status keanggotaan">
            <select value={f.status} onChange={on('status')}>
              <option value="trial">Trial (gratis 1 bulan)</option>
              <option value="member">Member ({U.rupiah(U.FEE)}/bulan)</option>
              {edit && <option value="berhenti">Berhenti</option>}
            </select>
          </Field>
          <Field label="Tanggal daftar" error={errs.joined_at}><input type="date" value={f.joined_at} onChange={on('joined_at')} /></Field>
        </div>
      </section>

      <div className="fact">
        <button className="btn" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan data'}</button>
        <Link className="btn ghost" to="/students">Batal</Link>
      </div>
    </form>
  );
}
