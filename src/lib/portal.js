import { supabase, upload } from './supabase';
import * as U from './utils';
import { compressImage, makeAvatar } from './photo';

// =====================================================================
//  PENGATURAN PORTAL ORANG TUA  (ubah di sini, tidak perlu menyentuh halaman lain)
// =====================================================================

/** Jam latihan semua kategori (WITA) */
export const TRAIN_TIME = '16.00 - 17.30';
/** Grup WhatsApp orang tua */
export const WA_GROUP = 'https://chat.whatsapp.com/Fcg44qCBuGS7JnAehiBjdF';
/** Nomor WhatsApp admin/contact person untuk konfirmasi pembayaran, format 628xxxxxxxxxx.
 *  Dikosongkan karena nomor di brosur terpotong. Jika kosong, tombol konfirmasi mengarah ke grup WhatsApp. */
export const CONTACT_PHONE = '';
/** Catatan di halaman Pembayaran Member */
export const PAY_NOTE = 'Transfer sesuai total tagihan ke rekening di bawah, lalu unggah bukti pembayaran. Admin akan memverifikasi dan status berubah menjadi Lunas.';
/** Rekening tujuan transfer */
export const BANK = { name: 'Bank Mandiri', number: '1480027999153', holder: 'Checyl Helendsfir' };
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const PROOF_MAX_MB = 5;
/** Teks status setelah mendaftar online (anak masuk sebagai "trial" di data admin) */
export const TRIAL_TEXT = 'Anak yang mendaftar online masuk masa trial 1 bulan. Admin akan menghubungi lewat WhatsApp untuk konfirmasi lanjut menjadi member.';

export const MAX_CHILDREN = 8;
/** Jumlah anak minimal untuk mendapat harga promo (sesuai brosur: 3 anak sekeluarga / adik kakak) */
export const PROMO_MIN = 3;

/**
 * Harga per anak.
 *  base  = harga normal per anak per periode
 *  promo = harga per anak per periode bila mendaftar PROMO_MIN anak atau lebih
 * Dari brosur: 3 anak Member = Rp540.000/2 bulan (180.000 per anak), 3 anak Reguler = Rp300.000/bulan (100.000 per anak).
 * Untuk 4 anak atau lebih, harga promo per anak yang sama dipakai. Untuk 2 anak belum ada diskon (brosur tidak menyebut).
 */
export const PLANS = {
  reguler: { label: 'Reguler', period: 'bulan', months: 1, base: 125000, promo: 100000 },
  member: { label: 'Member', period: '2 bulan', months: 2, base: 225000, promo: 180000 },
};

/** Hitung total harga untuk n anak pada paket tertentu */
export function quote(plan, n) {
  const p = PLANS[plan] || PLANS.reguler;
  const promo = n >= PROMO_MIN;
  const per = promo ? p.promo : p.base;
  const total = per * n, normal = p.base * n;
  return { per, total, normal, save: normal - total, promo, period: p.period, label: p.label };
}

/** Kategori otomatis dari tanggal lahir: usia 3-5 = KU 3-6, 6-8 = KU 6-9, 9-12 = KU 9-12. Di luar itu = null */
export function categoryFor(birth) {
  if (!birth || birth >= U.todayStr()) return null;
  const a = U.age(birth);
  if (a < 3 || a > 12) return null;
  return a < 6 ? '3-6' : a < 9 ? '6-9' : '9-12';
}

/** Latihan berikutnya untuk suatu kategori: { date, inDays } (latihan hari ini dianggap lewat setelah pukul 18.00) */
export function nextTraining(category) {
  const days = U.SCHEDULE[category]?.days || [];
  const t = U.todayStr();
  for (let i = 0; i < 8; i++) {
    const d = U.addDays(t, i);
    if (!days.includes(U.weekday(d))) continue;
    if (i === 0 && U.hourNow() >= 18) continue;
    return { date: d, inDays: i };
  }
  return null;
}
export const whenLabel = (inDays) => (inDays === 0 ? 'Hari ini' : inDays === 1 ? 'Besok' : `${inDays} hari lagi`);

