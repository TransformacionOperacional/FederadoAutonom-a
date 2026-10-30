/* ============================================================
   PDF DE COTIZACIÓN
   Toma los datos básicos (estado.poliza) y el último cálculo de la
   pantalla de cálculos (resumenCotizacion) y descarga el slip en PDF.
   Depende de app.js (estado, formatearDinero, etc.) y de html2pdf.js.
   ============================================================ */

const PDF_PLANES_POR_TABLA = 4;

// Geometría de la página y de la portada (encabezadoVG.png incrustada).
const PDF_ANCHO_PX = 794;
const PDF_ANCHO_MM = 210;
const PDF_MARGEN_VERTICAL_MM = 10;
const PDF_ENCABEZADO_ANCHO = 1200;
const PDF_ENCABEZADO_ALTO = 796;

// La portada se dibuja en la página 1 desde el borde superior izquierdo (sobre el margen);
// en el flujo del documento se reserva el espacio que ocupa debajo del margen superior.
function pdfAltoEncabezadoMm() {
    return PDF_ANCHO_MM * PDF_ENCABEZADO_ALTO / PDF_ENCABEZADO_ANCHO;
}

function pdfAltoEspacioEncabezadoPx() {
    return Math.round((pdfAltoEncabezadoMm() - PDF_MARGEN_VERTICAL_MM) * PDF_ANCHO_PX / PDF_ANCHO_MM) + 12;
}

// Une cada título con el contenido que le sigue para que no queden separados entre páginas.
function pdfMantenerTitulosConContenido(raiz) {
    const esTitulo = elemento => elemento && (/^H[1-3]$/.test(elemento.tagName) || elemento.classList.contains('tit'));
    raiz.querySelectorAll('h1, h2, h3, p.tit').forEach(titulo => {
        if (titulo.parentElement.classList.contains('keep')) return;
        const grupo = [titulo];
        let siguiente = titulo.nextElementSibling;
        while (siguiente && (esTitulo(siguiente) || siguiente.tagName === 'HR')) {
            grupo.push(siguiente);
            siguiente = siguiente.nextElementSibling;
        }
        if (siguiente) grupo.push(siguiente);
        const envoltorio = document.createElement('div');
        envoltorio.className = 'keep';
        titulo.before(envoltorio);
        grupo.forEach(elemento => envoltorio.appendChild(elemento));
    });
}

const PDF_ESTILOS = `
.pdf-cot { width:794px; padding:0 57px 24px; background:#fff; color:#1A2E4A; font-family:'FS Joey',-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:9pt; line-height:1.4; box-sizing:border-box; }
.pdf-cot * { box-sizing:border-box; }
.pdf-cot .pdf-espacio-encabezado { width:100%; }
.pdf-cot h1 { font-size:14pt; font-style:italic; font-weight:bold; color:#0033A0; margin:22px 0 8px; }
.pdf-cot h2 { font-size:9pt; font-weight:bold; color:#0033A0; margin:14px 0 4px; }
.pdf-cot h3 { font-size:9pt; font-weight:bold; color:#0033A0; margin:12px 0 4px; }
.pdf-cot p { margin:0 0 6px; }
.pdf-cot .b { font-weight:bold; }
.pdf-cot .sep-linea { border:0; border-top:1.5px solid #E3E829; width:78px; margin:4px 0 8px; }
.pdf-cot p, .pdf-cot li, .pdf-cot h1, .pdf-cot h2, .pdf-cot h3, .pdf-cot tr, .pdf-cot .keep, .pdf-cot .sep-linea,
.pdf-cot .t-req, .pdf-cot .t-edades, .pdf-cot .t-asesores, .pdf-cot .t-cg, .pdf-cot .t-pago, .pdf-cot .t-turquesa, .pdf-cot .caja-otras { break-inside:avoid; page-break-inside:avoid; }
.pdf-cot table { border-collapse:collapse; width:100%; margin-bottom:12px; table-layout:fixed; }
.pdf-cot td, .pdf-cot th { padding:4px 8px; vertical-align:top; text-align:left; font-weight:normal; word-wrap:break-word; overflow-wrap:anywhere; }
.pdf-cot img { max-width:100%; height:auto; }
.pdf-cot a { color:#2D6DF6; }
.pdf-cot .t-turquesa, .pdf-cot .t-turquesa td { border:1px solid #00AEC7; }
.pdf-cot .t-turquesa td .lbl { font-weight:bold; display:block; color:#0033A0; }
.pdf-cot .t-turquesa td.cab-azul-osc { background:#0033A0; color:#fff; font-weight:bold; letter-spacing:1px; }
.pdf-cot .t-turquesa td.cab-azul { background:#2D6DF6; color:#fff; font-weight:bold; letter-spacing:1px; }
.pdf-cot .t-planes { font-size:8.5pt; color:#1A2E4A; }
.pdf-cot .t-planes, .pdf-cot .t-planes td { border:1px solid #B4B4B5; }
.pdf-cot .t-planes td { padding:3px 5px; }
.pdf-cot .t-planes td.titulo { background:#0033A0; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-planes tr.cab td { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-planes tr.cab td:first-child { text-align:left; }
.pdf-cot .t-planes tr.seccion td { background:#DFEAFF; color:#0033A0; font-weight:bold; }
.pdf-cot .t-planes tr.total td { font-weight:bold; background:#F9FAE1; color:#0033A0; }
.pdf-cot .t-planes td.m { text-align:right; white-space:normal; overflow-wrap:anywhere; }
.pdf-cot .t-planes td.c { text-align:center; }
.pdf-cot .t-planes td.v { background:#F9FAE1; color:#0033A0; font-weight:bold; text-align:center; }
.pdf-cot .t-req, .pdf-cot .t-req td, .pdf-cot .t-req th { border:1px solid #B4B4B5; }
.pdf-cot .t-req th { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; vertical-align:middle; }
.pdf-cot .t-req td { color:#1A2E4A; text-align:center; }
.pdf-cot .t-req td:first-child { text-align:left; }
.pdf-cot .t-edades th { background:#2D6DF6; color:#fff; font-weight:bold; padding:6px 8px; }
.pdf-cot .t-edades td { color:#1A2E4A; border:1px solid #B4B4B5; }
.pdf-cot .t-edades td.c { text-align:center; vertical-align:middle; }
.pdf-cot .t-edades td.c small { font-size:7.5pt; }
.pdf-cot .t-edades th:nth-child(n+2) { text-align:center; }
.pdf-cot .caja-otras { border:1px solid #2D6DF6; min-height:70px; margin-bottom:8px; }
.pdf-cot .t-asesores, .pdf-cot .t-asesores td, .pdf-cot .t-asesores th { border:1px solid #2D6DF6; }
.pdf-cot .t-asesores th.cab1 { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-asesores th.cab2 { background:#0033A0; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-asesores td { text-align:center; height:24px; }
.pdf-cot .t-cg, .pdf-cot .t-cg td, .pdf-cot .t-cg th { border:1px solid #2D6DF6; }
.pdf-cot .t-cg th.cab1 { background:#0033A0; color:#fff; font-weight:bold; border-color:#00AEC7; }
.pdf-cot .t-cg th.cab2 { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-cg td { height:26px; }
.pdf-cot .t-pago, .pdf-cot .t-pago td { border:0; }
.pdf-cot ul, .pdf-cot ol { margin:4px 0 8px; padding-left:22px; }
.pdf-cot li { margin-bottom:3px; }
.pdf-cot .nota-tabla { font-size:8pt; color:#888B8D; margin:-6px 0 10px; }
`;

