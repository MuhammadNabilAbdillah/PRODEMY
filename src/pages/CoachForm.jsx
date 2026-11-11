import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, upload, removeFile } from '../lib/supabase';
import { compressImage } from '../lib/photo';
import { ErrorBox, Field, Loading, PhotoPicker, useTitle, useToast } from '../components/ui';
import * as U from '../lib/utils';

const EMPTY = { name: '', birth_date: '', phone: '', role: 'Coach' };

export default function CoachForm() {
  const { id } = useParams();
  const edit = Boolean(id);
  useTitle(edit ? 'Edit Coach' : 'Tambah Coach');
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
    supabase.from('coaches').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) setLoadErr(error); else { setOld(data); setF({ ...EMPTY, ...data }); }
      setLoading(false);
    });
  }, [id, edit]);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    ['name', 'birth_date', 'phone'].forEach((k) => { if (!String(f[k] || '').trim()) er[k] = 'Wajib diisi.'; });
    if (f.birth_date && f.birth_date >= U.todayStr()) er.birth_date = 'Tanggal lahir harus sebelum hari ini.';
    setErrs(er);
    if (Object.keys(er).length) return toast.error('Data belum bisa disimpan. Periksa kolom yang ditandai merah.');
    setBusy(true);
    try {
      const row = { name: f.name.trim(), birth_date: f.birth_date, phone: f.phone.trim(), role: f.role };
      if (file) {
        let up = file;
        try { up = await compressImage(file); } catch { /* format yang tidak bisa dibaca browser diunggah apa adanya */ }
        row.photo = await upload('photos', 'coaches', up);
      }
      const { error } = await (edit ? supabase.from('coaches').update(row).eq('id', id) : supabase.from('coaches').insert(row));
      if (error) { if (row.photo) await removeFile('photos', row.photo); throw error; }
      if (file && old?.photo) await removeFile('photos', old.photo);
      toast(edit ? 'Data coach berhasil diperbarui.' : 'Data coach berhasil ditambahkan.');
      nav(edit ? `/coaches/${id}` : '/coaches');
    } catch (x) { setErrs({ form: U.cleanMsg(x) }); toast.error(U.cleanMsg(x)); } finally { setBusy(false); }
  };

  if (loading) return <Loading />;
  if (loadErr) return <ErrorBox error={loadErr} />;
  return (
    <form className="fwrap" onSubmit={submit} noValidate>
      {errs.form && <div className="alert red">{errs.form}</div>}

      <section className="card">
        <h3 className="disp">Foto coach</h3>
        <PhotoPicker value={file} onChange={setFile} current={old?.photo} name={f.name} disabled={busy} />
      </section>

      <section className="card">
        <h3 className="disp">Data coach</h3>
        <div className="form">
          <Field label="Nama" error={errs.name} full><input value={f.name} onChange={on('name')} /></Field>
          <Field label="Posisi"><select value={f.role} onChange={on('role')}><option>Coach</option><option>Asisten Coach</option></select></Field>
          <Field label="Tanggal lahir" error={errs.birth_date}><input type="date" value={f.birth_date} max={U.todayStr()} onChange={on('birth_date')} /></Field>
          <Field label="Nomor HP / WA" error={errs.phone} full><input value={f.phone} inputMode="tel" placeholder="08xxxxxxxxxx" onChange={on('phone')} /></Field>
        </div>
      </section>

      <div className="fact">
        <button className="btn" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan data'}</button>
        <Link className="btn ghost" to={edit ? `/coaches/${id}` : '/coaches'}>Batal</Link>
      </div>
    </form>
  );
}
