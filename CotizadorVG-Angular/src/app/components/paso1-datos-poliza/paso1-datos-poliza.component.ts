import { ChangeDetectionStrategy, Component, HostListener, inject, Injector, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AGRUPACIONES_SINIESTROS, VALOR_ASEGURADO_MAXIMO_VOLUNTARIA } from '../../core/config';
import { CotizadorStore } from '../../core/cotizador.store';
import { UiService } from '../../core/ui.service';
import { formatearDinero, normalizarCanalComercial, obtenerFechaActualISO, sumarDiasISO } from '../../core/utils';
import { AseguradoService } from '../../services/asegurado.service';
import { CalculoService } from '../../services/calculo.service';
import { CatalogoService } from '../../services/catalogo.service';
import { FlujoService } from '../../services/flujo.service';

/** Paso 1: Datos generales de la póliza (`<section id="step1">` del index.html original). */
@Component({
  selector: 'app-paso1-datos-poliza',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paso1-datos-poliza.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Paso1DatosPolizaComponent implements OnInit {
  readonly catalogo = inject(CatalogoService);
  private store = inject(CotizadorStore);
  private ui = inject(UiService);
  private injector = inject(Injector);

  // Dependencias perezosas hacia servicios de otras tareas (evita ciclos de DI).
  private get flujo() { return this.injector.get(FlujoService); }
  private get aseguradoService() { return this.injector.get(AseguradoService); }

  readonly agrupaciones = AGRUPACIONES_SINIESTROS;

  get poliza() { return this.store.estado.poliza; }

  /* ---------- Valores derivados que antes escribía actualizarCamposComerciales() en el DOM ---------- */
  get canalActual(): string { return normalizarCanalComercial(this.poliza.canalComercial); }
  get esPromotora(): boolean { return this.canalActual === 'PROMOTORAS'; }
  get mostrarDatosAsesor(): boolean { return !!this.poliza.asesor; }
  get mostrarDatosOficina(): boolean { return !!(this.poliza.oficinaAsesor || this.canalActual); }

  /* ---------- Atributos min de los campos de fecha ---------- */
  get fechaHoy(): string { return obtenerFechaActualISO(); }
  get fechaMinimaDesde(): string { return sumarDiasISO(obtenerFechaActualISO(), -60); }
  get fechaMinimaHasta(): string { return this.poliza.vigenciaDesde || obtenerFechaActualISO(); }

  ngOnInit(): void {
    // Equivale a lo que hacía inicializar() para este paso al montar la pantalla.
    (this.flujo as any).establecerFechasDefault?.();
    this.catalogo.sincronizarCamposPaso1();
    this.catalogo.ajustarRetornoAlLimite();
    this.catalogo.validarComisionRetorno(false);
    this.catalogo.actualizarCamposComerciales();
  }

  /** Cierra la lista de actividades al hacer clic fuera de `.actividad-selector`. */
  @HostListener('document:click', ['$event'])
  alHacerClicEnDocumento(evento: Event): void {
    if (!(evento.target as HTMLElement | null)?.closest?.('.actividad-selector')) {
      this.catalogo.ocultarListaActividades();
    }
  }

  /* ============================================================
     Campos generales de la póliza (listener `change` de camposPoliza)
     ============================================================ */

  cambiarCampoPoliza(campo: string, valor: string): void {
    this.poliza[campo] = valor;
    if (campo === 'modalidadPlan') {
      const ajustes = this.aseguradoService.aplicarLimiteVoluntariaAValoresExistentes();
      (this.aseguradoService as any).actualizarValidacionEdadModal?.();
      if (ajustes.length > 0) {
        this.injector.get(CalculoService).recalcularTodo();
        this.aseguradoService.mostrarResumenModificaciones({ ajustes });
        this.ui.mostrarToast(`${ajustes.length} valor(es) asegurado(s) fueron ajustados al máximo de ${formatearDinero(VALOR_ASEGURADO_MAXIMO_VOLUNTARIA)} para póliza contributiva.`, 'info');
      }
    }
    this.store.guardarEstado();
    if (campo === 'formaPago') {
      this.catalogo.actualizarCampoPagoMensual(); // + renderizarTablaCalculos / renderizarDashboard
    }
  }

  /** Eventos `change` de vigenciaDesde / vigenciaHasta / fechaCobro. */
  alCambiarFecha(campo: 'vigenciaDesde' | 'vigenciaHasta' | 'fechaCobro', evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.cambiarCampoPoliza(campo, input.value);
    if (campo === 'fechaCobro') {
      this.flujo.sincronizarFechaCobro(input.value);
    } else {
      this.flujo.sincronizarVigencia(campo, input.value);
    }
    // El servicio puede corregir el valor; se refleja aunque coincida con el enlace anterior.
    input.value = this.poliza[campo] ?? '';
  }

  /* ============================================================
     Asesor / actividad
     ============================================================ */

  alPresionarTeclaCodigoAsesor(evento: KeyboardEvent): void {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      this.catalogo.consultarAsesorPorCodigo();
    }
  }

  alPresionarTeclaActividad(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') this.catalogo.ocultarListaActividades();
    if (evento.key === 'Enter') {
      const primeraOpcion = this.catalogo.coincidenciasActividades[0];
      if (primeraOpcion) {
        evento.preventDefault();
        this.catalogo.actualizarActividadEconomica(primeraOpcion.indice);
      }
    }
  }

  /* ============================================================
     Comisión / retorno
     ============================================================ */

  alCambiarComisionOHonorario(campo: 'comision' | 'honorarioPromotora', evento: Event): void {
    const input = evento.target as HTMLInputElement;
    input.value = String(this.catalogo.actualizarCampoComercial(campo, Number(input.value)));
  }

  alIngresarRetorno(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    input.value = this.catalogo.alIngresarRetorno(input.value);
  }

  alCambiarRetorno(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    input.value = String(this.catalogo.alCambiarRetorno(input.value));
  }

  /* ============================================================
     Siniestralidad
     ============================================================ */

  alIngresarSiniestrosTotales(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.catalogo.campoValorSiniestrosTotales = input.value;
    this.catalogo.actualizarSiniestralidad();
    input.value = this.catalogo.campoValorSiniestrosTotales;
  }

  alIngresarAnosExposicion(evento: Event): void {
    this.catalogo.campoAnosExposicion = (evento.target as HTMLInputElement).value;
  }

  alCambiarAnosExposicion(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const valorIngresado = Number(input.value);
    if (input.value !== '' && Number.isFinite(valorIngresado)) {
      input.value = String(Math.min(4, Math.max(0, Math.round(valorIngresado))));
    }
    this.catalogo.campoAnosExposicion = input.value;
    this.catalogo.actualizarSiniestralidad();
    input.value = String(this.catalogo.campoAnosExposicion ?? '');
  }

  alIngresarValorSiniestroCobertura(codigo: string, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    input.value = this.catalogo.actualizarValorSiniestroCobertura(codigo, input.value);
  }

  /* ============================================================
     Botones
     ============================================================ */

  volverAlLanding(): void {
    this.flujo.volverAlLanding();
  }

  siguiente(): void {
    if (!this.catalogo.validarActividadAsegurable()) return;
    if (!this.catalogo.validarSiniestralidadRequerida()) return;
    this.flujo.irAlPaso(2);
  }

  limpiar(): void {
    this.flujo.limpiarDatosGeneralesPoliza();
    this.ui.mostrarToast('Se limpiaron los datos de esta sección. El resto de la cotización se conservó.', 'success');
  }
}
