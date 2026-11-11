import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, OnInit, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CotizadorStore } from '../../core/cotizador.store';
import { CalculoService, CalculosPantallaModelo } from '../../services/calculo.service';
import { CatalogoService } from '../../services/catalogo.service';
import { FlujoService } from '../../services/flujo.service';
import { PdfService } from '../../services/pdf.service';

/**
 * Paso 5 - Cálculos de Tasas y Primas (`<section id="step5">`).
 *
 * Reemplaza a `renderizarTablaCalculos()`: el modelo se construye UNA vez (`recalcular()`) al entrar al paso
 * y cada vez que cambia `store.version()` (forma de pago, tipo de pago mensual, fin del PDF, recalcularTodo...),
 * igual que las llamadas a `renderizarTablaCalculos()` del original. `construirCalculosPorPlan` tiene efectos
 * (plan.primaTotal, store.resumenCotizacion), por eso nunca se invoca desde la plantilla.
 *
 * El modal `app-modal-confirmar-forma-pago` lo monta el shell (no se incluye aquí).
 *
 * `FlujoService.irAlPaso(5)` debe llamar a `alEntrarAlPaso()` si el componente permanece montado; si el shell lo
 * monta con `@if (pasoActual === 5)` basta con `ngOnInit` (que ya lo invoca).
 */
@Component({
  selector: 'app-paso5-resumen',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './paso5-resumen.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Paso5ResumenComponent implements OnInit {
  readonly calculo = inject(CalculoService);
  readonly catalogo = inject(CatalogoService);
  readonly pdf = inject(PdfService);
  private store = inject(CotizadorStore);
  private injector = inject(Injector);
  private get flujo() { return this.injector.get(FlujoService); }

  /** Resultado de `construirCalculosPorPlan` (contenido de `.calculos-container`). */
  modelo: CalculosPantallaModelo | null = null;
  /** Flag de la comparativa sin credibilidad (`renderizarTablaCalculos(true)`); se reinicia en cada recálculo ajeno al botón. */
  mostrarSinCredibilidad = false;

  private ultimaVersion = -1;

  constructor() {
    // Cada `notificarCambio()` equivale a un `renderizarTablaCalculos()` del original.
    effect(() => {
      const version = this.store.version();
      untracked(() => {
        if (version === this.ultimaVersion) return;
        this.mostrarSinCredibilidad = false;
        this.recalcular();
      });
    });
  }

  get poliza() {
    return this.store.estado.poliza;
  }

  ngOnInit(): void {
    this.alEntrarAlPaso();
  }

  /** Lo que hacía `irAlPaso(5)`: renderizarTablaCalculos() (guardarEstado/ejecutarConCarga los aplica FlujoService). */
  alEntrarAlPaso(): void {
    this.mostrarSinCredibilidad = false;
    this.recalcular();
  }

  private recalcular(): void {
    // Cada render del original dejaba los listados de asegurados colapsados.
    this.calculo.listadosCalculosExpandidos.clear();
    this.modelo = this.calculo.construirCalculosPorPlan(this.mostrarSinCredibilidad);
    this.ultimaVersion = this.store.version();
  }

  /* ---------- Comparativa sin credibilidad ---------- */

  alternarComparativa(mostrarSinCredibilidad: boolean): void {
    this.mostrarSinCredibilidad = mostrarSinCredibilidad;
    this.recalcular();
  }

  /* ---------- Listado y paginación por plan ---------- */

  alternarListado(llave: string): void {
    this.calculo.alternarListadoCalculosPlan(llave);
  }

  alCambiarRegistrosPorPagina(campo: HTMLInputElement): void {
    campo.value = String(this.calculo.establecerRegistrosPorPaginaCalculos(campo.value));
  }

  /* ---------- Forma de pago ---------- */

  /** Click en una opción de fraccionamiento; ignora los clicks del selector de tipo de pago mensual. */
  alClicOpcionFormaPago(evento: Event, formaPago: string): void {
    if ((evento.target as HTMLElement).closest('[data-tipo-pago-mensual]')) return;
    this.catalogo.solicitarCambioFormaPago(formaPago);
  }

  alTeclaOpcionFormaPago(evento: Event, formaPago: string): void {
    if (evento.target !== evento.currentTarget) return;
    evento.preventDefault();
    this.catalogo.solicitarCambioFormaPago(formaPago);
  }

  /* ---------- Navegación y PDF ---------- */

  atras(): void {
    this.flujo.irAlPaso(4);
  }

  descargarPdf(): void {
    void this.pdf.descargarCotizacionPdf();
  }
}
