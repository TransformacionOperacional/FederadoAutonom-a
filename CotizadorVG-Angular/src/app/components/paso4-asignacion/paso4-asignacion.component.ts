import { ChangeDetectionStrategy, Component, Injector, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { REGISTROS_POR_PAGINA_MAX, REGISTROS_POR_PAGINA_MIN } from '../../core/config';
import { AsignacionService } from '../../services/asignacion.service';
import { FlujoService } from '../../services/flujo.service';

/**
 * Paso 4 - Asignación de Planes (`<section id="step4">`).
 * Los modales (`app-modal-alerta-rango`, `app-modal-restriccion-plan`, `app-modal-filtro-edad`,
 * `app-modal-reasignar-seleccionados`) los monta el shell; no se incluyen aquí.
 */
@Component({
  selector: 'app-paso4-asignacion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paso4-asignacion.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Paso4AsignacionComponent implements OnInit {
  readonly asignacion = inject(AsignacionService);
  private injector = inject(Injector);
  private get flujo() { return this.injector.get(FlujoService); }

  readonly registrosMin = REGISTROS_POR_PAGINA_MIN;
  readonly registrosMax = REGISTROS_POR_PAGINA_MAX;

  /** Lo que hacía `irAlPaso(4)`: renderizarAsignacionPlanes() (guardarEstado/ejecutarConCarga los aplica FlujoService). */
  ngOnInit(): void {
    this.asignacion.alEntrarAlPaso();
  }

  /* ---------- Rangos de los planes base ---------- */

  alEscribirRango(planId: string, limite: 'desde' | 'hasta', campo: HTMLInputElement): void {
    this.asignacion.alEscribirRango(planId, limite, campo);
  }

  alCambiarRango(planId: string, limite: 'desde' | 'hasta', campo: HTMLInputElement): void {
    this.asignacion.actualizarRangoPlan(planId, limite, campo.value, campo);
  }

  /* ---------- Asignación manual ---------- */

  alCambiarPlanAsegurado(asegurado: any, campo: HTMLSelectElement): void {
    this.asignacion.asignarPlanAAsegurado(asegurado.id, campo.value);
    // Si la asignación se rechazó, el selector vuelve al plan realmente asignado (el original re-renderizaba la fila).
    campo.value = asegurado.planId || '';
  }

  alTeclaFiltroEdad(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      this.asignacion.abrirModalFiltroEdad();
    }
  }

  alCambiarRegistrosPorPagina(campo: HTMLInputElement): void {
    campo.value = String(this.asignacion.cambiarRegistrosPorPaginaAsignacion(campo.value));
  }

  /* ---------- Navegación ---------- */

  atras(): void { this.flujo.irAlPaso(3); }
  verCalculos(): void { this.flujo.irAlPaso(5); }
}
