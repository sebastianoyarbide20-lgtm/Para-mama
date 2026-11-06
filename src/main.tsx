import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ensureDefaults } from './db/defaults';
import { requestPersistentStorage } from './db/db';

const root = createRoot(document.getElementById('root')!);

async function start() {
  try {
    await ensureDefaults();
  } catch (e) {
    console.error(e);
    root.render(
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 560, margin: '40px auto' }}>
        <h1 style={{ fontSize: 24 }}>No se pudo abrir la base de datos</h1>
        <p>
          Es posible que el navegador esté en modo privado/incógnito o que no tenga espacio. Probá abrir la app en una
          ventana normal de Chrome, Safari o Edge.
        </p>
      </div>,
    );
    return;
  }
  // Pedimos que el navegador no borre los datos cuando le falte espacio.
  void requestPersistentStorage();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();

// Permite abrir la app sin conexión (solo en la versión publicada, no en desarrollo).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((e) => console.warn('No se pudo activar el modo sin conexión', e));
  });
}
