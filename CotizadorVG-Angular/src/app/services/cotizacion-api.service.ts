import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService } from '../core/ui.service';

/**
 * Cotizaciones guardadas en la API (Power Automate): registro de la cotización con su PDF
 * (`enviarCotizacionApi`) y consulta de las cotizaciones del usuario (modal "Consultar cotización").
 * Portado de `pdf-cotizacion.js`. El modal lo pinta `app-modal-consultar-cotizacion` con el estado de este servicio.
 */
@Injectable({ providedIn: 'root' })
export class CotizacionApiService {
  private store = inject(CotizadorStore);
  private ui = inject(UiService);
  private auth = inject(AuthService);

  /* ---------- Estado del modal "Consultar cotización" ---------- */

  modalConsultarVisible = false;
  /** `cargandoCotizacionesUsuario` */
  cargandoCotizaciones = false;
  /** `mensajeConsultarCotizacion` ('' = oculto) */
  mensajeConsulta = '';
  /** Filas de `listaCotizacionesUsuario`, ya ordenadas de la más reciente a la más antigua. */
  filasCotizaciones: any[] = [];
  /** IdCotizacion cuyo PDF se está consultando (el botón muestra 'Consultando...' y se deshabilita). */
  idCotizacionConsultando: string | null = null;

  private get estado() {
    return this.store.estado;
  }

  /* ---------- Registro de la cotización con su PDF ---------- */

  // Arma el JSON que consume el flujo de Power Automate (usp_CotizacionVG_Guardar / _GuardarPdf).
  // Los campos vacíos se omiten: el esquema del flujo no los exige y así llegan como NULL a SQL.
  construirPayloadCotizacion(resumen: any, pdfBase64: string, nombreArchivo: string): Record<string, any> {
    const p = this.estado.poliza;
    const flujo = this.store.flujo;
    const redondear = (valor: number, decimales: number) =>
      Number.isFinite(valor) ? Math.round(valor * 10 ** decimales) / 10 ** decimales : 0;
    const tasaPorMil = (prima: number, valorAsegurado: number) =>
      valorAsegurado > 0 ? redondear((prima / valorAsegurado) * 1000, 6) : 0;

    const edades = this.estado.asegurados.map((asegurado: any) => Number(asegurado.edad)).filter(Number.isFinite);
    // El esquema del flujo define estos campos como integer: se envían redondeados a entero.
    const edadPromedio = edades.length ? redondear(edades.reduce((suma, edad) => suma + edad, 0) / edades.length, 0) : 0;
    // La tasa única de la póliza se calcula sobre el valor asegurado de Vida (WET), igual que en pantalla.
    const valorAseguradoTotal = resumen.totalesPoliza.get('WET')?.valorAsegurado || 0;

    const payload: Record<string, any> = {
      idCotizacion: p.id,
      tipoNegocio: flujo.tipo,
      subtipo: flujo.subtipo,
      usuarioCreacion: this.auth.obtenerUsuario()?.correo,

      tipoIdentificacion: p.tipoIdentificacion,
      numeroIdentificacion: p.numeroIdentificacion,
      tomador: p.tomador,
      segmento: p.segmento,
      direccionCorrespondencia: p.direccionCorrespondencia,
      actividad: p.actividad,

      numeroPoliza: p.numeroPoliza,
      modalidadPlan: p.modalidadPlan,
      formaPago: p.formaPago,
      tipoPagoMensual: p.formaPago === 'Mensual' ? p.tipoPagoMensual : null,
      vigenciaDesde: p.vigenciaDesde,
      vigenciaHasta: p.vigenciaHasta,
      fechaCobro: p.fechaCobro,
      validezOferta: p.validezOferta,

      codigoAsesor: p.codigoAsesor,
      asesor: p.asesor,
      oficinaAsesor: p.oficinaAsesor,
      codigoOficinaAsesor: p.codigoOficinaAsesor,
      canalComercial: p.canalComercial,
      regional: p.regional,
      comisionPct: Number(p.comision) || 0,
      honorarioPromotoraPct: Number(p.honorarioPromotora) || 0,
      factorGastoPct: redondear(Number(p.factorGasto), 4),

      aplicaCredibilidad: p.aplicaCredibilidad === true,
      valorSiniestrosTotales: redondear(Number(p.valorSiniestrosTotales), 0),
      anosExposicion: Number(p.anosExposicion) || 0,
      siniestrosPromedio: redondear(Number(p.siniestrosPromedio), 0),

      numeroAsegurados: this.estado.asegurados.length,
      edadPromedio,
      valorAseguradoTotal: redondear(valorAseguradoTotal, 0),
      tasaUnica: tasaPorMil(resumen.primaTotalPoliza, valorAseguradoTotal),
      primaTotal: redondear(resumen.primaTotalPoliza, 0),

      coberturas: ([...resumen.totalesPoliza.entries()] as [string, any][]).map(([codigo, total]) => ({
        codigo,
        nombre: total.nombre || codigo,
        valorAsegurado: redondear(total.valorAsegurado, 0),
        tasa: tasaPorMil(total.prima, total.valorAsegurado),
        prima: redondear(total.prima, 0),
      })),

      pdfNombreArchivo: nombreArchivo,
      pdfBase64,
    };

    Object.keys(payload).forEach((clave) => {
      if (payload[clave] === null || payload[clave] === undefined || payload[clave] === '') delete payload[clave];
    });
    return payload;
  }

