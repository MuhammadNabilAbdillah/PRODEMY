import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PHOTO_MAX_MB, fmtMb, photoError } from '../lib/photo';

// ---------- judul halaman ----------
export const TitleCtx = createContext(() => {});
export function useTitle(t) {
  const set = useContext(TitleCtx);
  useEffect(() => { set(t); document.title = `${t} · PRODEMY`; }, [t]); // eslint-disable-line
}

// ---------- popup notifikasi (berhasil / gagal / konfirmasi) ----------
// Pemakaian:
//   const toast = useToast();
//   toast('Data tersimpan')            -> popup "Berhasil" (tutup otomatis)
//   toast.success('Data tersimpan')    -> sama seperti di atas
//   toast.error('Koneksi terputus')    -> popup "Gagal" (tutup dengan tombol)
//   if (await toast.confirm('Hapus?', { danger: true })) { ... }
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

const TITLE = { success: 'Berhasil', error: 'Gagal', confirm: 'Konfirmasi' };
const AUTO_CLOSE_MS = 3200;

function PopIcon({ type }) {
  return (
    <span className={`pop-icon ${type}`} aria-hidden="true">
      <svg viewBox="0 0 52 52" fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <circle className="ring" cx="26" cy="26" r="23" pathLength="1" />
        {type === 'success' && <path className="mark" d="M15.5 27l7.5 7.5L37 18.5" pathLength="1" />}
        {type === 'error' && <path className="mark" d="M18 18l16 16M34 18L18 34" pathLength="1" />}
        {type === 'confirm' && <><path className="mark" d="M26 14.5v14" pathLength="1" /><circle className="dot" cx="26" cy="36.5" r="1.2" /></>}
      </svg>
    </span>
  );
}

function Popup({ pop, onClose }) {
  const okRef = useRef(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pop.id]); // eslint-disable-line
  const isConfirm = pop.type === 'confirm';
  return (
    <div className="pop-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className={`pop ${pop.type}`} role="alertdialog" aria-modal="true" aria-labelledby="pop-t" aria-describedby="pop-m">
        <PopIcon type={pop.type} />
        <h2 id="pop-t">{pop.title}</h2>
        <p id="pop-m">{pop.message}</p>
        <div className="pop-acts">
          {isConfirm && <button type="button" className="btn ghost" onClick={() => onClose(false)}>{pop.cancelText}</button>}
          <button type="button" ref={okRef} className={`btn${pop.danger ? ' danger' : ''}`} onClick={() => onClose(true)}>{pop.okText}</button>
        </div>
        {pop.type === 'success' && <span className="pop-bar" style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }} />}
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [pop, setPop] = useState(null);
  const cur = useRef(null);
  const timer = useRef(0);

  const close = useCallback((result = false) => {
    clearTimeout(timer.current);
    const p = cur.current;
    cur.current = null; setPop(null);
    p?.resolve?.(result);
  }, []);

  const api = useMemo(() => {
    const show = (type, message, o = {}) => {
      clearTimeout(timer.current);
      cur.current?.resolve?.(false); // popup lama yang belum dijawab dianggap batal
      const p = {
        id: Math.random(), type, message: String(message ?? ''), title: o.title || TITLE[type],
        okText: o.okText || (type === 'confirm' ? 'Ya, lanjutkan' : type === 'error' ? 'Tutup' : 'Oke'),
        cancelText: o.cancelText || 'Batal', danger: o.danger, resolve: o.resolve,
      };
      cur.current = p; setPop(p);
      if (type === 'success') timer.current = setTimeout(() => close(true), AUTO_CLOSE_MS);
    };
    const toast = (m, o) => show('success', m, o);
    toast.success = toast;
    toast.error = (m, o) => show('error', m, o);
    toast.confirm = (m, o) => new Promise((resolve) => show('confirm', m, { ...o, resolve }));
    return toast;
  }, [close]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return <ToastCtx.Provider value={api}>{children}{pop && <Popup key={pop.id} pop={pop} onClose={close} />}</ToastCtx.Provider>;
}

