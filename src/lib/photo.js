// =====================================================================
//  Foto: batas ukuran, pengecilan, dan versi kecil (avatar) untuk portal orang tua
// =====================================================================

/** Ukuran maksimal foto yang boleh dipilih (MB). Samakan dengan batas bucket "photos" di Supabase. */
export const PHOTO_MAX_MB = 5;
const PHOTO_MAX = PHOTO_MAX_MB * 1024 * 1024;
export const fmtMb = (b) => (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';

/** Pesan kesalahan untuk foto yang dipilih, atau '' bila aman dipakai */
export function photoError(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) return 'File harus berupa foto (JPG, PNG, atau WEBP).';
  if (file.size > PHOTO_MAX) return `Ukuran foto maksimal ${PHOTO_MAX_MB} MB. Foto ini ${fmtMb(file.size)}.`;
  return '';
}

async function decode(file) {
  try { return await createImageBitmap(file); } catch { throw new Error('Foto tidak bisa dibaca. Gunakan foto berformat JPG atau PNG.'); }
}
const toBlob = (canvas, quality) => new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));

/** Kecilkan foto (sisi terpanjang maks. `max` px, JPEG) supaya cepat diunggah dari HP */
export async function compressImage(file, max = 1200, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Foto harus berupa gambar (JPG, PNG, atau WEBP).');
  const bmp = await decode(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await toBlob(c, quality);
  if (!blob) throw new Error('Foto tidak bisa diproses. Coba foto lain.');
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
}

/** Foto persegi kecil (data URL JPEG, kira-kira 20-40 KB) untuk ditampilkan di portal orang tua */
export async function makeAvatar(file, size = 320) {
  const bmp = await decode(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  for (const q of [0.82, 0.7, 0.55]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= 150000) return url;
  }
  return c.toDataURL('image/jpeg', 0.4);
}

/**
 * Siapkan foto untuk diunggah dari form admin: { file, avatar }.
 * Bila foto tidak bisa dibaca browser (mis. HEIC), file asli tetap dipakai tanpa avatar.
 */
export async function prepPhoto(file) {
  try { return { file: await compressImage(file), avatar: await makeAvatar(file) }; }
  catch { return { file, avatar: null }; }
}
