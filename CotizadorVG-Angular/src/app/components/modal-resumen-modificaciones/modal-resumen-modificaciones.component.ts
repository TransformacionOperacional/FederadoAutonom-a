import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { formatearDinero } from '../../core/utils';
import { AseguradoService } from '../../services/asegurado.service';

/**
 * Modal `modalResumenModificaciones`. Lo abren el paso 1 (límite de modalidad contributiva) y el paso 2
 * (agregar/importar asegurados) mediante `AseguradoService.mostrarResumenModificaciones()`,
 * por eso debe montarse una sola vez en un lugar siempre presente (shell del cotizador).
 */
@Component({
  selector: 'app-modal-resumen-modificaciones',
  standalone: true,
  templateUrl: './modal-resumen-modificaciones.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalResumenModificacionesComponent {
  readonly asegurados = inject(AseguradoService);
  readonly formatearDinero = formatearDinero;
}
