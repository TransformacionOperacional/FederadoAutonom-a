import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { UiService } from '../../core/ui.service';

/** Toast, overlay de carga y modal genérico de confirmación del cotizador. */
@Component({
  selector: 'app-ui-overlays',
  standalone: true,
  templateUrl: './ui-overlays.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class UiOverlaysComponent {
  readonly ui = inject(UiService);

  @HostListener('document:keydown.escape')
  alPresionarEscape(): void {
    if (this.ui.confirmacion()) this.ui.cancelarConfirmacionCotizador();
  }
}
