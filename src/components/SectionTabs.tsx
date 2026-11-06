import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

/** Pestañas grandes para moverse dentro de un sector. */
export function SectionTabs({ tabs }: { tabs: { to: string; label: string; icon: LucideIcon; end?: boolean }[] }) {
  return (
    <nav aria-label="Secciones" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-stone-200/60 p-1">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 font-bold whitespace-nowrap transition-colors ${
              isActive ? 'bg-white text-rosa-700 shadow-sm' : 'text-stone-600 hover:bg-white/60 hover:text-stone-900'
            }`
          }
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
