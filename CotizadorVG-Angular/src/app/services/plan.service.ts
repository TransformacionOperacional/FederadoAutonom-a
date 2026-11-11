import { inject, Injectable, Injector } from '@angular/core';
import {
    COBERTURA_RENTA_HOSPITALIZACION,
    COBERTURA_RENTA_HOSPITALIZACION_UCI,
    COBERTURA_RENTA_INCAPACIDAD,
    COBERTURAS_ENFERMEDADES_GRAVES,
    DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO,
    DEDUCIBLES_RENTA_INCAPACIDAD,
    FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO,
    FACTORES_ENFERMEDADES_GRAVES,
    GRUPOS_COBERTURAS_EXCLUYENTES,
    PLANES_SUGERIDOS,
    RANGOS_ASIGNACION_SALARIO,
    TASA_BASE_SISTEMA
} from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService } from '../core/ui.service';
import {
    formatearDinero,
    generarUUID,
    normalizarTexto,
    obtenerValorAseguradoBase
} from '../core/utils';
import { CalculoService } from './calculo.service';
import { CatalogoService } from './catalogo.service';

/* ============================================================
   Modelos de datos para las plantillas (paso 3 y modales de planes/subgrupos)
   ============================================================ */

/**
 * Estado del formulario de los modales Crear plan / Editar plan. Reemplaza el DOM que
 * generaban abrirModalCrearPlan/abrirModalEditarPlan (checkboxes + selects dentro de
 * `#coberturasPlanManual` / `#coberturasPlanEdicion`).
 */
export interface FormularioPlan {
    visible: boolean;
    nombre: string;
    /** codigo de cobertura -> marcada */
    seleccion: Record<string, boolean>;
    /** Valor del selector `.deducible-cobertura-plan` (solo aplica a Renta por incapacidad, WFA). */
    deducible: string;
    /** `[data-factor-eg]`: codigo EG -> factor (0.40/0.50/0.60) */
    factorEG: Record<string, number>;
    /** `[data-cancer-in-situ]`: codigo EG -> marcado */
    cancerInSitu: Record<string, boolean>;
}

/** Estado derivado de un checkbox del formulario (lo que actualizarOpcionesExcluyentesPlan escribía en el DOM). */
export interface EstadoCoberturaFormularioPlan {
    seleccionada: boolean;
    /** input.disabled */
    deshabilitada: boolean;
    /** input.title */
    titulo: string;
    /** clase `cobertura-excluida` y aria-disabled */
    excluida: boolean;
}

export interface PlanSugeridoVista {
    /** Posición 1-based que recibe `aplicarPlanSugerido`. */
    indice: number;
    nombre: string;
    /** Nombres de las coberturas unidos por ' · ' */
    detalle: string;
    /** false => 'No disponible para Core GW' */
    disponible: boolean;
}

export interface PlanConfiguradoVista {
    plan: any;
    /** Nombre de cada cobertura (con deducible si aplica); la plantilla los une con ' · '. */
    coberturas: string[];
}

export interface SubgrupoConfigVista {
    subgrupo: any;
    numAsegurados: number;
    numPlanes: number;
    chips: { codigo: string; obligatoria: boolean }[];
}

export interface ColumnaWorkspacePlanes {
    codigo: string;
    /** Deducible del primer plan del subgrupo (cabecera `Valor aseg. · Ded. x`). */
    deducible: string | null;
}

export interface FilaWorkspacePlanes {
    plan: any;
    valores: { codigo: string; valor: number }[];
    numAsegurados: number;
    primaTexto: string;
}

export interface WorkspacePlanesVista {
    subgrupo: any;
    titulo: string;
    subtitulo: string;
    columnas: ColumnaWorkspacePlanes[];
    filas: FilaWorkspacePlanes[];
}

export interface FilaAsignacionSalario {
    label: string;
    maxValorAsegurado: number;
    subgrupoId: string;
}

export interface FilaPlanSalario {
    maxValorAsegurado: number | null;
    /** codigo de cobertura -> valor asegurado digitado */
    valores: Record<string, number | null>;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
    private store = inject(CotizadorStore);
    private ui = inject(UiService);
    private injector = inject(Injector);

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get calculo() { return this.injector.get(CalculoService); }
    private get catalogo() { return this.injector.get(CatalogoService); }

    private get estado() { return this.store.estado; }
    private get coberturasDisponibles() { return this.store.coberturasDisponibles; }

    /* ============================================================
       Estado de UI (variables `let` de módulo del app.js original)
       ============================================================ */

    /** ID del subgrupo seleccionado en la pantalla de planes (PÚBLICA y escribible). */
    subgrupoActivoEnPlanes: string | null = null;
    planSalarioSubgrupoActivo: string | null = null;
    planEditandoId: string | null = null;
    /** `{ nombre, coberturas, configuracionEnfermedadesGraves }` o `{ tipo: 'subgrupo', subgrupoId }`. */
    planPendienteDeducible: any = null;

    /* ---- Modal Crear plan (modalCrearPlan) / Editar plan (modalEditarPlan) ---- */
    formularioCrearPlan: FormularioPlan = this.crearFormularioPlanVacio();
    formularioEditarPlan: FormularioPlan = this.crearFormularioPlanVacio();

    /* ---- Modal Deducible renta por incapacidad (modalDeducibleRentaIncapacidad) ---- */
    modalDeducibleRentaIncapacidadVisible = false;
    deducibleRentaIncapacidad = DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO;

    /* ---- Modal Crear subgrupo (modalCrearSubgrupo) ---- */
    modalCrearSubgrupoVisible = false;
    /** codigo de cobertura -> marcada (`#coberturaCheckGrid`) */
    seleccionSubgrupo: Record<string, boolean> = {};

    /* ---- Modal Asignación por rango de valor asegurado (modalAsignacionSalario) ---- */
    modalAsignacionSalarioVisible = false;
    filasAsignacionSalario: FilaAsignacionSalario[] = [];

    /* ---- Modal Planes por rango de valor asegurado (modalPlanSalario) ---- */
    modalPlanSalarioVisible = false;
    filasPlanSalario: FilaPlanSalario[] = [];

    /** `#subgrupoMasivoSelect` (asignación masiva de subgrupo). */
    subgrupoMasivoId = '';

    /* ============================================================
       SECCIÓN 12 (parcial): LÓGICA DE RENDERIZADO DEL PASO 3
       ============================================================ */

    /** Equivale a renderizarPlanesSugeridos. */
    get planesSugeridosVista(): PlanSugeridoVista[] {
        return PLANES_SUGERIDOS.map((plan, indice) => {
            const coberturas = plan.coberturas.map(referencia => this.catalogo.buscarCoberturaPorReferencia(referencia));
            const faltantes = plan.coberturas.filter((_referencia, posicion) => !coberturas[posicion]);
            const detalle = plan.coberturas
                .map((referencia, posicion) => coberturas[posicion]?.nombre || referencia)
                .join(' · ');
            return { indice: indice + 1, nombre: plan.nombre, detalle, disponible: faltantes.length === 0 };
        });
    }