function pdfFecha(iso) {
    const coincidencia = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : '';
}

function pdfFechaHoy() {
    const hoy = new Date();
    const dos = valor => String(valor).padStart(2, '0');
    return `${hoy.getFullYear()}/${dos(hoy.getMonth() + 1)}/${dos(hoy.getDate())}`;
}

function pdfTexto(valor) {
    const texto = String(valor ?? '').trim();
    return texto ? escaparHTML(texto) : '&nbsp;';
}

function pdfColgroup(columnas, porcentajePlanes = 56) {
    const anchoPlan = Math.floor(porcentajePlanes / (columnas - 1));
    return `<colgroup><col style="width:${100 - anchoPlan * (columnas - 1)}%">${`<col style="width:${anchoPlan}%">`.repeat(columnas - 1)}</colgroup>`;
}

function pdfDinero(valor) {
    return Number.isFinite(valor)
        ? escaparHTML(formatearDinero(Math.round(valor))).replace(/\./g, '.<wbr>')
        : '—';
}

function pdfNombreArchivo() {
    const tomador = String(estado.poliza.tomador || 'cotizacion')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'cotizacion';
    return `Cotizacion_VidaGrupo_${tomador}_${pdfFechaHoy().replace(/\//g, '')}.pdf`;
}

function pdfDirigidoA(plan) {
    if (!esPlanSoloFamiliares(plan)) return 'Afiliado principal';
    return (plan.parentescosRestriccion || []).join(', ') || 'Otros parentescos';
}

function pdfParentescosAseguradosAdicionales(resumen) {
    if (!debeSepararPrincipalesDeFamiliares()) return [];
    const idsPlanesCotizados = new Set(resumen.planes.map(item => item.plan.id));
    const parentescos = new Set();
    estado.asegurados
        .filter(asegurado => idsPlanesCotizados.has(asegurado.planId)
            && asegurado.tipoAsegurado !== 'Afiliado principal')
        .forEach(asegurado => {
            if (asegurado.tipoAsegurado) parentescos.add(asegurado.tipoAsegurado);
        });

    const nombresParentesco = { Conyugue: 'Cónyuge', Padrastos: 'Padrastros' };
    return [...parentescos]
        .sort((parentescoA, parentescoB) =>
            CONFIG.TIPO_ASEGURADO.indexOf(parentescoA) - CONFIG.TIPO_ASEGURADO.indexOf(parentescoB))
        .map(parentesco => nombresParentesco[parentesco] || parentesco);
}