// ---------- identitas masuk yang tersimpan di perangkat (pengganti login) ----------
// Masuk memakai nama lengkap DAN tanggal lahir anak, supaya anak yang namanya sama tidak membuka data orang lain.
const KEY = 'prodemy-portal-login';
const readSaved = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.name && v.birth ? v : null; } catch { return null; } };
export const getSavedName = () => readSaved()?.name || '';
export const getSavedBirth = () => readSaved()?.birth || '';
export const saveName = (name, birth) => { try { localStorage.setItem(KEY, JSON.stringify({ name, birth })); } catch { /* abaikan */ } };
export const clearName = () => { try { localStorage.removeItem(KEY); localStorage.removeItem('prodemy-portal-name'); } catch { /* abaikan */ } };
const sameName = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');

// ---------- panggilan ke Supabase (hanya lewat fungsi yang aman) ----------
export async function registerFamily({ parent, plan, kids, onPhoto }) {
  // unggah foto setiap anak lebih dulu (dilewati bila sudah terunggah pada percobaan sebelumnya)
  const photos = [], avatars = [];
  for (const k of kids) {
    let path = k.photo_path;
    if (!path) {
      path = await upload('photos', 'registrations', await compressImage(k.photo));
      if (onPhoto) onPhoto(k.key, path);
    }
    photos.push(path);
    avatars.push(await makeAvatar(k.photo).catch(() => null)); // versi kecil untuk dashboard orang tua
  }
  const { data, error } = await supabase.rpc('portal_register', {
    p_parent_name: parent.name.trim(),
    p_parent_job: parent.job.trim(),
    p_parent_phone: parent.phone.trim(),
    p_plan: plan,
    p_children: kids.map((k, i) => ({ name: k.name.trim(), birth_date: k.birth_date, photo: photos[i], avatar: avatars[i] })),
  });
  if (error) throw error;
  return data;
}

/**
 * Orang tua mengubah profil anak (tanpa login; kuncinya nama anak yang dipakai masuk).
 * Nomor HP dan pekerjaan "hanya tulis": kosong = tidak diubah, dan tidak pernah dikirim balik ke portal.
 */
export async function updateProfile({ name, id, parentName, birthDate, phone, job, photo, childName, childBirth }) {
  const birth = getSavedBirth();
  let path = null, avatar = null;
  if (photo) {
    avatar = await makeAvatar(photo);
    path = await upload('photos', 'registrations', await compressImage(photo));
  }
  const { error } = await supabase.rpc('portal_update_profile', {
    p_name: name, p_birth: birth, p_id: id,
    p_parent_name: parentName?.trim() || null,
    p_birth_date: birthDate || null,
    p_parent_phone: phone?.trim() || null,
    p_parent_job: job?.trim() || null,
    p_photo: path, p_avatar: avatar,
  });
  if (error) throw error;
  // bila yang diubah adalah anak yang dipakai untuk masuk, tanggal lahir tersimpan di perangkat ikut diperbarui
  if (birthDate && childBirth === birth && sameName(childName, name)) saveName(name, birthDate);
}

/** Unggah bukti transfer lalu kirim ke admin (status awal: menunggu verifikasi) */
export async function submitPayment({ name, studentIds, period, amount, file, note }) {
  if (!PROOF_TYPES.includes(file.type)) throw new Error('Bukti harus berupa foto (JPG, PNG, WEBP) atau PDF.');
  if (file.size > PROOF_MAX_MB * 1024 * 1024) throw new Error(`Ukuran file maksimal ${PROOF_MAX_MB} MB.`);
  const proof = await upload('proofs', 'submissions', file);
  const { data, error } = await supabase.rpc('portal_submit_payment', {
    p_name: name, p_birth: getSavedBirth(), p_student_ids: studentIds, p_period: period, p_amount: amount, p_proof: proof, p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function loadPortal(name, birth) {
  const { data, error } = await supabase.rpc('portal_data', { p_name: name, p_birth: birth });
  if (error) throw error;
  return data || { children: [] };
}

export const cleanErr = (e) => {
  const m = e?.message || String(e || '');
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.';
  if (/could not find the function|schema cache/i.test(m)) return 'Fitur portal belum aktif di database. Jalankan file migrasi di folder supabase/migrations (20260102 sampai 20260106) di Supabase.';
  if (/row-level security|mime type|exceeded the maximum/i.test(m)) return 'File tidak bisa diunggah. Pastikan berupa foto atau PDF maksimal 5 MB.';
  return m;
};