    /** Equivale a renderizarResumenPlanesConfigurados. */
    get resumenPlanesConfigurados(): PlanConfiguradoVista[] {
        return this.estado.planes.map(plan => {
            const subgrupo = this.estado.subgrupos.find(item => item.id === plan.subgrupoId);
            const coberturas = this.catalogo.ordenarCoberturasPorNombre((subgrupo?.['coberturas'] || [])
                .map((codigo: string) => {
                    const cobertura = this.coberturasDisponibles.find(item => item.codigo === codigo);
                    const deducible = this.obtenerDeducibleCoberturaPlan(plan, codigo);
                    return {
                        codigo,
                        nombre: cobertura?.nombre || codigo,
                        deducible
                    };
                }), true)
                .map((cobertura: any) => cobertura.deducible
                    ? `${cobertura.nombre} (Deducible: ${this.obtenerEtiquetaDeducible(cobertura.deducible)})`
                    : cobertura.nombre);
            return { plan, coberturas };
        });
    }

    /** Equivale a renderizarAmparosDisponibles: amparos del Core GW aún no configurados que cumplen la búsqueda. */
    obtenerAmparosDisponibles(busqueda = ''): any[] {
        const codigosConfigurados = new Set(this.estado.coberturasCatalogo.map(cobertura => cobertura.codigo));
        const texto = normalizarTexto(busqueda || '');
        return this.coberturasDisponibles.filter(cobertura => {
            const textoAmparo = `${cobertura.codigo} ${cobertura.codigoAmparo} ${cobertura.nombre}`;
            return !codigosConfigurados.has(cobertura.codigo) && normalizarTexto(textoAmparo).includes(texto);
        });
    }

    /** Coberturas ofrecidas en los formularios de crear/editar plan (ordenadas por nombre). */
    get coberturasFormularioPlan(): any[] {
        return this.catalogo.ordenarCoberturasPorNombre(this.coberturasDisponibles);
    }

    /** Coberturas del plan (ordenadas, Vida primero). Usada por CalculoService y AsignacionService. */
    obtenerCoberturasPlan(plan: any): any[] {
        const subgrupo = this.estado.subgrupos.find(item => item.id === plan.subgrupoId);
        return this.catalogo.ordenarCoberturasPorNombre((subgrupo?.['coberturas'] || []).map((codigo: string) =>
            this.coberturasDisponibles.find(cobertura => cobertura.codigo === codigo)
            || this.estado.coberturasCatalogo.find(cobertura => cobertura.codigo === codigo)
        ).filter(Boolean), true);
    }

    /* ============================================================
       PLANES: nombre, exclusiones, deducible, enfermedades graves
       ============================================================ */

    aplicarPlanSugerido(sugeridoId: number): void {
        const sugerencia = PLANES_SUGERIDOS[sugeridoId - 1];
        if (!sugerencia) return;

        const coberturas = sugerencia.coberturas.map(referencia => this.catalogo.buscarCoberturaPorReferencia(referencia));
        if (coberturas.some(cobertura => !cobertura)) {
            this.ui.mostrarToast('Una o más coberturas del plan no están disponibles en el Core GW.', 'warning');
            return;
        }

        this.solicitarDeducibleParaCrearPlan(sugerencia.nombre, coberturas);
    }

    siguienteNombrePlan(): string {
        const numeroPorLetra = (letras: string) => [...letras].reduce((total, letra) => total * 26 + letra.charCodeAt(0) - 64, 0) - 1;
        const ultimoNumero = this.estado.planes.reduce((maximo, plan) => {
            const coincidencia = String(plan.nombre || '').match(/^Plan\s+([A-Z]+)(?:\s|$)/i);
            return coincidencia ? Math.max(maximo, numeroPorLetra(coincidencia[1].toUpperCase())) : maximo;
        }, -1);
        let numero = ultimoNumero + 1;
        let letras = '';
        do {
            letras = String.fromCharCode(65 + (numero % 26)) + letras;
            numero = Math.floor(numero / 26) - 1;
        } while (numero >= 0);
        return `Plan ${letras}`;
    }

    obtenerCoberturasExcluyentesSeleccionadas(codigos: string[]): string[][] {
        const seleccionadas = new Set(codigos);
        return GRUPOS_COBERTURAS_EXCLUYENTES
            .map(grupo => grupo.filter(codigo => seleccionadas.has(codigo)))
            .filter(grupo => grupo.length > 1);
    }

    /**
     * Parte lógica de actualizarOpcionesExcluyentesPlan: UCI exige Hospitalización básica.
     * El resto (deshabilitar/titulo/clases) se obtiene con `estadoCoberturaFormularioPlan`.
     */
    actualizarOpcionesExcluyentesPlan(formulario: FormularioPlan): void {
        if (formulario.seleccion[COBERTURA_RENTA_HOSPITALIZACION_UCI]) {
            formulario.seleccion[COBERTURA_RENTA_HOSPITALIZACION] = true;
        }
    }

    /** Estado de cada checkbox del formulario (lo que actualizarOpcionesExcluyentesPlan pintaba en el DOM). */
    estadoCoberturaFormularioPlan(formulario: FormularioPlan, codigo: string): EstadoCoberturaFormularioPlan {
        const seleccionadas = new Set(Object.keys(formulario.seleccion).filter(clave => formulario.seleccion[clave]));
        const grupo = GRUPOS_COBERTURAS_EXCLUYENTES.find(item => item.includes(codigo));
        const incompatibleSeleccionada = Boolean(grupo?.some(c => c !== codigo && seleccionadas.has(c)));
        const esBaseHospitalizacionRequerida = codigo === COBERTURA_RENTA_HOSPITALIZACION
            && Boolean(formulario.seleccion[COBERTURA_RENTA_HOSPITALIZACION_UCI]);
        return {
            seleccionada: Boolean(formulario.seleccion[codigo]),
            deshabilitada: codigo === 'WET' || incompatibleSeleccionada || esBaseHospitalizacionRequerida,
            titulo: esBaseHospitalizacionRequerida
                ? 'Esta cobertura es obligatoria mientras esté seleccionada Renta por hospitalización en UCI.'
                : incompatibleSeleccionada ? 'No puede seleccionarse junto con la cobertura ya elegida.' : '',
            excluida: incompatibleSeleccionada
        };
    }

    /** Selector de deducible habilitado solo si Renta por incapacidad (WFA) está marcada. */
    deducibleHabilitado(formulario: FormularioPlan): boolean {
        return Boolean(formulario.seleccion[COBERTURA_RENTA_INCAPACIDAD]);
    }

