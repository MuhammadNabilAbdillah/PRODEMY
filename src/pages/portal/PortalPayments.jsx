import { useState } from 'react';
import { Chip, Empty, useTitle, useToast } from '../../components/ui';
import { usePortal } from './PortalLayout';
import * as P from '../../lib/portal';
import * as U from '../../lib/utils';

const SUB_CHIP = { menunggu: ['amb', 'Menunggu verifikasi'], disetujui: ['', 'Disetujui'], ditolak: ['red', 'Ditolak'] };

function BankCard() {
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(P.BANK.number); toast('Nomor rekening disalin.'); }
    catch { toast.error('Tidak bisa menyalin otomatis. Salin nomor rekening secara manual.'); }
  };
  return (
    <div className="pb-bank">
      <small>Transfer ke</small>
      <b className="pb-bankname">{P.BANK.name}</b>
      <div className="pb-bankno"><span>{P.BANK.number}</span><button type="button" className="btn ghost sm" onClick={copy}><i className="bi bi-clipboard" /> Salin</button></div>
      <div>a.n. <b>{P.BANK.holder}</b></div>
    </div>
  );
}

function ProofForm({ kids, name, q, period, reload }) {
  const toast = useToast();
  const members = kids.filter((c) => c.status === 'member');
  const [ids, setIds] = useState(() => members.filter((c) => !c.payments.some((p) => p.period === period)).map((c) => c.id));
  const [per, setPer] = useState(period);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const periods = [-1, 0, 1].map((d) => U.addMonths(period, d));
  const total = q.per * ids.length;
  const toggle = (id) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  if (!members.length) return <div className="alert amb" style={{ marginBottom: 0 }}>Unggah bukti pembayaran dibuka setelah anak menjadi member. Admin akan menghubungi Anda setelah masa trial.</div>;

  const submit = async (e) => {
    e.preventDefault();
    if (!ids.length) return toast.error('Pilih minimal satu anak yang dibayar.');
    if (!file) return toast.error('Pilih file bukti pembayaran (foto atau PDF).');
    setBusy(true);
    try {
      await P.submitPayment({ name, studentIds: ids, period: per, amount: total, file, note });
      toast('Bukti pembayaran terkirim. Admin akan memverifikasi, lalu status berubah menjadi Lunas.');
      setFile(null); setNote(''); reload();
    } catch (x) { toast.error(P.cleanErr(x)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="pb-proof">
      <label>Anak yang dibayar</label>
      <div className="pb-kids">
        {members.map((c) => (
          <label key={c.id} className={`pb-kid${ids.includes(c.id) ? ' on' : ''}`}>
            <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} /> {c.name}
          </label>
        ))}
      </div>
      <label>Bulan yang dibayar</label>
      <select value={per} onChange={(e) => setPer(e.target.value)}>{periods.map((p) => <option key={p} value={p}>{U.monthLabel(p)}</option>)}</select>
      <div className="pb-total" style={{ marginTop: 14 }}><span>Total transfer</span><b>{U.rupiah(total)}</b></div>
      <label style={{ marginTop: 14 }}>Bukti transfer (foto atau PDF, maks. {P.PROOF_MAX_MB} MB)</label>
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
      <label style={{ marginTop: 14 }}>Catatan (opsional)</label>
      <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: transfer atas nama Ibu Siti" />
      <button className="btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Mengirim...' : 'Kirim bukti pembayaran'}</button>
    </form>
  );
}

export default function PortalPayments() {
  useTitle('Pembayaran Member');
  const { children, child, name, reload } = usePortal();
  const t = U.todayStr(), period = U.monthStart(t);

  const active = children.filter((c) => c.status !== 'berhenti');
  const n = Math.max(1, active.length);
  const plan = child.plan;
  const q = P.quote(plan, n);
  const next = n < P.PROMO_MIN ? P.quote(plan, P.PROMO_MIN) : null;

  const history = children.flatMap((c) => c.payments.map((p) => ({ ...p, name: c.name })))
    .sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : a.name.localeCompare(b.name)));

  const statusOf = (c) => {
    if (c.status === 'berhenti') return <Chip tone="red">Berhenti</Chip>;
    if (c.status === 'trial') return <Chip tone="amb">Trial gratis sampai {U.fmtLong(U.trialEnds(c))}</Chip>;
    if (c.payments.some((p) => p.period === period)) return <Chip>Lunas {U.monthLabel(period)}</Chip>;
    if ((c.submissions || []).some((s) => s.period === period && s.status === 'menunggu')) return <Chip tone="amb">Menunggu verifikasi {U.monthLabel(period)}</Chip>;
    return <Chip tone="red">Belum bayar {U.monthLabel(period)}</Chip>;
  };

  const submissions = [...new Map(children.flatMap((c) => c.submissions || []).map((s) => [s.id, s])).values()]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const names = children.map((c) => c.name).join(', ');
  const wa = P.CONTACT_PHONE
    ? U.waLink(P.CONTACT_PHONE, `Halo admin Brother Academy, saya orang tua dari ${names}. Saya ingin konfirmasi pembayaran member.`)
    : P.WA_GROUP;

  return (
    <>
      <div className="pb-head">
        <h1 className="disp">Pembayaran Member</h1>
        <p className="pb-mut">Tagihan dan riwayat pembayaran keluarga {child.name.split(' ')[0]}.</p>
      </div>

      <div className="pb-two">
        <section className="card pb-sum">
          <h3><i className="bi bi-receipt" /> Paket {q.label}</h3>
          <div className="pb-sumline"><span>Anak aktif</span><b>{n}</b></div>
          <div className="pb-sumline"><span>Harga per anak</span><b>{U.rupiah(q.per)} <small>/{q.period}</small></b></div>
          {q.promo && <div className="pb-sumline old"><span>Harga normal</span><s>{U.rupiah(q.normal)}</s></div>}
          <div className="pb-total"><span>Total / {q.period}</span><b>{U.rupiah(q.total)}</b></div>
          {q.promo
            ? <div className="alert amb" style={{ marginTop: 14, marginBottom: 0 }}><i className="bi bi-stars" /> Harga promo sekeluarga. Hemat {U.rupiah(q.save)}.</div>
            : next && <div className="pb-hint"><i className="bi bi-lightbulb" /> Dengan {P.PROMO_MIN} anak, harga promo {U.rupiah(next.total)} / {next.period}.</div>}
        </section>

        <section className="card">
          <h3><i className="bi bi-wallet2" /> Cara pembayaran</h3>
          <p className="pb-mut" style={{ marginBottom: 14 }}>{P.PAY_NOTE}</p>
          <BankCard />
          <ProofForm kids={children} name={name} q={q} period={period} reload={reload} />
          <a className="btn wa" style={{ marginTop: 14 }} href={wa} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" /> {P.CONTACT_PHONE ? 'Konfirmasi ke admin' : 'Tanya di grup WhatsApp'}</a>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3>Status per anak</h3>
        <table>
          <thead><tr><th>Anak</th><th>Kategori</th><th>Paket</th><th>Status</th></tr></thead>
          <tbody>{children.map((c) => (
            <tr key={c.id}><td><b>{c.name}</b></td><td><Chip>KU {c.category}</Chip></td><td>{P.PLANS[c.plan]?.label}</td><td>{statusOf(c)}</td></tr>
          ))}</tbody>
        </table>
      </section>

      {submissions.length > 0 && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h3>Bukti yang sudah dikirim</h3>
          <table>
            <thead><tr><th>Dikirim</th><th>Periode</th><th>Jumlah</th><th>Status</th></tr></thead>
            <tbody>{submissions.map((s) => (
              <tr key={s.id}>
                <td>{U.fmtLong(s.created_at)}</td><td>{U.monthLabel(s.period)}</td><td>{U.rupiah(s.amount)}</td>
                <td><Chip tone={SUB_CHIP[s.status][0]}>{SUB_CHIP[s.status][1]}</Chip>{s.status === 'ditolak' && s.reject_reason && <div><small>{s.reject_reason}</small></div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h3>Riwayat pembayaran</h3>
        {history.length ? (
          <table>
            <thead><tr><th>Periode</th><th>Anak</th><th>Jumlah</th><th>Tanggal bayar</th></tr></thead>
            <tbody>{history.map((p) => (
              <tr key={p.name + p.period}><td>{U.monthLabel(p.period)}</td><td>{p.name}</td><td>{U.rupiah(p.amount)}</td><td>{U.fmtLong(p.paid_at)}</td></tr>
            ))}</tbody>
          </table>
        ) : <Empty>Belum ada pembayaran tercatat.</Empty>}
      </section>
    </>
  );
}
