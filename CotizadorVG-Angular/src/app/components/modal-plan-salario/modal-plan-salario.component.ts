import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../services/plan.service';

/**
 * Modal `modalPlanSalario` (planes por rango de valor asegurado). Se abre con
 * `PlanService.abrirModalPlanSalario()`. En el index.html original ningún botón lo dispara
 * (UI de subgrupos huérfana); se monta una sola vez en el shell solo si se reactiva esa UI.
 */
@Component({
  selector: 'app-modal-plan-salario',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-plan-salario.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalPlanSalarioComponent {
  readonly plan = inject(PlanService);
}
