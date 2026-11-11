import { ChangeDetectionStrategy, Component, DoCheck, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsignacionService } from '../../services/asignacion.service';

/**
 * Modal `modalFiltroEdad` (filtro por edad exacta o rango de la tabla de asignación manual).
 * Lo abre el campo "Edad" del paso 4 (`AsignacionService.abrirModalFiltroEdad()`).
 * Debe montarse una sola vez en el shell del cotizador.
 */
@Component({
  selector: 'app-modal-filtro-edad',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-filtro-edad.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalFiltroEdadComponent implements DoCheck {
  readonly asignacion = inject(AsignacionService);
  @ViewChild('campoExacta') private campoExacta?: ElementRef<HTMLInputElement>;
  @ViewChild('campoMin') private campoMin?: ElementRef<HTMLInputElement>;
  private visibleAnterior = false;

  /** El original enfocaba el slider mínimo (modo rango) o la edad específica al abrir. */
  ngDoCheck(): void {
    const visible = this.asignacion.modalFiltroEdadVisible;
    if (visible && !this.visibleAnterior) {
      setTimeout(() => (this.asignacion.edadFiltroUsarRango ? this.campoMin : this.campoExacta)?.nativeElement.focus());
    }
    this.visibleAnterior = visible;
  }
}