    /** Controles de enfermedades graves visibles solo si la cobertura está marcada (`[data-configuracion-eg]`). */
    configuracionEGVisible(formulario: FormularioPlan, codigo: string): boolean {
        return Boolean(formulario.seleccion[codigo]);
    }

    /** Equivale al listener 'change' de configurarOpcionesPlan (se invoca al marcar/desmarcar un checkbox). */
    alCambiarCoberturaPlan(formulario: FormularioPlan, codigo: string, marcada: boolean): void {
        formulario.seleccion[codigo] = marcada;
        if (COBERTURAS_ENFERMEDADES_GRAVES.includes(codigo)) {
            const codigosParaReiniciar = marcada
                ? COBERTURAS_ENFERMEDADES_GRAVES.filter(c => c !== codigo)
                : [codigo];

            codigosParaReiniciar.forEach(c => {
                if (marcada) formulario.seleccion[c] = false;
                formulario.factorEG[c] = FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO;
                formulario.cancerInSitu[c] = false;
            });
        }

        if (codigo === COBERTURA_RENTA_HOSPITALIZACION && marcada) {
            formulario.seleccion[COBERTURA_RENTA_HOSPITALIZACION_UCI] = true;
        }
        if (codigo === COBERTURA_RENTA_HOSPITALIZACION_UCI && marcada) {
            formulario.seleccion[COBERTURA_RENTA_HOSPITALIZACION] = true;
        }
        this.actualizarOpcionesExcluyentesPlan(formulario);
    }

    obtenerEtiquetaDeducible(deducible: any): string {
        const [diasMinimos, diasMaximos] = String(deducible || '').split('-');
        return diasMinimos && diasMaximos
            ? `Deducible ${diasMinimos} días - Máx. ${diasMaximos} días`
            : 'Deducible...';
    }

    /** Opciones del selector de deducible (`opcionesDeduciblePlan`). */
    get opcionesDeduciblePlan(): { valor: string; etiqueta: string }[] {
        return DEDUCIBLES_RENTA_INCAPACIDAD.map(opcion => ({ valor: opcion, etiqueta: this.obtenerEtiquetaDeducible(opcion) }));
    }

    /** Opciones del selector de factor de enfermedades graves (`opcionesEnfermedadesGravesPlan`). */
    get opcionesFactorEnfermedadesGraves(): { valor: number; etiqueta: string }[] {
        return FACTORES_ENFERMEDADES_GRAVES.map(opcion => ({ valor: opcion, etiqueta: `${Math.round(opcion * 100)}%` }));
    }

    esCoberturaEnfermedadesGraves(codigo: string): boolean {
        return this.calculo.esCoberturaEnfermedadesGraves(codigo);
    }

    obtenerConfiguracionEnfermedadesGravesDesdeContenedor(formulario: FormularioPlan): { factoresEnfermedadesGraves: Record<string, number>; cancerInSituPorCobertura: Record<string, boolean> } {
        const factoresEnfermedadesGraves: Record<string, number> = {};
        const cancerInSituPorCobertura: Record<string, boolean> = {};
        COBERTURAS_ENFERMEDADES_GRAVES.forEach(codigo => {
            if (!formulario.seleccion[codigo]) return;
            const factor = Number(formulario.factorEG[codigo]);
            factoresEnfermedadesGraves[codigo] = FACTORES_ENFERMEDADES_GRAVES.includes(factor) ? factor : FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO;
            cancerInSituPorCobertura[codigo] = Boolean(formulario.cancerInSitu[codigo]);
        });
        return { factoresEnfermedadesGraves, cancerInSituPorCobertura };
    }

    obtenerDeduciblesDesdeContenedor(formulario: FormularioPlan): Record<string, string> {
        return this.deducibleHabilitado(formulario) ? { [COBERTURA_RENTA_INCAPACIDAD]: formulario.deducible || '' } : {};
    }

    obtenerDeducibleCoberturaPlan(plan: any, codigo: string): string | null {
        return plan?.deduciblesCobertura?.[codigo] || null;
    }

    solicitarDeducibleParaCrearPlan(nombre: string, coberturas: any[], deduciblesCobertura: Record<string, string> = {}, configuracionEnfermedadesGraves: any = {}): boolean {
        if (!coberturas.some(cobertura => cobertura.codigo === COBERTURA_RENTA_INCAPACIDAD)) {
            return this.crearPlanConCoberturas(nombre, coberturas, deduciblesCobertura, configuracionEnfermedadesGraves);
        }
        const deducible = deduciblesCobertura[COBERTURA_RENTA_INCAPACIDAD];
        if (DEDUCIBLES_RENTA_INCAPACIDAD.includes(deducible)) {
            return this.crearPlanConCoberturas(nombre, coberturas, deduciblesCobertura, configuracionEnfermedadesGraves);
        }
        this.planPendienteDeducible = { nombre, coberturas, configuracionEnfermedadesGraves };
        this.deducibleRentaIncapacidad = DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO;
        this.modalDeducibleRentaIncapacidadVisible = true;
        return false;
    }

    confirmarDeducibleRentaIncapacidad(): void {
        const deducible = this.deducibleRentaIncapacidad;
        if (!this.planPendienteDeducible || !DEDUCIBLES_RENTA_INCAPACIDAD.includes(deducible)) {
            this.ui.mostrarToast('Selecciona un deducible válido.', 'warning');
            return;
        }
        const pendiente = this.planPendienteDeducible;
        this.planPendienteDeducible = null;
        this.modalDeducibleRentaIncapacidadVisible = false;
        if (pendiente.tipo === 'subgrupo') {
            this.crearPlanEnSubgrupo(pendiente.subgrupoId, deducible);
            return;
        }
        this.crearPlanConCoberturas(pendiente.nombre, pendiente.coberturas, { [COBERTURA_RENTA_INCAPACIDAD]: deducible }, pendiente.configuracionEnfermedadesGraves);
        this.cerrarModalCrearPlan();
    }

    cancelarDeducibleRentaIncapacidad(): void {
        this.planPendienteDeducible = null;
        this.modalDeducibleRentaIncapacidadVisible = false;
    }

