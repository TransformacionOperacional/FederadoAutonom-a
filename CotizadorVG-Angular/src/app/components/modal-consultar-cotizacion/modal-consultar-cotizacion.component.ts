import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { formatearDinero } from '../../core/utils';
import { CotizacionApiService } from '../../services/cotizacion-api.service';

/**
 * Modal `modalConsultarCotizacion` (consulta de cotizaciones anteriores del usuario).
 * Lo monta el shell UNA vez; se abre desde la opción "Consultar cotización" del menú principal con
 * `CotizacionApiService.abrirModalConsultarCotizacion()` (la visibilidad la controla `modalConsultarVisible`).
 */
@Component({
  selector: 'app-modal-consultar-cotizacion',
  standalone: true,
  templateUrl: './modal-consultar-cotizacion.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalConsultarCotizacionComponent {
  readonly api = inject(CotizacionApiService);

  primaTexto(fila: any): string {
    const prima = Number(fila.PrimaTotal);
    return Number.isFinite(prima) ? formatearDinero(prima) : '—';
  }
}
