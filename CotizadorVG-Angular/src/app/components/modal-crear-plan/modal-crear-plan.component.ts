import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COBERTURA_RENTA_INCAPACIDAD } from '../../core/config';
import { PlanService } from '../../services/plan.service';

/**
 * Modal `modalCrearPlan`. Lo abre el paso 3 (`PlanService.abrirModalCrearPlan()`); estado en
 * `PlanService.formularioCrearPlan`. Debe montarse una sola vez en el shell del cotizador.
 */
@Component({
  selector: 'app-modal-crear-plan',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-crear-plan.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ModalCrearPlanComponent {
  readonly plan = inject(PlanService);
  readonly codigoRentaIncapacidad = COBERTURA_RENTA_INCAPACIDAD;
}