    crearPlanConCoberturas(nombre: string, coberturas: any[], deduciblesCobertura: Record<string, string> = {}, configuracionEnfermedadesGraves: any = {}): boolean {
        if (coberturas.some(cobertura => cobertura.codigo === COBERTURA_RENTA_INCAPACIDAD)
            && !DEDUCIBLES_RENTA_INCAPACIDAD.includes(deduciblesCobertura[COBERTURA_RENTA_INCAPACIDAD])) {
            return this.solicitarDeducibleParaCrearPlan(nombre, coberturas, deduciblesCobertura, configuracionEnfermedadesGraves);
        }
        const estado = this.estado;
        const vida = this.coberturasDisponibles.find(cobertura => cobertura.codigo === 'WET');
        if (vida && !coberturas.some(cobertura => cobertura.codigo === 'WET')) {
            coberturas = [vida, ...coberturas];
        }
        const codigos = [...new Set(coberturas.map(cobertura => cobertura.codigo))].sort();
        const conflictos = this.obtenerCoberturasExcluyentesSeleccionadas(codigos);
        if (conflictos.length > 0) {
            this.ui.mostrarToast('El plan contiene coberturas excluyentes. Retira una de las coberturas incompatibles.', 'warning');
            return false;
        }

        coberturas.forEach(cobertura => {
            if (!estado.coberturasCatalogo.some(item => item.codigo === cobertura.codigo)) {
                estado.coberturasCatalogo.push({ ...cobertura, tasaBase: TASA_BASE_SISTEMA, obligatoria: cobertura.codigo === 'WET' });
            }
        });

        const subgrupoId = this.generarIdSubgrupo(codigos);
        if (!estado.subgrupos.some(subgrupo => subgrupo.id === subgrupoId)) {
            estado.subgrupos.push({ id: subgrupoId, nombre: `Grupo ${estado.subgrupos.length + 1}`, coberturas: codigos, asegurados: [] });
        }

        const nombrePlan = this.siguienteNombrePlan();
        estado.planes.push({
            id: generarUUID(), subgrupoId, nombre: nombrePlan,
            valoresCobertura: Object.fromEntries(codigos.map(codigo => [codigo, 0])),
            deduciblesCobertura: { ...deduciblesCobertura },
            factoresEnfermedadesGraves: { ...configuracionEnfermedadesGraves.factoresEnfermedadesGraves },
            cancerInSituPorCobertura: { ...configuracionEnfermedadesGraves.cancerInSituPorCobertura },
            asegurados: [], primaTotal: 0
        });

        this.store.guardarEstado();
        this.asegurarSubgrupoActivoEnPlanes();
        this.store.notificarCambio(); // renderizarTablaCoberturas + renderizarPlanesSubgrupoTabs
        this.ui.mostrarToast(`${nombrePlan} creado. Define valores asegurados y asigna asegurados en Planes.`, 'success');
        return true;
    }

    /* ---------- Modal Crear plan ---------- */

    abrirModalCrearPlan(): void {
        this.planEditandoId = null;
        const formulario = this.crearFormularioPlanVacio();
        formulario.nombre = this.siguienteNombrePlan();
        this.coberturasDisponibles.forEach(cobertura => {
            formulario.seleccion[cobertura.codigo] = cobertura.codigo === 'WET';
            if (this.esCoberturaEnfermedadesGraves(cobertura.codigo)) {
                formulario.factorEG[cobertura.codigo] = FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO;
                formulario.cancerInSitu[cobertura.codigo] = false;
            }
        });
        this.actualizarOpcionesExcluyentesPlan(formulario);
        formulario.visible = true;
        this.formularioCrearPlan = formulario;
    }

    cerrarModalCrearPlan(): void {
        this.formularioCrearPlan.visible = false;
    }

    crearPlanManual(): void {
        const formulario = this.formularioCrearPlan;
        const nombre = (formulario.nombre || '').trim();
        const coberturas = this.coberturasMarcadasFormulario(formulario);
        const deduciblesCobertura = this.obtenerDeduciblesDesdeContenedor(formulario);
        const configuracionEnfermedadesGraves = this.obtenerConfiguracionEnfermedadesGravesDesdeContenedor(formulario);
        if (!nombre) {
            this.ui.mostrarToast('Ingresa el nombre del plan.', 'warning');
            return;
        }
        if (coberturas.length === 0) {
            this.ui.mostrarToast('Selecciona al menos una cobertura.', 'warning');
            return;
        }
        if (this.solicitarDeducibleParaCrearPlan(nombre, coberturas, deduciblesCobertura, configuracionEnfermedadesGraves)) this.cerrarModalCrearPlan();
    }

    /* ---------- Modal Editar plan ---------- */

    abrirModalEditarPlan(planId: string): void {
        const plan = this.estado.planes.find(item => item.id === planId);
        if (!plan) return;

        this.planEditandoId = planId;
        const formulario = this.crearFormularioPlanVacio();
        formulario.nombre = plan.nombre;
        const coberturasSubgrupo: string[] = this.estado.subgrupos
            .find(subgrupo => subgrupo.id === plan.subgrupoId)?.['coberturas'] || [];
        this.coberturasDisponibles.forEach(cobertura => {
            const esVida = cobertura.codigo === 'WET';
            formulario.seleccion[cobertura.codigo] = esVida || coberturasSubgrupo.includes(cobertura.codigo);
            if (this.esCoberturaEnfermedadesGraves(cobertura.codigo)) {
                formulario.factorEG[cobertura.codigo] = this.calculo.obtenerFactorEnfermedadesGraves(plan, cobertura.codigo);
                formulario.cancerInSitu[cobertura.codigo] = Boolean(plan['cancerInSituPorCobertura']?.[cobertura.codigo]);
            }
        });
        formulario.deducible = this.obtenerDeducibleCoberturaPlan(plan, COBERTURA_RENTA_INCAPACIDAD) || DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO;
        this.actualizarOpcionesExcluyentesPlan(formulario);
        formulario.visible = true;
        this.formularioEditarPlan = formulario;
    }

    cerrarModalEditarPlan(): void {
        this.formularioEditarPlan.visible = false;
        this.planEditandoId = null;
    }

