import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CotizadorStore } from '../../core/cotizador.store';
import { CatalogoService } from '../../services/catalogo.service';
import { FlujoService } from '../../services/flujo.service';
import { PlanService } from '../../services/plan.service';

/**
 * Paso 3 - Configuración de Planes (`<section id="step3">`).
 * Los modales (crear/editar plan, deducible) los monta el shell; no se incluyen aquí.
 */
@Component({
  selector: 'app-paso3-planes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paso3-planes.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Paso3PlanesComponent {
  readonly plan = inject(PlanService);
  readonly catalogo = inject(CatalogoService);
  readonly store = inject(CotizadorStore);
  private injector = inject(Injector);
  private get flujo() { return this.injector.get(FlujoService); }

  readonly codigoVida = 'WET';
  busquedaCoberturas = '';
  codigoAmparoSeleccionado = '';

  get amparosDisponibles() {
    return this.plan.obtenerAmparosDisponibles(this.busquedaCoberturas);
  }

  async agregarAmparo(): Promise<void> {
    await this.catalogo.agregarCobertura(this.codigoAmparoSeleccionado);
    this.codigoAmparoSeleccionado = '';
  }

  atras(): void { this.flujo.irAlPaso(2); }
  verCalculos(): void { this.flujo.irAlPaso(4); }
}
