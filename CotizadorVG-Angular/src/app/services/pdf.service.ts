import { Injectable, Injector, inject } from '@angular/core';
import {
  CONFIG,
  NOMBRES_PARENTESCO_RESTRICCION,
  PDF_ANCHO_MM,
  PDF_ANCHO_PX,
  PDF_ENCABEZADO_ALTO,
  PDF_ENCABEZADO_ANCHO,
  PDF_ENCABEZADO_URL,
  PDF_ESTILOS,
  PDF_MARGEN_VERTICAL_MM,
  PDF_PLANES_CON_TASAS_POR_TABLA,
  PDF_PLANES_POR_TABLA,
} from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService } from '../core/ui.service';
import { escaparHTML, formatearDinero } from '../core/utils';
import { AsignacionService } from './asignacion.service';
import { CalculoService } from './calculo.service';
import { CatalogoService } from './catalogo.service';
import { CotizacionApiService } from './cotizacion-api.service';

/**
 * PDF de la cotización (slip) y exportación del resumen. Portado de `pdf-cotizacion.js`
 * y `pdf-encabezado-data.js`. Toma `estado.poliza` y el cálculo vigente del paso 5
 * (`store.resumenCotizacion`) y descarga el PDF con html2pdf.js (import dinámico).
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private store = inject(CotizadorStore);
  private ui = inject(UiService);
  private injector = inject(Injector);

  private get estado() {
    return this.store.estado;
  }
  private get calculo() {
    return this.injector.get(CalculoService);
  }
  private get catalogo() {
    return this.injector.get(CatalogoService);
  }
  private get asignacion() {
    return this.injector.get(AsignacionService);
  }
  private get cotizacionApi() {
    return this.injector.get(CotizacionApiService);
  }

  /** true mientras se genera/registra el PDF (los botones `btnDescargarPdfCalculos`/`btnDescargarPdfResumen` se deshabilitan). */
  generandoPdf = false;

  /** Portada del PDF (assets/images/encabezado-vg.png reducida a JPEG), equivalente a PDF_ENCABEZADO_DATA_URI. */
  private encabezadoDataUri: Promise<string> | null = null;

  /* ============================================================
     Geometría y utilidades del documento
     ============================================================ */

  // La portada se dibuja en la página 1 desde el borde superior izquierdo (sobre el margen);
  // en el flujo del documento se reserva el espacio que ocupa debajo del margen superior.
  pdfAltoEncabezadoMm(): number {
    return (PDF_ANCHO_MM * PDF_ENCABEZADO_ALTO) / PDF_ENCABEZADO_ANCHO;
  }

  pdfAltoEspacioEncabezadoPx(): number {
    return Math.round(((this.pdfAltoEncabezadoMm() - PDF_MARGEN_VERTICAL_MM) * PDF_ANCHO_PX) / PDF_ANCHO_MM) + 12;
  }

  // Une cada título con el contenido que le sigue para que no queden separados entre páginas.
  pdfMantenerTitulosConContenido(raiz: HTMLElement): void {
    const esTitulo = (elemento: Element | null) =>
      !!elemento && (/^H[1-3]$/.test(elemento.tagName) || elemento.classList.contains('tit'));
    raiz.querySelectorAll('h1, h2, h3, p.tit').forEach((titulo) => {
      if (titulo.parentElement!.classList.contains('keep')) return;
      const grupo: Element[] = [titulo];
      let siguiente = titulo.nextElementSibling;
      while (siguiente && (esTitulo(siguiente) || siguiente.tagName === 'HR')) {
        grupo.push(siguiente);
        siguiente = siguiente.nextElementSibling;
      }
      if (siguiente) grupo.push(siguiente);
      const envoltorio = document.createElement('div');
      envoltorio.className = 'keep';
      titulo.before(envoltorio);
      grupo.forEach((elemento) => envoltorio.appendChild(elemento));
    });
  }

  /**
   * Equivale a la constante PDF_ENCABEZADO_DATA_URI del original (que incrustaba la portada como JPEG en base64):
   * carga `assets/images/encabezado-vg.png`, la reduce a PDF_ENCABEZADO_ANCHO x PDF_ENCABEZADO_ALTO y la devuelve como JPEG.
   */
  cargarEncabezadoDataUri(): Promise<string> {
    if (!this.encabezadoDataUri) {
      this.encabezadoDataUri = new Promise<string>((resolver, rechazar) => {
        const imagen = new Image();
        imagen.onload = () => {
          const lienzo = document.createElement('canvas');
          lienzo.width = PDF_ENCABEZADO_ANCHO;
          lienzo.height = PDF_ENCABEZADO_ALTO;
          const contexto = lienzo.getContext('2d')!;
          contexto.fillStyle = '#fff';
          contexto.fillRect(0, 0, lienzo.width, lienzo.height);
          contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
          resolver(lienzo.toDataURL('image/jpeg', 0.85));
        };
        imagen.onerror = () => rechazar(new Error(`No se pudo cargar la imagen del PDF: ${PDF_ENCABEZADO_URL}`));
        imagen.src = PDF_ENCABEZADO_URL;
      }).catch((error) => {
        this.encabezadoDataUri = null;
        throw error;
      });
    }
    return this.encabezadoDataUri;
  }

  pdfFecha(iso: any): string {
    const coincidencia = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : '';
  }

  pdfDiaDelMes(iso: any): string {
    const coincidencia = String(iso || '').match(/^\d{4}-\d{2}-(\d{2})/);
    return coincidencia ? coincidencia[1] : '';
  }

  pdfFechaHoy(): string {
    const hoy = new Date();
    const dos = (valor: number) => String(valor).padStart(2, '0');
    return `${hoy.getFullYear()}/${dos(hoy.getMonth() + 1)}/${dos(hoy.getDate())}`;
  }

  pdfTexto(valor: any): string {
    const texto = String(valor ?? '').trim();
    return texto ? escaparHTML(texto) : '&nbsp;';
  }

  pdfColgroup(columnas: number, porcentajePlanes = 56): string {
    const anchoPlan = Math.floor(porcentajePlanes / (columnas - 1));
    return `<colgroup><col style="width:${100 - anchoPlan * (columnas - 1)}%">${`<col style="width:${anchoPlan}%">`.repeat(columnas - 1)}</colgroup>`;
  }

  pdfColgroupValoresYTasas(cantidadPares: number): string {
    const anchoPar = 72 / cantidadPares;
    const anchoValor = anchoPar * 0.62;
    const anchoTasa = anchoPar - anchoValor;
    return `<colgroup><col style="width:28%">${Array.from(
      { length: cantidadPares },
      () => `<col style="width:${anchoValor}%"><col style="width:${anchoTasa}%">`,
    ).join('')}</colgroup>`;
  }

  pdfDinero(valor: number): string {
    return Number.isFinite(valor) ? escaparHTML(formatearDinero(Math.round(valor))).replace(/\./g, '.<wbr>') : '—';
  }

  pdfTextoTasa(valor: any): string {
    return escaparHTML(valor).replace(/[.,]/g, (separador) => `${separador}<wbr>`);
  }

  pdfNombreArchivo(): string {
    const tomador =
      String(this.estado.poliza.tomador || 'cotizacion')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'cotizacion';
    return `Cotizacion_VidaGrupo_${tomador}_${this.pdfFechaHoy().replace(/\//g, '')}.pdf`;
  }

  pdfDirigidoA(plan: any): string {
    if (!this.calculo.esPlanSoloFamiliares(plan)) return 'Afiliado principal';
    return (plan.parentescosRestriccion || []).join(', ') || 'Otros parentescos';
  }

  pdfParentescosAseguradosAdicionales(resumen: any): string[] {
    if (!this.calculo.debeSepararPrincipalesDeFamiliares()) return [];
    const idsPlanesCotizados = new Set(resumen.planes.map((item: any) => item.plan.id));
    const parentescos = new Set<string>();
    this.estado.asegurados
      .filter((asegurado: any) => idsPlanesCotizados.has(asegurado.planId) && asegurado.tipoAsegurado !== 'Afiliado principal')
      .forEach((asegurado: any) => {
        if (asegurado.tipoAsegurado) parentescos.add(asegurado.tipoAsegurado);
      });

    const tiposAsegurado = CONFIG.TIPO_ASEGURADO as string[];
    return [...parentescos]
      .sort((parentescoA, parentescoB) => tiposAsegurado.indexOf(parentescoA) - tiposAsegurado.indexOf(parentescoB))
      .map((parentesco) => NOMBRES_PARENTESCO_RESTRICCION[parentesco] || parentesco);
  }

  // Coberturas de todos los planes, con Vida primero y sin repetir.
  pdfCoberturasResumen(planes: any[]): { codigo: string; nombre: string }[] {
    const coberturas = new Map<string, string>();
    planes.forEach((item) =>
      item.totales.forEach((total: any, codigo: string) => {
        if (!coberturas.has(codigo)) coberturas.set(codigo, total.nombre);
      }),
    );
    return [...coberturas.entries()]
      .sort(([codigoA], [codigoB]) => Number(codigoB === 'WET') - Number(codigoA === 'WET'))
      .map(([codigo, nombre]) => ({ codigo, nombre }));
  }

  pdfDividirEnGrupos<T>(lista: T[], tamano: number): T[][] {
    const grupos: T[][] = [];
    for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
    return grupos;
  }

  pdfNombrePlan(plan: any): string {
    const coincidencia = /^\s*plan\s+([a-z]+)\b/i.exec(String(plan?.nombre || ''));
    return coincidencia ? `PLAN ${coincidencia[1].toUpperCase()}` : String(plan?.nombre || '').toUpperCase();
  }

  /* ============================================================
     Tablas de planes y tasas
     ============================================================ */

  // Valores asegurados, tasas y primas por plan, según la forma de pago elegida.
  pdfTablasPlanes(resumen: any): string {
    const { planes, totalesPoliza, primaTotalPoliza } = resumen;
    const calculo = this.calculo;
    const poliza = this.estado.poliza;
    const coberturas = this.pdfCoberturasResumen(planes);
    const descripcionPago = this.catalogo.obtenerDescripcionFormaPago();
    const esAnual = (poliza.formaPago || 'Anual') === 'Anual';
    const mostrarTasasPorCobertura = !calculo.esPolizaPatronal();
    const mostrarDirigidoA = calculo.debeSepararPrincipalesDeFamiliares();
    const grupos = this.pdfDividirEnGrupos<any>(
      planes,
      mostrarTasasPorCobertura ? PDF_PLANES_CON_TASAS_POR_TABLA : PDF_PLANES_POR_TABLA,
    );

    return grupos
      .map((grupo, indice) => {
        const esUltimo = indice === grupos.length - 1;
        const columnasPorPlan = mostrarTasasPorCobertura ? 2 : 1;
        const pares = grupo.length + (esUltimo ? 1 : 0);
        const columnas = 1 + pares * columnasPorPlan;
        const colgroup = mostrarTasasPorCobertura ? this.pdfColgroupValoresYTasas(pares) : this.pdfColgroup(columnas);
        const celdasPlan = (funcion: (item: any) => string) => grupo.map(funcion).join('');
        const celdaTotal = (contenido: string | string[], clase = 'm') => {
          if (!esUltimo) return '';
          if (Array.isArray(contenido)) {
            return contenido.map((valor, i) => `<td class="${i === 1 ? 'v' : clase}">${valor}</td>`).join('');
          }
          return `<td class="${clase}"${mostrarTasasPorCobertura ? ' colspan="2"' : ''}>${contenido}</td>`;
        };
        const filaConTotal = (
          etiqueta: string,
          funcionPlan: (item: any) => string,
          totalPoliza: string | string[],
          clase = '',
          claseCelda = 'm',
        ) =>
          `<tr${clase ? ` class="${clase}"` : ''}><td>${etiqueta}</td>${celdasPlan(funcionPlan)}${celdaTotal(totalPoliza, claseCelda)}</tr>`;
        const filaSeccion = (texto: string) => `<tr class="seccion"><td colspan="${columnas}">${texto}</td></tr>`;
        const tasa = (total: any) =>
          this.pdfTextoTasa(total ? calculo.formatearTasaUnica(total.prima, total.valorAsegurado) : '—');

        const filasCoberturas = coberturas
          .map(({ codigo, nombre }) =>
            filaConTotal(
              escaparHTML(nombre),
              (item) => {
                const total = item.totales.get(codigo);
                const valor = total ? this.pdfDinero(total.valorAsegurado) : '—';
                return mostrarTasasPorCobertura
                  ? `<td class="m">${valor}</td><td class="v">${tasa(total)}</td>`
                  : `<td class="m">${valor}</td>`;
              },
              mostrarTasasPorCobertura
                ? totalesPoliza.has(codigo)
                  ? [this.pdfDinero(totalesPoliza.get(codigo).valorAsegurado), tasa(totalesPoliza.get(codigo))]
                  : ['—', '—']
                : totalesPoliza.has(codigo)
                  ? this.pdfDinero(totalesPoliza.get(codigo).valorAsegurado)
                  : '—',
            ),
          )
          .join('');

        const filaAnual = esAnual
          ? ''
          : filaConTotal(
              'Prima anual total por plan',
              (item) =>
                mostrarTasasPorCobertura
                  ? `<td class="m" colspan="2">${this.pdfDinero(item.primaTotal)}</td>`
                  : `<td class="m">${this.pdfDinero(item.primaTotal)}</td>`,
              this.pdfDinero(primaTotalPoliza),
            );
        const filaPrimaPorAsegurado = filaConTotal(
          `Prima ${escaparHTML(poliza.formaPago || 'Anual').toLocaleLowerCase('es-CO')} por asegurado`,
          (item) =>
            mostrarTasasPorCobertura
              ? `<td class="m" colspan="2">${calculo.formatearPrimaPorAsegurado(item.primaTotal, item.cantidadAsegurados)}</td>`
              : `<td class="m">${calculo.formatearPrimaPorAsegurado(item.primaTotal, item.cantidadAsegurados)}</td>`,
          calculo.formatearPrimaPorAsegurado(
            primaTotalPoliza,
            planes.reduce((total: number, item: any) => total + item.cantidadAsegurados, 0),
          ),
        );
        const etiquetaPago = `Prima ${escaparHTML(descripcionPago)}`;

        const filasCabecera = mostrarTasasPorCobertura
          ? `<tr class="cab"><td rowspan="2">COBERTURA</td>${grupo.map((item) => `<td colspan="2">${escaparHTML(this.pdfNombrePlan(item.plan))}</td>`).join('')}${esUltimo ? '<td colspan="2">TODA LA PÓLIZA</td>' : ''}</tr>
            <tr class="subcab">${grupo.map(() => '<td>Valor asegurado</td><td>Tasa (por mil)</td>').join('')}${esUltimo ? '<td>Valor asegurado</td><td>Tasa (por mil)</td>' : ''}</tr>`
          : `<tr class="cab"><td>PLAN</td>${celdasPlan((item) => `<td>${escaparHTML(this.pdfNombrePlan(item.plan))}</td>`)}${esUltimo ? '<td>TOTAL PÓLIZA</td>' : ''}</tr>`;
        const celdaPlanCentrada = (contenido: string) =>
          mostrarTasasPorCobertura ? `<td class="c" colspan="2">${contenido}</td>` : `<td class="c">${contenido}</td>`;

        return `<table class="t-planes">${colgroup}
            <tr><td colspan="${columnas}" class="titulo">${mostrarTasasPorCobertura ? 'VALORES ASEGURADOS Y TASAS POR COBERTURA' : 'VIDA GRUPO INTEGRAL'}</td></tr>
            ${filasCabecera}
            ${mostrarDirigidoA ? filaConTotal('Tipo de asegurado', (item) => celdaPlanCentrada(escaparHTML(this.pdfDirigidoA(item.plan))), '—', '', 'c') : ''}
            ${filaConTotal('Asegurados Aproximados', (item) => celdaPlanCentrada(item.cantidadAsegurados.toLocaleString('es-CO')), planes.reduce((suma: number, item: any) => suma + item.cantidadAsegurados, 0).toLocaleString('es-CO'), '', 'c')}
            ${filaSeccion(mostrarTasasPorCobertura ? 'VALOR ASEGURADO Y TASA POR COBERTURA' : 'VALOR ASEGURADO TOTAL POR COBERTURA')}
            ${filasCoberturas}
            ${
              mostrarTasasPorCobertura && esUltimo
                ? `<tr class="total"><td colspan="${columnas - 2}">Tasa única total de la póliza (por mil)</td><td class="v" colspan="2">${this.pdfTextoTasa(resumen.tasaUnicaPoliza)}</td></tr>`
                : ''
            }
            ${filaSeccion('PRIMAS')}
            ${filaAnual}
            ${filaConTotal(
              etiquetaPago,
              (item) =>
                mostrarTasasPorCobertura
                  ? `<td class="m" colspan="2">${this.pdfDinero(calculo.calcularPrimaPorFormaPago(item.primaTotal))}</td>`
                  : `<td class="m">${this.pdfDinero(calculo.calcularPrimaPorFormaPago(item.primaTotal))}</td>`,
              this.pdfDinero(calculo.calcularPrimaPorFormaPago(primaTotalPoliza)),
              'total',
            )}
            ${filaPrimaPorAsegurado}
        </table>`;
      })
      .join('');
  }

  // Patronal: solo la tasa única de la póliza. Voluntaria/Mixta: tasas por
  // cobertura por plan y para toda la póliza, además de la tasa única.
  pdfTablasTasas(resumen: any): string {
    const { tasaUnicaPoliza } = resumen;
    const filaTasaUnica = (columnas: number) =>
      `<tr class="total"><td colspan="${columnas - 1}">Tasa única total de la póliza (por mil)</td><td class="v">${this.pdfTextoTasa(tasaUnicaPoliza)}</td></tr>`;

    if (!this.calculo.esPolizaPatronal()) return '';

    return `<table class="t-planes"><colgroup><col style="width:75%"><col style="width:25%"></colgroup>
        <tr><td colspan="2" class="titulo">TASA</td></tr>
        ${filaTasaUnica(2)}
    </table>`;
  }

  pdfMarca(condicion: boolean): string {
    return condicion ? 'x' : '___';
  }

  /* ============================================================
     Documento completo
     ============================================================ */

  construirHtmlCotizacionPdf(resumen: any): string {
    const p = this.estado.poliza;
    const formaPago = p.formaPago || 'Anual';
    const diaFacturacion = this.pdfDiaDelMes(p.fechaCobro);
    const detallePago = this.calculo.obtenerDetalleFraccionamiento();
    const vigencia = `Desde ${this.pdfFecha(p.vigenciaDesde) || '—'} hasta ${this.pdfFecha(p.vigenciaHasta) || '—'}`;
    const oficina = [p.codigoOficinaAsesor, p.oficinaAsesor].filter(Boolean).join(' – ');
    const comision = Number.isFinite(Number(p.comision)) ? `${Number(p.comision)}%` : '';
    const retorno = Number.isFinite(Number(p.retorno))
      ? Number(p.retorno).toLocaleString('es-CO', { maximumFractionDigits: 1 })
      : '0';
    const validez = this.pdfFecha(p.validezOferta);
    const numeroPolizaContinuidad = p.esContinuidad === true ? this.pdfTexto(p.numeroPolizaAnterior) : 'XXXXXX';
    const companiaContinuidad = p.esContinuidad === true ? this.pdfTexto(p.companiaAnterior) : 'XXXXXX';
    const textoCondicionesEspeciales = String(p.condicionesEspeciales || '');
    const contenidoCondicionesEspeciales = textoCondicionesEspeciales.trim()
      ? escaparHTML(textoCondicionesEspeciales).replace(/\r\n?|\n/g, '<br>')
      : '&nbsp;';
    const validezTexto = validez
      ? `la presente cotización tiene validez hasta el ${escaparHTML(validez)}.`
      : 'la presente cotización tiene validez hasta el día XX del mes de XXXX de 20XX.';
    const frecuencias = ['Diario', 'Mensual', 'Trimestral', 'Semestral', 'Anual'];
    const parentescosAdicionales = this.pdfParentescosAseguradosAdicionales(resumen);
    const textoAseguradosAdicionales =
      parentescosAdicionales.length > 0 ? `; familiares incluidos: ${escaparHTML(parentescosAdicionales.join(', '))}` : '';
    const pdfTexto = (valor: any) => this.pdfTexto(valor);
    const pdfFecha = (valor: any) => this.pdfFecha(valor);

    return `<div class="pdf-cot"><style>${PDF_ESTILOS}</style>
  <div class="pdf-espacio-encabezado" style="height:${this.pdfAltoEspacioEncabezadoPx()}px"></div>

  <table class="t-turquesa">
    <tr><td colspan="4" class="cab-azul-osc">INFORMACIÓN GENERAL</td></tr>
    <tr>
      <td><span class="lbl">Ciudad y fecha de cotización</span>${this.pdfFechaHoy()}</td>
      <td><span class="lbl">Oficina de radicación</span>${pdfTexto(oficina)}</td>
      <td><span class="lbl">Número de póliza</span></td>
      <td><span class="lbl">Documento de identificación</span>${pdfTexto(p.numeroIdentificacion)}</td>
    </tr>
    <tr>
      <td colspan="2"><span class="lbl">Vigencia del seguro</span>${escaparHTML(vigencia)}</td>
      <td colspan="2"><span class="lbl">Vigencia del movimiento</span>${escaparHTML(vigencia)}</td>
    </tr>
    <tr>
      <td colspan="2"><span class="lbl">Actividad</span>${pdfTexto(p.actividad)}</td>
      <td colspan="2"><span class="lbl">Día de facturación</span>${pdfTexto(diaFacturacion)}</td>
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
  <p class="b">Asegurado: Los empleados de la empresa${textoAseguradosAdicionales}</p>
  <p class="b">Beneficiario: Los designados por cada asegurado</p>

  <p class="b tit" style="margin-top:14px;">Valor Asegurado, Prima Total y Tasa de acuerdo con el plan elegido</p>
  ${this.pdfTablasPlanes(resumen)}
  ${this.pdfTablasTasas(resumen)}

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

  <h2>Continuidad:</h2>
  <p>Seguros de Vida Suramericana S.A. amparará a las personas que venían aseguradas en la póliza <span class="pdf-campo-pendiente">${numeroPolizaContinuidad}</span> de la Compañía <span class="pdf-campo-pendiente">${companiaContinuidad}</span>. Lo que significa que acepta dichos riesgos en el estado en que se encuentran, otorgando cobertura solamente a aquellas preexistencias que hubieran sido cubiertas por la anterior compañía/póliza. Las extra primas y limitaciones de cobertura que hayan sido impuestas en la póliza anterior regirán para este contrato sin perjuicio de aquellas que puedan ser impuestas por esta aseguradora. Se aplicarán para la presente póliza, las manifestaciones o declaraciones de asegurabilidad realizadas para la póliza anterior. Los nuevos asegurados deben cumplir con los requisitos de asegurabilidad exigidos por SURAMERICANA.</p>
  <p>El Tomador de la póliza certifica que no tiene conocimiento de asegurados con enfermedades graves o procesos de invalidez en curso.</p>
  <p class="b">CONDICIONES PÓLIZA <span class="pdf-campo-pendiente">${numeroPolizaContinuidad}</span>, COMPAÑÍA <span class="pdf-campo-pendiente">${companiaContinuidad}</span></p>
  <p>La anterior continuidad se otorgará solamente con respecto a los amparos y valores asegurados que tenga en la otra compañía/póliza, bajo las definiciones que para dichas coberturas tiene Suramericana. <b>“Se deben relacionar las coberturas que incluye la póliza a la cual se quiere dar continuidad”</b></p>

  <h2>Honorarios por administración y recaudo:</h2>
  <p>Se entregará al tomador un <span class="pdf-campo-pendiente">${pdfTexto(retorno)} %</span> de las primas pagadas a SURAMERICANA, como aporte por concepto de Honorarios por Administración y Recaudo. Para ello, el Tomador debe enviar una factura de venta o documento equivalente a Suramericana por el monto correspondiente al honorario por la administración de seguros. Una vez realice el proceso de causación de la factura, la compañía procederá a realizar el pago.</p>

  <h2>Bono por siniestralidad:</h2>
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
  <div class="caja-otras">${contenidoCondicionesEspeciales}</div>

  <table class="t-asesores" style="margin-top:24px;">
    <colgroup><col style="width:16%"><col style="width:30%"><col style="width:16%"><col style="width:17%"><col style="width:21%"></colgroup>
    <tr><th colspan="5" class="cab1">ASESORES</th></tr>
    <tr><th class="cab2">Código</th><th class="cab2">Nombre del asesor principal</th><th class="cab2">Líder</th><th class="cab2">Participación</th><th class="cab2">Comisión ponderada</th></tr>
    <tr><td><b>${pdfTexto(p.codigoAsesor)}</b></td><td>${pdfTexto(String(p.asesor || '').toUpperCase())}</td><td></td><td>100%</td><td>${pdfTexto(comision)}</td></tr>
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
    <tr><td>${pdfTexto('Vida Integral')}</td><td>${pdfTexto(pdfFecha(p.vigenciaDesde))}</td><td>${pdfTexto('083')}</td><td>${pdfTexto('F-14-11-0083-461')}</td></tr>
  </table>

  <h2>Pago de las primas:</h2>
  <p>El plazo para el pago de la prima será de 30 días entre la fecha de inicio de vigencia y la fecha de expedición más reciente.</p>

  <table class="t-pago">
    <colgroup><col style="width:51%"><col style="width:49%"></colgroup>
    <tr>
      <td>
        <p class="b">Forma de pago: ${escaparHTML(formaPago)}.</p>
        ${formaPago === 'Mensual' ? `<p class="b">Mensual*: anticipado ${this.pdfMarca(p.tipoPagoMensual === 'Anticipada')} Vencido ${this.pdfMarca(p.tipoPagoMensual !== 'Anticipada')}</p>` : ''}
        <p class="b">**Este campo aplica para las pólizas expedidas en GW.</p>
        <p>Fecha(s) acordada(s) para el pago (según forma de pago): ${pdfTexto(pdfFecha(p.fechaCobro))}</p>
        <p>Frecuencia ajuste**</p>
        <ul>${frecuencias.map((frecuencia) => `<li>${frecuencia}${frecuencia === formaPago ? ' x' : ''}</li>`).join('')}</ul>
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
        <p class="b" style="margin-top:28px;">Acompañamiento del Ejecutivo Comercial: Sí o No</p>
        <p class="b">¿Tiene ARL SURA?: Sí o No</p>
        <p class="b">¿Tiene recargo por fraccionamiento?: ${detallePago.factor > 0 ? 'Sí' : 'No'}</p>
      </td>
    </tr>
  </table>

  <h1>Programas de Acompañamiento y Gestión de Riesgos</h1>
  <ul style="list-style:disc;"><li class="b">Estamos cerca de tus colaboradores cuando más lo necesitan.</li></ul>
  <div class="pdf-fila-programa">
    <img class="pdf-icono-programa" src="assets/images/pdf/icono-gestion-medica.png" alt="">
    <h2>Gestión Médica:</h2>
  </div>
  <p class="pdf-programa-descripcion">Orientación especializada en casos de invalidez, enfermedades graves o cáncer.</p>
  <div class="pdf-fila-programa">
    <img class="pdf-icono-programa" src="assets/images/pdf/icono-programa-cuidar.png" alt="">
    <h2>Programa Cuidar:</h2>
  </div>
  <p class="pdf-programa-descripcion">Apoyo integral a personas con patologías en etapa avanzada, junto a sus familias, en aspectos emocionales, jurídicos y financieros.</p>
  <div class="pdf-fila-programa">
    <img class="pdf-icono-programa" src="assets/images/pdf/icono-empresas-sura.png" alt="">
    <h2>Empresas SURA:</h2>
  </div>
  <p class="b pdf-programa-descripcion">En Empresas SURA, te acompañamos en el cuidado de tu talento humano mientras alcanzas los objetivos de tu empresa. Te proporcionamos herramientas que puedes implementar para fidelizar a tu equipo y lograr tus metas. <a href="https://www.segurossura.com.co/empresasura/Paginas/default.aspx">Agenda la primera cita aquí.</a> Aplica para empresas clientes de Vida Grupo del segmento Empresarial.</p>
  <div class="keep">
    <p class="pdf-texto-qr">Escanea el siguiente código QR y descubre cómo Vida Grupo SURA se convierte en el respaldo que potencia el bienestar y la competitividad de tu empresa:</p>
    <img class="pdf-qr" src="assets/images/pdf/qr-slip.png" alt="Código QR Vida Grupo SURA">
  </div>

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

  /* ============================================================
     Descarga del PDF
     ============================================================ */

  async descargarCotizacionPdf(): Promise<void> {
    let html2pdf: any;
    try {
      html2pdf = (await import('html2pdf.js')).default;
    } catch (error) {
      console.error('No fue posible cargar html2pdf.js:', error);
    }
    if (!html2pdf) {
      this.ui.mostrarToast('La librería de PDF no está disponible. Verifica tu conexión e inténtalo de nuevo.', 'error');
      return;
    }
    const estado = this.estado;
    if (estado.asegurados.length === 0 || estado.planes.length === 0) {
      this.ui.mostrarToast('Aún no hay una cotización calculada para descargar.', 'warning');
      return;
    }
    if (!String(estado.poliza.tomador || '').trim()) {
      this.asignacion.mostrarAlertaRango(
        'Diligencia el tomador en los datos generales antes de descargar la cotización.',
        null,
        'Datos incompletos',
      );
      return;
    }
    if (!this.asignacion.validarAseguradosAsignadosParaCalculos()) return;

    this.generandoPdf = true;
    this.ui.mostrarCargando('Generando PDF de la cotización...');
    try {
      // Garantiza que el resumen corresponda al cálculo vigente con credibilidad.
      this.calculo.construirCalculosPorPlan(false);
      const resumen = this.store.resumenCotizacion;
      if (!resumen || resumen.planes.length === 0 || resumen.sinPlan) {
        this.ui.mostrarToast('No fue posible obtener el cálculo de la cotización.', 'warning');
        return;
      }

      const raiz = document.createElement('div');
      raiz.innerHTML = this.construirHtmlCotizacionPdf(resumen);
      const documentoPdf = raiz.firstElementChild as HTMLElement;
      await Promise.all(
        [...documentoPdf.querySelectorAll('img')].map((imagen) => {
          if (imagen.complete) {
            return imagen.naturalWidth > 0
              ? Promise.resolve()
              : Promise.reject(new Error(`No se pudo cargar la imagen del PDF: ${imagen.src}`));
          }
          return new Promise<void>((resolver, rechazar) => {
            imagen.addEventListener('load', () => resolver(), { once: true });
            imagen.addEventListener(
              'error',
              () => rechazar(new Error(`No se pudo cargar la imagen del PDF: ${imagen.src}`)),
              { once: true },
            );
          });
        }),
      );
      this.pdfMantenerTitulosConContenido(documentoPdf);
      try {
        await document.fonts.load("9pt 'FS Joey'");
      } catch (error) {
        /* se usa la tipografía de respaldo */
      }
      const encabezadoDataUri = await this.cargarEncabezadoDataUri();
      const nombreArchivo = this.pdfNombreArchivo();
      let documentoJsPdf: any = null;
      await (html2pdf() as any)
        .set({
          margin: [PDF_MARGEN_VERTICAL_MM, 0, PDF_MARGEN_VERTICAL_MM, 0],
          filename: nombreArchivo,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            width: PDF_ANCHO_PX,
            windowWidth: PDF_ANCHO_PX,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['table', 'tr', 'h1', 'h2', 'h3', 'p', 'li', '.keep'] },
        })
        .from(documentoPdf)
        .toPdf()
        .get('pdf')
        .then((pdf: any) => {
          pdf.setPage(1);
          pdf.addImage(encabezadoDataUri, 'JPEG', 0, 0, PDF_ANCHO_MM, this.pdfAltoEncabezadoMm());
          documentoJsPdf = pdf;
        })
        .save();
      this.ui.mostrarToast('Cotización PDF descargada.', 'success');

      // Registra la cotización con el PDF en base64; el indicador sigue visible hasta que termine.
      this.ui.cargando.update((c) => ({
        ...c,
        mensaje: 'PDF descargado. Registrando la cotización, por favor espera...',
      }));
      await this.cotizacionApi.enviarCotizacionApi(resumen, documentoJsPdf, nombreArchivo);
    } catch (error) {
      console.error('No fue posible generar el PDF:', error);
      this.ui.mostrarToast('No fue posible generar el PDF de la cotización.', 'error');
    } finally {
      this.ui.ocultarCargando();
      this.generandoPdf = false;
      // El cálculo se rehízo con credibilidad (como renderizarTablaCalculos(false) del original): refresca el paso 5.
      this.store.notificarCambio();
    }
  }

  /* ============================================================
     Exportar resumen (JSON)
     ============================================================ */

  exportarResumen(): void {
    const estado = this.estado;
    const calculo = this.calculo;
    const primaAnual = calculo.calcularPrimaTotal();
    const detalleFraccionamiento = calculo.obtenerDetalleFraccionamiento();
    const resumen = {
      poliza: estado.poliza,
      coberturas: estado.coberturasCatalogo.map((cobertura: any) => ({
        Codigo_Amparo_Op: cobertura.codigo,
        Codigo_Amparo: cobertura.codigoAmparo,
        Amparo_Detallado: cobertura.nombre,
        tasaBase: cobertura.tasaBase,
        obligatoria: cobertura.obligatoria,
      })),
      estadisticas: {
        totalAsegurados: estado.asegurados.length,
        totalSubgrupos: estado.subgrupos.length,
        totalPlanes: estado.planes.length,
        primaAnual,
        formaPago: estado.poliza.formaPago || 'Anual',
        factorFraccionamiento: detalleFraccionamiento.factor,
        numeroPeriodos: detalleFraccionamiento.periodos,
        primaSegunFormaPago: calculo.calcularPrimaPorFormaPago(primaAnual),
        nivelComplejidad: calculo.calcularNivelComplejidad(),
      },
      resumenPor: {
        subgrupos: estado.subgrupos.map((sg: any) => ({
          coberturas: sg.coberturas,
          asegurados: sg.asegurados.length,
          planes: estado.planes.filter((p: any) => p.subgrupoId === sg.id).length,
        })),
      },
    };

    const datauri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resumen, null, 2));
    const element = document.createElement('a');
    element.setAttribute('href', datauri);
    element.setAttribute('download', 'resumen_cotizacion.json');
    element.click();
    this.ui.mostrarToast('Resumen exportado como JSON', 'success');
  }
}
