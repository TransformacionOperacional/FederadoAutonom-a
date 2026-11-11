# Estado de la migración CotizadorVG -> Angular

Fecha de corte: 2026-11-11

Origen (vanilla JS, solo lectura): `../CotizadorVG/` (`index.html`, `Login.html`, `js/app.js` ~7450 líneas, `css/styles.css`).
Destino: `CotizadorVG-Angular/` (Angular 22, standalone components, TypeScript no estricto, zone.js).
Contrato de arquitectura y convenciones: [MIGRACION-CONTRATO.md](MIGRACION-CONTRATO.md).

## 1. Qué se realizó

### Base del proyecto
- Proyecto Angular 22.2 generado con `npx` (CLI no instalado global). Node v26 / npm 11.
- `zone.js` agregado en `angular.json` (polyfills) y `provideZoneChangeDetection({eventCoalescing:true})` en `app.config.ts`, porque el `estado` mutable compartido requiere detección de cambios basada en zona.
- `tsconfig`: `strict:false`, `noImplicitAny:false`.
- `angular.json` producción: budgets elevados (1 MB warn / 3 MB error inicial) y `fileReplacements` `environment.ts` -> `environment.prod.ts`.
- Librerías: `exceljs` (lectura y escritura de `.xlsx`) y `html2pdf.js` (import dinámico) reemplazan los CDN SheetJS/ExcelJS/html2pdf.
- CSS original (`css/styles.css`) usado como `src/styles.css` global. Fuente `FS-Joey-Regular.otf`, imágenes en `public/assets/images`, datos `public/data/CoberturasVG.json`.
- Configuración por entorno: `src/environments/environment.ts` y `environment.prod.ts` (`apis.*`, `apiUsuario`, `apiContrasena`).

### Núcleo (`src/app/core/`)
`config.ts`, `utils.ts`, `models.ts`, `cotizador.store.ts` (estado mutable único `store.estado`), `ui.service.ts` (toast, confirmación, overlay de carga), `auth.service.ts`, `auth.guard.ts`.

### Servicios (`src/app/services/`)
Mantienen los nombres de función en español del original. Las llamadas cruzadas entre servicios son lazy vía `Injector`.

| Servicio | Contenido |
|---|---|
| `calculo.service.ts` | Valor asegurado, tasa pura, recargos, credibilidad, prima, forma de pago, tasa única |
| `catalogo.service.ts` | Coberturas, actividades, tasas, asesor, siniestralidad |
| `asegurado.service.ts` | CRUD de asegurados, visibilidad de sección |
| `importacion.service.ts` | Importación de Excel (solo `.xlsx`) |
| `plan.service.ts` | Planes, deducibles, subgrupos (lógica) |
| `asignacion.service.ts` | Asignación de planes, reasignación |
| `cotizacion-api.service.ts` | Guardar/consultar cotización (Power Automate) |
| `pdf.service.ts` | Generación del PDF de cotización |
| `flujo.service.ts` | Navegación entre pantallas, renovación, validaciones de pasos, inicialización, reinicio de estado |

### Componentes (`src/app/components/`, `src/app/pages/`)
- Pasos: `paso1-datos-poliza`, `paso2-asegurados`, `paso3-planes`, `paso4-asignacion`, `paso5-resumen`.
- Modales: `modal-confirmar-forma-pago`, `modal-resumen-modificaciones`, `modal-crear-plan`, `modal-editar-plan`, `modal-deducible-renta`, `modal-crear-subgrupo`, `modal-asignacion-salario`, `modal-plan-salario`, `modal-alerta-rango`, `modal-restriccion-plan`, `modal-filtro-edad`, `modal-reasignar-seleccionados`, `modal-consultar-cotizacion`.
- `ui-overlays` (toast, confirmación, carga), `pages/login`, `pages/cotizador` (shell: cabecera, landing, renovación, navegación de pasos, montaje de modales).
- `app.ts` = `router-outlet` + `app-ui-overlays`; `app.routes.ts`: `/login`, `''` con `authGuard`, `**` -> `''`.

