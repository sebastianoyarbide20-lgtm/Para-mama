import { Outlet, NavLink, ScrollRestoration, useLocation, Link } from 'react-router-dom';
import {
  CalendarPlus,
  ChartColumn,
  ChevronRight,
  DatabaseBackup,
  FolderHeart,
  House,
  Plus,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useData } from '../hooks/useData';
import { daysBetween, formatDateLong, relativeDays, todayISO } from '../lib/dates';

interface SubItem {
  to: string;
  label: string;
  match: (path: string) => boolean;
}

interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  children?: SubItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Inicio',
    shortLabel: 'Inicio',
    icon: House,
    match: (p) => p === '/',
  },
  {
    to: '/sesion/nueva',
    label: 'Sesión de hoy',
    shortLabel: 'Sesión',
    icon: CalendarPlus,
    match: (p) => p.startsWith('/sesion'),
    children: [
      { to: '/sesion/nueva', label: 'Nueva sesión', match: (p) => p === '/sesion/nueva' || p.endsWith('/editar') },
      { to: '/sesion/historial', label: 'Sesiones cargadas', match: (p) => p === '/sesion/historial' },
    ],
  },
  {
    to: '/panel',
    label: 'Panel y clientas',
    shortLabel: 'Panel',
    icon: ChartColumn,
    match: (p) => p.startsWith('/panel') || p.startsWith('/clientas'),
    children: [
      { to: '/panel', label: 'Resumen', match: (p) => p === '/panel' },
      { to: '/panel/ingresos', label: 'Ingresos', match: (p) => p === '/panel/ingresos' },
      { to: '/clientas', label: 'Clientas', match: (p) => p.startsWith('/clientas') },
    ],
  },
  {
    to: '/mis-datos',
    label: 'Mis datos',
    shortLabel: 'Mis datos',
    icon: FolderHeart,
    match: (p) => p.startsWith('/mis-datos'),
    children: [
      { to: '/mis-datos', label: 'Mis listas', match: (p) => p === '/mis-datos' || p.startsWith('/mis-datos/lista') },
      { to: '/mis-datos/ficha', label: 'Campos de la ficha', match: (p) => p === '/mis-datos/ficha' },
      { to: '/mis-datos/ajustes', label: 'Copia y ajustes', match: (p) => p === '/mis-datos/ajustes' },
    ],
  },
];

/** Ruta legible para la barra superior: sector › pantalla. */
function breadcrumb(path: string): string[] {
  if (path === '/') return ['Inicio'];
  if (path === '/sesion/nueva') return ['Sesión de hoy', 'Nueva sesión'];
  if (path === '/sesion/historial') return ['Sesión de hoy', 'Sesiones cargadas'];
  if (/^\/sesion\/\d+\/editar$/.test(path)) return ['Sesión de hoy', 'Editar sesión'];
  if (path === '/panel') return ['Panel', 'Resumen'];
  if (path === '/panel/ingresos') return ['Panel', 'Ingresos'];
  if (path === '/clientas') return ['Panel', 'Clientas'];
  if (path === '/clientas/nueva') return ['Panel', 'Clientas', 'Nueva clienta'];
  if (/^\/clientas\/\d+\/editar$/.test(path)) return ['Panel', 'Clientas', 'Ficha inicial'];
  if (/^\/clientas\/\d+$/.test(path)) return ['Panel', 'Clientas', 'Ficha de la clienta'];
  if (path === '/mis-datos') return ['Mis datos', 'Mis listas'];
  if (path.startsWith('/mis-datos/lista')) return ['Mis datos', 'Lista'];
  if (path === '/mis-datos/ficha') return ['Mis datos', 'Campos de la ficha'];
  if (path === '/mis-datos/ajustes') return ['Mis datos', 'Copia y ajustes'];
  return ['Mi Cabina'];
}

function Brand() {
  const { settings } = useData();
  return (
    <Link to="/" className="group flex items-center gap-3 rounded-2xl">
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-rosa-400 to-rosa-700 shadow-glow">
        <img
          src="./icon.svg"
          alt=""
          className="size-11 rounded-2xl transition-transform duration-300 group-hover:scale-105"
        />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[1.35rem] font-semibold text-stone-900">
          {settings.businessName || 'Mi Cabina'}
        </span>
        <span className="block text-xs font-medium text-stone-500">Registro de tratamientos</span>
      </span>
    </Link>
  );
}

