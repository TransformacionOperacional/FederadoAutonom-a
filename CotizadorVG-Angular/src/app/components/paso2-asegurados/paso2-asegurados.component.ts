import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, Injector, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CONFIG, REGISTROS_POR_PAGINA_MAX, REGISTROS_POR_PAGINA_MIN, VALOR_ASEGURADO_MAXIMO_VOLUNTARIA } from '../../core/config';
import { CotizadorStore } from '../../core/cotizador.store';
import { formatearDinero } from '../../core/utils';
import { AseguradoService } from '../../services/asegurado.service';
import { FlujoService } from '../../services/flujo.service';
import { ImportacionService } from '../../services/importacion.service';

/** Paso 2: Registro y carga de asegurados (`<section id="step2">` del index.html original). */
@Component({
  selector: 'app-paso2-asegurados',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paso2-asegurados.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Paso2AseguradosComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly aseguradoService = inject(AseguradoService);
  readonly importacion = inject(ImportacionService);
  private store = inject(CotizadorStore);
  private injector = inject(Injector);

  // Dependencia perezosa hacia el servicio de flujo (evita ciclos de DI).
  private get flujo() { return this.injector.get(FlujoService); }

  readonly formatearDinero = formatearDinero;
  readonly tiposAsegurado = CONFIG.TIPO_ASEGURADO;
  readonly gruposAsignacion = CONFIG.GRUPOS_ASIGNACION;
  readonly registrosMin = REGISTROS_POR_PAGINA_MIN;
  readonly registrosMax = REGISTROS_POR_PAGINA_MAX;
  readonly valorMaximoVoluntaria = VALOR_ASEGURADO_MAXIMO_VOLUNTARIA;

  /** `#modalEditarCobertura` (sin lógica en el original: solo `editarCobertura` mostraba un aviso). */
  modalEditarCoberturaVisible = false;

  @ViewChild('campoValorAsegurado') private campoValorAsegurado?: ElementRef<HTMLInputElement>;

  get gruposSalariales() { return this.store.gruposSalariales; }

  /** `#panelSimulacion`: visible solo en modo simulación. */
  get mostrarPanelSimulacion(): boolean {
    const flujo = this.store.flujo;
    return flujo.tipo === 'nuevo' && flujo.subtipo === 'simulacion';
  }

  /** `#panelExcel`: visible solo en modo cotización. */
  get mostrarPanelExcel(): boolean {
    return this.store.flujo.subtipo === 'cotizacion';
  }

  ngOnInit(): void {
    this.aseguradoService.aplicarVisibilidadSeccionAsegurados();
  }

  ngAfterViewInit(): void {
    this.aseguradoService.enfocarCampoValorAsegurado = () => this.campoValorAsegurado?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.aseguradoService.enfocarCampoValorAsegurado = null;
  }

  /* ---------- Modal de asegurado ---------- */

  alEscribirValorAsegurado(campo: HTMLInputElement): void {
    this.aseguradoService.formatearCampoMoneda(campo);
    this.aseguradoService.limitarValorAseguradoEnCampo(campo);
  }

  alEscribirEdad(valor: string): void {
    this.aseguradoService.aseguradoEdad = valor;
    this.aseguradoService.actualizarValidacionEdadModal();
  }

  alCambiarTipoAsegurado(tipo: string): void {
    this.aseguradoService.aseguradoTipo = tipo;
    this.aseguradoService.actualizarValidacionEdadModal();
  }

  /* ---------- Paginación ---------- */

  alCambiarRegistrosPorPagina(campo: HTMLInputElement): void {
    campo.value = String(this.aseguradoService.cambiarRegistrosPorPaginaAsegurados(campo.value));
  }

  /* ---------- Navegación ---------- */

  atras(): void {
    this.flujo.irAlPaso(1);
  }

  siguiente(): void {
    if (!this.aseguradoService.validarValoresMinimosParaCotizar()) return;
    this.flujo.irAlPaso(3);
  }

  seleccionarArchivo(input: HTMLInputElement): void {
    input.click();
  }

  /** Cierra el modal al hacer clic en el fondo (mismo comportamiento que el overlay original). */
  alHacerClicEnFondo(evento: Event, cerrar: () => void): void {
    if (evento.target === evento.currentTarget) cerrar();
  }
}
