import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { CATS, fmtLong, todayStr, age, rupiah, joinedAt, monthLabel, STATUS_LABEL } from './utils';

const GREEN = [13, 122, 40];
const header = (doc, title, sub) => {
  doc.setFontSize(18); doc.setTextColor(...GREEN); doc.text('BROTHER ACADEMY', 14, 15);
  doc.setFontSize(9); doc.setTextColor(90); doc.text(`${title}  |  ${sub}  |  Dicetak ${fmtLong(todayStr())}`, 14, 21);
  return 27;
};
const section = (doc, y, text) => { doc.setFontSize(11); doc.setTextColor(...GREEN); doc.text(text, 14, y); return y + 3; };
const table = (doc, y, head, body, opts = {}) => {
  autoTable(doc, { startY: y, head: [head], body, theme: 'striped', headStyles: { fillColor: GREEN }, styles: { fontSize: 8.5, cellPadding: 2 }, margin: { left: 14, right: 14 }, ...opts });
  return doc.lastAutoTable.finalY + 8;
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function studentsPdf(students, title) {
  const doc = new jsPDF({ orientation: 'landscape' });
  let y = header(doc, 'Data Murid Academy', `${title} - ${students.length} murid`);
  for (const c of CATS) {
    const list = students.filter((s) => s.category === c);
    if (!list.length) continue;
    y = section(doc, y, `KU ${c} (${list.length} murid)`);
    y = table(doc, y, ['No', 'Nama', 'Status', 'Tgl lahir', 'Orang tua', 'Pekerjaan', 'No. WA'],
      list.map((s, i) => [i + 1, s.name, cap(s.status), `${fmtLong(s.birth_date)} (${age(s.birth_date)} th)`, s.parent_name, s.parent_job, s.parent_phone]));
    if (y > 180) { doc.addPage(); y = 20; }
  }
  doc.save(`data-academy-${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export function studentsExcel(students, name) {
  const rows = [['No', 'Nama Anak', 'Kategori', 'Status', 'Tanggal Lahir', 'Usia', 'Nama Orang Tua', 'Pekerjaan Orang Tua', 'No WA Orang Tua', 'Tanggal Daftar']]
    .concat(students.map((s, i) => [i + 1, s.name, 'KU ' + s.category, cap(s.status), fmtLong(s.birth_date), age(s.birth_date), s.parent_name, s.parent_job, s.parent_phone, fmtLong(joinedAt(s))]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [6, 26, 10, 10, 18, 6, 24, 22, 16, 18].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data Academy');
  XLSX.writeFile(wb, `data-academy-${name}.xlsx`);
}

export const importTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nama Anak', 'Nama Orang Tua', 'Pekerjaan Orang Tua', 'Tanggal Lahir (YYYY-MM-DD)', 'No WA Orang Tua', 'Kategori (3-6 / 6-9 / 9-12)', 'Status (trial / member)', 'Tanggal Daftar (YYYY-MM-DD)'],
    ['Rafi Pratama', 'Budi Pratama', 'Wiraswasta', '2020-03-12', '081255501122', '3-6', 'trial', todayStr()],
  ]);
  ws['!cols'] = Array(8).fill({ wch: 26 });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Murid');
  XLSX.writeFile(wb, 'template-import-murid.xlsx');
};

/** Rekap absensi satu bulan: people=[{id,name}], dates=['YYYY-MM-DD'], map[id][date]=status */
export function attendanceExcel(sheetTitle, fileName, people, dates, map) {
  const head = ['No', 'Nama', ...dates.map((d) => fmtLong(d, { weekday: 'short', day: '2-digit', month: '2-digit' })), 'Hadir', 'Izin', 'Sakit', 'Tidak hadir'];
  const rows = people.map((p, i) => {
    const sum = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    const cells = dates.map((d) => { const st = map[p.id]?.[d]; if (st) sum[st]++; return st ? STATUS_LABEL[st] : '-'; });
    return [i + 1, p.name, ...cells, sum.hadir, sum.izin, sum.sakit, sum.alpa];
  });
  const ws = XLSX.utils.aoa_to_sheet([[sheetTitle], [], head, ...rows]);
  ws['!cols'] = [{ wch: 5 }, { wch: 28 }, ...dates.map(() => ({ wch: 14 })), ...Array(4).fill({ wch: 11 })];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Absensi');
  XLSX.writeFile(wb, fileName);
}

export function paymentsPdf(d) {
  const doc = new jsPDF();
  let y = header(doc, 'Laporan Pembayaran Member', monthLabel(d.period));
  y = table(doc, y, ['Ringkasan', ''], [['Jumlah member', d.members.length], ['Sudah bayar', d.paid.length], ['Belum bayar', d.unpaid.length], ['Terkumpul', `${rupiah(d.income)} dari target ${rupiah(d.target)}`]]);
  y = section(doc, y, `Sudah membayar (${d.paid.length})`);
  y = table(doc, y, ['No', 'Nama', 'Kategori', 'Status', 'Tanggal bayar', 'Nominal'], d.paid.map((m, i) => [i + 1, m.name, 'KU ' + m.category, 'Lunas', fmtLong(d.payments[m.id].paid_at), rupiah(d.payments[m.id].amount)]));
  y = section(doc, y, `Belum membayar (${d.unpaid.length})`);
  table(doc, y, ['No', 'Nama', 'Kategori', 'Status', 'No. WA orang tua'], d.unpaid.map((m, i) => [i + 1, m.name, 'KU ' + m.category, 'Belum bayar', m.parent_phone]));
  doc.save(`laporan-pembayaran-${d.period.slice(0, 7)}.pdf`);
}

export function reportPdf(r) {
  const doc = new jsPDF();
  let y = header(doc, 'Laporan Bulanan', monthLabel(r.start));
  y = table(doc, y, ['Ringkasan bulan ini', ''], [['Murid aktif akhir bulan', r.activeTotal], ['Murid baru', r.newStudents.length], ['Member baru', r.newMembers.length], ['Murid berhenti', r.stopped.length], ['Rata-rata kehadiran', `${r.rate}%`]]);
  y = section(doc, y, 'Jumlah murid per kategori');
  y = table(doc, y, ['Kategori', 'Murid', 'Member', 'Trial', 'Pertemuan', 'Kehadiran'], CATS.map((c) => [`KU ${c}`, r.perKu[c].total, r.perKu[c].member, r.perKu[c].trial, r.perKu[c].sessions, r.perKu[c].sessions ? r.perKu[c].rate + '%' : '-']));
  y = section(doc, y, 'Pemasukan');
  y = table(doc, y, ['Keterangan', ''], [['Member aktif', r.memberTotal], ['Sudah membayar', r.paidCount], ['Belum membayar', r.unpaid.length], ['Terkumpul', `${rupiah(r.income)} dari target ${rupiah(r.target)}`]]);
  for (const [title, list] of [['Murid baru', r.newStudents], ['Member baru', r.newMembers], ['Murid berhenti', r.stopped]]) {
    if (y > 250) { doc.addPage(); y = 20; }
    y = section(doc, y, `${title} (${list.length})`);
    y = list.length ? table(doc, y, ['Nama', 'Kategori'], list.map((s) => [s.name, 'KU ' + s.category])) : (doc.setFontSize(9), doc.setTextColor(90), doc.text('Tidak ada.', 14, y + 5), y + 12);
  }
  if (y > 240) { doc.addPage(); y = 20; }
  y = section(doc, y, `Belum bayar bulan ${monthLabel(r.start)} (${r.unpaid.length})`);
  table(doc, y, ['Nama', 'Kategori', 'Bulan belum dibayar', 'No. WA orang tua'], r.unpaid.map((u) => [u.m.name, 'KU ' + u.m.category, `${u.due} bulan`, u.m.parent_phone]));
  doc.save(`laporan-bulanan-${r.start.slice(0, 7)}.pdf`);
}