    guardarEdicionPlan(): void {
        const estado = this.estado;
        const formulario = this.formularioEditarPlan;
        const plan = estado.planes.find(item => item.id === this.planEditandoId);
        const nombre = (formulario.nombre || '').trim();
        const coberturas = this.coberturasMarcadasFormulario(formulario);
        const deduciblesCobertura = this.obtenerDeduciblesDesdeContenedor(formulario);
        const configuracionEnfermedadesGraves = this.obtenerConfiguracionEnfermedadesGravesDesdeContenedor(formulario);
        if (!plan || !nombre || coberturas.length === 0) {
            this.ui.mostrarToast('Indica el nombre y selecciona al menos una cobertura.', 'warning');
            return;
        }

        const nuevosCodigos = [...new Set(coberturas.map(cobertura => cobertura.codigo))].sort();
        if (nuevosCodigos.includes(COBERTURA_RENTA_INCAPACIDAD) && !DEDUCIBLES_RENTA_INCAPACIDAD.includes(deduciblesCobertura[COBERTURA_RENTA_INCAPACIDAD])) {
            this.ui.mostrarToast('Selecciona el deducible para Renta por incapacidad por accidente y enfermedad.', 'warning');
            return;
        }
        if (this.obtenerCoberturasExcluyentesSeleccionadas(nuevosCodigos).length > 0) {
            this.ui.mostrarToast('El plan contiene coberturas excluyentes. Retira una de las coberturas incompatibles.', 'warning');
            return;
        }
        const nuevoSubgrupoId = this.generarIdSubgrupo(nuevosCodigos);
        if (!estado.subgrupos.some(subgrupo => subgrupo.id === nuevoSubgrupoId)) {
            estado.subgrupos.push({ id: nuevoSubgrupoId, nombre: `Grupo ${estado.subgrupos.length + 1}`, coberturas: nuevosCodigos, asegurados: [] });
        }
        coberturas.forEach(cobertura => {
            if (!estado.coberturasCatalogo.some(item => item.codigo === cobertura.codigo)) {
                estado.coberturasCatalogo.push({ ...cobertura, tasaBase: TASA_BASE_SISTEMA, obligatoria: cobertura.codigo === 'WET' });
            }
        });

        const valoresActualizados = Object.fromEntries(nuevosCodigos.map(codigo => [codigo, plan['valoresCobertura']?.[codigo] || 0]));
        plan.nombre = nombre;
        plan.subgrupoId = nuevoSubgrupoId;
        plan['valoresCobertura'] = valoresActualizados;
        plan['deduciblesCobertura'] = nuevosCodigos.includes(COBERTURA_RENTA_INCAPACIDAD) ? deduciblesCobertura : {};
        plan['factoresEnfermedadesGraves'] = configuracionEnfermedadesGraves.factoresEnfermedadesGraves;
        plan['cancerInSituPorCobertura'] = configuracionEnfermedadesGraves.cancerInSituPorCobertura;
        plan['asegurados'].forEach((aseguradoId: string) => {
            const asegurado = estado.asegurados.find(item => item.id === aseguradoId);
            if (!asegurado) return;
            asegurado['subgrupoId'] = nuevoSubgrupoId;
            asegurado['coberturas'] = (asegurado['coberturas'] || []).filter((cobertura: any) => nuevosCodigos.includes(cobertura.codigo));
            coberturas.forEach(cobertura => {
                if (!asegurado['coberturas'].some((item: any) => item.codigo === cobertura.codigo)) {
                    asegurado['coberturas'].push({ codigo: cobertura.codigo, codigoAmparo: cobertura.codigoAmparo, nombre: cobertura.nombre, activa: true, valorAsegurado: 0, tasa: TASA_BASE_SISTEMA, prima: 0 });
                }
            });
        });

        this.recalcularPrimaPlan(plan);
        this.store.guardarEstado();
        this.cerrarModalEditarPlan();
        this.subgrupoActivoEnPlanes = nuevoSubgrupoId;
        this.store.notificarCambio(); // renderizarTablaCoberturas + renderizarPlanesSubgrupoTabs + renderizarTablaCalculos
        this.ui.mostrarToast('Plan actualizado.', 'success');
    }

    /* ============================================================
       SECCIÓN 16: GESTIÓN DE SUBGRUPOS (explícita)
       ============================================================ */

    generarIdSubgrupo(coberturaCodes: string[]): string {
        // Ordenar códigos alfabéticamente → determinístico
        return [...coberturaCodes].sort().join('-');
    }

    /** Lógica de renderizarListaSubgruposConfig. */
    get listaSubgruposConfigVista(): SubgrupoConfigVista[] {
        const estado = this.estado;
        return estado.subgrupos.map(sg => ({
            subgrupo: sg,
            numAsegurados: estado.asegurados.filter(a => a['subgrupoId'] === sg.id).length,
            numPlanes: estado.planes.filter(p => p.subgrupoId === sg.id).length,
            chips: (sg['coberturas'] || []).map((cod: string) => ({
                codigo: cod,
                obligatoria: Boolean(estado.coberturasCatalogo.find(c => c.codigo === cod)?.obligatoria)
            }))
        }));
    }

    /* ---- Modal: crear subgrupo ---- */

    abrirModalCrearSubgrupo(): void {
        const seleccion: Record<string, boolean> = {};
        this.estado.coberturasCatalogo.forEach(cob => { seleccion[cob.codigo] = Boolean(cob.obligatoria); });
        this.seleccionSubgrupo = seleccion;
        this.modalCrearSubgrupoVisible = true;
    }

    /** Clic sobre un ítem del grid (las obligatorias no se pueden cambiar). */
    alternarCoberturaSubgrupo(codigo: string): void {
        const cob = this.estado.coberturasCatalogo.find(item => item.codigo === codigo);
        if (cob?.obligatoria) return;
        this.seleccionSubgrupo[codigo] = !this.seleccionSubgrupo[codigo];
    }

    private get codigosSubgrupoSeleccionados(): string[] {
        return this.estado.coberturasCatalogo.map(cob => cob.codigo).filter(codigo => this.seleccionSubgrupo[codigo]);
    }

    /** `#previewSubgrupoId` (actualizarPreviewSubgrupoId). */
    get previewSubgrupoId(): string {
        const codes = this.codigosSubgrupoSeleccionados;
        return codes.length > 0 ? this.generarIdSubgrupo(codes) : '—';
    }

    /** `#previewSubgrupoExiste` */
    get previewSubgrupoExiste(): string {
        const codes = this.codigosSubgrupoSeleccionados;
        const id = codes.length > 0 ? this.generarIdSubgrupo(codes) : '—';
        return this.estado.subgrupos.some(sg => sg.id === id) ? '⚠ Este subgrupo ya existe' : '';
    }

    cerrarModalCrearSubgrupo(): void {
        this.modalCrearSubgrupoVisible = false;
    }

    confirmarCrearSubgrupo(): void {
        const codes = this.codigosSubgrupoSeleccionados;

        if (codes.length === 0) {
            this.ui.mostrarToast('Selecciona al menos una cobertura', 'warning');
            return;
        }

        const id = this.generarIdSubgrupo(codes);

        if (this.estado.subgrupos.some(sg => sg.id === id)) {
            this.ui.mostrarToast(`El subgrupo ${id} ya existe`, 'warning');
            return;
        }

        const numero = this.estado.subgrupos.length + 1;
        const subgrupo = {
            id,
            nombre: `Subgrupo ${numero}`,
            coberturas: codes.sort(),
            asegurados: []
        };

        this.estado.subgrupos.push(subgrupo);
        this.store.guardarEstado();
        this.cerrarModalCrearSubgrupo();
        this.actualizarSelectoresSubgrupos();
        this.store.notificarCambio();
        this.ui.mostrarToast(`Subgrupo ${id} creado`, 'success');
    }