// Coberturas de todos los planes, con Vida primero y sin repetir.
function pdfCoberturasResumen(planes) {
    const coberturas = new Map();
    planes.forEach(item => item.totales.forEach((total, codigo) => {
        if (!coberturas.has(codigo)) coberturas.set(codigo, total.nombre);
    }));
    return [...coberturas.entries()]
        .sort(([codigoA], [codigoB]) => (codigoB === 'WET') - (codigoA === 'WET'))
        .map(([codigo, nombre]) => ({ codigo, nombre }));
}

function pdfDividirEnGrupos(lista, tamano) {
    const grupos = [];
    for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
    return grupos;
}

function pdfNombrePlan(plan) {
    const coincidencia = /^\s*plan\s+([a-z]+)\b/i.exec(String(plan?.nombre || ''));
    return coincidencia ? `PLAN ${coincidencia[1].toUpperCase()}` : String(plan?.nombre || '').toUpperCase();
}

// Valor asegurado y primas por plan, según la forma de pago elegida.
function pdfTablasPlanes(resumen) {
    const { planes, totalesPoliza, primaTotalPoliza } = resumen;
    const coberturas = pdfCoberturasResumen(planes);
    const detallePago = obtenerDetalleFraccionamiento();
    const descripcionPago = obtenerDescripcionFormaPago();
    const esAnual = (estado.poliza.formaPago || 'Anual') === 'Anual';
    const mostrarDirigidoA = debeSepararPrincipalesDeFamiliares();
    const grupos = pdfDividirEnGrupos(planes, PDF_PLANES_POR_TABLA);

    return grupos.map((grupo, indice) => {
        const esUltimo = indice === grupos.length - 1;
        const columnas = grupo.length + 1 + (esUltimo ? 1 : 0);
        const colgroup = pdfColgroup(columnas);
        const celdasPlan = funcion => grupo.map(funcion).join('');
        const filaConTotal = (etiqueta, funcionPlan, totalPoliza, clase = '', claseCelda = 'm') =>
            `<tr${clase ? ` class="${clase}"` : ''}><td>${etiqueta}</td>${celdasPlan(funcionPlan)}${esUltimo ? `<td class="${claseCelda}">${totalPoliza}</td>` : ''}</tr>`;
        const filaSeccion = texto => `<tr class="seccion"><td colspan="${columnas}">${texto}</td></tr>`;

        const filasCoberturas = coberturas.map(({ codigo, nombre }) => filaConTotal(
            escaparHTML(nombre),
            item => `<td class="m">${item.totales.has(codigo) ? pdfDinero(item.totales.get(codigo).valorAsegurado) : '—'}</td>`,
            totalesPoliza.has(codigo) ? pdfDinero(totalesPoliza.get(codigo).valorAsegurado) : '—'
        )).join('');

        const filaAnual = esAnual ? '' : filaConTotal(
            'Prima anual',
            item => `<td class="m">${pdfDinero(item.primaTotal)}</td>`,
            pdfDinero(primaTotalPoliza)
        );
        const etiquetaPago = `Prima ${escaparHTML(descripcionPago)} · ${detallePago.periodos} ${detallePago.periodos === 1 ? 'pago' : 'pagos'}`;

        return `<table class="t-planes">${colgroup}
            <tr><td colspan="${columnas}" class="titulo">VIDA GRUPO INTEGRAL</td></tr>
            <tr class="cab"><td>PLAN</td>${celdasPlan(item => `<td>${escaparHTML(pdfNombrePlan(item.plan))}</td>`)}${esUltimo ? '<td>TOTAL PÓLIZA</td>' : ''}</tr>
            ${mostrarDirigidoA ? filaConTotal('Dirigido a', item => `<td class="c">${escaparHTML(pdfDirigidoA(item.plan))}</td>`, '—', '', 'c') : ''}
            ${filaConTotal('Asegurados Aproximados', item => `<td class="c">${item.cantidadAsegurados.toLocaleString('es-CO')}</td>`, planes.reduce((suma, item) => suma + item.cantidadAsegurados, 0).toLocaleString('es-CO'), '', 'c')}
            ${filaSeccion('VALOR ASEGURADO TOTAL POR COBERTURA')}
            ${filasCoberturas}
            ${filaSeccion('PRIMAS')}
            ${filaAnual}
            ${filaConTotal(etiquetaPago, item => `<td class="m">${pdfDinero(calcularPrimaPorFormaPago(item.primaTotal))}</td>`, pdfDinero(calcularPrimaPorFormaPago(primaTotalPoliza)), 'total')}
        </table>`;
    }).join('');
}

