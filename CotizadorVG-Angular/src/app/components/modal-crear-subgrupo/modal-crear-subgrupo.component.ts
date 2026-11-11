import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CotizadorStore } from '../../core/cotizador.store';
import { PlanService } from '../../services/plan.service';

/**
 * Modal `modalCrearSubgrupo`. Se abre con `PlanService.abrirModalCrearSubgrupo()`.
 * En el index.html original no existe ningún botón que lo dispare (UI de subgrupos huérfana);
 * se monta una sola vez en el shell solo si se reactiva esa UI.
 */
@Component({
  selector: 'app-modal-crear-subgrupo',
  standalone: true,
  templateUrl: './modal-crear-subgrupo.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalCrearSubgrupoComponent {
  readonly plan = inject(PlanService);

  private store = inject(CotizadorStore);

  get coberturasCatalogo() { return this.store.estado.coberturasCatalogo; }
}
