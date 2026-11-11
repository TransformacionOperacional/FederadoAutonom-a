import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CotizadorStore } from '../../core/cotizador.store';
import { PlanService } from '../../services/plan.service';

/**
 * Modal `modalAsignacionSalario` (asignación de subgrupos por rango de valor asegurado).
 * Se abre con `PlanService.asignarPorSalario()`. En el index.html original ningún botón lo dispara
 * (UI de subgrupos huérfana); se monta una sola vez en el shell solo si se reactiva esa UI.
 */
@Component({
  selector: 'app-modal-asignacion-salario',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-asignacion-salario.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalAsignacionSalarioComponent {
  readonly plan = inject(PlanService);
  private store = inject(CotizadorStore);

  get subgrupos() { return this.store.estado.subgrupos; }
}