// Patronal: solo la tasa única de la póliza. Voluntaria/Mixta: tasas por
// cobertura por plan y para toda la póliza, además de la tasa única.
function pdfTablasTasas(resumen) {
    const { planes, totalesPoliza, tasaUnicaPoliza } = resumen;
    const filaTasaUnica = columnas => `<tr class="total"><td colspan="${columnas - 1}">Tasa única total de la póliza (por mil)</td><td class="v">${escaparHTML(tasaUnicaPoliza)}</td></tr>`;

    if (esPolizaPatronal()) {
        return `<table class="t-planes"><colgroup><col style="width:75%"><col style="width:25%"></colgroup>
            <tr><td colspan="2" class="titulo">TASA</td></tr>
            ${filaTasaUnica(2)}
        </table>`;
    }

    const coberturas = pdfCoberturasResumen(planes);
    const grupos = pdfDividirEnGrupos(planes, PDF_PLANES_POR_TABLA);
    const tasa = total => escaparHTML(total ? formatearTasaUnica(total.prima, total.valorAsegurado) : '—');
    return grupos.map((grupo, indice) => {
        const esUltimo = indice === grupos.length - 1;
        const columnas = grupo.length + 1 + (esUltimo ? 1 : 0);
        const colgroup = pdfColgroup(columnas);
        const filas = coberturas.map(({ codigo, nombre }) => `<tr><td>${escaparHTML(nombre)}</td>${grupo.map(item => `<td class="v">${tasa(item.totales.get(codigo))}</td>`).join('')}${esUltimo ? `<td class="v">${tasa(totalesPoliza.get(codigo))}</td>` : ''}</tr>`).join('');
        return `<table class="t-planes">${colgroup}
            <tr><td colspan="${columnas}" class="titulo">TASAS POR COBERTURA (POR MIL)</td></tr>
            <tr class="cab"><td>COBERTURA</td>${grupo.map(item => `<td>${escaparHTML(pdfNombrePlan(item.plan))}</td>`).join('')}${esUltimo ? '<td>TODA LA PÓLIZA</td>' : ''}</tr>
            ${filas}
            ${esUltimo ? filaTasaUnica(columnas) : ''}
        </table>`;
    }).join('');
}

function pdfMarca(condicion) {
    return condicion ? 'x' : '___';
}