  // Envía la cotización y el PDF (base64) a la API. No interrumpe la descarga si falla.
  async enviarCotizacionApi(resumen: any, documentoPdf: any, nombreArchivo: string): Promise<boolean> {
    try {
      // Base64 sin el prefijo data:application/pdf;...;base64,
      const pdfBase64: string = String(documentoPdf.output('datauristring')).split(',').pop() as string;
      // Diagnóstico: compara estos valores con LEN(PdfBase64) y RIGHT(PdfBase64, 12) en SQL.
      console.info(
        `PDF base64 enviado: ${pdfBase64.length} caracteres, inicio "${pdfBase64.slice(0, 8)}", fin "${pdfBase64.slice(-12)}"`,
      );
      const respuesta = await fetch(environment.apis.guardarCotizacion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(this.construirPayloadCotizacion(resumen, pdfBase64, nombreArchivo)),
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        throw new Error(`La API respondió HTTP ${respuesta.status}. ${detalle}`);
      }
      return true;
    } catch (error) {
      console.error('No fue posible registrar la cotización:', error);
      this.ui.mostrarToast('El PDF se descargó, pero no fue posible registrar la cotización.', 'warning');
      return false;
    }
  }

  /* ---------- Modal "Consultar cotización" ---------- */

  mostrarCargandoConsultaCotizacion(visible: boolean): void {
    this.cargandoCotizaciones = visible;
  }

  mostrarMensajeConsultaCotizacion(texto: string): void {
    this.mensajeConsulta = texto || '';
  }

  // Normaliza la respuesta del flujo a un arreglo de filas.
  extraerFilasCotizaciones(datos: any): any[] {
    let origen = datos;
    if (origen && origen.ResultSets && Array.isArray(origen.ResultSets.Table1)) origen = origen.ResultSets.Table1;
    else if (origen && Array.isArray(origen.value)) origen = origen.value;
    else if (origen && Array.isArray(origen.body)) origen = origen.body;
    return Array.isArray(origen) ? origen.filter((fila) => fila && typeof fila === 'object') : [];
  }