function BackupStatus() {
  const { settings, clients } = useData();
  const last = settings.lastBackupAt;
  const days = last ? daysBetween(last.slice(0, 10), todayISO()) : null;
  const ok = days !== null && days <= 14;
  if (clients.length === 0 && !last) {
    return (
      <div className="rounded-2xl bg-salvia-50/80 p-3.5 text-[0.8rem] text-salvia-900 ring-1 ring-salvia-100">
        <p className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4" aria-hidden /> Tus datos están en esta PC
        </p>
      </div>
    );
  }
  return (
    <Link
      to="/mis-datos/ajustes"
      className={`group block rounded-2xl p-3.5 text-[0.8rem] ring-1 transition-colors ${
        ok
          ? 'bg-salvia-50/80 text-salvia-900 ring-salvia-100 hover:bg-salvia-50'
          : 'bg-amber-50/90 text-amber-950 ring-amber-200/70 hover:bg-amber-50'
      }`}
    >
      <p className="flex items-center gap-2 font-bold">
        {ok ? <ShieldCheck className="size-4" aria-hidden /> : <DatabaseBackup className="size-4" aria-hidden />}
        {ok ? 'Copia de seguridad al día' : 'Hacé una copia de seguridad'}
      </p>
      <p className={`mt-0.5 ${ok ? 'text-salvia-700' : 'text-amber-800'}`}>
        {last ? `Última: ${relativeDays(last.slice(0, 10))}` : 'Todavía no hiciste ninguna'}
        <ChevronRight className="ml-0.5 inline size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </p>
    </Link>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const crumbs = breadcrumb(pathname);

  const skipToContent = () => {
    document.getElementById('contenido')?.focus();
  };

  return (
    <div className="min-h-dvh lg:pl-68">
      <button
        type="button"
        onClick={skipToContent}
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </button>

      {/* Barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col border-r border-stone-900/[0.06] bg-white/75 px-4 pt-6 pb-4 backdrop-blur-xl lg:flex">
        <div className="px-1.5">
          <Brand />
        </div>

        <Link
          to="/sesion/nueva"
          className="group mt-7 flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-b from-rosa-500 to-rosa-600 px-4 font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_12px_26px_-12px_rgb(176_63_88/0.8)] transition-all hover:-translate-y-px hover:from-rosa-600 hover:to-rosa-700"
        >
          <Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
          Nueva sesión
        </Link>

        <p className="eyebrow mt-8 mb-2 px-3 text-stone-400">Menú</p>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 font-semibold transition-colors ${
                    active
                      ? 'bg-rosa-50 text-rosa-800'
                      : 'text-stone-600 hover:bg-stone-900/[0.04] hover:text-stone-900'
                  }`}
                >
                  <span
                    className={`absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-rosa-500 transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      active
                        ? 'bg-linear-to-br from-rosa-500 to-rosa-600 text-white shadow-[0_6px_14px_-6px_rgb(176_63_88/0.8)]'
                        : 'bg-stone-100 text-stone-500 group-hover:bg-white group-hover:text-rosa-600 group-hover:shadow-sm'
                    }`}
                  >
                    <Icon className="size-[1.15rem]" aria-hidden />
                  </span>
                  {item.label}
                </NavLink>
                {item.children && (
                  // El submenú se despliega solo en el sector actual.
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <ul className="overflow-hidden" aria-hidden={!active}>
                      <li className="h-1" />
                      {item.children.map((child) => {
                        const childActive = child.match(pathname);
                        return (
                          <li key={child.to}>
                            <Link
                              to={child.to}
                              tabIndex={active ? undefined : -1}
                              className={`relative ml-[1.85rem] flex items-center gap-2 border-l py-1.5 pl-5 text-sm transition-colors ${
                                childActive
                                  ? 'border-rosa-400 font-semibold text-rosa-700'
                                  : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-900'
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                      <li className="h-1.5" />
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <BackupStatus />
        </div>
      </aside>

      {/* Barra superior */}
      <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-stone-900/[0.05] bg-crema/70 px-10 backdrop-blur-xl lg:flex">
        <nav aria-label="Ubicación" className="flex items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <span key={`${c}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 text-stone-300" aria-hidden />}
              <span className={i === crumbs.length - 1 ? 'font-semibold text-stone-800' : 'text-stone-500'}>{c}</span>
            </span>
          ))}
        </nav>
        <p className="text-sm font-medium text-stone-500 first-letter:uppercase">{formatDateLong(todayISO())}</p>
      </header>

      {/* Encabezado en pantallas chicas */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/70 bg-crema/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand />
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto max-w-[92rem] px-4 pt-6 pb-32 outline-none sm:px-6 lg:px-10 lg:pt-8 lg:pb-16"
      >
        {/* Cada pantalla entra con un fundido suave. */}
        <div key={pathname} className="animate-enter">
          <Outlet />
        </div>
      </main>

      {/* Barra inferior (solo en pantallas chicas) */}
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