function construirHtmlCotizacionPdf(resumen) {
    const p = estado.poliza;
    const formaPago = p.formaPago || 'Anual';
    const detallePago = obtenerDetalleFraccionamiento();
    const vigencia = `Desde 24:00 horas del ${pdfFecha(p.vigenciaDesde) || '—'} Hasta 24:00 horas del ${pdfFecha(p.vigenciaHasta) || '—'}`;
    const oficina = [p.codigoOficinaAsesor, p.oficinaAsesor].filter(Boolean).join(' – ');
    const identificacion = [p.tipoIdentificacion, p.numeroIdentificacion].filter(Boolean).join(' ');
    const comision = Number.isFinite(Number(p.comision)) ? `${Number(p.comision)}%` : '';
    const validez = pdfFecha(p.validezOferta);
    const validezTexto = validez
        ? `la presente cotización tiene validez hasta el ${escaparHTML(validez)}.`
        : 'la presente cotización tiene validez hasta el día XX del mes de XXXX de 20XX.';
    const frecuencias = ['Diario', 'Mensual', 'Trimestral', 'Semestral', 'Anual'];
    const parentescosAdicionales = pdfParentescosAseguradosAdicionales(resumen);
    const textoAseguradosAdicionales = parentescosAdicionales.length > 0
        ? `; familiares incluidos: ${escaparHTML(parentescosAdicionales.join(', '))}`
        : '';

    return `<div class="pdf-cot"><style>${PDF_ESTILOS}</style>
  <div class="pdf-espacio-encabezado" style="height:${pdfAltoEspacioEncabezadoPx()}px"></div>

  <table class="t-turquesa">
    <tr><td colspan="4" class="cab-azul-osc">INFORMACIÓN GENERAL</td></tr>
    <tr>
      <td><span class="lbl">Ciudad y fecha de cotización</span>${pdfFechaHoy()}</td>
      <td><span class="lbl">Oficina de radicación</span>${pdfTexto(oficina)}</td>
      <td><span class="lbl">Número de póliza</span>${pdfTexto(p.numeroPoliza)}</td>
      <td><span class="lbl">Documento de identificación</span>${pdfTexto(p.numeroIdentificacion)}</td>
    </tr>
    <tr>
      <td colspan="2"><span class="lbl">Vigencia del seguro</span>${escaparHTML(vigencia)}</td>
      <td colspan="2"><span class="lbl">Vigencia del movimiento</span>${escaparHTML(vigencia)}</td>
    </tr>
    <tr>
      <td colspan="2"><span class="lbl">Actividad</span>${pdfTexto(p.actividad)}</td>
      <td colspan="2"><span class="lbl">Día de facturación</span>${pdfTexto(pdfFecha(p.fechaCobro))}</td>
    </tr>
  </table>

  <table class="t-turquesa">
    <colgroup><col style="width:75%"><col style="width:25%"></colgroup>
    <tr><td colspan="2" class="cab-azul">ASESOR</td></tr>
    <tr>
      <td><span class="lbl">NOMBRE: ${escaparHTML(String(p.asesor || '').toUpperCase())}</span></td>
      <td><span class="lbl">Código</span>${pdfTexto(p.codigoAsesor)}</td>
    </tr>
  </table>

  <table class="t-turquesa">
    <tr><td colspan="4" class="cab-azul">TOMADORES</td></tr>
    <tr>
      <td><span class="lbl">Nombre:</span>${pdfTexto(p.tomador)}</td>
      <td><span class="lbl">Tipo de identificación</span>${pdfTexto(p.tipoIdentificacion)}</td>
      <td><span class="lbl">Número de identificación</span>${pdfTexto(p.numeroIdentificacion)}</td>
      <td><span class="lbl">Segmento</span>${pdfTexto(p.segmento)}</td>
    </tr>
    <tr>
      <td colspan="4"><span class="lbl">Dirección de correspondencia</span>${pdfTexto(p.direccionCorrespondencia)}</td>
    </tr>
  </table>

  <p class="b"><span>Solución</span> Seguro Vida Grupo – Plan Vida Integral</p>
  <p class="b">Modalidad: ${pdfTexto(p.modalidadPlan)}</p>
  <p class="b">Asegurado: TODOS LOS EMPLEADOS DE LA EMPRESA${textoAseguradosAdicionales}</p>
  <p class="b">Beneficiario: LOS DESIGNADOS POR CADA ASEGURADO</p>

  <p class="b tit" style="margin-top:14px;">Valor Asegurado, Prima Total y Tasa de acuerdo con el plan elegido</p>
  ${pdfTablasPlanes(resumen)}
  ${pdfTablasTasas(resumen)}

  <p><b>Nota técnica:</b> Las pólizas de Vida Grupo emitidas por el Core Guidewire (Policy) pueden presentar variaciones en la prima debido al prorrateo automático del sistema. Este ajuste aplica en modificaciones posteriores, devoluciones y en inclusiones realizadas después del inicio de vigencia. La distribución aplica cuando los riesgos continúan vigentes, no para exclusiones.</p>
  <p><b>Ejemplo:</b> Si una persona se incluye en la póliza 15 días después del inicio de vigencia, el sistema calcula la prima proporcional al tiempo restante y distribuye el cobro en los periodos pendientes.</p>

  <h1>Requisitos de asegurabilidad para todas las coberturas</h1>
  <table class="t-req">
    <colgroup><col style="width:32%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:17%"></colgroup>
    <tr>
      <th rowspan="2">Valor Asegurado</th>
      <th colspan="2">Patronales</th>
      <th colspan="2">Voluntarias<br><span style="font-size:8pt">(máx. de VA en Vida según segmento)</span></th>
    </tr>
    <tr><th>Hasta 55 años</th><th>Entre 56 y 69 años</th><th>Hasta 55 años</th><th>Entre 56 y 69 años</th></tr>
    <tr><td>Hasta $500.000.000</td><td>1</td><td>1</td><td>1</td><td>1</td></tr>
    <tr><td>$500.000.001 a $700.000.000</td><td>1</td><td>1,4</td><td>1</td><td>1,2,4</td></tr>
    <tr><td>$700.000.001 a $1.700.000.000</td><td>1,2,4</td><td>1,2,4,5</td><td>1,2,4</td><td>1,2,4,5</td></tr>
    <tr><td>Mayor a $1.700.000.000</td><td>1,2,3,4,5,6</td><td>1,2,3,4,5,6,7</td><td>1,2,3,4,5,6</td><td>1,2,3,4,5,6,7</td></tr>
  </table>

  <p class="b tit">Requisitos Aplicables para la Cobertura de Enfermedades Graves:</p>
  <table class="t-req" style="width:80%">
    <colgroup><col style="width:42%"><col style="width:29%"><col style="width:29%"></colgroup>
    <tr><th>Valor Asegurado</th><th>Hasta 55 años</th><th>Entre 56 y 60 años</th></tr>
    <tr><td>Hasta $100.000.000</td><td>1</td><td>1</td></tr>
    <tr><td>$101.000.000 a $200.000.000</td><td>1</td><td>1,2,3,4</td></tr>
    <tr><td>$200.000.000 a $810.000.000</td><td>1,2,3,4</td><td>1,2,4,5,6</td></tr>
  </table>

  <h3>Listado de requisitos de asegurabilidad</h3>
  <hr class="sep-linea">
  <ol>
    <li>Declaración de asegurabilidad</li>
    <li>Examen médico</li>
    <li>Electrocardiograma</li>
    <li>Exámenes de laboratorio (glicemia, colesterol total, colesterol HDL, triglicéridos)</li>
    <li>Creatinina</li>
    <li>VIH</li>
    <li>Prueba de esfuerzo</li>
  </ol>

  <h3>Vigencia de los requisitos de asegurabilidad</h3>
  <hr class="sep-linea">
  <ol>
    <li>Examen médico, citoquímico de orina y química sanguínea: 1 año (12 meses).</li>
    <li>Electrocardiograma: 1 año (12 meses).</li>
    <li>Declaración de asegurabilidad: seis (6) meses.</li>
  </ol>

  <p class="b"><b>Nota:</b> los exámenes descritos anteriormente están cubiertos por SURA. En caso de solicitarse exámenes adicionales para la evaluación médica de cada riesgo, deben ser asumidos por el asegurado.</p>

  <h1>Edades de ingreso y permanencia</h1>
  <table class="t-edades">
    <colgroup><col style="width:34%"><col style="width:20%"><col style="width:46%"></colgroup>
    <tr><th>COBERTURA</th><th>Edad máxima de ingreso</th><th>Edad máxima de permanencia</th></tr>
    <tr><td>Vida – Muerte por cualquier causa</td><td class="c" rowspan="5">70 años + 364 días</td><td class="c" rowspan="5">80 años + 364 días</td></tr>
    <tr><td>Bono funerario</td></tr>
    <tr><td>Bono para educación</td></tr>
    <tr><td>Auxilio por maternidad o paternidad</td></tr>
    <tr><td>Auxilio de repatriación</td></tr>
    <tr><td>Muerte accidental</td><td class="c">69 años + 364 días</td><td class="c">75 años + 364 días</td></tr>
    <tr><td>Invalidez, pérdida o inutilización por accidente o enfermedad</td><td class="c" rowspan="5">69 años + 364 días</td><td class="c" rowspan="5">70 años + 364 días</td></tr>
    <tr><td>Invalidez, pérdida o inutilización por enfermedad</td></tr>
    <tr><td>Invalidez accidental adicional</td></tr>
    <tr><td>Pérdida parcial de la capacidad laboral</td></tr>
    <tr><td>Bono para adecuaciones del hogar</td></tr>
    <tr><td>Renta por incapacidad por accidente o enfermedad</td><td class="c" rowspan="3">60 años + 364 días</td><td class="c" rowspan="3">65 años + 364 días</td></tr>
    <tr><td>Renta por hospitalización</td></tr>
    <tr><td>Renta adicional por hospitalización en cuidados intensivos</td></tr>
    <tr><td>Enfermedades graves</td><td class="c">65 años + 364 días</td><td class="c">70 años + 364 días</td></tr>
    <tr><td>Gastos de curación</td><td class="c" rowspan="2">65 años + 364 días</td><td class="c" rowspan="2">75 años + 364 días</td></tr>
    <tr><td>Renta por incapacidad por accidente</td></tr>
    <tr><td>Bono canasta</td><td class="c">70 años + 364 días</td><td class="c"><small>Por estar ligada a la cobertura de ‘Vida – Muerte por cualquier causa’ o ‘Invalidez o pérdida por accidente o enfermedad’, se le aplica la edad máxima de permanencia de cada una de las coberturas mencionadas.</small></td></tr>
  </table>

  <h1 style="font-family:Arial,sans-serif;font-style:normal;font-size:9pt;">Condiciones particulares</h1>

  <h2>Cobertura patronal automática:</h2>
  <h3>SURA dará cobertura automática a los asegurados nuevos desde la fecha de inicio del contrato con la empresa, siempre y cuando:</h3>
  <ul>
    <li>SURA reciba la declaración de asegurabilidad dentro de los 30 días siguientes a la firma de dicho contrato.</li>
    <li>La suma asegurada no supere $ 150.000.000.</li>
    <li>La edad de ingreso del asegurado no supere 55 años.</li>
    <li>Las respuestas a la declaración de asegurabilidad sean en su totalidad negativas.</li>
    <li>Modificaciones de valor asegurado: no se requiere diligenciamiento de la declaración de asegurabilidad para incrementos hasta $ 50.000.000, incrementos superiores a este valor, deben ser verificados para que no superen el 40 % del valor asegurado con un límite máximo de $ 150.000.000, de lo contrario se deberá llenar la declaración de asegurabilidad.</li>
  </ul>

  ${esCanalPromotora(p.canalComercial) ? `<h2>Honorarios por administración y recaudo:</h2>
  <p>Se entregará al tomador un ${escaparHTML(String(Number(p.honorarioPromotora) || 0))} % de las primas pagadas a SURAMERICANA, como aporte por concepto de Honorarios por Administración y Recaudo. Para ello, el Tomador debe enviar una factura de venta o documento equivalente a Suramericana por el monto correspondiente al honorario por la administración de seguros. Una vez realice el proceso de causación de la factura, la compañía procederá a realizar el pago.</p>

  ` : ''}<h2>Bono por siniestralidad:</h2>
  <p>El bono por siniestralidad se debe calcular tres meses posteriores a la terminación de la vigencia y se liquida a través de una factura de cobro (incluye IVA) que el tomador debe generar, por lo que no afecta la comisión del intermediario. El bono por siniestralidad se establece para esta póliza de la siguiente forma:</p>
  <p>PU = 30 % (40 % primas emitidas – siniestros incurridos*).</p>
  <p class="b">Siniestros incurridos*: Corresponde al valor de siniestros pagados y avisados de la vigencia que se está evaluando y se le debe sumar la Reserva de Siniestros No Avisados (IBNR), que corresponde a siniestros que ya ocurrieron y aún no se han reportado a la aseguradora.</p>

  <h2>Errores, omisiones o inexactitudes:</h2>
  <p>En caso de que, por alguna inconsistencia en los sistemas o un error de digitación, un asegurado no aparezca en los listados de asegurados y tenga un siniestro, la aseguradora pagaría el siniestro, previa prueba de que el asegurado haya diligenciado satisfactoriamente la declaración de asegurabilidad y el valor asegurado se encuentre dentro de los límites de automaticidad autorizados por la aseguradora.</p>

  <h2>Beneficiarios:</h2>
  <p>La designación de los beneficiarios es una POTESTAD LIBRE, EXCLUSIVA E INDELEGABLE DE CADA UNO DE LOS ASEGURADOS. Por lo anterior, cada uno de los asegurados deberá indicar el nombre de las personas con sus respectivos porcentajes, a quienes desea que se les entregue la indemnización y en el evento de no haber designación, los beneficiarios serán los estipulados por ley.</p>

  <h2>Irreductibilidad:</h2>
  <p>ARTÍCULO 1160. IMPOSIBILIDAD DE REDUCCIÓN DEL VALOR DEL SEGURO. Transcurridos dos años en vida del asegurado, desde la fecha del perfeccionamiento del contrato, el valor del seguro de vida no podrá ser reducido por causa de error en la declaración de asegurabilidad.</p>

  <h2>Otras condiciones especiales:</h2>
  <div class="caja-otras">&nbsp;</div>

  <table class="t-asesores" style="margin-top:24px;">
    <colgroup><col style="width:16%"><col style="width:30%"><col style="width:16%"><col style="width:17%"><col style="width:21%"></colgroup>
    <tr><th colspan="5" class="cab1">ASESORES</th></tr>
    <tr><th class="cab2">Código</th><th class="cab2">Nombre del asesor principal</th><th class="cab2">Líder</th><th class="cab2">Participación</th><th class="cab2">Comisión ponderada</th></tr>
    <tr><td><b>${pdfTexto(p.codigoAsesor)}</b></td><td>${pdfTexto(String(p.asesor || '').toUpperCase())}</td><td>X</td><td>100%</td><td>${pdfTexto(comision)}</td></tr>
    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
  </table>

  <table class="t-asesores">
    <colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup>
    <tr><th colspan="3" class="cab1">COASEGURADOR</th></tr>
    <tr><th class="cab2">Código</th><th class="cab2">Porcentaje</th><th class="cab2">Líder</th></tr>
    <tr><td>&nbsp;</td><td></td><td></td></tr>
  </table>

  <p class="b tit" style="margin-top:18px;">Condiciones generales</p>
  <table class="t-cg">
    <tr><th colspan="4" class="cab1">DATOS DE LAS CONDICIONES GENERALES APLICABLES</th></tr>
    <tr><th class="cab2">Solución</th><th class="cab2">Fecha a partir de la cual se utiliza</th><th class="cab2">Ramo al que pertenece</th><th class="cab2">Identificación de la proforma</th></tr>
    <tr><td>${pdfTexto('Vida Integral')}</td><td>${pdfTexto(pdfFecha(p.vigenciaDesde))}</td><td>${pdfTexto('083')}</td><td></td></tr>
  </table>

  <h2>Pago de las primas:</h2>
  <p>El plazo para el pago de la prima será de 30 días entre la fecha de inicio de vigencia y la fecha de expedición más reciente.</p>

  <table class="t-pago">
    <colgroup><col style="width:51%"><col style="width:49%"></colgroup>
    <tr>
      <td>
        <p class="b">Forma de pago: ${escaparHTML(formaPago)}.</p>
        ${formaPago === 'Mensual' ? `<p class="b">Mensual*: anticipado ${pdfMarca(p.tipoPagoMensual === 'Anticipada')} Vencido ${pdfMarca(p.tipoPagoMensual !== 'Anticipada')}</p>` : ''}
        <p class="b">**Este campo aplica para las pólizas expedidas en GW.</p>
        <p>Fecha(s) acordada(s) para el pago (según forma de pago): ${pdfTexto(pdfFecha(p.fechaCobro))}</p>
        <p>Frecuencia ajuste**</p>
        <ul>${frecuencias.map(frecuencia => `<li>${frecuencia}${frecuencia === formaPago ? ' x' : ''}</li>`).join('')}</ul>
        <p class="b">Nota: la forma de pago y la frecuencia de ajuste deben ser iguales.</p>
        <p class="b">**Este campo aplica para las pólizas expedidas en Cliente Servidor.</p>
      </td>
      <td>
        <p class="b">Medio de pago</p>
        <ul>
          <li>Pago express (PSE – Código de Barras)</li>
          <li>Recaudo en línea</li>
          <li>Débito automático al tomador</li>
          <li>Transferencia</li>
          <li>Financiación (Servicios Financieros)</li>
        </ul>
        <p class="b" style="margin-top:28px;">Acompañamiento de gestor BST: Sí o No</p>
        <p class="b">¿Tiene ARL SURA?: Sí o No</p>
        <p class="b">¿Tiene recargo por fraccionamiento?: ${detallePago.factor > 0 ? 'Sí' : 'No'}</p>
      </td>
    </tr>
  </table>

  <h1>Programas de Acompañamiento y Gestión de Riesgos</h1>
  <ul style="list-style:disc;"><li class="b">Estamos cerca de tus colaboradores cuando más lo necesitan.</li></ul>
  <h2>Gestión Médica:</h2>
  <p>Orientación especializada en casos de invalidez, enfermedades graves o cáncer.</p>
  <h2>Programa Cuidar:</h2>
  <p>Apoyo integral a personas con patologías en etapa avanzada, junto a sus familias, en aspectos emocionales, jurídicos y financieros.</p>
  <h2>Empresas SURA:</h2>
  <p class="b">En Empresas SURA, te acompañamos en el cuidado de tu talento humano mientras alcanzas los objetivos de tu empresa. Te proporcionamos herramientas que puedes implementar para fidelizar a tu equipo y lograr tus metas. <a href="https://www.segurossura.com.co/empresasura/Paginas/default.aspx">Agenda la primera cita aquí.</a> Aplica para empresas clientes de Vida Grupo del segmento Empresarial.</p>

  <h1>Condiciones de cotización</h1>
  <p>El seguro que se cotiza en esta oferta se expedirá y se regirá, en caso que sea adjudicado a Seguros de Vida Suramericana S.A., en los términos y condiciones que específicamente se mencionan en este documento.</p>
  <p>Seguros Generales Suramericana S.A. se reserva el derecho de revisar términos y condiciones indicados en esta cotización si antes de la iniciación de la vigencia se presenta un incremento importante en la siniestralidad o existe una variación importante del estado de riesgo.</p>
  <p>Al contratar el seguro se entiende que la cotización le fue explicada, así como las coberturas y exclusiones de la póliza; cabe resaltar que la propuesta presentada está basada en sus requerimientos frente a los valores asegurados y eventuales solicitudes de eliminar ciertas coberturas.</p>
  <p>El seguro que se cotiza en esta oferta se expedirá y se regirá, en caso que sea adjudicado a Seguros Generales Suramericana S.A., en los términos y condiciones que específicamente se mencionan en este documento.</p>
  <p>Para que SEGUROS DE VIDA SURAMERICANA S.A no se considere en riesgo, la compañía debe recibir confirmación escrita de la aceptación de los términos y condiciones de esta cotización, de lo contrario se entiende que SURAMERICANA no ha asumido responsabilidad alguna.</p>
  <p>Validez de la oferta: ${validezTexto}</p>

  <h1 style="margin-top:36px;">SEGUROS DE VIDA SURAMERICANA S.A.</h1>
</div>`;
}

