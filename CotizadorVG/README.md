# Cotizador Vida Grupo - Seguros SURA

Aplicación web (HTML, CSS y JavaScript sin frameworks) para cotizar pólizas de **Vida Grupo**: captura los datos de la póliza y de los asegurados, asigna planes y coberturas, calcula tasas y primas con la tarifa del Core GW y genera el slip de cotización en PDF.

## Flujo de la aplicación

1. **Póliza:** datos del tomador, vigencia, modalidad, canal comercial, forma de pago y siniestralidad.
2. **Asegurados:** carga manual o por plantilla Excel (`.xlsx`).
3. **Coberturas:** catálogo de amparos disponibles para la cotización.
4. **Asignación:** reparto de asegurados en planes.
5. **Cálculos:** tasas y primas por asegurado, plan y póliza.
6. **Planes:** valores asegurados por plan.
7. **Resumen:** prima por forma de pago y descarga del PDF.

## Estructura del proyecto

```
CotizadorVG/
├── index.html                 Pantalla principal
├── css/
│   └── styles.css             Estilos y paleta de marca
├── js/
│   ├── app.js                 Lógica de la aplicación y cálculos
│   ├── pdf-cotizacion.js      Generación del PDF de cotización
│   └── pdf-encabezado-data.js Portada del PDF incrustada (base64)
├── assets/
│   ├── fonts/                 Tipografía FS Joey
│   └── images/                Logo, portada e imágenes del PDF
├── data/
│   └── CoberturasVG.json      Catálogo de coberturas
├── docs/
│   ├── calculos/              Documentación de fórmulas y ejemplos
│   └── referencia/            Prototipos y guía de color
```

## Ejecución

Es una aplicación 100 % JavaScript del lado del cliente: no tiene backend ni usa Python. Basta publicar la carpeta en cualquier hosting de archivos estáticos (Azure Static Web Apps, Blob Storage, S3, etc.).

Para probar en local debe servirse por HTTP (no abrir con `file://`) porque carga `data/CoberturasVG.json`; por ejemplo con la extensión Live Server de VS Code.

## Dependencias externas (CDN)

- [SheetJS](https://sheetjs.com/) y [ExcelJS](https://github.com/exceljs/exceljs): lectura y plantilla de Excel.
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js): generación del PDF.

También consume servicios de Power Automate para tasas, actividades económicas, asesores y pólizas del tomador (ver `js/app.js`).

## Documentación de cálculos

Las fórmulas (valor asegurado, tasa pura, recargo comercial, credibilidad, fraccionamiento y tasa única) y un ejemplo numérico completo están en [docs/calculos](docs/calculos/README.md).
