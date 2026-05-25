import { Link } from 'react-router-dom';

export function Logo({ size = 40, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-3"
      aria-label="ClairDossier — accueil"
    >
      <span
        className="grid place-items-center rounded-md bg-navy-900 font-display font-bold leading-none text-gold-500 transition-colors group-hover:bg-navy-800"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        CD
      </span>
      {withWordmark && (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-[1.05rem] font-semibold text-navy-900">
            ClairDossier
          </span>
          <span className="text-[0.7rem] text-slate-500">Dossiers juridiques, clairs.</span>
        </span>
      )}
    </Link>
  );
}
