import { Outlet, NavLink, ScrollRestoration, useLocation, Link } from 'react-router-dom';
import { CalendarPlus, ChartColumn, FolderHeart, House, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useData } from '../hooks/useData';

interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Inicio',
    shortLabel: 'Inicio',
    description: 'Accesos rápidos',
    icon: House,
    match: (p) => p === '/',
  },
  {
    to: '/sesion/nueva',
    label: 'Sesión de hoy',
    shortLabel: 'Sesión',
    description: 'Registrar tratamientos',
    icon: CalendarPlus,
    match: (p) => p.startsWith('/sesion'),
  },
  {
    to: '/panel',
    label: 'Panel y clientas',
    shortLabel: 'Panel',
    description: 'Historial y análisis',
    icon: ChartColumn,
    match: (p) => p.startsWith('/panel') || p.startsWith('/clientas'),
  },
  {
    to: '/mis-datos',
    label: 'Mis datos',
    shortLabel: 'Mis datos',
    description: 'Listas y ajustes',
    icon: FolderHeart,
    match: (p) => p.startsWith('/mis-datos'),
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useData();
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-xl">
      <img src="./icon.svg" alt="" className={compact ? 'size-9' : 'size-11'} />
      <span className="min-w-0 leading-tight">
        <span className={`block truncate font-extrabold text-stone-900 ${compact ? 'text-lg' : 'text-xl'}`}>
          {settings.businessName || 'Mi Cabina'}
        </span>
        {!compact && <span className="block text-sm text-stone-500">Registro de tratamientos</span>}
      </span>
    </Link>
  );
}

export function Layout() {
  const { pathname } = useLocation();

  const skipToContent = () => {
    const main = document.getElementById('contenido');
    main?.focus();
  };

  return (
    <div className="min-h-dvh lg:pl-72">
      <button
        type="button"
        onClick={skipToContent}
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </button>

      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-stone-200 bg-white/80 px-4 py-6 backdrop-blur lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav aria-label="Principal" className="mt-8 flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                  active ? 'bg-rosa-600 text-white shadow-sm' : 'text-stone-700 hover:bg-rosa-50'
                }`}
              >
                <Icon className="size-6 shrink-0" aria-hidden />
                <span className="leading-tight">
                  <span className="block text-lg font-bold">{item.label}</span>
                  <span className={`block text-sm ${active ? 'text-rosa-100' : 'text-stone-500'}`}>
                    {item.description}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-salvia-50 p-4 text-sm text-salvia-900">
          <p className="flex items-center gap-2 font-bold">
            <ShieldCheck className="size-5" aria-hidden /> Tus datos están en este dispositivo
          </p>
          <p className="mt-1 text-salvia-800">
            Hacé una{' '}
            <Link to="/mis-datos/ajustes" className="font-bold underline underline-offset-2">
              copia de seguridad
            </Link>{' '}
            cada tanto para no perderlos.
          </p>
        </div>
      </aside>

      {/* Encabezado (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/70 bg-crema/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand compact />
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pt-5 pb-32 outline-none sm:px-6 lg:px-10 lg:pt-10 lg:pb-16"
      >
        <Outlet />
      </main>

      {/* Barra inferior (celular) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-17 flex-col items-center justify-center gap-1 text-[0.8rem] font-bold transition-colors ${
                    active ? 'text-rosa-700' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-rosa-100' : ''
                    }`}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  {item.shortLabel}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <ScrollRestoration />
    </div>
  );
}