async function descargarCotizacionPdf() {
    if (typeof html2pdf === 'undefined') {
        mostrarToast('La librería de PDF no está disponible. Verifica tu conexión e inténtalo de nuevo.', 'error');
        return;
    }
    if (estado.asegurados.length === 0 || estado.planes.length === 0) {
        mostrarToast('Aún no hay una cotización calculada para descargar.', 'warning');
        return;
    }
    if (!String(estado.poliza.tomador || '').trim()) {
        mostrarAlertaRango('Diligencia el tomador en los datos generales antes de descargar la cotización.', null, 'Datos incompletos');
        return;
    }
    if (!validarAseguradosAsignadosParaCalculos()) return;

    const botones = ['btnDescargarPdfCalculos', 'btnDescargarPdfResumen']
        .map(id => document.getElementById(id)).filter(Boolean);
    botones.forEach(boton => { boton.disabled = true; });
    mostrarCargando('Generando PDF de la cotización...');
    try {
        // Garantiza que el resumen corresponda al cálculo vigente con credibilidad.
        renderizarTablaCalculos(false);
        if (!resumenCotizacion || resumenCotizacion.planes.length === 0 || resumenCotizacion.sinPlan) {
            mostrarToast('No fue posible obtener el cálculo de la cotización.', 'warning');
            return;
        }

        const raiz = document.createElement('div');
        raiz.innerHTML = construirHtmlCotizacionPdf(resumenCotizacion);
        const documentoPdf = raiz.firstElementChild;
        pdfMantenerTitulosConContenido(documentoPdf);
        try { await document.fonts.load("9pt 'FS Joey'"); } catch (error) { /* se usa la tipografía de respaldo */ }
        await html2pdf().set({
            margin: [PDF_MARGEN_VERTICAL_MM, 0, PDF_MARGEN_VERTICAL_MM, 0],
            filename: pdfNombreArchivo(),
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, x: 0, y: 0, width: PDF_ANCHO_PX, windowWidth: PDF_ANCHO_PX },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'h1', 'h2', 'h3', 'p', 'li', '.keep'] }
        }).from(documentoPdf).toPdf().get('pdf').then(pdf => {
            pdf.setPage(1);
            pdf.addImage(PDF_ENCABEZADO_DATA_URI, 'JPEG', 0, 0, PDF_ANCHO_MM, pdfAltoEncabezadoMm());
        }).save();
        mostrarToast('Cotización PDF descargada.', 'success');
    } catch (error) {
        console.error('No fue posible generar el PDF:', error);
        mostrarToast('No fue posible generar el PDF de la cotización.', 'error');
    } finally {
        ocultarCargando();
        botones.forEach(boton => { boton.disabled = false; });
    }
}

['btnDescargarPdfCalculos', 'btnDescargarPdfResumen'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', descargarCotizacionPdf);
});
