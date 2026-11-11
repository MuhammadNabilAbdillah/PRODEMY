import { Link } from 'react-router-dom';
import { toggleTheme } from './Layout';
import { PLANS, PROMO_MIN, quote } from '../lib/portal';
import { rupiah } from '../lib/utils';

export const ThemeBtn = () => (
  <button type="button" className="theme" onClick={toggleTheme} aria-label="Ganti mode terang atau gelap">
    <i className="bi bi-moon-stars moon" /><i className="bi bi-sun sun" />
  </button>
);

/** Kerangka halaman publik (tanpa login): bar atas hijau gelap + isi */
export default function PublicShell({ children, back = '/', backText = 'Beranda', right, nav }) {
  return (
    <div className="pub">
      <div className="pub-top">
        <Link to="/" className="brand-m">
          <span className="logo-tile sm"><img src="/images/logo.png" alt="" /></span>
          <b>BROTHER ACADEMY</b>
        </Link>
        {nav}
        <div className="sp">
          {right}
          {back && <Link className="btn glass sm" to={back} title={backText} aria-label={backText}><i className="bi bi-arrow-left" /> {backText}</Link>}
          <ThemeBtn />
        </div>
      </div>
      <div className="pub-main">{children}</div>
    </div>
  );
}

/** Daftar harga seperti di brosur: harga normal dan promo sekeluarga */
export function PriceTable() {
  const r = PLANS.reguler, m = PLANS.member;
  return (
    <div className="ptab">
      <div className="pt-col">
        <h4>Harga</h4>
        <div className="pt-row"><span>Reguler</span><b>{rupiah(r.base)}<small>/{r.period}</small></b></div>
        <div className="pt-row"><span>Member</span><b>{rupiah(m.base)}<small>/{m.period}</small></b></div>
      </div>
      <div className="pt-col promo">
        <h4>Diskon {PROMO_MIN} anak sekaligus <small>keluarga / adik kakak</small></h4>
        <div className="pt-row"><span>Member</span><b>{rupiah(quote('member', PROMO_MIN).total)}<small>/{m.period}</small></b></div>
        <div className="pt-row"><span>Reguler</span><b>{rupiah(quote('reguler', PROMO_MIN).total)}<small>/{r.period}</small></b></div>
      </div>
    </div>
  );
}
