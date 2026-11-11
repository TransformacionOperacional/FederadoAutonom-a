import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CotizadorStore } from '../../core/cotizador.store';
import { CatalogoService } from '../../services/catalogo.service';

/**
 * Modal `modalConfirmarFormaPago`. Se abre con `CatalogoService.solicitarCambioFormaPago()`
 * (la invoca el paso 5 al elegir otra forma de pago), por eso debe montarse una sola vez
 * en un lugar siempre presente (shell del cotizador / paso 5), no dentro del paso 1.
 */
@Component({
  selector: 'app-modal-confirmar-forma-pago',
  standalone: true,
  templateUrl: './modal-confirmar-forma-pago.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalConfirmarFormaPagoComponent {
  readonly catalogo = inject(CatalogoService);
  private store = inject(CotizadorStore);

  get formaPagoActual(): string {
    return this.store.estado.poliza.formaPago || 'Anual';
  }

  alHacerClicEnFondo(evento: Event): void {
    if (evento.target === evento.currentTarget) this.catalogo.cancelarCambioFormaPago();
  }
}
