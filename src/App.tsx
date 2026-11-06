import { createHashRouter, Navigate, RouterProvider, useRouteError } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider } from './hooks/useData';
import { FeedbackProvider } from './components/ui/Feedback';
import { EmptyState, Spinner } from './components/ui/Card';
import { LinkButton } from './components/ui/Button';
import { HomePage } from './pages/HomePage';
import { SessionFormPage } from './pages/sesion/SessionFormPage';
import { SessionListPage } from './pages/sesion/SessionListPage';
import { ClientsListPage } from './pages/clientas/ClientsListPage';
import { ClientDetailPage } from './pages/clientas/ClientDetailPage';
import { ClientEditPage } from './pages/clientas/ClientEditPage';
import { MisDatosPage } from './pages/misdatos/MisDatosPage';
import { CatalogPage } from './pages/misdatos/CatalogPage';
import { ClientFieldsPage } from './pages/misdatos/ClientFieldsPage';
import { SettingsPage } from './pages/misdatos/SettingsPage';

function NotFound() {
  return (
    <EmptyState title="No encontramos esta pantalla" action={<LinkButton to="/">Ir al inicio</LinkButton>}>
      Puede que el enlace esté mal escrito.
    </EmptyState>
  );
}

function ErrorScreen() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="mx-auto max-w-xl p-6">
      <EmptyState
        title="Ups, algo salió mal"
        action={
          <button
            type="button"
            className="rounded-xl bg-rosa-600 px-5 py-3 font-bold text-white"
            onClick={() => window.location.reload()}
          >
            Recargar la página
          </button>
        }
      >
        Tus datos están a salvo. Recargá la página para seguir.
      </EmptyState>
    </div>
  );
}

// HashRouter: funciona en cualquier hosting estático sin configuración extra.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sesion', element: <Navigate to="/sesion/nueva" replace /> },
      { path: 'sesion/nueva', element: <SessionFormPage /> },
      { path: 'sesion/historial', element: <SessionListPage /> },
      { path: 'sesion/:id/editar', element: <SessionFormPage /> },
      {
        path: 'panel',
        // Los gráficos se cargan solo cuando se abre el panel (la app arranca más rápido).
        lazy: async () => ({ Component: (await import('./pages/panel/DashboardPage')).DashboardPage }),
      },
      { path: 'clientas', element: <ClientsListPage /> },
      { path: 'clientas/nueva', element: <ClientEditPage /> },
      { path: 'clientas/:id', element: <ClientDetailPage /> },
      { path: 'clientas/:id/editar', element: <ClientEditPage /> },
      { path: 'mis-datos', element: <MisDatosPage /> },
      { path: 'mis-datos/lista/:id', element: <CatalogPage /> },
      { path: 'mis-datos/ficha', element: <ClientFieldsPage /> },
      { path: 'mis-datos/ajustes', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <FeedbackProvider>
      <DataProvider fallback={<Spinner label="Abriendo tus datos…" />}>
        <RouterProvider router={router} />
      </DataProvider>
    </FeedbackProvider>
  );
}