    eliminarSubgrupo(id: string): void {
        const asignados = this.estado.asegurados.filter(a => a['subgrupoId'] === id).length;
        const planes = this.estado.planes.filter(p => p.subgrupoId === id).length;

        if (asignados > 0 || planes > 0) {
            this.ui.mostrarConfirmacionCotizador({
                titulo: 'Eliminar subgrupo',
                mensaje: `Este subgrupo tiene ${asignados} asegurado(s) y ${planes} plan(es). ¿Eliminar de todas formas? Los asegurados quedarán sin subgrupo.`,
                textoConfirmar: 'Eliminar',
                accion: () => this.confirmarEliminarSubgrupo(id)
            });
            return;
        }

        this.confirmarEliminarSubgrupo(id);
    }

    confirmarEliminarSubgrupo(id: string): void {
        // Des-asignar asegurados
        this.estado.asegurados.forEach(a => {
            if (a['subgrupoId'] === id) { a['subgrupoId'] = null; a['planId'] = null; }
        });

        // Eliminar planes
        this.estado.planes = this.estado.planes.filter(p => p.subgrupoId !== id);

        // Eliminar subgrupo
        this.estado.subgrupos = this.estado.subgrupos.filter(sg => sg.id !== id);

        this.store.guardarEstado();
        this.actualizarSelectoresSubgrupos();
        this.asegurarSubgrupoActivoEnPlanes();
        this.store.notificarCambio();
        this.ui.mostrarToast('Subgrupo eliminado', 'success');
    }

    /* ---- Helpers para actualizar selectores en otras pantallas ---- */

    /**
     * Selector de asignación masiva (Step 4): conserva la selección solo si el subgrupo aún existe.
     * La visibilidad de la barra de asignación masiva es `barraAsignacionMasivaVisible`.
     */
    actualizarSelectoresSubgrupos(): void {
        if (!this.estado.subgrupos.some(sg => sg.id === this.subgrupoMasivoId)) this.subgrupoMasivoId = '';
    }

    /** `#barraAsignacionMasiva` visible si hay subgrupos. */
    get barraAsignacionMasivaVisible(): boolean {
        return this.estado.subgrupos.length > 0;
    }

    /* ============================================================
       SECCIÓN 17: ASIGNACIÓN DE ASEGURADOS A SUBGRUPOS
       ============================================================ */

    asignarSubgrupoAAsegurado(aseguradoId: string, subgrupoId: string | null): void {
        const asegurado = this.estado.asegurados.find(a => a.id === aseguradoId);
        if (!asegurado) return;

        // Si cambia de subgrupo, quitar del plan anterior
        if (asegurado['subgrupoId'] !== subgrupoId) {
            if (asegurado['planId']) {
                const planAnterior = this.estado.planes.find(p => p.id === asegurado['planId']);
                if (planAnterior) planAnterior['asegurados'] = planAnterior['asegurados'].filter((id: string) => id !== aseguradoId);
                asegurado['planId'] = null;
            }
        }

        asegurado['subgrupoId'] = subgrupoId || null;
        this.store.guardarEstado();
        this.store.notificarCambio();
    }

    asignarTodosASubgrupo(): void {
        const subgrupoId = this.subgrupoMasivoId;
        if (!subgrupoId) {
            this.ui.mostrarToast('Selecciona un subgrupo primero', 'warning');
            return;
        }

        let asignados = 0;
        this.estado.asegurados.forEach(a => {
            if (!a['subgrupoId']) {
                a['subgrupoId'] = subgrupoId;
                asignados++;
            }
        });

        this.store.guardarEstado();
        this.store.notificarCambio();
        this.ui.mostrarToast(`${asignados} asegurado(s) asignado(s) al subgrupo ${subgrupoId}`, 'success');
    }

    asignarPorSalario(): void {
        if (this.estado.subgrupos.length === 0) {
            this.ui.mostrarToast('Crea al menos un subgrupo antes de asignar', 'warning');
            return;
        }

        // Opciones de rango de valor asegurado predeterminadas
        this.filasAsignacionSalario = RANGOS_ASIGNACION_SALARIO.map(rango => ({
            label: rango.label,
            maxValorAsegurado: rango.maxValorAsegurado,
            subgrupoId: ''
        }));
        this.modalAsignacionSalarioVisible = true;
    }

    cerrarModalAsignacionSalario(): void {
        this.modalAsignacionSalarioVisible = false;
    }

    ejecutarAsignacionPorSalario(): void {
        const reglas: { maxValorAsegurado: number; subgrupoId: string }[] = [];
        this.filasAsignacionSalario.forEach(fila => {
            const maxValorAsegurado = Number(fila.maxValorAsegurado) || Infinity;
            const subgrupoId = fila.subgrupoId;
            if (subgrupoId) reglas.push({ maxValorAsegurado, subgrupoId });
        });

        reglas.sort((a, b) => a.maxValorAsegurado - b.maxValorAsegurado);

        let asignados = 0;
        this.estado.asegurados.forEach(a => {
            const valorAsegurado = obtenerValorAseguradoBase(a);
            for (const regla of reglas) {
                if (valorAsegurado <= regla.maxValorAsegurado) {
                    a['subgrupoId'] = regla.subgrupoId;
                    a['planId'] = null;
                    asignados++;
                    break;
                }
            }
        });

        this.store.guardarEstado();
        this.store.notificarCambio();
        this.cerrarModalAsignacionSalario();
        this.ui.mostrarToast(`${asignados} asegurado(s) asignado(s) por rango de valor asegurado`, 'success');
    }

    /* ============================================================
       SECCIÓN 18: GESTIÓN DE PLANES Y VALORES ASEGURADOS
       ============================================================ */

    /** Tabs de `renderizarPlanesSubgrupoTabs`. */
    get tabsSubgrupoPlanes(): { id: string; etiqueta: string; activo: boolean }[] {
        return this.estado.subgrupos.map(sg => ({
            id: sg.id,
            etiqueta: `${sg.nombre} (${sg.id})`,
            activo: this.subgrupoActivoEnPlanes === sg.id
        }));
    }

    /** Efecto lateral de renderizarPlanesSubgrupoTabs: si no hay subgrupo activo, selecciona el primero. */
    asegurarSubgrupoActivoEnPlanes(): void {
        if (!this.subgrupoActivoEnPlanes && this.estado.subgrupos.length > 0) {
            this.seleccionarSubgrupoParaPlanes(this.estado.subgrupos[0].id);
        }
    }

    seleccionarSubgrupoParaPlanes(subgrupoId: string): void {
        // Los botones #btnAgregarPlan / #btnPlanPorSalario se muestran cuando `subgrupoActivoEnPlanes` tiene valor.
        this.subgrupoActivoEnPlanes = subgrupoId;
    }

