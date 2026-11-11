/**
 * Memberi atribut data-label pada setiap sel tabel (diambil dari teks kepala kolom)
 * supaya di HP tabel bisa tampil sebagai kartu: "Judul kolom: isi".
 * Dipasang sekali di main.jsx dan mengamati seluruh halaman, jadi semua tabel otomatis ikut.
 */
function label(root) {
  root.querySelectorAll('table').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim());
    if (!heads.length) return;
    t.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        if (td.tagName !== 'TD' || td.hasAttribute('colspan')) return;
        const v = heads[i] || '';
        if (td.dataset.label !== v) td.dataset.label = v;
      });
    });
  });
}

export function watchTableLabels() {
  const host = document.getElementById('root');
  if (!host) return () => {};
  let raf = 0;
  const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => label(host)); };
  const mo = new MutationObserver(run);
  mo.observe(host, { childList: true, subtree: true, characterData: true });
  run();
  return () => mo.disconnect();
}