### Verificación realizada
- `npx tsc --noEmit -p tsconfig.app.json`: sin errores.
- `npx ng build --configuration development`: compila correctamente (main.js 2.34 MB; chunks lazy: html2pdf 2.47 MB, exceljs 1.47 MB).

## 2. Qué NO se ha verificado / pendiente

### Verificación (prioridad alta)
1. `npx ng build --configuration production`: no se alcanzó a ejecutar (se canceló). Verificar budgets y `fileReplacements`.
2. Ninguna prueba en navegador. Nada se ha ejecutado con `ng serve`. Probar en este orden:
   - Login (`/login`) contra la API de autenticación; redirección y guard.
   - Landing -> nuevo negocio / renovación / simulación / cotización.
   - Paso 1 (datos de póliza, fechas, vigencia, asesor, comisión, siniestralidad).
   - Paso 2 (alta manual e importación `.xlsx`).
   - Paso 3 (planes, crear/editar, deducible renta).
   - Paso 4 (asignación y reasignación).
   - Paso 5 (resumen, forma de pago, PDF, guardar y consultar cotización).
3. Comparar numéricamente los cálculos contra el original con un caso real (valor asegurado, tasa pura, prima, tasa única). Ver `../CotizadorVG/docs/calculos/`.
4. CORS: confirmar que las URLs de Power Automate aceptan el origen del nuevo despliegue.

### Documentación
5. Reemplazar `README.md` (aún es el predeterminado de Angular CLI) con la guía paso a paso: prerrequisitos (Node 20+/22+), `npm install`, `npm start`, `npm run build` (salida `dist/cotizador-vg/browser`), configuración de `environment*.ts`, despliegue (fallback SPA a `index.html` para `/login`, `--base-href` si va bajo subruta, CORS) y estructura del proyecto.
6. Decidir si se conserva `docs/MIGRACION-CONTRATO.md` en el repo destino.

### Diferencias y salvedades conocidas
- Paso 3: el select de deducible se habilita solo cuando WFA está marcado (el original lo habilitaba con cualquier check). Confirmar cuál es el comportamiento correcto. También se corrigió el bug de `maxSal` no definido.
- Subgrupos / workspace: la UI está huérfana en el original (no está en `index.html`). La lógica está en `PlanService` y los modales están montados pero nadie los abre.
- `construirResumenCredibilidad` y el botón `exportarResumen` no tienen UI en el original; no se expuso UI.
- `catalogo.service.ts` usa `querySelector` para pasar elementos a `mostrarAlertaRango` (revisar si conviene sustituirlo).
- Solo se soporta `.xlsx` (no `.xls`).
- El proxy `server/proxy-server.js` no se migró: el frontend no lo usa (la renovación usa la API Power Automate `polizasTomador`).

### Incidencia abierta: "el valor sigue en 0"
- Captura del usuario: tabla "Valor total a pagar" con columnas "Datos actuales de la póliza" y "Datos modificación".
- Esos textos no existen en `CotizadorVG` ni en el port Angular (búsqueda en todo el workspace). Se debe confirmar en qué pantalla/app/carpeta aparece (posiblemente `CotizadorPCP-Contingente` u otra funcionalidad pendiente).
- Dato relacionado: en renovación, `normalizarPolizaRenovacion` (app.js ~4162-4181) no recibe la prima actual de la póliza y `seleccionarPolizaRenovacion` genera asegurados simulados con `primaIndividual: 0`. Si se quiere mostrar la prima actual, la API `polizasTomador` debe devolverla y habría que mapearla.

### Seguridad (reportar antes de pasar a producción)
- Credenciales `CotizadorVG` / `Sura2025*` y URLs firmadas de Power Automate (`sig=`) están hardcodeadas en el cliente (`environment*.ts`). Cualquier usuario puede extraerlas. Mover a un backend/proxy o inyectarlas en despliegue y rotarlas.
- `server/proxy-server.js` original contiene una cookie hardcodeada.

## 3. Orden sugerido para continuar
1. `npm install` (si `node_modules` no existe) y `npx ng build --configuration production`.
2. `npm start` y recorrer el flujo completo en navegador; corregir lo que falle.
3. Aclarar la incidencia "valor en 0".
4. Escribir el `README.md` final.
5. Revisar seguridad de credenciales/URLs.