// ---------- file privat (foto & bukti) ----------
const cache = new Map();
export async function signedUrl(bucket, path) {
  const k = bucket + '/' + path, c = cache.get(k);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  cache.set(k, { url: data.signedUrl, exp: Date.now() + 3000e3 });
  return data.signedUrl;
}
export async function openFile(bucket, path) {
  const w = window.open('', '_blank'); // dibuka dulu agar tidak diblokir browser
  try { const u = await signedUrl(bucket, path); if (w) w.location.href = u; } catch { if (w) w.close(); alert('File tidak bisa dibuka.'); }
}
export function Avatar({ photo, name, bucket = 'photos', className = 'av', style }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (photo) signedUrl(bucket, photo).then((u) => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [photo, bucket]);
  if (photo && url) return <img className={className} style={style} src={url} alt={name || ''} />;
  return <div className={className} style={style}>{(name || '?').charAt(0).toUpperCase()}</div>;
}
export function FileLink({ bucket, path, children = 'Lihat bukti' }) {
  if (!path) return <>-</>;
  return <a href="#bukti" onClick={(e) => { e.preventDefault(); openFile(bucket, path); }} style={{ color: 'var(--gd)', fontWeight: 700 }}>{children}</a>;
}

// ---------- potongan kecil ----------
export const Chip = ({ tone = '', children, className = '' }) => <span className={`chip ${tone} ${className}`}>{children}</span>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Loading = () => <div className="empty">Memuat data...</div>;
export const ErrorBox = ({ error }) => error ? <div className="alert red">Gagal memuat data: {error.message || String(error)}</div> : null;
export const Field = ({ label, error, full, children }) => (
  <div className={full ? 'full' : ''}><label>{label}</label>{children}{error && <div className="err">{error}</div>}</div>
);
export const WaBtn = ({ href, children = 'WA', sm = true }) => (
  <a className={`btn wa${sm ? ' sm' : ''}`} target="_blank" rel="noreferrer" href={href}><i className="bi bi-whatsapp" /> {children}</a>
);

/**
 * Pemilih foto yang rapi: preview, nama + ukuran file, tombol pilih/ganti/hapus, batas ukuran (PHOTO_MAX_MB).
 *  value    : File yang dipilih (atau null)
 *  onChange : (file|null) => void  (foto yang melebihi batas ditolak dan pesannya tampil di bawah)
 *  current  : path foto lama di Supabase Storage (tampil bila belum memilih foto baru)
 *  dataUrl  : alternatif untuk foto lama yang sudah berbentuk data URL (portal orang tua)
 */
export function PhotoPicker({ value, onChange, current, dataUrl, name, error, round = true, disabled }) {
  const [prev, setPrev] = useState('');
  const [localErr, setLocalErr] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (!value) { setPrev(''); return undefined; }
    const u = URL.createObjectURL(value);
    setPrev(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  const pick = (e) => {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (!f) return;
    const msg = photoError(f);
    setLocalErr(msg);
    if (!msg) onChange(f);
  };
  const shape = round ? 'pk-round' : '';
  const msg = localErr || error;
  return (
    <div className="pk">
      <div className="pk-row">
        {prev ? <img className={`pk-img ${shape}`} src={prev} alt="Foto yang dipilih" />
          : dataUrl ? <img className={`pk-img ${shape}`} src={dataUrl} alt="Foto saat ini" />
          : current ? <Avatar photo={current} name={name} className={`pk-img ${shape}`} />
          : <span className={`pk-img pk-empty ${shape}`}><i className="bi bi-camera" /></span>}
        <div className="pk-body">
          {value ? <><b className="pk-file">{value.name}</b><small>{fmtMb(value.size)} · siap diunggah</small></>
            : <><b>{current || dataUrl ? 'Foto saat ini' : 'Belum ada foto'}</b><small>JPG, PNG, atau WEBP · maksimal {PHOTO_MAX_MB} MB</small></>}
          <div className="pk-acts">
            <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
              <i className="bi bi-upload" /> {value || current || dataUrl ? 'Ganti foto' : 'Pilih foto'}
            </button>
            {value && <button type="button" className="btn red sm" disabled={disabled} onClick={() => { setLocalErr(''); onChange(null); }}><i className="bi bi-x-lg" /> Batal pilih</button>}
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
      {msg && <div className="err">{msg}</div>}
    </div>
  );
}
