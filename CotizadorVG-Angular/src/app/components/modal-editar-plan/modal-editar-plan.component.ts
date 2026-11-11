import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COBERTURA_RENTA_INCAPACIDAD } from '../../core/config';
import { PlanService } from '../../services/plan.service';

/**
 * Modal `modalEditarPlan`. Lo abre el paso 3 (`PlanService.abrirModalEditarPlan(planId)`); estado en
 * `PlanService.formularioEditarPlan`. Debe montarse una sola vez en el shell del cotizador.
 */
@Component({
  selector: 'app-modal-editar-plan',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-editar-plan.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalEditarPlanComponent {
  readonly plan = inject(PlanService);
  readonly codigoRentaIncapacidad = COBERTURA_RENTA_INCAPACIDAD;
}