    /** Lógica de renderizarPlanesWorkspace; null si el subgrupo no existe. */
    obtenerWorkspacePlanes(subgrupoId: string | null = this.subgrupoActivoEnPlanes): WorkspacePlanesVista | null {
        const subgrupo = this.estado.subgrupos.find(sg => sg.id === subgrupoId);
        if (!subgrupo) return null;

        const coberturas: string[] = subgrupo['coberturas'] || [];
        const asignados = this.estado.asegurados.filter(a => a['subgrupoId'] === subgrupoId).length;
        const planes = this.estado.planes.filter(p => p.subgrupoId === subgrupoId);

        return {
            subgrupo,
            titulo: `${subgrupo.nombre} — ${subgrupo.id}`,
            subtitulo: `Coberturas: ${coberturas.join(', ')} | ${asignados} asegurado(s)`,
            columnas: coberturas.map(codigo => ({
                codigo,
                deducible: planes.length > 0 ? this.obtenerDeducibleCoberturaPlan(planes[0], codigo) : null
            })),
            filas: planes.map(plan => ({
                plan,
                valores: coberturas.map(codigo => ({ codigo, valor: plan['valoresCobertura']?.[codigo] || 0 })),
                numAsegurados: plan['asegurados']?.length || 0,
                primaTexto: formatearDinero(plan['primaTotal'] || 0)
            }))
        };
    }

    agregarPlanAlSubgrupo(): void {
        if (!this.subgrupoActivoEnPlanes) {
            this.ui.mostrarToast('Selecciona un subgrupo primero', 'warning');
            return;
        }

        const subgrupo = this.estado.subgrupos.find(sg => sg.id === this.subgrupoActivoEnPlanes);
        if (!subgrupo) return;

        if (subgrupo['coberturas'].includes(COBERTURA_RENTA_INCAPACIDAD)) {
            this.planPendienteDeducible = { tipo: 'subgrupo', subgrupoId: subgrupo.id };
            this.deducibleRentaIncapacidad = DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO;
            this.modalDeducibleRentaIncapacidadVisible = true;
            return;
        }
        this.crearPlanEnSubgrupo(subgrupo.id);
    }

    crearPlanEnSubgrupo(subgrupoId: string, deducible: string | null = null): void {
        const subgrupo = this.estado.subgrupos.find(sg => sg.id === subgrupoId);
        if (!subgrupo) return;

        // Valores por defecto (0)
        const valoresCobertura: Record<string, number> = {};
        subgrupo['coberturas'].forEach((cod: string) => { valoresCobertura[cod] = 0; });

        const plan = {
            id: generarUUID(),
            subgrupoId,
            nombre: this.siguienteNombrePlan(),
            valoresCobertura,
            deduciblesCobertura: deducible ? { [COBERTURA_RENTA_INCAPACIDAD]: deducible } : {},
            factoresEnfermedadesGraves: {},
            cancerInSituPorCobertura: {},
            asegurados: [],
            primaTotal: 0
        };

        this.estado.planes.push(plan);
        this.store.guardarEstado();
        this.store.notificarCambio();
        this.ui.mostrarToast(`Plan ${plan.nombre} creado`, 'success');
    }

    actualizarNombrePlan(planId: string, nombre: string): void {
        const plan = this.estado.planes.find(p => p.id === planId);
        if (plan) { plan.nombre = nombre; this.store.guardarEstado(); }
    }

    actualizarValorPlan(planId: string, coberturaCod: string, valor: any): void {
        const plan = this.estado.planes.find(p => p.id === planId);
        if (!plan) return;

        plan['valoresCobertura'][coberturaCod] = parseFloat(valor) || 0;

        // Recalcular prima del plan
        this.recalcularPrimaPlan(plan);
        this.store.notificarCambio(); // renderizarTablaCalculos + renderizarPlanesWorkspace
        this.store.guardarEstado();
    }

    recalcularPrimaPlan(plan: any): void {
        const subgrupo = this.estado.subgrupos.find(sg => sg.id === plan.subgrupoId);
        if (!subgrupo) return;

        const aseguradosPorId = new Map(this.estado.asegurados.map(item => [item.id, item]));
        this.sincronizarCoberturasPlan(plan, subgrupo, aseguradosPorId);
        this.calculo.conCacheCredibilidad(() => this.calculo.calcularPrimaPlanSincronizado(plan, aseguradosPorId));
    }

    sincronizarCoberturasPlan(plan: any, subgrupo: any, aseguradosPorId: Map<any, any>): void {
        plan.asegurados.forEach((asegId: string) => {
            const asegurado = aseguradosPorId.get(asegId);
            if (!asegurado) return;

            // Actualizar coberturas del asegurado con los valores del plan
            subgrupo.coberturas.forEach((cod: string) => {
                const cob = asegurado.coberturas.find((c: any) => c.codigo === cod);
                const valorConfiguradoPlan = Number(plan.valoresCobertura?.[cod]);
                if (cob) {
                    if (Number.isFinite(valorConfiguradoPlan) && valorConfiguradoPlan > 0) {
                        cob.valorAsegurado = valorConfiguradoPlan;
                    }
                    cob.activa = true;
                }
            });
        });
    }

    /** Delega en CalculoService (misma lógica). */
    calcularPrimaPlanSincronizado(plan: any, aseguradosPorId: Map<any, any>): void {
        this.calculo.calcularPrimaPlanSincronizado(plan, aseguradosPorId);
    }

    eliminarPlan(planId: string): void {
        this.ui.mostrarConfirmacionCotizador({
            titulo: 'Eliminar plan',
            mensaje: '¿Eliminar este plan? Los asegurados quedarán sin plan asignado.',
            textoConfirmar: 'Eliminar',
            accion: () => {
                const plan = this.estado.planes.find(p => p.id === planId);
                if (plan) {
                    plan['asegurados'].forEach((asegId: string) => {
                        const asegurado = this.estado.asegurados.find(a => a.id === asegId);
                        if (asegurado) asegurado['planId'] = null;
                    });
                }

                this.estado.planes = this.estado.planes.filter(p => p.id !== planId);
                this.store.guardarEstado();
                this.asegurarSubgrupoActivoEnPlanes();
                this.store.notificarCambio(); // renderizarPlanesWorkspace + renderizarTablaCoberturas + renderizarAsignacionPlanes
                this.ui.mostrarToast('Plan eliminado', 'success');
            }
        });
    }

