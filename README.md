# Mi Cabina · Registro de tratamientos

Aplicación web para que una profesional de estética (cosmetología, estética facial y corporal) registre **rápido** cada
sesión que hace y consulte el **historial de cada clienta**.

- Funciona en el navegador, en la computadora o en el celular.
- **No necesita servidor ni cuenta**: los datos quedan guardados en el dispositivo (IndexedDB).
- Tiene **copia de seguridad** (exportar / importar) y exportación a **Excel (CSV)**.
- Toda la interfaz está en español (Argentina) y las fechas se muestran como dd/mm/aaaa.

---

## Instalación y uso para desarrollo

Requisitos: [Node.js](https://nodejs.org/) 20.19 o superior (recomendado 22).

```bash
npm install
```

```bash
npm run dev
```

Abrí la dirección que aparece en la terminal (normalmente http://localhost:5173).

### Otros comandos

| Comando             | Para qué sirve                                                   |
| ------------------- | ---------------------------------------------------------------- |
| `npm run build`     | Revisa los tipos y genera la versión final en la carpeta `dist`  |
| `npm run preview`   | Sirve la carpeta `dist` para probar la versión final             |
| `npm test`          | Corre los tests de la lógica (fechas, montos, CSV, estadísticas) |
| `npm run typecheck` | Revisa los tipos de TypeScript                                   |
| `npm run format`    | Ordena el formato del código con Prettier                        |

### Publicarla

La app está publicada en GitHub Pages:

**https://sebastianoyarbide20-lgtm.github.io/Para-mama/**

Cada vez que se suben cambios a la rama principal, el workflow `.github/workflows/pages.yml` corre los tests, compila
la app y actualiza la rama `gh-pages`, que es la que muestra GitHub Pages (en el repositorio: Settings → Pages → «Deploy
from a branch» → `gh-pages` / `(root)`).

`npm run build` genera la carpeta `dist/`, que es un sitio estático: también se puede subir tal cual a Netlify, Vercel,
Cloudflare Pages o cualquier hosting. Usa rutas con `#` (por ejemplo `.../#/panel`), así que no hace falta configurar
nada en el servidor, y funciona en cualquier subcarpeta.

Una vez abierta, la app queda guardada para funcionar **sin internet** y se puede **agregar a la pantalla de inicio**
del celular (en Chrome: menú ⋮ → «Agregar a la pantalla principal»; en iPhone/Safari: Compartir → «Agregar a
inicio»).

> Importante: los datos se guardan en el navegador **de ese dispositivo y en esa dirección web**. Si usás la app en la
> compu y en el celular, cada uno tiene sus propios datos. Para pasarlos de uno a otro, usá la copia de seguridad.

---

## Cómo funciona la copia de seguridad

Como los datos viven solo en el navegador, **conviene descargar una copia seguido** (la pantalla de Inicio avisa si
pasaron más de 14 días desde la última).

En **Mis datos → Copia de seguridad y ajustes**:

- **Descargar copia completa**: baja un archivo `.json` con todo (clientas, sesiones, listas, campos de la ficha,
  ajustes y fotos). Guardalo en Google Drive, mandatelo por mail o copialo a un pendrive.
- **Enviar copia (WhatsApp, Drive, mail…)**: en el celular abre el menú de compartir del teléfono.
- **Copia sin fotos**: más liviana, para cuando hay muchas fotos.
- **Restaurar una copia**: elegís el archivo `.json`, la app muestra qué contiene (cuántas clientas, sesiones y fotos) y
  pide confirmación. **Reemplaza** todos los datos actuales del dispositivo por los de la copia.
- **Planillas para Excel**: exporta las sesiones o las fichas de clientas a `.csv` (separado por `;` y con tildes
  correctas, listo para abrir con Excel o Google Sheets). Desde el Panel también se pueden exportar solo las sesiones
  del período elegido.

Además, al abrir la app se le pide al navegador que **no borre** los datos automáticamente cuando le falta espacio.

---

## Guía de uso (para la profesional)

Hay una guía ilustrada para imprimir o mandar por WhatsApp: [`docs/Guia-de-uso-Mi-Cabina.pdf`](docs/Guia-de-uso-Mi-Cabina.pdf).

La app tiene 3 sectores, siempre visibles en el menú (a la izquierda en la computadora, abajo en el celular):

### 1. Sesión de hoy — registrar lo que hiciste

1. **¿A quién atendiste?** Buscá la clienta por nombre o teléfono. Si es nueva, tocá **Nueva clienta**: se abre su
   **ficha inicial** (ver más abajo); al guardarla queda elegida al instante.
2. Al elegirla, vas a ver sus **alergias, medicación, tipo de piel y su última sesión**. Con **Usar la última sesión
   como base** se copian los tratamientos, aparatos y productos de la vez anterior.
3. **¿Cuándo?** Por defecto es hoy (botones «Hoy» / «Ayer»). La hora es opcional.
4. **¿Qué le hiciste?** Tocá los tratamientos, la aparatología y los líquidos/productos que usaste. Si falta alguno,
   escribilo en el buscador y tocá **Agregar «…»**. En los productos podés anotar un detalle (por ejemplo «20 %» o
   «2 ml»).
5. **Para la casa y notas**: recomendaciones para hacer en casa y observaciones de la sesión.
6. **Extras** (opcional): próxima sesión sugerida (botones +7, +15, +21, +30 días), monto cobrado y si está pagado, y
   fotos de antes/después.
7. Tocá **Guardar sesión**. Con **Guardar y cargar otra** el formulario queda listo para la siguiente clienta.

En **Sesiones cargadas** ves todas las sesiones, podés buscarlas, **editarlas** o **eliminarlas** (siempre pide
confirmación). Si querés salir con una sesión a medio cargar, la app te avisa.

### Ficha inicial de cada clienta

Cuando cargás una clienta nueva (desde «Sesión de hoy» o desde Clientas → Nueva clienta) se completa su **ficha
inicial**, igual a la «Ficha de Tratamiento y Anamnesis» en papel (el «Tratamiento en Gabinete» ya lo cubren las
sesiones):

1. **Datos personales**: nombre y apellido, fecha de nacimiento (calcula la edad), género, teléfono, email y fecha del
   último tratamiento (o «Nunca se hizo un tratamiento»).
2. **Historia clínica y hábitos**: alergias (cuáles, o «No tiene alergias»), hábitos (alcohol, cigarrillo, drogas,
   café), cuidados domiciliarios (limpieza, exfoliación, humectantes, hidratantes, protección solar), y además
   medicación, antecedentes y ejercicio.
3. **Tipo de piel** y **escala de Fitzpatrick** (tipos I a VI, con la descripción de cada uno).
4. **Análisis facial**: capilares visibles, glándulas sebáceas, pigmentación y líneas / surcos.
5. **Condiciones del paciente**: las 21 de la ficha (marcapasos, embarazo, lactancia, diabetes, etc.).
6. **Otros datos**: campos propios y notas.

Para guardar una clienta nueva hay que responder **todos** los puntos: en los de casillas, si no hay nada que marcar se
elige «Ninguno», «Ninguna» o «Sin hallazgos». Abajo se ve el avance («Ficha: 9 de 13»). Las clientas cargadas antes de
esta función se marcan con **«Ficha incompleta»** y se pueden completar con «Editar ficha»; al editarlas se puede
guardar igual aunque falte algo. Lo que ya estaba cargado se pasó solo a su lugar nuevo («¿Fuma?» → Hábitos /
Cigarrillo, «Embarazo / lactancia» → Condiciones del paciente).

### 2. Panel y clientas — historial y análisis

- **Resumen**: elegí el período (este mes, últimos 3 meses, este año, etc.) y vas a ver cantidad de sesiones, clientas
  atendidas, clientas nuevas, ingresos (cobrado y lo que falta cobrar), gráficos de sesiones e ingresos en el tiempo,
  tratamientos/aparatos/productos más usados, clientas por tipo de piel y un **análisis cruzado** (qué tratamientos
  hacés más según el tipo de piel y qué productos combinás con cada tratamiento). Cada gráfico tiene «Ver como tabla».
- **Clientas**: buscador, orden (última visita, más sesiones, nombre…) y filtros para ver las que **hace mucho no
  vienen** (más de 60 días, se cambia en Ajustes), las que tienen **próxima sesión** (pendiente o vencida) y las que
  tienen la **ficha inicial incompleta**.
- **Pantalla de cada clienta**: datos importantes destacados (alergias, condiciones, medicación, piel), el **resumen
  de su ficha inicial**, resumen (cuántas sesiones, cada cuántos días viene,
  tratamiento más frecuente, productos más usados con ella, total cobrado) y la **línea de tiempo** con todas sus
  sesiones y fotos. Desde ahí: **Registrar sesión** (ya con la clienta elegida) y **Editar ficha**.

### 3. Mis datos — tus listas

- **Listas para las sesiones**: Tratamientos, Aparatología y Líquidos/productos vienen con algunos ejemplos que podés
  editar, **desactivar** (dejan de aparecer para elegir pero se conserva el historial) o eliminar.
- **Crear nueva lista**: armá tus propias listas (por ejemplo «Zonas tratadas», «Cremas para casa», «Técnicas»). Aparecen
  solas como un campo más en «Sesión de hoy». Podés elegir si se puede marcar más de una opción y si cada opción lleva
  un detalle.
- **Tipos de piel**: la lista que se usa en la ficha.
- **Campos de la ficha**: agregá datos propios a la ficha de las clientas (texto, sí/no, número o fecha).
- **Copia de seguridad y ajustes**: copia, restauración, planillas, nombre de tu espacio, días para avisar de clientas
  inactivas y **datos de ejemplo** (se cargan y se borran con un botón, sin tocar tus datos reales).

---

## Detalles técnicos

- **Stack**: React 19 + Vite 7 + TypeScript, Tailwind CSS 4, Dexie (IndexedDB), Recharts, React Router 7, íconos Lucide.
- **Estructura**:

  ```
  src/
    db/          base de datos (Dexie), tipos, catálogos por defecto, acciones, backup y datos de ejemplo
    hooks/       useData (datos reactivos de toda la app), useExport
    lib/         fechas, formato de montos, CSV, búsqueda, estadísticas (con tests)
    components/  UI reutilizable (botones, tarjetas, campos, modales, avisos) y piezas de la app
                 (selector de catálogo con "+ agregar", buscador de clientas, ficha, fotos, gráficos)
    pages/       Inicio, sesión, panel, clientas y mis datos
  public/        ícono, manifest y service worker (modo sin conexión)
  ```

- **Modelo de datos** (tablas de IndexedDB):
  - `catalogs`: listas (predefinidas y propias). Todas funcionan igual: nombre, ícono, si se muestran en la sesión, si
    permiten varias opciones y detalle por opción.
  - `catalogItems`: opciones de cada lista (nombre, descripción, extras como la marca, activo/desactivado).
  - `clients`: ficha inicial de la clienta (datos personales, alergias, hábitos, cuidados domiciliarios, tipo de piel,
    Fitzpatrick, análisis facial, condiciones) y `customFields` para los campos propios. Las opciones de la ficha están
    en `src/lib/anamnesis.ts`.
  - `clientFields`: definición de los campos propios de la ficha.
  - `sessions`: fecha, hora, `selections` (por id de lista: opciones elegidas + detalle), recomendaciones,
    observaciones, próxima sesión, monto y pagado.
  - `photos`: fotos comprimidas de cada sesión (antes/después).
  - `settings`: preferencias.