  /** Texto de la columna "Fecha creación" (la plantilla lo escapa al interpolarlo). */
  formatearFechaCreacionCotizacion(valor: any): string {
    if (!valor) return '—';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async abrirModalConsultarCotizacion(): Promise<void> {
    this.filasCotizaciones = [];
    this.modalConsultarVisible = true;

    const correo = this.auth.obtenerUsuario()?.correo;
    if (!correo) {
      this.mostrarMensajeConsultaCotizacion('No fue posible identificar al usuario de la sesión. Inicia sesión nuevamente.');
      return;
    }

    this.mostrarMensajeConsultaCotizacion('');
    this.mostrarCargandoConsultaCotizacion(true);
    try {
      const respuesta = await fetch(environment.apis.cotizacionesUsuario, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ UsuarioCreacion: correo }),
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        console.error(`Consulta de cotizaciones del usuario HTTP ${respuesta.status}`, detalle);
        throw new Error('No fue posible consultar tus cotizaciones. Inténtalo de nuevo.');
      }
      const filas = this.extraerFilasCotizaciones(await respuesta.json()).filter((fila) => fila.IdCotizacion);
      if (filas.length === 0) {
        this.mostrarMensajeConsultaCotizacion('No tienes cotizaciones registradas.');
        return;
      }
      this.mostrarMensajeConsultaCotizacion('');
      this.filasCotizaciones = [...filas].sort(
        (a, b) => new Date(b.FechaCreacion).getTime() - new Date(a.FechaCreacion).getTime(),
      );
    } catch (error: any) {
      console.error('No fue posible listar las cotizaciones del usuario:', error);
      this.mostrarMensajeConsultaCotizacion(error?.message || 'No fue posible consultar tus cotizaciones.');
    } finally {
      this.mostrarCargandoConsultaCotizacion(false);
    }
  }

  cerrarModalConsultarCotizacion(): void {
    this.modalConsultarVisible = false;
  }

  // Extrae nombre y contenido base64 de la respuesta del flujo (acepta variantes de nombres de campo).
  extraerPdfDeRespuesta(datos: any): { nombre: string; base64: string } | null {
    let origen = datos;
    if (origen && origen.ResultSets && Array.isArray(origen.ResultSets.Table1)) origen = origen.ResultSets.Table1[0];
    if (Array.isArray(origen)) origen = origen[0];
    if (!origen || typeof origen !== 'object') return null;
    const buscar = (...claves: string[]) => {
      const clave = Object.keys(origen).find((k) => claves.includes(k.toLowerCase()));
      return clave ? origen[clave] : null;
    };
    const base64 = buscar('pdfbase64', 'contenido', 'base64', 'contenidobase64');
    const nombre = buscar('nombrearchivo', 'pdfnombrearchivo', 'nombre', 'filename');
    if (!base64 || typeof base64 !== 'string') return null;
    return { nombre: nombre || 'Cotizacion.pdf', base64 };
  }

  base64ABlobPdf(base64: string): Blob {
    const limpio = base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    const binario = atob(limpio);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
  }

  /** Botón "Descargar PDF" de cada fila: pide el PDF almacenado y lo descarga. */
  async consultarCotizacionPdf(idCotizacion: any): Promise<void> {
    const mostrarMensaje = (texto: string) => this.mostrarMensajeConsultaCotizacion(texto);

    if (!/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(String(idCotizacion || '').trim())) {
      mostrarMensaje('La cotización seleccionada no tiene un ID válido.');
      return;
    }
    idCotizacion = String(idCotizacion).trim();

    mostrarMensaje('');
    this.idCotizacionConsultando = idCotizacion;
    try {
      const respuesta = await fetch(environment.apis.consultarCotizacion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ idCotizacion }),
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        console.error(`Consulta de cotización HTTP ${respuesta.status}`, detalle);
        throw new Error(
          respuesta.status === 400 ? 'La solicitud no es válida.' : 'No se encontró la cotización o el servicio no respondió.',
        );
      }
      const pdf = this.extraerPdfDeRespuesta(await respuesta.json());
      if (!pdf) throw new Error('La cotización no tiene un PDF almacenado.');

      const url = URL.createObjectURL(this.base64ABlobPdf(pdf.base64));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = /\.pdf$/i.test(pdf.nombre) ? pdf.nombre : `${pdf.nombre}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      this.cerrarModalConsultarCotizacion();
      this.ui.mostrarToast('PDF de la cotización descargado correctamente.', 'success');
    } catch (error: any) {
      console.error('No fue posible consultar la cotización:', error);
      mostrarMensaje(error?.message || 'No fue posible consultar la cotización.');
    } finally {
      this.idCotizacionConsultando = null;
    }
  }
}
