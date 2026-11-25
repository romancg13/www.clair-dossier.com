// Petits éléments d'interface de l'espace de recette (styles alignés sur le site).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <section className="bg-cream-50 min-h-[70vh]"><div className={`mx-auto ${narrow ? 'max-w-xl' : 'max-w-5xl'} px-4 sm:px-6 py-10 sm:py-14`}>{children}</div></section>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 shadow-[0_1px_0_rgba(13,27,61,0.04)] ${className}`}>{children}</div>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">{children}</p>;
}

export function Primary({ children, onClick, to, type = 'button', disabled }: { children: ReactNode; onClick?: () => void; to?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  const cls = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-navy-900 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-50';
  return to ? <Link to={to} className={cls}>{children}</Link> : <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function Secondary({ children, onClick, to, href, download }: { children: ReactNode; onClick?: () => void; to?: string; href?: string; download?: boolean }) {
  const cls = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-[14px] font-medium text-navy-900 transition hover:border-gold-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500';
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} className={cls} download={download}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[14px] font-medium text-navy-900">{label}</span>
      {hint && <span className="block text-[13px] text-slate-500">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

export const inputCls = 'w-full min-h-11 rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-[15px] text-navy-900 placeholder:text-slate-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30';

export function Alert({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'ok' }) {
  const c = tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-cream-200 bg-cream-100 text-navy-900';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-[14px] ${c}`}>{children}</div>;
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'busy' }) {
  const c = tone === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : tone === 'warn' ? 'bg-amber-50 text-amber-900 ring-amber-200' : tone === 'busy' ? 'bg-sky-50 text-sky-900 ring-sky-200' : 'bg-cream-100 text-navy-900 ring-cream-200';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium ring-1 ${c}`}>{children}</span>;
}
