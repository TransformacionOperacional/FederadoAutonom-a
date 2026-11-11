import { ChangeDetectionStrategy, Component, DoCheck, ElementRef, ViewChild, inject } from '@angular/core';
import { AsignacionService } from '../../services/asignacion.service';

/**
 * Modal `modalRestriccionPlan` (motivo del nuevo plan). Lo abre el botón `i` de "Planes asignados" del paso 4
 * (`AsignacionService.abrirModalRestriccionPlan(planId)`). Debe montarse una sola vez en el shell del cotizador.
 */
@Component({
  selector: 'app-modal-restriccion-plan',
  standalone: true,
  templateUrl: './modal-restriccion-plan.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalRestriccionPlanComponent implements DoCheck {
  readonly asignacion = inject(AsignacionService);
  @ViewChild('btnCerrar') private btnCerrar?: ElementRef<HTMLButtonElement>;
  private visibleAnterior = false;

  /** El original enfocaba `#btnCerrarRestriccionPlan` al abrir. */
  ngDoCheck(): void {
    const visible = this.asignacion.modalRestriccionPlanVisible;
    if (visible && !this.visibleAnterior) setTimeout(() => this.btnCerrar?.nativeElement.focus());
    this.visibleAnterior = visible;
  }

  /** Clic en el fondo (`evento.target.id === 'modalRestriccionPlan'`). */
  alClicFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) this.asignacion.cerrarModalRestriccionPlan();
  }
}
