# Prompt para continuar la migración

Copiar y pegar el bloque siguiente en una conversación nueva:

```
Continúa la migración del cotizador de Vida Grupo de vanilla JS a Angular, retomando donde quedó.

Contexto:
- Workspace: C:\Repogerencia\FederadoAutonom-a (Windows, PowerShell; Angular CLI no es global: usar `npx`).
- Origen (solo lectura): CotizadorVG/ (index.html, Login.html, js/app.js, css/styles.css).
- Destino: CotizadorVG-Angular/ (Angular 22, standalone components, FormsModule, zone.js, TS no estricto).
- Lee primero, en este orden:
  1. CotizadorVG-Angular/docs/ESTADO-MIGRACION.md (qué está hecho y pendiente)
  2. CotizadorVG-Angular/docs/MIGRACION-CONTRATO.md (arquitectura y convenciones)
- Convenciones clave: `CotizadorStore` tiene un `estado` mutable; siempre leer `store.estado`, nunca cachear referencias. Los servicios mantienen los nombres de función en español del original. Las llamadas cruzadas entre servicios son lazy con `Injector`. Los modales son componentes standalone controlados por banderas de servicio. Usa las mismas APIs (Power Automate) del original, configuradas en src/environments/.

Estado: todo el código está portado y `npx ng build --configuration development` compila sin errores, pero NADA se ha probado en navegador y el build de producción no se ha verificado.

Tareas, en orden:
1. Ejecutar `npx tsc --noEmit -p tsconfig.app.json` y `npx ng build --configuration production`; corregir errores o presupuestos excedidos.
2. Levantar `npm start` y probar el flujo completo (login, landing, renovación, pasos 1-5, importación .xlsx, PDF, guardar/consultar cotización). Comparar cálculos contra el original (CotizadorVG/docs/calculos/). Corregir cualquier diferencia de comportamiento respecto a CotizadorVG/js/app.js.
3. Revisar la salvedad del paso 3 (select de deducible habilitado solo con WFA marcado vs. cualquier check en el original) y alinear con el original salvo que yo indique lo contrario.
4. Reemplazar CotizadorVG-Angular/README.md (aún es el predeterminado) con la guía paso a paso: prerrequisitos, npm install, npm start, npm run build (salida dist/cotizador-vg/browser), configuración de environment.ts / environment.prod.ts, despliegue en otro repo (fallback SPA a index.html, --base-href, CORS con Power Automate), estructura del proyecto y notas de seguridad.
5. Incidencia abierta: una captura mostraba la tabla "Valor total a pagar" con columnas "Datos actuales de la póliza" y "Datos modificación" con valor 0. Esos textos no existen en CotizadorVG ni en el Angular. Pregúntame en qué pantalla/carpeta aparece antes de implementar nada.
6. Reporta riesgos de seguridad (credenciales y URLs firmadas hardcodeadas en el cliente) y proponer cómo inyectarlas en el despliegue.

Reglas: cambios mínimos y enfocados, sin documentar con archivos extra salvo que lo pida; no modificar CotizadorVG/ (original); al terminar, actualiza docs/ESTADO-MIGRACION.md con lo realizado y lo pendiente. Responde en español, breve.
```
