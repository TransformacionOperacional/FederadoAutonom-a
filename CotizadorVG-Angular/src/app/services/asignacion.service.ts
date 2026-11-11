import { inject, Injectable, Injector } from '@angular/core';
import {
    CONFIG,
    NOMBRES_PARENTESCO_RESTRICCION,
    REGISTROS_POR_PAGINA_MIN,
    TASA_BASE_SISTEMA
} from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService } from '../core/ui.service';
import {
    formatearDinero,
    formatearValorMonetario,
    generarUUID,
    normalizarTexto,
    obtenerValorAseguradoBase,
    obtenerValorMonetario
} from '../core/utils';
import { AseguradoService } from './asegurado.service';
import { CalculoService } from './calculo.service';
import { PlanService } from './plan.service';

/* ============================================================
   Modelos de datos para las plantillas (paso 4 y sus modales)
   ============================================================ */

export interface OpcionPlanAsignacion {
    id: string;
    nombre: string;
}

/** Fila de "Planes base" (`#tbody-rangos-planes`). */
export interface FilaPlanBaseAsignacion {
    plan: any;
    coberturas: string;
    edadMaxima: string;
}

/** Fila de "Planes asignados" (`#tbody-planes-asignados`). */
export interface FilaPlanAsignadoVista {
    plan: any;
    nombre: string;
    /** true => se pinta el botón `i` (`.plan-restriccion-info`) que abre modalRestriccionPlan. */
    tieneRestricciones: boolean;
    coberturas: string;
    valorVida: string;
    numAsegurados: number;
    edadMaxima: string;
}

/** Fila de la tabla de asignación manual (`#tbody-asignacion-planes`). */
export interface FilaAsignacionPlan {
    asegurado: any;
    seleccionado: boolean;
    documento: string;
    edad: string;
    parentesco: string;
    grupo: string;
    valorTexto: string;
    /** Opciones del selector de plan de esta fila (excluye planes solo-familiares para Afiliados principales). */
    opcionesPlanes: OpcionPlanAsignacion[];
}

/** Lo que renderizarAsignacionPlanes / renderizarFilasAsignacionPlanes escribían en el DOM. */
export interface VistaAsignacionPlanes {
    /** estado.planes.length === 0 */
    sinPlanes: boolean;
    /** `#btnReiniciarAsignacion[disabled]` */
    reiniciarDeshabilitado: boolean;
    planesBase: FilaPlanBaseAsignacion[];
    planesAsignados: FilaPlanAsignadoVista[];
    opcionesPlanes: OpcionPlanAsignacion[];
    opcionesParentesco: string[];
    opcionesGrupo: string[];
    filas: FilaAsignacionPlan[];
    /** Texto de la fila vacía de la tabla manual; '' si hay filas. */
    mensajeVacioAsignacion: string;
    /** `#paginacionAsignacion[hidden]` */
    ocultarPaginacion: boolean;
    textoInfo: string;
    textoPagina: string;
    enPrimera: boolean;
    enUltima: boolean;
    /** `#contadorSeleccionAsignacion` */
    textoContador: string;
    /** `#btnReasignarSeleccionados` habilitado */
    haySeleccion: boolean;
    /** `#seleccionarTodosAsignacion` checked / indeterminate */
    todosMarcados: boolean;
    algunosMarcados: boolean;
}

/** Un bloque `<p>` del detalle de restricciones (modalRestriccionPlan). */
export interface DetalleRestriccionVista {
    motivo: string;
    detalle: string;
}

export interface FiltroEdadAsignacion {
    modo: 'rango' | 'exacta';
    min: number;
    max: number;
}

@Injectable({ providedIn: 'root' })
export class AsignacionService {
    private store = inject(CotizadorStore);
    private ui = inject(UiService);
    private injector = inject(Injector);

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get calculo() { return this.injector.get(CalculoService); }
    private get planService() { return this.injector.get(PlanService); }
    private get aseguradoService() { return this.injector.get(AseguradoService); }

    private get estado(): any { return this.store.estado; }

    /* ============================================================
       Estado de UI del Paso 4 (variables `let`/`const` de módulo del app.js original)
       ============================================================ */

    readonly seleccionAsignacionIds = new Set<string>();
    filtroEdadAsignacion: FiltroEdadAsignacion | null = null;
    paginaAsignacion = 1;
    registrosPorPaginaAsignacion = REGISTROS_POR_PAGINA_MIN;

    /* ---- Filtros de la tabla de asignación manual (`#filtroAsignacion*`) ---- */
    filtroAsignacionDocumento = '';
    filtroAsignacionParentesco = '';
    filtroAsignacionGrupo = '';
    filtroAsignacionValor = '';
    filtroAsignacionPlan = '';

    /** Texto digitado en los campos "desde"/"hasta" de los planes base: clave `${planId}|${limite}`. */
    valoresRangoFormulario: Record<string, string> = {};
    /** Campos con la clase `.rango-plan-error`: clave `${planId}|${limite}`. */
    readonly camposRangoError = new Set<string>();
    /** Cambia en cada renderizarAsignacionPlanes: la plantilla lo usa en `track` para recrear los inputs de rango. */
    generacionRangos = 0;

    /* ---- Modal de alerta (modalAlertaRango) ---- */
    modalAlertaRangoVisible = false;
    tituloAlertaRango = '';
    mensajeAlertaRango = '';
    /** Elemento al que se devuelve el foco al cerrar la alerta (`campoRangoConError`). */
    campoRangoConError: HTMLElement | null = null;

    /* ---- Modal de motivo del plan (modalRestriccionPlan) ---- */
    modalRestriccionPlanVisible = false;
    tituloRestriccionPlan = '';
    detalleRestriccionPlan: DetalleRestriccionVista[] = [];

    /* ---- Modal de filtro por edad (modalFiltroEdad) ---- */
    modalFiltroEdadVisible = false;
    edadFiltroUsarRango = false;
    edadFiltroExacta: number | string | null = null;
    edadFiltroMin = 0;
    edadFiltroMax = 100;

    /* ---- Modal de reasignación (modalReasignarSeleccionados) ---- */
    modalReasignarSeleccionadosVisible = false;
    planReasignacionSeleccionados = '';
    resumenReasignarSeleccionados = '';

    /* Caché del modelo de la vista (evita refiltrar miles de asegurados en cada ciclo de detección de cambios). */
    private revision = 0;
    private cacheVista: {
        clave: string;
        asegurados: any;
        planes: any;
        cantidadAsegurados: number;
        cantidadPlanes: number;
        modelo: VistaAsignacionPlanes;
    } | null = null;

    /* ============================================================
       Entrada al paso y notificación de cambios
       ============================================================ */

    /** Parte de `irAlPaso(4)`: `renderizarAsignacionPlanes()`. Lo invoca `ngOnInit` del componente y puede invocarlo FlujoService. */
    alEntrarAlPaso(): void {
        this.invalidarVistaAsignacion();
    }

    /**
     * Equivale a renderizarAsignacionPlanes() (las vistas se refrescan al leer el estado): descarta el
     * texto digitado en los rangos, recrea los inputs y avisa del cambio.
     */
    renderizarAsignacionPlanes(): void {
        this.invalidarVistaAsignacion();
        this.store.notificarCambio();
    }

    private invalidarVistaAsignacion(): void {
        this.generacionRangos++;
        this.valoresRangoFormulario = {};
        this.camposRangoError.clear();
        this.revision++;
    }

    /* ============================================================
       Modelos de la vista (renderizarAsignacionPlanes / renderizarFilasAsignacionPlanes)
       ============================================================ */

