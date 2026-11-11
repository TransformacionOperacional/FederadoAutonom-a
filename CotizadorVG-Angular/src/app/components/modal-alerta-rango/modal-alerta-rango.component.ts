import { ChangeDetectionStrategy, Component, DoCheck, ElementRef, ViewChild, inject } from '@angular/core';
import { AsignacionService } from '../../services/asignacion.service';

/**
 * Modal `modalAlertaRango` (alerta de validación parametrizable). La abre cualquier servicio con
 * `AsignacionService.mostrarAlertaRango(mensaje, campo, titulo)`. Debe montarse una sola vez en el shell del cotizador.
 */
@Component({
  selector: 'app-modal-alerta-rango',
  standalone: true,
  templateUrl: './modal-alerta-rango.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalAlertaRangoComponent implements DoCheck {
  readonly asignacion = inject(AsignacionService);
  @ViewChild('btnAceptar') private btnAceptar?: ElementRef<HTMLButtonElement>;
  private visibleAnterior = false;

  /** El original enfocaba `#btnAceptarAlertaRango` al abrir. */
  ngDoCheck(): void {
    const visible = this.asignacion.modalAlertaRangoVisible;
    if (visible && !this.visibleAnterior) setTimeout(() => this.btnAceptar?.nativeElement.focus());
    this.visibleAnterior = visible;
  }
}
