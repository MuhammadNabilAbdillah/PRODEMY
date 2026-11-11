export const SCHEDULE = {
  '3-6': { days: [5, 6], label: 'Jumat & Sabtu' },
  '6-9': { days: [5, 6], label: 'Jumat & Sabtu' },
  '9-12': { days: [6, 0], label: 'Sabtu & Minggu' },
};
export const CATS = Object.keys(SCHEDULE);
export const COACH_DAYS = [5, 6, 0];
export const FEE = 125000;
export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const YEARS = Array.from({ length: 55 }, (_, i) => 2026 + i); // 2026 - 2080
export const STATUS_LABEL = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpa: 'Tidak hadir' };
export const STATUS_CHIP = { trial: 'amb', member: 'blue', berhenti: 'red' };
export const ATT_CHIP = { hadir: '', izin: 'blue', sakit: 'amb', alpa: 'red' };

const TZ = 'Asia/Makassar'; // WITA
// ---------- tanggal (semua dalam bentuk 'YYYY-MM-DD', dihitung di UTC agar tidak bergeser) ----------
const U = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const S = (dt) => dt.toISOString().slice(0, 10);
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const hourNow = () => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()), 10) % 24;
export const addDays = (s, n) => { const d = U(s); d.setUTCDate(d.getUTCDate() + n); return S(d); };
export const addMonths = (s, n) => { const d = U(s); d.setUTCMonth(d.getUTCMonth() + n); return S(d); };
export const diffDays = (a, b) => Math.round((U(b) - U(a)) / 864e5);
export const monthStart = (s) => s.slice(0, 7) + '-01';
export const monthEnd = (s) => { const d = U(monthStart(s)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return S(d); };
export const ymd = (y, m, d = 1) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const weekday = (s) => U(s).getUTCDay();
export const fmtLong = (s, o = { day: '2-digit', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat('id-ID', { ...o, timeZone: 'UTC' }).format(U(s));
export const fmtDayLong = (s) => fmtLong(s, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
export const monthLabel = (s) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
export const shortMonth = (s) => new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(U(s));
export const age = (birth, ref = todayStr()) => {
  const b = U(birth), r = U(ref);
  let a = r.getUTCFullYear() - b.getUTCFullYear();
  if (r.getUTCMonth() < b.getUTCMonth() || (r.getUTCMonth() === b.getUTCMonth() && r.getUTCDate() < b.getUTCDate())) a--;
  return a;
};
/** Tanggal latihan (YYYY-MM-DD) dalam satu bulan untuk hari-hari tertentu (0=Minggu ... 6=Sabtu) */
export function trainingDates(year, month, days) {
  const out = [], last = monthEnd(ymd(year, month));
  for (let d = ymd(year, month); d <= last; d = addDays(d, 1)) if (days.includes(weekday(d))) out.push(d);
  return out;
}
/** Tanggal latihan yang dibuka otomatis: yang terakhir <= hari ini, atau yang pertama */
export const defaultDate = (dates) => [...dates].reverse().find((d) => d <= todayStr()) || dates[0] || null;

// ---------- murid ----------
export const joinedAt = (s) => s.joined_at || s.created_at.slice(0, 10);
export const trialEnds = (s) => addMonths(joinedAt(s), 1);
export const trialDaysLeft = (s) => diffDays(todayStr(), trialEnds(s));
export const stoppedAt = (s) => (s.status === 'berhenti' ? (s.stopped_at || s.created_at.slice(0, 10)) : null);
export const activeAt = (students, end) => students.filter((s) => joinedAt(s) <= end && (!stoppedAt(s) || stoppedAt(s) > end));
export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
export const compactRp = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' jt' : n >= 1000 ? Math.round(n / 1000) + ' rb' : String(n));
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ---------- WhatsApp ----------
export function waLink(phone, msg) {
  let n = String(phone || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}
export const waIuran = (s, label, total = FEE) => `Halo Bapak/Ibu ${s.parent_name}, salam dari Brother Academy. Kami mengingatkan iuran member ${s.name} untuk ${label} sebesar ${rupiah(total)} belum kami terima. Mohon konfirmasinya. Terima kasih.`;
export const waTrial = (s) => `Halo Bapak/Ibu ${s.parent_name}, salam dari Brother Academy. Masa trial gratis ${s.name} ${trialDaysLeft(s) < 0 ? 'sudah berakhir' : 'akan berakhir'} pada ${fmtLong(trialEnds(s))}. Apakah ingin lanjut menjadi member (${rupiah(FEE)}/bulan)? Mohon konfirmasinya. Terima kasih.`;
export const waBirthday = (s) => `Selamat ulang tahun ${s.name}! Semoga sehat, makin semangat berlatih, dan sukses selalu. Salam dari seluruh keluarga Brother Academy.`;
export const waAbsen = (s) => `Halo Bapak/Ibu ${s.parent_name}, salam dari Brother Academy. Kami melihat ${s.name} tidak hadir pada 3 latihan terakhir. Apakah ada kendala? Kami tunggu ${s.name} di latihan berikutnya ya. Terima kasih.`;

export const cleanMsg = (e) => {
  if (!e) return '';
  if (e.code === '23505') return 'Data duplikat: data yang sama sudah terdaftar.';
  if (e.code === '23514') return 'Ada isian yang tidak sesuai aturan. Periksa kembali isian formulir.';
  if (e.code === '23502' && /nik/i.test(e.message || '')) return 'Database masih mewajibkan NIK. Jalankan migrasi 20260106 di Supabase (lihat README).';
  return e.message || String(e);
};
