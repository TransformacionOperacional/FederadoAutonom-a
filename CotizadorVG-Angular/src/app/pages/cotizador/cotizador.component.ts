import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CotizadorStore } from '../../core/cotizador.store';
import { AuthService, UsuarioSesion } from '../../core/auth.service';
import { formatearFechaISO } from '../../core/utils';
import { ModalAlertaRangoComponent } from '../../components/modal-alerta-rango/modal-alerta-rango.component';
import { ModalAsignacionSalarioComponent } from '../../components/modal-asignacion-salario/modal-asignacion-salario.component';
import { ModalConfirmarFormaPagoComponent } from '../../components/modal-confirmar-forma-pago/modal-confirmar-forma-pago.component';
import { ModalConsultarCotizacionComponent } from '../../components/modal-consultar-cotizacion/modal-consultar-cotizacion.component';
import { ModalCrearPlanComponent } from '../../components/modal-crear-plan/modal-crear-plan.component';
import { ModalCrearSubgrupoComponent } from '../../components/modal-crear-subgrupo/modal-crear-subgrupo.component';
import { ModalDeducibleRentaComponent } from '../../components/modal-deducible-renta/modal-deducible-renta.component';
import { ModalEditarPlanComponent } from '../../components/modal-editar-plan/modal-editar-plan.component';
import { ModalFiltroEdadComponent } from '../../components/modal-filtro-edad/modal-filtro-edad.component';
import { ModalPlanSalarioComponent } from '../../components/modal-plan-salario/modal-plan-salario.component';
import { ModalReasignarSeleccionadosComponent } from '../../components/modal-reasignar-seleccionados/modal-reasignar-seleccionados.component';
import { ModalRestriccionPlanComponent } from '../../components/modal-restriccion-plan/modal-restriccion-plan.component';
import { ModalResumenModificacionesComponent } from '../../components/modal-resumen-modificaciones/modal-resumen-modificaciones.component';
import { Paso1DatosPolizaComponent } from '../../components/paso1-datos-poliza/paso1-datos-poliza.component';
import { Paso2AseguradosComponent } from '../../components/paso2-asegurados/paso2-asegurados.component';
import { Paso3PlanesComponent } from '../../components/paso3-planes/paso3-planes.component';
import { Paso4AsignacionComponent } from '../../components/paso4-asignacion/paso4-asignacion.component';
import { Paso5ResumenComponent } from '../../components/paso5-resumen/paso5-resumen.component';
import { CotizacionApiService } from '../../services/cotizacion-api.service';
import { FlujoService } from '../../services/flujo.service';

/**
 * Shell del cotizador (`index.html` original): header, pantallas previas (landing y
 * búsqueda de renovación), barra de pasos del wizard y los modales globales.
 */
@Component({
  selector: 'app-cotizador',
  standalone: true,
  imports: [
    FormsModule,
    Paso1DatosPolizaComponent,
    Paso2AseguradosComponent,
    Paso3PlanesComponent,
    Paso4AsignacionComponent,
    Paso5ResumenComponent,
    ModalConfirmarFormaPagoComponent,
    ModalResumenModificacionesComponent,
    ModalCrearPlanComponent,
    ModalEditarPlanComponent,
    ModalDeducibleRentaComponent,
    ModalAlertaRangoComponent,
    ModalRestriccionPlanComponent,
    ModalFiltroEdadComponent,
    ModalReasignarSeleccionadosComponent,
    ModalConsultarCotizacionComponent,
    ModalCrearSubgrupoComponent,
    ModalAsignacionSalarioComponent,
    ModalPlanSalarioComponent,
  ],
  templateUrl: './cotizador.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class CotizadorComponent implements OnInit {
  readonly flujo = inject(FlujoService);
  readonly store = inject(CotizadorStore);
  readonly cotizacionApi = inject(CotizacionApiService);
  private auth = inject(AuthService);

  readonly formatearFechaISO = formatearFechaISO;

  usuario: UsuarioSesion | null = null;
  menuAbierto = false;
  mostrarModalCerrarSesion = false;

  /** Saludo del landing (`mostrarSaludo` de auth-guard.js). */
  get saludo(): string {
    return this.usuario?.primerNombre ? `¡Hola, ${this.usuario.primerNombre}!` : 'Cotizador Vida Integral';
  }

  ngOnInit(): void {
    this.usuario = this.auth.obtenerUsuario();
    this.flujo.inicializar();
  }

  /* ---------- Menú principal (alternarMenuPrincipal) ---------- */

  alternarMenuPrincipal(abrir?: boolean): void {
    this.menuAbierto = typeof abrir === 'boolean' ? abrir : !this.menuAbierto;
  }

  consultarCotizacion(): void {
    this.alternarMenuPrincipal(false);
    this.cotizacionApi.abrirModalConsultarCotizacion();
  }

  /** Cierra el menú al hacer clic fuera de `.logo-area`. */
  @HostListener('document:click', ['$event'])
  alHacerClicEnDocumento(evento: Event): void {
    if (!(evento.target as HTMLElement | null)?.closest?.('.logo-area')) this.alternarMenuPrincipal(false);
  }

  @HostListener('document:keydown.escape')
  alPresionarEscape(): void {
    this.alternarMenuPrincipal(false);
    this.cancelarCerrarSesion();
  }

  /* ---------- Cerrar sesión ---------- */

  solicitarCerrarSesion(): void {
    this.alternarMenuPrincipal(false);
    this.mostrarModalCerrarSesion = true;
  }

  cancelarCerrarSesion(): void {
    this.mostrarModalCerrarSesion = false;
  }

  confirmarCerrarSesion(): void {
    this.mostrarModalCerrarSesion = false;
    this.auth.cerrarSesion();
  }

  /* ---------- Búsqueda de renovación ---------- */

  alPresionarTeclaDocumento(evento: KeyboardEvent): void {
    if (evento.key === 'Enter') this.flujo.buscarPolizasRenovacion();
  }

  alPresionarTeclaNumeroPoliza(evento: KeyboardEvent): void {
    if (evento.key === 'Enter') evento.preventDefault();
  }

  /** `valor()` del render de la tabla de pólizas: texto o guion largo. */
  valorTabla(texto: any): string {
    return texto ? String(texto) : '—';
  }
}