    get vistaAsignacion(): VistaAsignacionPlanes {
        const cache = this.cacheVista;
        const estado = this.estado;
        if (cache && cache.clave === this.claveVista() && cache.asegurados === estado.asegurados
            && cache.planes === estado.planes && cache.cantidadAsegurados === estado.asegurados.length
            && cache.cantidadPlanes === estado.planes.length) {
            return cache.modelo;
        }

        const modelo = this.construirVistaAsignacion();
        // La clave se calcula después de construir: la construcción normaliza filtros, página y selección.
        this.cacheVista = {
            clave: this.claveVista(),
            asegurados: estado.asegurados,
            planes: estado.planes,
            cantidadAsegurados: estado.asegurados.length,
            cantidadPlanes: estado.planes.length,
            modelo
        };
        return modelo;
    }

    private claveVista(): string {
        return [
            this.revision,
            this.store.version(),
            this.filtroAsignacionDocumento,
            this.filtroAsignacionParentesco,
            this.filtroAsignacionGrupo,
            this.filtroAsignacionValor,
            this.filtroAsignacionPlan,
            JSON.stringify(this.filtroEdadAsignacion),
            this.paginaAsignacion,
            this.registrosPorPaginaAsignacion,
            this.estado.poliza.modalidadPlan,
            this.seleccionAsignacionIds.size
        ].join('|');
    }

    private construirVistaAsignacion(): VistaAsignacionPlanes {
        const estado = this.estado;
        const hayPlanes = estado.planes.length > 0;
        const reiniciarDeshabilitado = this.actualizarEstadoBotonReiniciarAsignacion();
        const opcionesParentesco = this.actualizarOpcionesFiltroAsignacion(
            'filtroAsignacionParentesco',
            hayPlanes ? estado.asegurados.map((asegurado: any) => asegurado.tipoAsegurado) : []
        );
        const opcionesGrupo = this.actualizarOpcionesFiltroAsignacion(
            'filtroAsignacionGrupo',
            hayPlanes ? estado.asegurados.map((asegurado: any) => asegurado.grupo) : []
        );

        if (!hayPlanes) {
            const contador = this.actualizarContadorSeleccionAsignacion();
            return {
                sinPlanes: true,
                reiniciarDeshabilitado,
                planesBase: [],
                planesAsignados: [],
                opcionesPlanes: [],
                opcionesParentesco,
                opcionesGrupo,
                filas: [],
                mensajeVacioAsignacion: 'No hay planes disponibles para asignar.',
                ocultarPaginacion: true,
                textoInfo: '',
                textoPagina: '',
                enPrimera: true,
                enUltima: true,
                ...contador
            };
        }

        const planesBase = this.obtenerPlanesBase();
        // El resumen debe mostrar todos los planes que tengan asegurados: tanto
        // los planes base asignados directamente (por ejemplo, Plan A) como los
        // derivados por restricciones de edad o parentesco (por ejemplo, Plan B).
        const planesAsignados = estado.planes.filter((plan: any) => (plan.asegurados || []).length > 0);
        const opcionesPlanes: OpcionPlanAsignacion[] = estado.planes.map((plan: any) => ({
            id: plan.id,
            nombre: this.obtenerNombreCortoPlan(plan)
        }));
        if (!estado.planes.some((plan: any) => plan.id === this.filtroAsignacionPlan)) this.filtroAsignacionPlan = '';

        // --- renderizarFilasAsignacionPlanes ---
        const idsExistentes = new Set(estado.asegurados.map((asegurado: any) => asegurado.id));
        this.seleccionAsignacionIds.forEach(id => { if (!idsExistentes.has(id)) this.seleccionAsignacionIds.delete(id); });

        const filtrados = this.obtenerAseguradosAsignacionFiltrados();
        const totalPaginas = Math.max(1, Math.ceil(filtrados.length / this.registrosPorPaginaAsignacion));
        this.paginaAsignacion = Math.min(Math.max(1, this.paginaAsignacion), totalPaginas);
        const inicio = (this.paginaAsignacion - 1) * this.registrosPorPaginaAsignacion;
        const visibles = filtrados.slice(inicio, inicio + this.registrosPorPaginaAsignacion);

        const separarPrincipales = this.calculo.debeSepararPrincipalesDeFamiliares();
        const filas: FilaAsignacionPlan[] = visibles.map((asegurado: any) => ({
            asegurado,
            seleccionado: this.seleccionAsignacionIds.has(asegurado.id),
            documento: asegurado.numeroDocumento || '—',
            edad: String(asegurado.edad ?? '—'),
            parentesco: asegurado.tipoAsegurado || '—',
            grupo: asegurado.grupo || '—',
            valorTexto: formatearDinero(obtenerValorAseguradoBase(asegurado)),
            opcionesPlanes: estado.planes
                .filter((plan: any) => !(separarPrincipales && this.calculo.esAfiliadoPrincipal(asegurado) && this.calculo.esPlanSoloFamiliares(plan)))
                .map((plan: any) => ({ id: plan.id, nombre: this.obtenerNombreCortoPlan(plan) }))
        }));

        const info = filtrados.length === 0
            ? 'Sin registros'
            : `Mostrando ${inicio + 1}-${inicio + visibles.length} de ${filtrados.length}${filtrados.length !== estado.asegurados.length ? ` (filtrados de ${estado.asegurados.length})` : ''}`;
        const contador = this.actualizarContadorSeleccionAsignacion(filtrados);

        return {
            sinPlanes: false,
            reiniciarDeshabilitado,
            planesBase: planesBase.map((plan: any) => ({
                plan,
                coberturas: this.formatearCoberturasPlan(plan),
                edadMaxima: this.formatearEdadMaximaPlan(plan)
            })),
            planesAsignados: planesAsignados.map((plan: any) => ({
                plan,
                nombre: this.obtenerNombreCortoPlan(plan),
                tieneRestricciones: this.obtenerDetalleRestriccionesPlan(plan).length > 0,
                coberturas: this.formatearCoberturasPlan(plan),
                valorVida: formatearDinero(this.obtenerValorAseguradoVidaPlan(plan)),
                numAsegurados: (plan.asegurados || []).length,
                edadMaxima: this.formatearEdadMaximaPlan(plan)
            })),
            opcionesPlanes,
            opcionesParentesco,
            opcionesGrupo,
            filas,
            mensajeVacioAsignacion: visibles.length ? '' : 'No se encontraron asegurados con esos filtros.',
            ocultarPaginacion: estado.asegurados.length === 0,
            textoInfo: info,
            textoPagina: `P\u00e1gina ${this.paginaAsignacion} de ${totalPaginas}`,
            enPrimera: this.paginaAsignacion <= 1,
            enUltima: this.paginaAsignacion >= totalPaginas,
            ...contador
        };
    }

    private obtenerPlanesBase(): any[] {
        return this.estado.planes.filter((plan: any) => !plan.creadoPorAsignacionAutomatica
            && !plan.generadoPorParentesco
            && !plan.generadoPorEdad
            && !plan.generadoPorValorAsegurado);
    }

