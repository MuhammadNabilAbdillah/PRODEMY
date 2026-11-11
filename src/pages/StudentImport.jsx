import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { fetchAll, supabase } from '../lib/supabase';
import { useTitle, useToast } from '../components/ui';
import { importTemplate } from '../lib/exports';
import * as U from '../lib/utils';

/** terima 2020-03-12 atau 12/03/2020; selain itu dianggap salah */
function toDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return U.ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return U.ymd(+m[3], +m[2], +m[1]);
  return null;
}

export default function StudentImport() {
  useTitle('Impor Murid dari Excel');
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);

  const run = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErrors([]);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const all = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      // template lama masih punya kolom NIK (kolom ke-5): buang saja supaya file lama tetap bisa dipakai
      const oldTpl = /nik/i.test(String(all[0]?.[4] ?? ''));
      const rows = all.slice(1).map((r) => (oldTpl ? r.filter((_, i) => i !== 4) : r));
      const key = (n, b) => `${String(n).trim().toLowerCase().replace(/\s+/g, ' ')}|${b}`;
      const existing = new Set((await fetchAll('students', 'name,birth_date')).map((s) => key(s.name, s.birth_date)));
      const errs = [], valid = [], seen = new Set();

      rows.forEach((r, i) => {
        if (r.every((c) => String(c).trim() === '')) return;
        const line = i + 2, name = String(r[0]).trim();
        const row = {
          name, parent_name: String(r[1]).trim(), parent_job: String(r[2]).trim(), birth_date: toDate(r[3]),
          parent_phone: String(r[4]).trim(),
          category: String(r[5]).replace(/ku/i, '').trim(), status: String(r[6]).trim().toLowerCase() || 'trial',
          joined_at: String(r[7]).trim() ? toDate(r[7]) : U.todayStr(),
        };
        const bad = !row.name || !row.parent_name || !row.parent_job || !row.parent_phone ? 'ada kolom wajib yang kosong'
          : !row.birth_date || !row.joined_at ? 'format tanggal salah (pakai 2020-03-12)'
          : !U.CATS.includes(row.category) ? 'kategori harus 3-6, 6-9, atau 9-12'
          : !['trial', 'member'].includes(row.status) ? 'status harus trial atau member'
          : existing.has(key(row.name, row.birth_date)) || seen.has(key(row.name, row.birth_date)) ? 'murid dengan nama dan tanggal lahir yang sama sudah terdaftar' : null;
        if (bad) return errs.push(`Baris ${line} (${name || 'tanpa nama'}): ${bad}.`);
        seen.add(key(row.name, row.birth_date));
        valid.push({ ...row, member_since: row.status === 'member' ? row.joined_at : null });
      });

      if (valid.length) { const { error } = await supabase.from('students').insert(valid); if (error) throw error; }
      setErrors(errs);
      if (valid.length) toast(`${valid.length} murid berhasil diimpor.${errs.length ? ` ${errs.length} baris dilewati.` : ''}`);
      else toast.error(errs.length ? `Tidak ada murid yang berhasil diimpor. ${errs.length} baris bermasalah, lihat daftar di bawah.` : 'File tidak berisi data murid.');
      setFile(null); e.target.reset();
    } catch (x) { setErrors([U.cleanMsg(x)]); toast.error(U.cleanMsg(x)); } finally { setBusy(false); }
  };

  return (
    <>
      {errors.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderTopColor: 'var(--amb)' }}>
          <h3>Baris yang dilewati</h3>{errors.map((m, i) => <div className="bd" key={i}>{m}</div>)}
        </div>
      )}
      <div className="grid g2">
        <form className="card" onSubmit={run}>
          <h3 className="disp" style={{ fontSize: 22 }}>1. Unggah file</h3>
          <p style={{ color: 'var(--mut)', marginBottom: 14 }}>Pilih file Excel (.xlsx) yang sudah diisi sesuai template. Murid dengan nama dan tanggal lahir yang sama dengan data yang sudah ada akan dilewati.</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files[0] || null)} style={{ marginBottom: 14 }} />
          <button className="btn" disabled={!file || busy}><i className="bi bi-upload" /> {busy ? 'Mengimpor...' : 'Impor sekarang'}</button>{' '}
          <Link className="btn ghost" to="/students">Kembali</Link>
        </form>
        <div className="card">
          <h3 className="disp" style={{ fontSize: 22 }}>Template</h3>
          <p style={{ color: 'var(--mut)', marginBottom: 14 }}>Unduh template, isi data murid mulai baris ke-2, lalu unggah di sebelah.</p>
          <button className="btn dark" onClick={importTemplate}><i className="bi bi-file-earmark-excel" /> Unduh template</button>
          <ul style={{ margin: '14px 0 0 18px', color: 'var(--mut)' }}>
            <li>Kategori: 3-6, 6-9, atau 9-12</li><li>Status: trial atau member</li><li>Tanggal: format 2020-03-12</li><li>Kolom NIK tidak diperlukan lagi</li>
          </ul>
        </div>
      </div>
    </>
  );
}