    abrirAsignadorPlan(planId: string): void {
        const plan = this.estado.planes.find(p => p.id === planId);
        if (!plan) return;

        const aseguradosDelSubgrupo = this.estado.asegurados.filter(a => a['subgrupoId'] === plan.subgrupoId);
        if (aseguradosDelSubgrupo.length === 0) {
            this.ui.mostrarToast('No hay asegurados asignados a este subgrupo', 'warning');
            return;
        }

        // Asignar todos los asegurados del subgrupo sin plan a este plan
        let asignados = 0;
        aseguradosDelSubgrupo.forEach(a => {
            if (!a['planId']) {
                a['planId'] = planId;
                if (!plan['asegurados'].includes(a.id)) plan['asegurados'].push(a.id);
                asignados++;
            }
        });

        this.recalcularPrimaPlan(plan);
        this.store.guardarEstado();
        this.store.notificarCambio();
        this.ui.mostrarToast(`${asignados} asegurado(s) asignado(s) al plan`, 'success');
    }

    /* ---- Plan por rango de valor asegurado ---- */

    /** Coberturas (códigos) del subgrupo del modal de plan por rango: columnas de la tabla. */
    get coberturasPlanSalario(): string[] {
        return this.estado.subgrupos.find(sg => sg.id === this.planSalarioSubgrupoActivo)?.['coberturas'] || [];
    }

    abrirModalPlanSalario(): void {
        if (!this.subgrupoActivoEnPlanes) return;
        this.planSalarioSubgrupoActivo = this.subgrupoActivoEnPlanes;

        const subgrupo = this.estado.subgrupos.find(sg => sg.id === this.subgrupoActivoEnPlanes);
        if (!subgrupo) return;

        this.filasPlanSalario = [];
        // Agregar dos filas por defecto
        this.agregarFilaPlanSalario();
        this.agregarFilaPlanSalario();

        this.modalPlanSalarioVisible = true;
    }

    cerrarModalPlanSalario(): void {
        this.modalPlanSalarioVisible = false;
    }

    agregarFilaPlanSalario(): void {
        const subgrupo = this.estado.subgrupos.find(sg => sg.id === this.planSalarioSubgrupoActivo);
        if (!subgrupo) return;

        const valores: Record<string, number | null> = {};
        subgrupo['coberturas'].forEach((cod: string) => { valores[cod] = null; });
        this.filasPlanSalario.push({ maxValorAsegurado: null, valores });
    }

    /** Equivale a `this.closest('tr').remove()` del botón ✕. */
    quitarFilaPlanSalario(indice: number): void {
        this.filasPlanSalario.splice(indice, 1);
    }

    ejecutarPlanPorSalario(): void {
        const estado = this.estado;
        const subgrupo = estado.subgrupos.find(sg => sg.id === this.planSalarioSubgrupoActivo);
        if (!subgrupo) return;

        const reglas: { maxValorAsegurado: number; valoresCobertura: Record<string, number> }[] = [];

        this.filasPlanSalario.forEach(fila => {
            const maxValorAsegurado = parseFloat(fila.maxValorAsegurado as any) || 0;
            // En app.js la validación usa la variable inexistente `maxSal`; la intención es esta.
            if (maxValorAsegurado <= 0) return;

            const vals: Record<string, number> = {};
            Object.keys(fila.valores).forEach(cod => {
                vals[cod] = parseFloat(fila.valores[cod] as any) || 0;
            });

            reglas.push({ maxValorAsegurado, valoresCobertura: vals });
        });

        if (reglas.length === 0) {
            this.ui.mostrarToast('Define al menos un rango de valor asegurado mayor a 0', 'warning');
            return;
        }

        reglas.sort((a, b) => a.maxValorAsegurado - b.maxValorAsegurado);

        // Eliminar planes existentes del subgrupo
        const planesAnteriores = estado.planes.filter(p => p.subgrupoId === this.planSalarioSubgrupoActivo);
        const deducibleRentaIncapacidad = subgrupo['coberturas'].includes(COBERTURA_RENTA_INCAPACIDAD)
            ? this.obtenerDeducibleCoberturaPlan(planesAnteriores[0], COBERTURA_RENTA_INCAPACIDAD)
            : null;
        if (subgrupo['coberturas'].includes(COBERTURA_RENTA_INCAPACIDAD) && !DEDUCIBLES_RENTA_INCAPACIDAD.includes(deducibleRentaIncapacidad as string)) {
            this.ui.mostrarToast('Edita el plan y selecciona el deducible antes de crear planes por rango.', 'warning');
            return;
        }
        planesAnteriores.forEach(p => {
            p['asegurados'].forEach((id: string) => {
                const a = estado.asegurados.find(x => x.id === id);
                if (a) a['planId'] = null;
            });
        });
        estado.planes = estado.planes.filter(p => p.subgrupoId !== this.planSalarioSubgrupoActivo);

        // Crear planes por rango y asignar asegurados
        const aseguradosDelSubgrupo = estado.asegurados.filter(a => a['subgrupoId'] === this.planSalarioSubgrupoActivo);

        const planesCreados: any[] = reglas.map((regla, i) => ({
            id: generarUUID(),
            subgrupoId: this.planSalarioSubgrupoActivo,
            nombre: `Plan ${i + 1} (≤ ${formatearDinero(regla.maxValorAsegurado)})`,
            valoresCobertura: regla.valoresCobertura,
            deduciblesCobertura: deducibleRentaIncapacidad ? { [COBERTURA_RENTA_INCAPACIDAD]: deducibleRentaIncapacidad } : {},
            asegurados: [],
            primaTotal: 0
        }));

        // Asignar asegurados a planes según su valor asegurado de Vida
        aseguradosDelSubgrupo.forEach(a => {
            const valorAsegurado = obtenerValorAseguradoBase(a);
            let planAsignado = planesCreados[planesCreados.length - 1]; // último plan para los que superen todos los rangos
            for (const plan of planesCreados) {
                const maxValor = reglas[planesCreados.indexOf(plan)].maxValorAsegurado;
                if (valorAsegurado <= maxValor) { planAsignado = plan; break; }
            }
            a['planId'] = planAsignado.id;
            planAsignado.asegurados.push(a.id);
        });

        // Calcular primas
        planesCreados.forEach(p => this.recalcularPrimaPlan(p));

        estado.planes.push(...planesCreados);
        this.store.guardarEstado();
        this.store.notificarCambio();
        this.cerrarModalPlanSalario();
        this.ui.mostrarToast(`${planesCreados.length} plan(es) creado(s) por rango de valor asegurado`, 'success');
    }

    /* ============================================================
       Auxiliares internos
       ============================================================ */

    private crearFormularioPlanVacio(): FormularioPlan {
        return {
            visible: false,
            nombre: '',
            seleccion: {},
            deducible: DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO,
            factorEG: {},
            cancerInSitu: {}
        };
    }

    /** Coberturas marcadas en el formulario, en el orden en que se muestran (`input:checked`). */
    private coberturasMarcadasFormulario(formulario: FormularioPlan): any[] {
        return this.coberturasFormularioPlan.filter(cobertura => formulario.seleccion[cobertura.codigo]);
    }
}
