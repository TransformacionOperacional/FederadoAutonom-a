import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../services/plan.service';

/**
 * Modal `modalDeducibleRentaIncapacidad`. Lo abren `PlanService.solicitarDeducibleParaCrearPlan()` y
 * `agregarPlanAlSubgrupo()`. Debe montarse una sola vez en el shell, DESPUÉS de `app-modal-crear-plan`
 * y `app-modal-editar-plan` para que quede apilado encima de ellos.
 */
@Component({
  selector: 'app-modal-deducible-renta',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-deducible-renta.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalDeducibleRentaComponent {
  readonly plan = inject(PlanService);
}
