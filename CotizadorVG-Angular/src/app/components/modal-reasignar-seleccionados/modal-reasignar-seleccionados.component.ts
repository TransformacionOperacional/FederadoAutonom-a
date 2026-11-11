import { ChangeDetectionStrategy, Component, DoCheck, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsignacionService } from '../../services/asignacion.service';

/**
 * Modal `modalReasignarSeleccionados` (reasignar los asegurados marcados en la tabla de asignación manual).
 * Lo abre el botón "Reasignar seleccionados" del paso 4 (`AsignacionService.abrirReasignacionSeleccionados()`).
 * Debe montarse una sola vez en el shell del cotizador.
 */
@Component({
  selector: 'app-modal-reasignar-seleccionados',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-reasignar-seleccionados.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalReasignarSeleccionadosComponent implements DoCheck {
  readonly asignacion = inject(AsignacionService);
  @ViewChild('selectorPlan') private selectorPlan?: ElementRef<HTMLSelectElement>;
  private visibleAnterior = false;

  /** El original enfocaba `#planReasignacionSeleccionados` al abrir. */
  ngDoCheck(): void {
    const visible = this.asignacion.modalReasignarSeleccionadosVisible;
    if (visible && !this.visibleAnterior) setTimeout(() => this.selectorPlan?.nativeElement.focus());
    this.visibleAnterior = visible;
  }
}