    /**
     * Calcula las opciones de un filtro de lista (parentesco/grupo) y descarta el valor seleccionado si ya
     * no existe entre las opciones. Equivale a actualizarOpcionesFiltroAsignacion(id, valores).
     */
    actualizarOpcionesFiltroAsignacion(filtro: 'filtroAsignacionParentesco' | 'filtroAsignacionGrupo', valores: any[]): string[] {
        const opciones = [...new Set(valores.map(valor => String(valor || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'));
        if (!opciones.includes(this[filtro])) this[filtro] = '';
        return opciones;
    }

    /* ============================================================
       Restricciones del plan (motivo del nuevo plan)
       ============================================================ */

    agregarDetalleRestriccionPlan(plan: any, detalle: any): void {
        if (!detalle.coberturasExcluidas.length) return;
        if (!Array.isArray(plan.detalleRestricciones)) plan.detalleRestricciones = [];
        const existente = plan.detalleRestricciones.find((item: any) =>
            item.tipo === detalle.tipo && item.parentesco === detalle.parentesco
        );
        if (existente) {
            const exclusiones = new Map(existente.coberturasExcluidas.map((cobertura: any) => [cobertura.codigo, cobertura]));
            detalle.coberturasExcluidas.forEach((cobertura: any) => exclusiones.set(cobertura.codigo, cobertura));
            existente.coberturasExcluidas = [...exclusiones.values()];
            return;
        }
        plan.detalleRestricciones.push(detalle);
    }

    /** Lógica de renderizarInfoRestriccionesPlan: true => mostrar el botón `i` junto al plan. */
    tieneInfoRestriccionesPlan(plan: any): boolean {
        return this.obtenerDetalleRestriccionesPlan(plan).length > 0;
    }

    /** Modelo de obtenerDetalleRestriccionesPlan (el original devolvía HTML; [] equivale a ''). */
    obtenerDetalleRestriccionesPlan(plan: any): DetalleRestriccionVista[] {
        const estado = this.estado;
        let detalleRestricciones = Array.isArray(plan.detalleRestricciones) ? plan.detalleRestricciones : [];
        if (detalleRestricciones.length === 0 && (plan.generadoPorEdad || plan.generadoPorParentesco)) {
            const planBase = estado.planes.find((item: any) => item.id === plan.planBaseId);
            if (planBase) {
                const coberturasPlan = new Set(this.planService.obtenerCoberturasPlan(plan).map((cobertura: any) => cobertura.codigo));
                const coberturasExcluidas = this.planService.obtenerCoberturasPlan(planBase)
                    .filter((cobertura: any) => !coberturasPlan.has(cobertura.codigo))
                    .map((cobertura: any) => ({
                        codigo: cobertura.codigo,
                        nombre: cobertura.nombre || cobertura.codigo,
                        edadMaxima: plan.generadoPorEdad ? this.obtenerEdadMaximaCobertura(cobertura) : null
                    }));
                detalleRestricciones = [
                    ...(plan.generadoPorEdad && coberturasExcluidas.length > 0
                        ? [{ tipo: 'edad', coberturasExcluidas }]
                        : []),
                    ...(plan.generadoPorParentesco && coberturasExcluidas.length > 0
                        ? [{
                            tipo: 'parentesco',
                            parentesco: plan.parentescoRestriccion,
                            coberturasExcluidas
                        }]
                        : [])
                ];
            }
        }
        if (detalleRestricciones.length === 0) return [];
        const asegurados = (plan.asegurados || [])
            .map((id: string) => estado.asegurados.find((asegurado: any) => asegurado.id === id))
            .filter(Boolean);
        return detalleRestricciones.map((detalle: any) => {
            const afectados = detalle.parentesco
                ? asegurados.filter((asegurado: any) => asegurado.tipoAsegurado === detalle.parentesco)
                : asegurados;
            const exclusiones = detalle.coberturasExcluidas.map((cobertura: any) =>
                `${cobertura.nombre}${Number.isFinite(cobertura.edadMaxima) ? ` (edad máxima: ${cobertura.edadMaxima} años)` : ''}`
            ).join(', ');
            const motivo = detalle.tipo === 'edad'
                ? 'Restricción por edad'
                : `Restricción por parentesco: ${NOMBRES_PARENTESCO_RESTRICCION[detalle.parentesco] || detalle.parentesco}`;
            return {
                motivo,
                detalle: `Coberturas excluidas: ${exclusiones}.${afectados.length ? ` Personas afectadas: ${afectados.length}.` : ''}`
            };
        });
    }

    abrirModalRestriccionPlan(planId: string): void {
        const plan = this.estado.planes.find((item: any) => item.id === planId);
        if (!plan) return;

        this.tituloRestriccionPlan = `Motivo del nuevo plan: ${this.obtenerNombreCortoPlan(plan)}`;
        this.detalleRestriccionPlan = this.obtenerDetalleRestriccionesPlan(plan);
        this.modalRestriccionPlanVisible = true;
    }

    cerrarModalRestriccionPlan(): void {
        this.modalRestriccionPlanVisible = false;
    }

    /* ============================================================
       Asignación de planes: filtros, paginación y selección
       ============================================================ */

    obtenerAseguradosAsignacionFiltrados(): any[] {
        const filtros = {
            documento: normalizarTexto(this.filtroAsignacionDocumento || ''),
            edad: this.filtroEdadAsignacion,
            parentesco: this.filtroAsignacionParentesco || '',
            grupo: this.filtroAsignacionGrupo || '',
            valor: String(this.filtroAsignacionValor || '').replace(/\D/g, ''),
            planId: this.filtroAsignacionPlan || ''
        };
        return this.estado.asegurados.filter((asegurado: any) =>
            (!filtros.documento || normalizarTexto(asegurado.numeroDocumento || '').includes(filtros.documento))
            && (!filtros.edad || (Number.isFinite(Number(asegurado.edad)) && Number(asegurado.edad) >= filtros.edad.min && Number(asegurado.edad) <= filtros.edad.max))
            && (!filtros.parentesco || String(asegurado.tipoAsegurado || '').trim() === filtros.parentesco)
            && (!filtros.grupo || String(asegurado.grupo || '').trim() === filtros.grupo)
            && (!filtros.valor || String(obtenerValorAseguradoBase(asegurado)).includes(filtros.valor))
            && (!filtros.planId || (asegurado.planId || '') === filtros.planId));
    }

    irAPaginaAsignacion(pagina: number): void {
        this.paginaAsignacion = pagina;
        this.revision++;
    }

    /** Equivale al listener 'change' de `#registrosPorPaginaAsignacion` (configurarPaginacionAsignacion). Devuelve el valor normalizado. */
    cambiarRegistrosPorPaginaAsignacion(valor: any): number {
        this.registrosPorPaginaAsignacion = this.aseguradoService.normalizarRegistrosPorPagina(valor);
        this.irAPaginaAsignacion(1);
        return this.registrosPorPaginaAsignacion;
    }

    limpiarFiltrosAsignacionPlanes(): void {
        this.filtroAsignacionDocumento = '';
        this.filtroAsignacionParentesco = '';
        this.filtroAsignacionGrupo = '';
        this.filtroAsignacionValor = '';
        this.filtroAsignacionPlan = '';
        this.filtroEdadAsignacion = null;
        this.aplicarFiltrosAsignacionPlanes();
    }

    aplicarFiltrosAsignacionPlanes(reiniciarPagina = true): void {
        if (reiniciarPagina) this.paginaAsignacion = 1;
        this.revision++;
    }

    /** Texto de `#filtroAsignacionEdad`. */
    get textoFiltroEdadAsignacion(): string {
        const filtro = this.filtroEdadAsignacion;
        return !filtro ? ''
            : filtro.modo === 'exacta' ? `${filtro.min} años`
            : `${filtro.min} - ${filtro.max} años`;
    }

    /* ---- Modal de filtro por edad ---- */

    abrirModalFiltroEdad(): void {
        const filtro = this.filtroEdadAsignacion;
        const usaRango = filtro?.modo === 'rango';
        this.edadFiltroUsarRango = usaRango;
        this.edadFiltroExacta = filtro?.modo === 'exacta' ? filtro.min : null;
        this.edadFiltroMin = usaRango ? filtro!.min : 0;
        this.edadFiltroMax = usaRango ? filtro!.max : 100;
        this.actualizarSlidersFiltroEdad();
        this.alternarModoFiltroEdad();
        this.modalFiltroEdadVisible = true;
    }

    /** La plantilla deriva `disabled` y la clase `.deshabilitado` de `edadFiltroUsarRango`; no hay nada más que sincronizar. */
    alternarModoFiltroEdad(): void {
        // Sin DOM imperativo: ver `modal-filtro-edad.component.html`.
    }

    cerrarModalFiltroEdad(): void {
        this.modalFiltroEdadVisible = false;
    }

    actualizarSlidersFiltroEdad(origen?: 'min' | 'max'): void {
        let min = Number(this.edadFiltroMin);
        let max = Number(this.edadFiltroMax);
        if (min > max) {
            if (origen === 'min') max = min;
            else min = max;
        }
        this.edadFiltroMin = min;
        this.edadFiltroMax = max;
    }

    aplicarFiltroEdad(): void {
        if (this.edadFiltroUsarRango) {
            this.filtroEdadAsignacion = {
                modo: 'rango',
                min: Number(this.edadFiltroMin),
                max: Number(this.edadFiltroMax)
            };
        } else {
            const texto = String(this.edadFiltroExacta ?? '').trim();
            const edad = Number(texto);
            if (texto === '' || !Number.isFinite(edad) || edad < 0 || edad > 100) {
                this.ui.mostrarToast('Ingresa una edad entre 0 y 100.', 'warning');
                return;
            }
            this.filtroEdadAsignacion = { modo: 'exacta', min: Math.round(edad), max: Math.round(edad) };
        }
        this.cerrarModalFiltroEdad();
        this.aplicarFiltrosAsignacionPlanes();
    }

    quitarFiltroEdad(): void {
        this.filtroEdadAsignacion = null;
        this.cerrarModalFiltroEdad();
        this.aplicarFiltrosAsignacionPlanes();
    }

    /* ---- Selección ---- */

    alternarSeleccionAsignacion(aseguradoId: string, seleccionado: boolean): void {
        if (seleccionado) this.seleccionAsignacionIds.add(aseguradoId);
        else this.seleccionAsignacionIds.delete(aseguradoId);
        this.revision++;
    }

    seleccionarTodosAsignacionPlanes(seleccionar: boolean): void {
        this.obtenerAseguradosAsignacionFiltrados().forEach((asegurado: any) => {
            if (seleccionar) this.seleccionAsignacionIds.add(asegurado.id);
            else this.seleccionAsignacionIds.delete(asegurado.id);
        });
        this.revision++;
    }

    /** Lógica de actualizarContadorSeleccionAsignacion: devuelve lo que se pintaba en el contador, el botón y el checkbox "todos". */
    actualizarContadorSeleccionAsignacion(filtrados: any[] = this.obtenerAseguradosAsignacionFiltrados()): Pick<VistaAsignacionPlanes, 'textoContador' | 'haySeleccion' | 'todosMarcados' | 'algunosMarcados'> {
        const seleccionados = this.seleccionAsignacionIds.size;
        const marcados = filtrados.filter((asegurado: any) => this.seleccionAsignacionIds.has(asegurado.id)).length;
        const todosMarcados = filtrados.length > 0 && marcados === filtrados.length;
        return {
            textoContador: `${seleccionados} seleccionado${seleccionados === 1 ? '' : 's'}`,
            haySeleccion: seleccionados > 0,
            todosMarcados,
            algunosMarcados: marcados > 0 && !todosMarcados
        };
    }

    /* ---- Reasignación de seleccionados ---- */

    /** Opciones del selector `#planReasignacionSeleccionados`. */
    get opcionesPlanesReasignacion(): OpcionPlanAsignacion[] {
        return this.estado.planes.map((plan: any) => ({ id: plan.id, nombre: this.obtenerNombreCortoPlan(plan) }));
    }

    abrirReasignacionSeleccionados(): void {
        const seleccionados = [...this.seleccionAsignacionIds];
        if (seleccionados.length === 0) return;

        this.planReasignacionSeleccionados = '';
        this.resumenReasignarSeleccionados = `Seleccionaste ${seleccionados.length} asegurado${seleccionados.length === 1 ? '' : 's'}. Selecciona el plan al que serán reasignados.`;
        this.modalReasignarSeleccionadosVisible = true;
    }

    cerrarModalReasignarSeleccionados(): void {
        this.modalReasignarSeleccionadosVisible = false;
    }

    confirmarReasignacionSeleccionados(): void {
        const planId = this.planReasignacionSeleccionados || '';
        const aseguradosIds = [...this.seleccionAsignacionIds];
        if (aseguradosIds.length === 0) {
            this.cerrarModalReasignarSeleccionados();
            return;
        }
        if (!planId) {
            this.ui.mostrarToast('Selecciona el plan de destino.', 'warning');
            return;
        }

        let reasignados = 0;
        let noElegibles = 0;
        aseguradosIds.forEach(aseguradoId => {
            if (this.asignarPlanAAsegurado(aseguradoId, planId, { renderizar: false, guardar: false, notificar: false })) reasignados++;
            else noElegibles++;
        });
        this.retirarPlanesDerivadosSinAsegurados();
        this.seleccionAsignacionIds.clear();
        this.store.guardarEstado();
        this.cerrarModalReasignarSeleccionados();
        this.renderizarAsignacionPlanes(); // + renderizarTablaCalculos
        const detalleNoElegibles = noElegibles > 0 ? ` ${noElegibles} no se reasignaron por superar la edad máxima del plan.` : '';
        this.ui.mostrarToast(`${reasignados} asegurado(s) reasignado(s).${detalleNoElegibles}`, noElegibles > 0 ? 'warning' : 'success');
    }

    /* ============================================================
       Utilidades de plan
       ============================================================ */

    obtenerNombreCortoPlan(plan: any): string {
        return String(plan.nombre || '').match(/^Plan\s+[A-Z]+/i)?.[0] || plan.nombre;
    }

    obtenerValorAseguradoVidaPlan(plan: any): number {
        return (plan.asegurados || []).reduce((total: number, aseguradoId: string) => {
            const asegurado = this.estado.asegurados.find((item: any) => item.id === aseguradoId);
            return total + (asegurado ? obtenerValorAseguradoBase(asegurado) : 0);
        }, 0);
    }

    esPlanDerivadoDeAsignacion(plan: any): boolean {
        return Boolean(
            plan.creadoPorAsignacionAutomatica
            || plan.generadoPorParentesco
            || plan.generadoPorEdad
            || plan.generadoPorValorAsegurado
        );
    }

    retirarPlanesDerivadosSinAsegurados(): void {
        this.estado.planes = this.estado.planes.filter((plan: any) =>
            !this.esPlanDerivadoDeAsignacion(plan) || (plan.asegurados || []).length > 0
        );
    }

    /* ============================================================
       Validación de rangos
       ============================================================ */

    private claveRango(planId: string, limite: string): string {
        return `${planId}|${limite}`;
    }

    /** Texto actual del campo "desde"/"hasta" de un plan base (lo digitado, o el valor guardado formateado). */
    valorCampoRango(plan: any, limite: 'desde' | 'hasta'): string {
        const clave = this.claveRango(plan.id, limite);
        if (clave in this.valoresRangoFormulario) return this.valoresRangoFormulario[clave];
        return formatearValorMonetario(limite === 'desde' ? plan.valorDesde : plan.valorHasta);
    }

    /** Campo del formulario de rangos (solo para devolver el foco desde la alerta). */
    private obtenerCampoRango(planId: string, limite: string): HTMLElement | null {
        return document.querySelector<HTMLElement>(`#tbody-rangos-planes input[data-plan-id="${planId}"][data-limite="${limite}"]`);
    }

    /** `oninput="formatearCampoMoneda(this); revisarRangosEnFormulario(this)"` de los campos de rango. */
    alEscribirRango(planId: string, limite: 'desde' | 'hasta', campo: HTMLInputElement): void {
        campo.value = formatearValorMonetario(obtenerValorMonetario(campo.value));
        this.valoresRangoFormulario[this.claveRango(planId, limite)] = campo.value;
        this.revisarRangosEnFormulario(campo);
    }

    revisarRangosEnFormulario(campoActivo: HTMLElement | null = null): { valido: boolean; mensaje: string; campoError: HTMLElement | null | undefined } {
        this.camposRangoError.clear();

        const rangos = this.obtenerPlanesBase().map((plan: any) => ({
            plan,
            desde: obtenerValorMonetario(this.valorCampoRango(plan, 'desde')),
            hasta: obtenerValorMonetario(this.valorCampoRango(plan, 'hasta'))
        })).filter((rango: any) => rango.desde !== null && rango.hasta !== null)
            .sort((a: any, b: any) => a.desde - b.desde);

        let mensaje = '';
        for (let indice = 0; indice < rangos.length; indice++) {
            const rango = rangos[indice];
            if (rango.desde > rango.hasta) {
                this.camposRangoError.add(this.claveRango(rango.plan.id, 'desde'));
                this.camposRangoError.add(this.claveRango(rango.plan.id, 'hasta'));
                mensaje = `${rango.plan.nombre}: el valor desde no puede ser mayor que el valor hasta.`;
                break;
            }
            const anterior = rangos[indice - 1];
            if (anterior && rango.desde <= anterior.hasta) {
                this.camposRangoError.add(this.claveRango(anterior.plan.id, 'hasta'));
                this.camposRangoError.add(this.claveRango(rango.plan.id, 'desde'));
                mensaje = `${rango.plan.nombre}: el valor desde debe ser mayor que el valor hasta de ${anterior.plan.nombre}.`;
                break;
            }
        }

        const claveActivo = campoActivo?.dataset
            ? this.claveRango(campoActivo.dataset['planId'] || '', campoActivo.dataset['limite'] || '')
            : '';
        const rangoConError = rangos.find((rango: any) => this.camposRangoError.has(this.claveRango(rango.plan.id, 'desde')));
        return {
            valido: !mensaje,
            mensaje,
            campoError: this.camposRangoError.has(claveActivo)
                ? campoActivo
                : rangoConError ? this.obtenerCampoRango(rangoConError.plan.id, 'desde') : undefined
        };
    }

    validarRangosPlanes(): { valido: boolean; mensaje?: string } {
        const rangos = this.estado.planes
            // Solo los planes base definen rangos. Los planes espejo creados por
            // asignaciones previas conservan el rango de origen y no pueden
            // participar en esta validación, porque generarían falsos cruces.
            .filter((plan: any) => !plan.creadoPorAsignacionAutomatica
                && !plan.generadoPorParentesco
                && !plan.generadoPorEdad
                && !plan.generadoPorValorAsegurado)
            .filter((plan: any) => plan.valorDesde !== null && plan.valorDesde !== undefined && plan.valorHasta !== null && plan.valorHasta !== undefined)
            .map((plan: any) => ({ nombre: plan.nombre, desde: plan.valorDesde, hasta: plan.valorHasta }))
            .sort((a: any, b: any) => a.desde - b.desde);

        for (let indice = 0; indice < rangos.length; indice++) {
            const rango = rangos[indice];
            if (rango.desde > rango.hasta) {
                return { valido: false, mensaje: `${rango.nombre}: el valor desde no puede ser mayor que el valor hasta.` };
            }
            const anterior = rangos[indice - 1];
            if (anterior && rango.desde <= anterior.hasta) {
                return { valido: false, mensaje: `${rango.nombre}: el valor desde debe ser mayor que $ ${anterior.hasta.toLocaleString('es-CO')} para no cruzarse con ${anterior.nombre}.` };
            }
        }
        return { valido: true };
    }

    validarPlanesBaseParaAsignacionAutomatica(): boolean {
        const planSinRango = this.obtenerPlanesBase().find((plan: any) =>
            plan.valorDesde === null || plan.valorDesde === undefined
            || plan.valorHasta === null || plan.valorHasta === undefined
        );
        if (planSinRango) {
            this.mostrarAlertaRango(
                `Diligencia los valores “desde” y “hasta” del ${planSinRango.nombre} antes de usar la asignación automática.`,
                null,
                'Rangos requeridos para la asignación automática'
            );
            return false;
        }
        return true;
    }

    validarAseguradosAsignadosParaCalculos(): boolean {
        const planesMezclados = this.calculo.obtenerPlanesConMezclaPrincipalFamiliares();
        if (planesMezclados.length > 0) {
            this.mostrarAlertaRango(
                `En pólizas Voluntarias o Mixtas los Afiliados principales no pueden compartir plan con otros parentescos. Revisa: ${planesMezclados.map((plan: any) => this.obtenerNombreCortoPlan(plan)).join(', ')}. Reasigna los asegurados o vuelve a ejecutar la asignación automática.`,
                null,
                'Plan con parentescos mezclados'
            );
            return false;
        }
        const sinPlan = this.estado.asegurados.filter((asegurado: any) => !asegurado.planId);
        if (sinPlan.length === 0) return true;

        const nombres = sinPlan.slice(0, 5)
            .map((asegurado: any) => `Asegurado con documento ${asegurado.numeroDocumento}`)
            .join(', ');
        const adicionales = sinPlan.length > 5 ? ` y ${sinPlan.length - 5} más` : '';
        this.mostrarAlertaRango(
            `No es posible ver los cálculos mientras existan asegurados sin plan asignado: ${nombres}${adicionales}. Asigna los planes faltantes o ajusta los rangos y vuelve a ejecutar la asignación automática.`,
            null,
            'Asegurados sin plan asignado'
        );
        return false;
    }

    /** `campo`: elemento que recupera el foco al cerrar la alerta (o null). */
    mostrarAlertaRango(mensaje: string, campo: HTMLElement | null, titulo = 'Revisa el rango de valor asegurado'): void {
        this.campoRangoConError = campo || null;
        this.tituloAlertaRango = titulo;
        this.mensajeAlertaRango = mensaje;
        this.modalAlertaRangoVisible = true;
    }

    cerrarAlertaRango(): void {
        this.modalAlertaRangoVisible = false;
        this.campoRangoConError?.focus();
        this.campoRangoConError = null;
    }

    /** Devuelve el valor de `#btnReiniciarAsignacion.disabled` (true = no hay nada que reiniciar). */
    actualizarEstadoBotonReiniciarAsignacion(): boolean {
        const estado = this.estado;
        const hayAsignaciones = estado.planes.some((plan: any) =>
            this.esPlanDerivadoDeAsignacion(plan) || (plan.asegurados || []).length > 0
        ) || estado.asegurados.some((asegurado: any) => asegurado.planId);
        return !hayAsignaciones;
    }

    reiniciarAsignacionAutomatica(mostrarConfirmacion = true): void {
        const estado = this.estado;
        const planesDerivados = estado.planes.filter((plan: any) => this.esPlanDerivadoDeAsignacion(plan));
        const hayAsignaciones = planesDerivados.length > 0
            || estado.planes.some((plan: any) => (plan.asegurados || []).length > 0)
            || estado.asegurados.some((asegurado: any) => asegurado.planId);
        if (!hayAsignaciones) {
            this.ui.mostrarToast('No hay planes asignados para reiniciar.', 'info');
            return;
        }

        estado.asegurados.forEach((asegurado: any) => {
            asegurado.planId = null;
            asegurado.subgrupoId = null;
        });
        estado.planes = estado.planes
            .filter((plan: any) => !this.esPlanDerivadoDeAsignacion(plan))
            .map((plan: any) => ({
                ...plan,
                asegurados: [],
                ...(mostrarConfirmacion ? { valorDesde: null, valorHasta: null } : {})
            }));
        const subgruposConPlan = new Set(estado.planes.map((plan: any) => plan.subgrupoId));
        estado.subgrupos = estado.subgrupos
            .filter((subgrupo: any) => subgruposConPlan.has(subgrupo.id))
            .map((subgrupo: any) => ({ ...subgrupo, asegurados: [] }));
        if (!estado.subgrupos.some((subgrupo: any) => subgrupo.id === this.planService.subgrupoActivoEnPlanes)) {
            this.planService.subgrupoActivoEnPlanes = null;
        }

        this.store.guardarEstado();
        this.planService.asegurarSubgrupoActivoEnPlanes(); // efecto de renderizarPlanesSubgrupoTabs
        this.renderizarAsignacionPlanes(); // + renderizarPlanesSubgrupoTabs + renderizarTablaCalculos
        if (mostrarConfirmacion) {
            this.ui.mostrarToast('Asignación reiniciada. Puedes configurar los planes nuevamente.', 'success');
        }
    }

    /** `onchange="actualizarRangoPlan(planId, limite, this.value, this)"` de los campos de rango. */
    actualizarRangoPlan(planId: string, limite: 'desde' | 'hasta', valor: string, campo: HTMLElement | null): void {
        const plan = this.estado.planes.find((item: any) => item.id === planId);
        if (!plan) return;
        const propiedad = limite === 'desde' ? 'valorDesde' : 'valorHasta';
        const valorAnterior = plan[propiedad];
        plan[propiedad] = obtenerValorMonetario(valor);
        const validacion = this.validarRangosPlanes();
        if (!validacion.valido) {
            plan[propiedad] = valorAnterior;
            const revision = this.revisarRangosEnFormulario(campo);
            this.mostrarAlertaRango(validacion.mensaje!, revision.campoError || campo);
            return;
        }
        this.revisarRangosEnFormulario();
        this.store.guardarEstado();
    }

    /* ============================================================
       Asignación de un asegurado a un plan
       ============================================================ */

    asignarPlanAAsegurado(aseguradoId: string, planId: string, opciones: { renderizar?: boolean; guardar?: boolean; notificar?: boolean } = {}): boolean {
        const { renderizar = true, guardar = true, notificar = true } = opciones;
        const estado = this.estado;
        const calculo = this.calculo;
        const asegurado = estado.asegurados.find((item: any) => item.id === aseguradoId);
        if (!asegurado) return false;
        let plan = estado.planes.find((item: any) => item.id === planId);
        if (plan && calculo.debeSepararPrincipalesDeFamiliares() && calculo.esAfiliadoPrincipal(asegurado) && calculo.esPlanSoloFamiliares(plan)) {
            // Un plan de familiares no admite Afiliados principales: se usa el plan
            // de origen del que fue derivado.
            const planSolicitado = plan;
            let planOrigen = plan;
            while (planOrigen && calculo.esPlanSoloFamiliares(planOrigen)) {
                const idBase = planOrigen.planBaseId;
                planOrigen = estado.planes.find((item: any) => item.id === idBase);
            }
            if (!planOrigen) {
                if (notificar) {
                    this.mostrarAlertaRango(
                        `${this.obtenerNombreCortoPlan(planSolicitado)} es un plan exclusivo para otros parentescos. En pólizas Voluntarias o Mixtas los Afiliados principales no pueden compartir plan con otros parentescos.`,
                        null,
                        'Plan no permitido para Afiliado principal'
                    );
                }
                return false;
            }
            if (notificar) {
                this.ui.mostrarToast(`${this.obtenerNombreCortoPlan(planSolicitado)} es solo para otros parentescos; el Afiliado principal se asignó a ${this.obtenerNombreCortoPlan(planOrigen)}.`, 'info');
            }
            plan = planOrigen;
        }
        if (plan) {
            const planOriginal = plan;
            const planConParentesco = this.crearPlanFiltradoPorParentesco(plan, asegurado.tipoAsegurado);
            plan = planConParentesco;
            const coberturasPlan = this.planService.obtenerCoberturasPlan(plan);
            const coberturasElegibles = coberturasPlan.filter((cobertura: any) => {
                const edadMaxima = this.obtenerEdadMaximaCobertura(cobertura);
                return edadMaxima === null || Number(asegurado.edad) <= edadMaxima;
            });
            if (coberturasElegibles.length === 0) {
                if (notificar) {
                    this.mostrarAlertaRango(
                        `El asegurado ${asegurado.numeroDocumento || ''} tiene ${asegurado.edad} años y no tiene coberturas habilitadas en ${plan.nombre}. No se realizó la asignación.`,
                        null,
                        'Restricción de edad para el plan'
                    );
                }
                this.retirarPlanesDerivadosSinAsegurados();
                if (renderizar) this.renderizarAsignacionPlanes();
                return false;
            }
            if (coberturasElegibles.length !== coberturasPlan.length) {
                plan = this.crearPlanElegiblePorEdad(plan, coberturasElegibles);
                if (notificar) {
                    const coberturasRetiradas = coberturasPlan
                        .filter((cobertura: any) => !coberturasElegibles.some((elegible: any) => elegible.codigo === cobertura.codigo))
                        .map((cobertura: any) => cobertura.nombre || cobertura.codigo);
                    this.ui.mostrarToast(`${plan.nombre} fue creado sin ${coberturasRetiradas.join(', ')} por restricción de edad.`, 'info');
                }
            }
            if (notificar && planConParentesco !== planOriginal) {
                this.ui.mostrarToast(`${plan.nombre} fue creado con las coberturas habilitadas para ${asegurado.tipoAsegurado}.`, 'info');
            }
        }
        estado.planes.forEach((item: any) => { item.asegurados = (item.asegurados || []).filter((id: string) => id !== aseguradoId); });
        asegurado.planId = plan?.id || null;
        if (plan) {
            plan.asegurados = [...new Set([...(plan.asegurados || []), aseguradoId])];
            asegurado.subgrupoId = plan.subgrupoId;
            this.sincronizarCoberturasAseguradoConPlan(asegurado, plan);
        }
        this.retirarPlanesDerivadosSinAsegurados();
        if (guardar) this.store.guardarEstado();
        if (renderizar) {
            this.renderizarAsignacionPlanes(); // + renderizarTablaCalculos
        }
        return true;
    }

    obtenerCoberturasPermitidasPorParentesco(coberturas: any[], tipoAsegurado: string): any[] {
        const habilitadas = CONFIG.COBERTURAS_HABILITADAS_POR_PARENTESCO[tipoAsegurado];
        if (habilitadas) {
            return coberturas.filter(cobertura => habilitadas.includes(cobertura.codigo));
        }

        const excluidas = CONFIG.COBERTURAS_EXCLUIDAS_POR_PARENTESCO[tipoAsegurado] || [];
        return coberturas.filter(cobertura => !excluidas.includes(cobertura.codigo));
    }

    crearPlanFiltradoPorParentesco(planBase: any, tipoAsegurado: string): any {
        const estado = this.estado;
        const calculo = this.calculo;
        const coberturasBase = this.planService.obtenerCoberturasPlan(planBase);
        const coberturasPermitidas = this.obtenerCoberturasPermitidasPorParentesco(coberturasBase, tipoAsegurado);
        const codigosPermitidosSet = new Set(coberturasPermitidas.map(cobertura => cobertura.codigo));
        const coberturasExcluidas = coberturasBase
            .filter((cobertura: any) => !codigosPermitidosSet.has(cobertura.codigo))
            .map((cobertura: any) => ({ codigo: cobertura.codigo, nombre: cobertura.nombre || cobertura.codigo }));
        const codigosBase = coberturasBase.map((cobertura: any) => cobertura.codigo).sort().join(',');
        const codigosPermitidos = coberturasPermitidas.map(cobertura => cobertura.codigo).sort().join(',');

        // En Voluntaria/Mixta los parentescos distintos de Afiliado principal siempre
        // van a un plan propio, aunque conserven las mismas coberturas del plan base.
        const separarFamiliares = calculo.debeSepararPrincipalesDeFamiliares() && tipoAsegurado !== 'Afiliado principal';
        if (codigosPermitidos === codigosBase && (!separarFamiliares || calculo.esPlanSoloFamiliares(planBase))) return planBase;

        // El parentesco únicamente define qué coberturas puede recibir la persona;
        // no define un plan. Reutilizamos el plan derivado si ya existe otro con
        // las mismas coberturas elegibles y los mismos valores de cobertura.
        const firmaValores = coberturasPermitidas
            .map(cobertura => `${cobertura.codigo}:${Number(planBase.valoresCobertura?.[cobertura.codigo]) || 0}`)
            .sort()
            .join('|');
        const planExistente = estado.planes.find((plan: any) =>
            plan.generadoPorParentesco
            && calculo.esPlanSoloFamiliares(plan) === separarFamiliares
            && this.planService.obtenerCoberturasPlan(plan).map((cobertura: any) => cobertura.codigo).sort().join(',') === codigosPermitidos
            && this.planService.obtenerCoberturasPlan(plan)
                .map((cobertura: any) => `${cobertura.codigo}:${Number(plan.valoresCobertura?.[cobertura.codigo]) || 0}`)
                .sort()
                .join('|') === firmaValores
        );
        if (planExistente) {
            const parentescos = new Set<string>(planExistente.parentescosRestriccion || [planExistente.parentescoRestriccion].filter(Boolean));
            parentescos.add(tipoAsegurado);
            planExistente.parentescosRestriccion = [...parentescos];
            this.agregarDetalleRestriccionPlan(planExistente, {
                tipo: 'parentesco',
                parentesco: tipoAsegurado,
                coberturasExcluidas
            });
            return planExistente;
        }

        const subgrupoId = this.planService.generarIdSubgrupo(coberturasPermitidas.map(cobertura => cobertura.codigo));
        if (!estado.subgrupos.some((subgrupo: any) => subgrupo.id === subgrupoId)) {
            estado.subgrupos.push({
                id: subgrupoId,
                nombre: `Grupo ${estado.subgrupos.length + 1}`,
                coberturas: coberturasPermitidas.map(cobertura => cobertura.codigo).sort(),
                asegurados: []
            });
        }

        const plan = {
            id: generarUUID(),
            subgrupoId,
            nombre: `${this.planService.siguienteNombrePlan()} — ${tipoAsegurado}`,
            planBaseId: planBase.id,
            generadoPorParentesco: true,
            soloFamiliares: separarFamiliares,
            generadoPorEdad: Boolean(planBase.generadoPorEdad),
            parentescoRestriccion: tipoAsegurado,
            parentescosRestriccion: [tipoAsegurado],
            valorDesde: planBase.valorDesde,
            valorHasta: planBase.valorHasta,
            valoresCobertura: Object.fromEntries(coberturasPermitidas.map(cobertura => [
                cobertura.codigo,
                planBase.valoresCobertura?.[cobertura.codigo] || 0
            ])),
            deduciblesCobertura: { ...planBase.deduciblesCobertura },
            factoresEnfermedadesGraves: { ...planBase.factoresEnfermedadesGraves },
            cancerInSituPorCobertura: { ...planBase.cancerInSituPorCobertura },
            detalleRestricciones: (planBase.detalleRestricciones || []).map((detalle: any) => ({
                ...detalle,
                coberturasExcluidas: detalle.coberturasExcluidas.map((cobertura: any) => ({ ...cobertura }))
            })),
            asegurados: [],
            primaTotal: 0
        };
        this.agregarDetalleRestriccionPlan(plan, {
            tipo: 'parentesco',
            parentesco: tipoAsegurado,
            coberturasExcluidas
        });
        estado.planes.push(plan);
        return plan;
    }

    sincronizarCoberturasAseguradoConPlan(asegurado: any, plan: any): void {
        const coberturasPlan = this.planService.obtenerCoberturasPlan(plan);
        const codigosPlan = new Set(coberturasPlan.map((cobertura: any) => cobertura.codigo));
        asegurado.coberturas = (asegurado.coberturas || []).filter((cobertura: any) => codigosPlan.has(cobertura.codigo));
        coberturasPlan.forEach((cobertura: any) => {
            if (!asegurado.coberturas.some((item: any) => item.codigo === cobertura.codigo)) {
                asegurado.coberturas.push({
                    codigo: cobertura.codigo,
                    codigoAmparo: cobertura.codigoAmparo,
                    nombre: cobertura.nombre,
                    activa: true,
                    valorAsegurado: 0,
                    tasa: TASA_BASE_SISTEMA,
                    prima: 0
                });
            }
        });
    }

    formatearCoberturasPlan(plan: any): string {
        const coberturas = this.planService.obtenerCoberturasPlan(plan);
        return coberturas.length > 0
            ? coberturas.map((cobertura: any) => cobertura.nombre || cobertura.codigo).join(', ')
            : 'Sin coberturas';
    }

    obtenerEdadMaximaCobertura(cobertura: any): number | null {
        const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
        const edadMaxima = this.estado.edadesMaximasPorCobertura?.[codigoAmparo];
        return Number.isFinite(edadMaxima) ? edadMaxima : null;
    }

    obtenerEdadMaximaPlan(plan: any): number | null {
        const edadesMaximas = this.planService.obtenerCoberturasPlan(plan)
            .map((cobertura: any) => this.obtenerEdadMaximaCobertura(cobertura))
            .filter((edad: number | null) => edad !== null) as number[];
        return edadesMaximas.length > 0 ? Math.min(...edadesMaximas) : null;
    }

    formatearEdadMaximaPlan(plan: any): string {
        const edadMaxima = this.obtenerEdadMaximaPlan(plan);
        return edadMaxima === null ? 'Sin información' : `${edadMaxima} años`;
    }

    crearPlanElegiblePorEdad(planBase: any, coberturasElegibles: any[]): any {
        const estado = this.estado;
        const codigos = coberturasElegibles.map(cobertura => cobertura.codigo).sort();
        const firmaCoberturas = codigos.join(',');
        const codigosElegibles = new Set(codigos);
        const coberturasExcluidas = this.planService.obtenerCoberturasPlan(planBase)
            .filter((cobertura: any) => !codigosElegibles.has(cobertura.codigo))
            .map((cobertura: any) => ({
                codigo: cobertura.codigo,
                nombre: cobertura.nombre || cobertura.codigo,
                edadMaxima: this.obtenerEdadMaximaCobertura(cobertura)
            }));
        const planExistente = estado.planes.find((plan: any) =>
            plan.generadoPorEdad
            && plan.planBaseId === planBase.id
            && this.planService.obtenerCoberturasPlan(plan).map((cobertura: any) => cobertura.codigo).sort().join(',') === firmaCoberturas
        );
        if (planExistente) {
            this.agregarDetalleRestriccionPlan(planExistente, { tipo: 'edad', coberturasExcluidas });
            return planExistente;
        }

        const subgrupoId = this.planService.generarIdSubgrupo(codigos);
        if (!estado.subgrupos.some((subgrupo: any) => subgrupo.id === subgrupoId)) {
            estado.subgrupos.push({ id: subgrupoId, nombre: `Grupo ${estado.subgrupos.length + 1}`, coberturas: codigos, asegurados: [] });
        }

        const plan = {
            id: generarUUID(),
            subgrupoId,
            nombre: `${this.planService.siguienteNombrePlan()} — coberturas por edad`,
            planBaseId: planBase.id,
            generadoPorEdad: true,
            soloFamiliares: this.calculo.esPlanSoloFamiliares(planBase),
            valorDesde: planBase.valorDesde,
            valorHasta: planBase.valorHasta,
            valoresCobertura: Object.fromEntries(codigos.map(codigo => [codigo, planBase.valoresCobertura?.[codigo] || 0])),
            deduciblesCobertura: { ...planBase.deduciblesCobertura },
            factoresEnfermedadesGraves: { ...planBase.factoresEnfermedadesGraves },
            cancerInSituPorCobertura: { ...planBase.cancerInSituPorCobertura },
            detalleRestricciones: (planBase.detalleRestricciones || []).map((detalle: any) => ({
                ...detalle,
                coberturasExcluidas: detalle.coberturasExcluidas.map((cobertura: any) => ({ ...cobertura }))
            })),
            asegurados: [],
            primaTotal: 0
        };
        this.agregarDetalleRestriccionPlan(plan, { tipo: 'edad', coberturasExcluidas });
        estado.planes.push(plan);
        return plan;
    }

    asignarAseguradoAPlanElegible(asegurado: any, plan: any): void {
        this.estado.planes.forEach((item: any) => { item.asegurados = (item.asegurados || []).filter((id: string) => id !== asegurado.id); });
        asegurado.planId = plan.id;
        asegurado.subgrupoId = plan.subgrupoId;
        plan.asegurados.push(asegurado.id);
        this.sincronizarCoberturasAseguradoConPlan(asegurado, plan);
    }

    /* ============================================================
       Asignación automática por rango de valor asegurado
       ============================================================ */

    asignarPlanesPorRango(): void {
        if (!this.validarPlanesBaseParaAsignacionAutomatica()) return;
        const validacion = this.validarRangosPlanes();
        if (!validacion.valido) {
            this.ui.mostrarToast(validacion.mensaje!, 'warning');
            return;
        }

        this.ui.ejecutarConCarga(
            this.estado.asegurados.length,
            'Asignando asegurados a los planes...',
            () => this.asignarPlanesPorRangoValidado()
        );
    }

    asignarPlanesPorRangoValidado(): void {
        const estado = this.estado;
        // La asignación automática siempre se calcula desde los planes base. Si
        // existe una ejecución anterior, se limpia en silencio para no conservar
        // planes espejo ni asignaciones desactualizadas entre ejecuciones.
        if (estado.planes.some((plan: any) => plan.creadoPorAsignacionAutomatica)) {
            this.reiniciarAsignacionAutomatica(false);
        }

        const idsPlanesAntesDeAsignar = new Set(estado.planes.map((plan: any) => plan.id));
        let asignados = 0;
        let planesPorEdadCreados = 0;
        let sinCoberturasElegibles = 0;
        const ajustesPorEdad: string[] = [];
        const planesElegibles = new Map<string, any>();
        estado.asegurados.forEach((asegurado: any) => {
            const valor = obtenerValorAseguradoBase(asegurado);
            const plan = estado.planes.find((item: any) => !item.generadoPorEdad && !item.generadoPorParentesco && !item.generadoPorValorAsegurado && !item.creadoPorAsignacionAutomatica
                &&
                (item.valorDesde === null || item.valorDesde === undefined || valor >= item.valorDesde)
                && (item.valorHasta === null || item.valorHasta === undefined || valor <= item.valorHasta)
            );
            if (plan) {
                const coberturasPlan = this.planService.obtenerCoberturasPlan(plan);
                const coberturasElegibles = coberturasPlan.filter((cobertura: any) => {
                    const edadMaxima = this.obtenerEdadMaximaCobertura(cobertura);
                    return edadMaxima === null || Number(asegurado.edad) <= edadMaxima;
                });
                if (coberturasElegibles.length === 0) {
                    sinCoberturasElegibles++;
                    ajustesPorEdad.push(`Asegurado con documento ${asegurado.numeroDocumento}: no tiene coberturas habilitadas.`);
                    return;
                }

                let planAsignado = plan;
                if (coberturasElegibles.length !== coberturasPlan.length) {
                    const coberturasRetiradas = coberturasPlan
                        .filter((cobertura: any) => !coberturasElegibles.some((elegible: any) => elegible.codigo === cobertura.codigo))
                        .map((cobertura: any) => cobertura.nombre || cobertura.codigo);
                    ajustesPorEdad.push(`Asegurado con documento ${asegurado.numeroDocumento}: se retiraron ${coberturasRetiradas.join(', ')}.`);
                    const llave = `${plan.id}:${coberturasElegibles.map((cobertura: any) => cobertura.codigo).sort().join(',')}`;
                    planAsignado = planesElegibles.get(llave);
                    if (!planAsignado) {
                        planAsignado = this.crearPlanElegiblePorEdad(plan, coberturasElegibles);
                        planesElegibles.set(llave, planAsignado);
                        planesPorEdadCreados++;
                    }
                }
                planAsignado = this.crearPlanFiltradoPorParentesco(planAsignado, asegurado.tipoAsegurado);
                this.asignarAseguradoAPlanElegible(asegurado, planAsignado);
                asignados++;
            }
        });
        estado.planes.forEach((plan: any) => {
            if (!idsPlanesAntesDeAsignar.has(plan.id)) plan.creadoPorAsignacionAutomatica = true;
        });
        // Los planes creados como paso intermedio por edad o parentesco se reemplazan
        // por su plan espejo de valor asegurado. No deben mostrarse si quedan vacíos.
        estado.planes = estado.planes.filter((plan: any) =>
            !plan.creadoPorAsignacionAutomatica || (plan.asegurados || []).length > 0
        );
        estado.planes.forEach((plan: any) => this.planService.recalcularPrimaPlan(plan));
        this.store.guardarEstado();
        this.planService.asegurarSubgrupoActivoEnPlanes(); // efecto de renderizarPlanesSubgrupoTabs
        this.renderizarAsignacionPlanes(); // + renderizarPlanesSubgrupoTabs + renderizarTablaCalculos
        const detalleEdad = planesPorEdadCreados > 0 ? ` Se crearon ${planesPorEdadCreados} plan(es) con coberturas elegibles por edad.` : '';
        const detalleSinCobertura = sinCoberturasElegibles > 0 ? ` ${sinCoberturasElegibles} asegurado(s) no tienen coberturas habilitadas para su edad.` : '';
        this.ui.mostrarToast(`${asignados} asegurado(s) asignado(s) por rango de valor asegurado.${detalleEdad}${detalleSinCobertura}`, sinCoberturasElegibles > 0 ? 'warning' : 'success');
        if (ajustesPorEdad.length > 0) {
            const detalle = ajustesPorEdad.slice(0, 5).join(' ');
            const adicionales = ajustesPorEdad.length > 5 ? ` Además, hay ${ajustesPorEdad.length - 5} caso(s) adicional(es).` : '';
            this.mostrarAlertaRango(
                `Se aplicaron restricciones de edad a ${ajustesPorEdad.length} asegurado(s). ${detalle}${adicionales}`,
                null,
                'Coberturas ajustadas por edad'
            );
        }
    }
}
