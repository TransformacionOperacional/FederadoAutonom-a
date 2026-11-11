import { inject, Injectable, Injector } from '@angular/core';
import {
    AGRUPACIONES_SINIESTROS,
    CONFIG,
    COBERTURA_RENTA_INCAPACIDAD,
    COBERTURAS_ENFERMEDADES_GRAVES,
    FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO,
    FACTOR_REFERENCIA_CANCER_IN_SITU,
    FACTORES_ENFERMEDADES_GRAVES,
    RECARGO_CANCER_IN_SITU,
    REGISTROS_POR_PAGINA_CALCULOS_MIN,
    REGISTROS_POR_PAGINA_MAX,
    TASA_BASE_SISTEMA,
    TASA_CANCER_IN_SITU,
} from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import {
    formatearDinero,
    generarUUID,
    normalizarCanalComercial,
    obtenerValorAseguradoBase,
} from '../core/utils';
import { AseguradoService } from './asegurado.service';
import { CatalogoService } from './catalogo.service';
import { PlanService } from './plan.service';

/* ============================================================
   Modelos de datos para la plantilla (paso 5 y resumen de credibilidad)
   ============================================================ */

export interface CeldaTexto {
    texto: string;
    negrita?: boolean;
}

export interface ResumenCredibilidadModelo {
    /** 'mensaje': solo se pinta `mensaje` (clase info-box). 'tabla': se pinta la tarjeta con la tabla. */
    tipo: 'mensaje' | 'tabla';
    mensaje?: string;
    titulo?: string;
    descripcion?: string;
    encabezados?: string[];
    filas?: { celdas: CeldaTexto[] }[];
}

export interface FilaTasaCobertura {
    codigo: string;
    nombre: string;
    /** `${nombre} (${codigo})` */
    etiqueta: string;
    valorAsegurado: string;
    tasaUnica: string;
    prima: string;
}

export interface TablaTasaCobertura {
    /** Texto de la etiqueta de alcance (p. ej. 'TODOS LOS PLANES'); '' si no aplica. */
    alcance: string;
    titulo: string;
    descripcion: string;
    /** Clase CSS adicional de la tarjeta ('tabla-tasa-plan' | 'tabla-tasa-poliza'). */
    clase: string;
    encabezados: string[];
    filas: FilaTasaCobertura[];
}

export interface CeldaCalculoCobertura {
    valorAsegurado: string;
    prima: string;
}

export interface FilaCalculoAsegurado {
    documento: string | number;
    edad: string | number;
    /** Una celda por cobertura del plan, en el mismo orden que `TarjetaCalculoPlan.coberturas`. */
    celdas: CeldaCalculoCobertura[];
}

export interface ColumnaCalculoCobertura {
    codigo: string;
    nombreComercial: string;
    encabezadoValor: string;
    encabezadoPrima: string;
}

export interface TarjetaCalculoPlan {
    /** Llave del plan: `plan.id` o 'sin-plan'. Es la llave de la paginación (`obtenerPaginaCalculosPlan`). */
    llave: string;
    plan: any | null;
    /** 'PLAN 1 DE 3' o 'SIN PLAN ASIGNADO' */
    secuencia: string;
    titulo: string;
    descripcion: string;
    cantidadAsegurados: number;
    primaTotalPlan: number;
    primaTotalPlanTexto: string;
    /** `Prima ${formaPago} por asegurado` */
    etiquetaPrimaPorAsegurado: string;
    primaPorAsegurado: string;
    /** false cuando no hay plan: solo se pinta el encabezado. */
    tieneTabla: boolean;
    coberturas: ColumnaCalculoCobertura[];
    /** Id del tbody del listado de asegurados (aria-controls del botón). */
    idListado: string;
    textoBotonVer: string;
    textoBotonOcultar: string;
    /** Todas las filas ya formateadas (la plantilla debe mostrar solo la página de `obtenerPaginaCalculosPlan`). */
    filas: FilaCalculoAsegurado[];
    etiquetaTotalesCobertura: string;
    totalesCobertura: CeldaCalculoCobertura[];
    etiquetaPrimaTotal: string;
    /** colspan de la celda de etiqueta 'Prima total {plan}' en el pie (la prima va en la última columna). */
    colspanPrimaTotal: number;
    /** Tabla 'Tasas por cobertura · {plan}' (null en Patronal o sin plan). */
    tablaTasas: TablaTasaCobertura | null;
}

export interface OpcionFraccionamiento {
    formaPago: string;
    seleccionada: boolean;
    /** `${formaPago}${seleccionada ? ' · Seleccionada' : ''}` */
    etiqueta: string;
    valorPorPago: number;
    valorTexto: string;
    /** `${periodos} pago(s) · Factor x%` */
    detalle: string;
    /** true solo para 'Mensual' seleccionada: pintar el selector Anticipada/Vencida (poliza.tipoPagoMensual). */
    mostrarSelectorTipoPagoMensual: boolean;
}

export interface CalculosPantallaModelo {
    /** true: no hay asegurados; pintar `mensajeVacio` (clase calculos-vacio) y nada más. */
    vacio: boolean;
    mensajeVacio: string;
    esComparativaSinCredibilidad: boolean;
    avisoComparativa: { titulo: string; texto: string } | null;
    planes: TarjetaCalculoPlan[];
    /** Tabla 'Tasas por cobertura · toda la póliza' (null en Patronal o sin filas). */
    tablaTasasPoliza: TablaTasaCobertura | null;
    totalesPoliza: {
        tasaUnica: string;
        primaTotalPoliza: number;
        primaTotalPolizaTexto: string;
        etiquetaPrimaPorAsegurado: string;
        primaPorAsegurado: string;
    };
    fraccionamiento: {
        titulo: string;
        subtitulo: string;
        opciones: OpcionFraccionamiento[];
        /** Ej. 'Mensual (Vencida)' */
        descripcionFormaPago: string;
        valorSegunFormaPago: string;
    };
    /** Sección 'comparativa sin credibilidad' (solo si poliza.aplicaCredibilidad === true; si no, null). */
    comparativa: {
        titulo: string;
        descripcion: string;
        textoBoton: string;
        /** Valor a pasar a `construirCalculosPorPlan(...)` al pulsar el botón. */
        mostrarSinCredibilidadAlPulsar: boolean;
    } | null;
}

export interface PaginaCalculosPlan {
    filas: FilaCalculoAsegurado[];
    pagina: number;
    totalPaginas: number;
    registrosPorPagina: number;
    /** El listado de asegurados está expandido (botón 'Ver/Ocultar asegurados'). */
    listadoVisible: boolean;
    /** Mostrar la barra de paginación (listado visible y más filas que registros por página). */
    mostrarBarra: boolean;
    /** 'Mostrando 1-10 de 35' */
    textoInfo: string;
    /** 'Página 1 de 4' */
    textoPagina: string;
    enPrimera: boolean;
    enUltima: boolean;
}

@Injectable({ providedIn: 'root' })
export class CalculoService {
    private store = inject(CotizadorStore);
    private injector = inject(Injector);

    private get estado() {
        return this.store.estado;
    }

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get catalogoService() {
        return this.injector.get(CatalogoService);
    }
    private get planService() {
        return this.injector.get(PlanService);
    }
    private get aseguradoService() {
        return this.injector.get(AseguradoService);
    }

    // Mientras dura una operación de recálculo, el resultado de la credibilidad
    // se calcula una sola vez en lugar de repetirlo por cada asegurado.
    private cacheCredibilidad: { calculado: boolean; valor: any } | null = null;

    // Paginación de la pantalla de cálculos (paso 5).
    registrosPorPaginaCalculos = 10;
    readonly paginasCalculos = new Map<string, number>();
    readonly filasCalculosPorPlan = new Map<string, FilaCalculoAsegurado[]>();
    /** Llaves de plan cuyo listado de asegurados está desplegado (equivale a `tbody.hidden === false`). */
    readonly listadosCalculosExpandidos = new Set<string>();

    /* ============================================================
       SECCIÓN 6: CÁLCULO DE PRIMAS
       ============================================================ */

    obtenerTasaApiCobertura(cobertura: any, edad: any, deducible: any = null) {
        const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
        if (String(cobertura.codigo || '').toUpperCase() === COBERTURA_RENTA_INCAPACIDAD) {
            return deducible ? this.estado.tasasPorCoberturaEdadDeducible?.[`${codigoAmparo}-${Number(edad)}-${deducible}`] : undefined;
        }
        return this.estado.tasasPorCoberturaEdad?.[`${codigoAmparo}-${Number(edad)}`];
    }

    calcularPrimaCobertura(cobertura: any, valorAsegurado: number, edad: any, deducible: any = null, plan: any = null): number {
        const tasaPura = this.obtenerTasaPuraConRecargoOcupacional(cobertura, edad, deducible, plan);
        if (tasaPura === undefined) return 0;
        const tasaRecargada = this.aplicarRecargoATasa(tasaPura);
        const prima = valorAsegurado * tasaRecargada;
        return Math.round(prima * 100) / 100;
    }

    aplicarRecargoATasa(tasaPura: any): number {
        const factorGasto = this.obtenerRecargoComercial().total / 100;
        return factorGasto >= 1 ? Number(tasaPura) : Number(tasaPura) / (1 - factorGasto);
    }

    obtenerRecargoComercial() {
        const poliza = this.estado.poliza;
        const canalNormalizado = normalizarCanalComercial(poliza.canalComercial);
        const esPromotora = canalNormalizado === 'PROMOTORAS';
        const canal = canalNormalizado || 'SUCURSALES';
        const comision = Math.min(Math.max(Math.round(Number(poliza.comision) || 10), 10), 30);
        const honorarioPromotora = esPromotora
            ? Math.min(Math.max(Number(poliza.honorarioPromotora) || 0, 0), 10)
            : 0;
        const retorno = Math.min(Math.max(Number(poliza.retorno) || 0, 0), 30);
        const costoContrato = 1.64;
        const gastoAdministracion = esPromotora ? 8 : 13;
        const utilidad = 1.6;
        const iva = (comision + honorarioPromotora + retorno) * 0.19;
        const total = comision + honorarioPromotora + retorno + costoContrato + iva + gastoAdministracion + utilidad;

        return { canal, esPromotora, comision, honorarioPromotora, retorno, costoContrato, iva, gastoAdministracion, utilidad, total };
    }

    esCoberturaVida(cobertura: any): boolean {
        return ['WET', 'VID', 'VIDA'].includes(String(cobertura?.codigo || '').toUpperCase());
    }

    obtenerTasaPuraCobertura(asegurado: any, cobertura: any, deducible: any = null) {
        const plan = this.estado.planes.find((item: any) => item.id === asegurado.planId);
        return this.obtenerTasaPuraConRecargoOcupacional(cobertura, asegurado.edad, deducible, plan);
    }

    obtenerTasaPuraConRecargoOcupacional(cobertura: any, edad: any, deducible: any = null, plan: any = null): number | undefined {
        const tasaApi = this.obtenerTasaApiCobertura(cobertura, edad, deducible);
        if (String(cobertura.codigo || '').toUpperCase() === COBERTURA_RENTA_INCAPACIDAD && tasaApi === undefined) return undefined;
        const tasaBase = tasaApi !== undefined
            ? Number(tasaApi)
            : Number(cobertura.tasa ?? cobertura.tasaBase ?? TASA_BASE_SISTEMA) * this.obtenerFactorEdad(edad) / 100;
        // Cáncer in Situ y la extraprima por ocupación se incorporan a la tasa
        // pura; el recargo comercial se aplica únicamente después de esta etapa.
        const tasaPuraConCancerInSitu = this.agregarRecargoCancerInSituATasaPura(tasaBase, plan, cobertura);
        return tasaPuraConCancerInSitu * (1 + (this.catalogoService.obtenerRecargoPorActividad(cobertura) / 100));
    }

    esCoberturaEnfermedadesGraves(codigo: any): boolean {
        return COBERTURAS_ENFERMEDADES_GRAVES.includes(String(codigo || '').toUpperCase());
    }

    obtenerFactorEnfermedadesGraves(plan: any, codigo: any): number {
        const factor = Number(plan?.factoresEnfermedadesGraves?.[codigo]);
        return FACTORES_ENFERMEDADES_GRAVES.includes(factor) ? factor : FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO;
    }

    obtenerRecargoTasaCancerInSitu(plan: any, cobertura: any): number {
        const codigo = String(cobertura?.codigo || '').toUpperCase();
        if (!this.esCoberturaEnfermedadesGraves(codigo) || !plan?.cancerInSituPorCobertura?.[codigo]) return 0;
        return TASA_CANCER_IN_SITU
            * (this.obtenerFactorEnfermedadesGraves(plan, codigo) / FACTOR_REFERENCIA_CANCER_IN_SITU)
            * RECARGO_CANCER_IN_SITU;
    }

    agregarRecargoCancerInSituATasaPura(tasaPura: any, plan: any, cobertura: any): number {
        return Number(tasaPura) + this.obtenerRecargoTasaCancerInSitu(plan, cobertura);
    }

    obtenerTasaBaseConCancerInSitu(cobertura: any, edad: any, deducible: any = null, plan: any = null): number {
        const tasaApi = this.obtenerTasaApiCobertura(cobertura, edad, deducible);
        const tasaBase = tasaApi ?? cobertura.tasa ?? cobertura.tasaBase ?? 0;
        return this.agregarRecargoCancerInSituATasaPura(tasaBase, plan, cobertura);
    }

    /**
     * Devuelve null si no aplica credibilidad o, si aplica:
     * `{ escenario: 1|2, anosExposicion, siniestrosTotales, coberturas: Map<codigoCobertura, item> }` donde item =
     * { codigo, nombre, grupo, nombreGrupo, z6, cantidadAsegurados, valorAsegurado, siniestralidadEsperada,
     *   aplicaCredibilidad, tasaTeorica, [peso, siniestralidadObservada, tasaReal, factorZ, tasaPuraCredibilidad, incrementoDisminucion] }.
     */
    obtenerCalculoCredibilidad(): any {
        const estado = this.estado;
        if (estado.poliza.aplicaCredibilidad !== true || estado.poliza.siniestrosInformados !== true) return null;

        const anosExposicion = Number(estado.poliza.anosExposicion);
        const siniestrosTotales = Number(estado.poliza.valorSiniestrosTotales);
        if (!Number.isFinite(anosExposicion) || anosExposicion <= 0 || !Number.isFinite(siniestrosTotales) || siniestrosTotales < 0) return null;

        // Escenario 1: la siniestralidad se conoce desglosada por grupo de cobertura.
        // Escenario 2: solo se conoce el total de la cuenta.
        const usaDetalle = estado.poliza.detalleSiniestrosCobertura === true;
        const siniestrosPorGrupo = new Map<string, number>((estado.poliza.siniestrosPorCobertura || [])
            .filter((item: any) => item && item.valor !== null && item.valor !== undefined)
            .map((item: any) => [item.codigo, Number(item.valor) || 0] as [string, number]));

        // Solo participan asegurados elegibles (en Mixta/Voluntaria, el Afiliado
        // principal) y coberturas que pertenezcan a un grupo con credibilidad.
        // Los familiares no entran en la siniestralidad esperada ni en los pesos.
        const coberturas = new Map<string, any>();
        const codigosPorPlan = new Map<string, Set<string>>();
        estado.asegurados.forEach((asegurado: any) => {
            if (!this.esAseguradoElegibleCredibilidad(asegurado)) return;
            const plan = estado.planes.find((item: any) => item.id === asegurado.planId);
            if (!plan) return;
            if (!codigosPorPlan.has(plan.id)) {
                codigosPorPlan.set(plan.id, new Set<string>(this.planService.obtenerCoberturasPlan(plan).map((cobertura: any) => cobertura.codigo)));
            }
            const codigosPlan = codigosPorPlan.get(plan.id)!;
            (asegurado.coberturas || []).filter((cobertura: any) => cobertura.activa && codigosPlan.has(cobertura.codigo)).forEach((cobertura: any) => {
                const grupo = this.obtenerGrupoCredibilidad(cobertura.codigo);
                if (!grupo || (!usaDetalle && grupo.soloDetallado)) return;

                const coberturaCatalogo = estado.coberturasCatalogo.find((item: any) => item.codigo === cobertura.codigo) || cobertura;
                const valorAsegurado = this.calcularValorAseguradoCobertura(coberturaCatalogo, asegurado);
                const tasaPura = this.obtenerTasaPuraCobertura(asegurado, cobertura, this.planService.obtenerDeducibleCoberturaPlan(plan, cobertura.codigo));
                if (valorAsegurado === null || valorAsegurado <= 0 || !Number.isFinite(tasaPura)) return;

                const item = coberturas.get(cobertura.codigo) || {
                    codigo: cobertura.codigo,
                    nombre: coberturaCatalogo.nombre || cobertura.nombre || cobertura.codigo,
                    grupo: grupo.codigo,
                    nombreGrupo: grupo.nombre,
                    z6: grupo.z6,
                    cantidadAsegurados: 0,
                    valorAsegurado: 0,
                    siniestralidadEsperada: 0
                };
                item.cantidadAsegurados += 1;
                item.valorAsegurado += valorAsegurado;
                item.siniestralidadEsperada += tasaPura * valorAsegurado;
                coberturas.set(cobertura.codigo, item);
            });
        });
        if (coberturas.size === 0) return null;

        const esperadaPorGrupo = new Map<string, number>();
        let esperadaTotal = 0;
        coberturas.forEach(item => {
            esperadaPorGrupo.set(item.grupo, (esperadaPorGrupo.get(item.grupo) || 0) + item.siniestralidadEsperada);
            esperadaTotal += item.siniestralidadEsperada;
        });

        let hayCredibilidad = false;
        coberturas.forEach(item => {
            const observadaBase = usaDetalle ? siniestrosPorGrupo.get(item.grupo) : siniestrosTotales;
            const esperadaBase = usaDetalle ? esperadaPorGrupo.get(item.grupo) : esperadaTotal;
            // Cobertura sin siniestralidad observada para su grupo: conserva el cálculo teórico.
            item.aplicaCredibilidad = observadaBase !== undefined && esperadaBase > 0 && item.siniestralidadEsperada > 0;
            item.tasaTeorica = item.siniestralidadEsperada / item.valorAsegurado;
            if (!item.aplicaCredibilidad) return;

            hayCredibilidad = true;
            item.peso = item.siniestralidadEsperada / esperadaBase;
            item.siniestralidadObservada = observadaBase * item.peso;
            item.tasaReal = item.siniestralidadObservada / (item.valorAsegurado * anosExposicion);
            item.factorZ = Math.min(1, Math.sqrt((item.cantidadAsegurados * anosExposicion) / item.z6));
            item.tasaPuraCredibilidad = (item.tasaReal * item.factorZ) + ((1 - item.factorZ) * item.tasaTeorica);
            item.incrementoDisminucion = (item.tasaPuraCredibilidad / item.tasaTeorica) - 1;
        });
        if (!hayCredibilidad) return null;

        return { escenario: usaDetalle ? 1 : 2, anosExposicion, siniestrosTotales, coberturas };
    }

    esPolizaPatronal(): boolean {
        return this.estado.poliza.modalidadPlan === 'Patronal (No Contributiva)';
    }

    // Patronal no aplica el filtro de Afiliado principal. En Mixta y Voluntaria
    // (mismo tratamiento) solo el Afiliado principal puede recibir credibilidad.
    esAseguradoElegibleCredibilidad(asegurado: any): boolean {
        return this.esPolizaPatronal() || this.esAfiliadoPrincipal(asegurado);
    }

    esAfiliadoPrincipal(asegurado: any): boolean {
        return asegurado?.tipoAsegurado === 'Afiliado principal';
    }

    // En Voluntaria y Mixta la credibilidad aplica por plan solo a Afiliados
    // principales; por eso un plan nunca mezcla principales con otros parentescos.
    debeSepararPrincipalesDeFamiliares(): boolean {
        return this.aseguradoService.esModalidadContributiva();
    }

    // Plan creado exclusivamente para parentescos distintos de Afiliado principal.
    esPlanSoloFamiliares(plan: any): boolean {
        return Boolean(plan?.soloFamiliares);
    }

    obtenerPlanesConMezclaPrincipalFamiliares(): any[] {
        if (!this.debeSepararPrincipalesDeFamiliares()) return [];
        return this.estado.planes.filter((plan: any) => {
            const integrantes = (plan.asegurados || [])
                .map((id: any) => this.estado.asegurados.find((asegurado: any) => asegurado.id === id))
                .filter(Boolean);
            return integrantes.some((a: any) => this.esAfiliadoPrincipal(a)) && integrantes.some((asegurado: any) => !this.esAfiliadoPrincipal(asegurado));
        });
    }

    obtenerGrupoCredibilidad(codigoCobertura: any) {
        const codigo = String(codigoCobertura || '').toUpperCase();
        return AGRUPACIONES_SINIESTROS.find(grupo => grupo.codigos.includes(codigo)) || null;
    }

    // Tasa comercial con credibilidad de la cobertura para el asegurado; undefined
    // si no aplica y debe conservarse el cálculo teórico. El factor de gasto se
    // aplica con la misma función que la tasa teórica.
    obtenerTasaComercialConCredibilidadCobertura(asegurado: any, codigoCobertura: any, calculo: any = this.obtenerAjustesCredibilidad()): number | undefined {
        if (!calculo || !this.esAseguradoElegibleCredibilidad(asegurado)) return undefined;
        const item = calculo.coberturas.get(codigoCobertura);
        return item?.aplicaCredibilidad ? this.aplicarRecargoATasa(item.tasaPuraCredibilidad) : undefined;
    }

    obtenerFactorRecargoActividadCredibilidad(planes: any[]) {
        const totalesPorCobertura = new Map<string, any>();

        planes.forEach(plan => {
            this.planService.obtenerCoberturasPlan(plan).forEach((cobertura: any) => {
                const total = totalesPorCobertura.get(cobertura.codigo) || {
                    cobertura,
                    valorAsegurado: 0
                };
                plan.asegurados.forEach((aseguradoId: any) => {
                    const asegurado = this.estado.asegurados.find((item: any) => item.id === aseguradoId);
                    if (!asegurado) return;
                    const valorAsegurado = this.calcularValorAseguradoCobertura(cobertura, asegurado);
                    if (Number.isFinite(valorAsegurado) && valorAsegurado > 0) {
                        total.valorAsegurado += valorAsegurado;
                    }
                });
                totalesPorCobertura.set(cobertura.codigo, total);
            });
        });

        const valorAseguradoTotal = [...totalesPorCobertura.values()]
            .reduce((total, item) => total + item.valorAsegurado, 0);
        if (valorAseguradoTotal <= 0) {
            return { factor: 1, recargoPonderado: 0, valorAseguradoTotal: 0, coberturas: [] as any[] };
        }

        const coberturas = [...totalesPorCobertura.values()].map(({ cobertura, valorAsegurado }) => {
            const participacion = valorAsegurado / valorAseguradoTotal;
            const recargo = this.catalogoService.obtenerRecargoPorActividad(cobertura) / 100;
            return {
                codigo: cobertura.codigo,
                nombre: cobertura.nombre || cobertura.codigo,
                valorAsegurado,
                participacion,
                recargo,
                contribucion: participacion * recargo
            };
        });
        const recargoPonderado = coberturas.reduce((total, cobertura) => total + cobertura.contribucion, 0);

        return {
            factor: 1 + recargoPonderado,
            recargoPonderado,
            valorAseguradoTotal,
            coberturas
        };
    }

    // Mientras dura una operación de recálculo, el resultado de la credibilidad
    // se calcula una sola vez en lugar de repetirlo por cada asegurado.
    conCacheCredibilidad<T>(funcion: () => T): T {
        if (this.cacheCredibilidad) return funcion();
        this.cacheCredibilidad = { calculado: false, valor: null };
        try {
            return funcion();
        } finally {
            this.cacheCredibilidad = null;
        }
    }

    obtenerAjustesCredibilidad(): any {
        if (this.cacheCredibilidad?.calculado) return this.cacheCredibilidad.valor;
        const valor = this.obtenerCalculoCredibilidad();
        if (this.cacheCredibilidad) {
            this.cacheCredibilidad.calculado = true;
            this.cacheCredibilidad.valor = valor;
        }
        return valor;
    }

    calcularPrimaIndividual(asegurado: any): number {
        let prima = 0;
        const plan = this.estado.planes.find((item: any) => item.id === asegurado.planId);
        const ajustesCredibilidad = this.obtenerAjustesCredibilidad();
        const codigosPlan = plan ? new Set<string>(this.planService.obtenerCoberturasPlan(plan).map((cobertura: any) => cobertura.codigo)) : null;
        asegurado.coberturas.filter((cobertura: any) => !codigosPlan || codigosPlan.has(cobertura.codigo)).forEach((cob: any) => {
            const coberturaCatalogo = this.estado.coberturasCatalogo.find((item: any) => item.codigo === cob.codigo) || cob;
            const valorAsegurado = this.calcularValorAseguradoCobertura(coberturaCatalogo, asegurado);
            if (cob.activa && valorAsegurado !== null && valorAsegurado > 0) {
                const tasaCredibilidad = this.obtenerTasaComercialConCredibilidadCobertura(asegurado, cob.codigo, ajustesCredibilidad);
                prima += tasaCredibilidad !== undefined
                    ? Math.round(valorAsegurado * tasaCredibilidad * 100) / 100
                    : this.calcularPrimaCobertura(
                        { codigo: cob.codigo, codigoAmparo: cob.codigoAmparo, tasa: cob.tasa },
                        valorAsegurado,
                        asegurado.edad,
                        this.planService.obtenerDeducibleCoberturaPlan(plan, cob.codigo),
                        plan
                    );
            }
        });
        asegurado.primaIndividual = Math.round(prima * 100) / 100;
        return asegurado.primaIndividual;
    }

    calcularPrimaTotal(): number {
        let total = 0;
        this.estado.asegurados.forEach((a: any) => {
            total += this.calcularPrimaIndividual(a);
        });
        return Math.round(total * 100) / 100;
    }

    // Prima = suma de las primas individuales de los asegurados del plan.
    // (Helper de recalcularTodo; en app.js vive en la sección de planes.)
    calcularPrimaPlanSincronizado(plan: any, aseguradosPorId: Map<any, any>): void {
        let primaTotal = 0;
        plan.asegurados.forEach((asegId: any) => {
            const asegurado = aseguradosPorId.get(asegId);
            if (!asegurado) return;

            const primaInd = this.calcularPrimaIndividual(asegurado);
            asegurado.primaIndividual = primaInd;
            primaTotal += primaInd;
        });

        plan.primaTotal = primaTotal;
    }

    obtenerFactorEdad(edad: any): number {
        const e = parseInt(edad);
        if (e < 26) return CONFIG.FACTORES_EDAD['18-25'];
        if (e < 36) return CONFIG.FACTORES_EDAD['26-35'];
        if (e < 46) return CONFIG.FACTORES_EDAD['36-45'];
        if (e < 56) return CONFIG.FACTORES_EDAD['46-55'];
        if (e < 66) return CONFIG.FACTORES_EDAD['56-65'];
        return CONFIG.FACTORES_EDAD['65+'];
    }

    obtenerFactorOcupacional(ocupacion: any): number {
        return CONFIG.FACTORES_OCUPACION[ocupacion] || 1.0;
    }

    /* ============================================================
       SECCIÓN 7: IDENTIFICACIÓN DE SUBGRUPOS
       ============================================================ */

    identificarSubgrupos(): void {
        const estado = this.estado;
        estado.subgrupos = [];
        const subgruposMap = new Map<string, any>();

        estado.asegurados.forEach((asegurado: any) => {
            // Crear clave basada en coberturas activas
            const coberturasActivas = asegurado.coberturas
                .filter((c: any) => c.activa)
                .map((c: any) => c.codigo)
                .sort()
                .join(',');

            if (!subgruposMap.has(coberturasActivas)) {
                subgruposMap.set(coberturasActivas, {
                    id: generarUUID(),
                    coberturas: coberturasActivas,
                    asegurados: [],
                    planes: []
                });
            }

            const subgrupo = subgruposMap.get(coberturasActivas);
            subgrupo.asegurados.push(asegurado.id);
            asegurado.subgrupoId = subgrupo.id;
        });

        estado.subgrupos = Array.from(subgruposMap.values());
        this.identificarPlanes();
    }

    /* ============================================================
       SECCIÓN 8: IDENTIFICACIÓN DE PLANES
       ============================================================ */

    identificarPlanes(): void {
        const estado = this.estado;
        estado.planes = [];
        const planesMap = new Map<string, any>();

        estado.asegurados.forEach((asegurado: any) => {
            // Los valores asegurados son individuales y no generan planes nuevos.
            // Solo la combinación de coberturas define el plan dentro del subgrupo.
            const coberturas = asegurado.coberturas
                .filter((c: any) => c.activa)
                .map((c: any) => c.codigo)
                .sort()
                .join('|');

            const planId = `${asegurado.subgrupoId}_${coberturas}`;

            if (!planesMap.has(planId)) {
                planesMap.set(planId, {
                    id: planId,
                    subgrupoId: asegurado.subgrupoId,
                    coberturas: coberturas,
                    asegurados: [],
                    primaTotal: 0
                });
            }

            const plan = planesMap.get(planId);
            plan.asegurados.push(asegurado.id);
            asegurado.planId = plan.id;
        });

        estado.planes = Array.from(planesMap.values());

        // Calcular prima total por plan
        const aseguradosPorId = new Map<any, any>(estado.asegurados.map((a: any) => [a.id, a] as [any, any]));
        this.conCacheCredibilidad(() => {
            estado.planes.forEach((plan: any) => {
                plan.primaTotal = plan.asegurados
                    .reduce((sum: number, id: any) => {
                        const asegurado = aseguradosPorId.get(id);
                        return sum + (asegurado ? this.calcularPrimaIndividual(asegurado) : 0);
                    }, 0);
            });
        });
    }

    /* ============================================================
       SECCIÓN 9: ANÁLISIS DE COMPLEJIDAD
       ============================================================ */

    analizarComplejidad() {
        const nivelComplejidad = this.calcularNivelComplejidad();
        const reglas = this.evaluarReglas();

        return {
            nivel: nivelComplejidad,
            reglas: reglas,
            recomendaciones: []
        };
    }

    calcularNivelComplejidad(): string {
        const estado = this.estado;
        const numSubgrupos = estado.subgrupos.length;
        const numPlanes = estado.planes.length;
        const planesUnicos = estado.planes.filter((p: any) => p.asegurados.length === 1).length;
        const numAsegurados = estado.asegurados.length;

        const puntos = {
            subgrupos: numSubgrupos > 6 ? 30 : numSubgrupos > 3 ? 15 : 5,
            planes: numPlanes > 15 ? 30 : numPlanes > 8 ? 15 : 5,
            planesUnicos: planesUnicos / numPlanes > 0.3 ? 20 : 10,
            asxplan: numAsegurados > 0 ? Math.min(Math.floor((numAsegurados / numPlanes) / 3), 20) : 5
        };

        const total = puntos.subgrupos + puntos.planes + puntos.planesUnicos + puntos.asxplan;

        if (total > 60) return 'Alto';
        if (total > 35) return 'Medio';
        return 'Bajo';
    }

    evaluarReglas(): { tipo: string; mensaje: string }[] {
        const estado = this.estado;
        const reglas: { tipo: string; mensaje: string }[] = [];
        const { maxSubgrupos, maxPlanes } = CONFIG.REGLAS_COMPLEJIDAD;

        if (estado.subgrupos.length > maxSubgrupos) {
            reglas.push({
                tipo: 'error',
                mensaje: `Máximo ${maxSubgrupos} subgrupos: tienes ${estado.subgrupos.length}`
            });
        }

        if (estado.planes.length > maxPlanes) {
            reglas.push({
                tipo: 'error',
                mensaje: `Máximo ${maxPlanes} planes: tienes ${estado.planes.length}`
            });
        }

        // Verificar planes únicos (1 asegurado)
        const planesUnicos = estado.planes.filter((p: any) => p.asegurados.length === 1).length;
        if (planesUnicos > estado.planes.length * 0.3) {
            reglas.push({
                tipo: 'warning',
                mensaje: `${planesUnicos} planes con 1 solo asegurado (${Math.round(planesUnicos / estado.planes.length * 100)}%)`
            });
        }

        return reglas;
    }

    /* ============================================================
       SECCIÓN 10: GENERACIÓN DE SUGERENCIAS
       ============================================================ */

    generarSugerencias(): any[] {
        const estado = this.estado;
        estado.sugerencias = [];

        // 1. Valores redondeados
        const sugerenciasValores = this.sugerirValoresRedondeados();
        if (sugerenciasValores.length > 0) {
            estado.sugerencias.push({
                tipo: 'valores',
                titulo: 'Optimizar Valores',
                sugerencias: sugerenciasValores
            });
        }

        // 2. Agrupación
        const sugerenciasAgrupacion = this.sugerirAgrupacion();
        if (sugerenciasAgrupacion.length > 0) {
            estado.sugerencias.push({
                tipo: 'agrupacion',
                titulo: 'Simplificar Agrupación',
                sugerencias: sugerenciasAgrupacion
            });
        }

        // 3. Planes únicos
        const sugerenciasPlanes = this.detectarPlanesUnicos();
        if (sugerenciasPlanes.length > 0) {
            estado.sugerencias.push({
                tipo: 'planes',
                titulo: 'Consolidar Planes',
                sugerencias: sugerenciasPlanes
            });
        }

        // 4. Coberturas frecuentes
        const sugerenciasCoberturas = this.detectarCoberturasPocFrecuentes();
        if (sugerenciasCoberturas.length > 0) {
            estado.sugerencias.push({
                tipo: 'coberturas',
                titulo: 'Revisar Coberturas',
                sugerencias: sugerenciasCoberturas
            });
        }

        return estado.sugerencias;
    }

    sugerirValoresRedondeados(): any[] {
        const sugerencias: any[] = [];
        const tolerance = 0.05; // 5%

        this.estado.asegurados.forEach((asegurado: any) => {
            asegurado.coberturas.forEach((cob: any) => {
                if (cob.activa && cob.valorAsegurado > 0) {
                    const redondeado = Math.ceil(cob.valorAsegurado / 1000000) * 1000000;
                    const diferencia = Math.abs(redondeado - cob.valorAsegurado) / cob.valorAsegurado;

                    if (diferencia > tolerance && diferencia < 0.15) {
                        sugerencias.push({
                            asegurado: asegurado.numeroDocumento,
                            cobertura: cob.nombre,
                            actual: formatearDinero(cob.valorAsegurado),
                            sugerido: formatearDinero(redondeado),
                            ahorro: formatearDinero(Math.abs(redondeado - cob.valorAsegurado))
                        });
                    }
                }
            });
        });

        return sugerencias.slice(0, 5); // Máximo 5 sugerencias
    }

    sugerirAgrupacion(): any[] {
        const estado = this.estado;
        const sugerencias: any[] = [];

        // Buscar planes con valores muy similares
        for (let i = 0; i < estado.planes.length; i++) {
            for (let j = i + 1; j < estado.planes.length; j++) {
                const p1 = estado.planes[i];
                const p2 = estado.planes[j];

                if (p1.subgrupoId === p2.subgrupoId) {
                    const diferencia = Math.abs(p1['primaTotal'] - p2['primaTotal']) / Math.max(p1['primaTotal'], p2['primaTotal']);

                    if (diferencia < 0.1 && diferencia > 0) { // 10% de diferencia
                        sugerencias.push({
                            plan1: p1['coberturas'],
                            plan2: p2['coberturas'],
                            diferencia: Math.round(diferencia * 100) + '%',
                            consolidadoPrimaTotal: Math.round((p1['primaTotal'] + p2['primaTotal']) * 100) / 100
                        });
                    }
                }
            }
        }

        return sugerencias;
    }

    detectarPlanesUnicos(): any[] {
        const sugerencias: any[] = [];

        this.estado.planes.forEach((plan: any) => {
            if (plan.asegurados.length === 1) {
                const asegurado = this.estado.asegurados.find((a: any) => a.id === plan.asegurados[0]);
                sugerencias.push({
                    asegurado: asegurado.numeroDocumento,
                    plan: plan.coberturas,
                    prima: formatearDinero(plan.primaTotal),
                    razon: 'Plan aplicable solo a 1 asegurado - Evalúa su necesidad'
                });
            }
        });

        return sugerencias;
    }

    detectarCoberturasPocFrecuentes(): any[] {
        const sugerencias: any[] = [];
        const totalAsegurados = this.estado.asegurados.length;

        this.estado.coberturasCatalogo.forEach((cobertura: any) => {
            const conCobertura = this.estado.asegurados.filter((a: any) =>
                a.coberturas.find((c: any) => c.codigo === cobertura.codigo && c.activa)
            ).length;

            const porcentaje = (conCobertura / totalAsegurados) * 100;

            if (conCobertura > 0 && porcentaje < 20 && !cobertura.obligatoria) {
                sugerencias.push({
                    cobertura: cobertura.nombre,
                    asegurados: conCobertura + ' de ' + totalAsegurados,
                    porcentaje: Math.round(porcentaje) + '%',
                    razon: 'Cobertura poco frecuente - Considera si debe ser opcional'
                });
            }
        });

        return sugerencias;
    }

    /* ============================================================
       TASAS, VALORES ASEGURADOS Y FORMA DE PAGO (app.js 2618-2670, 2822-2830)
       ============================================================ */

    obtenerTasaPorEdad(cobertura: any, edad: any, deducible: any = null, plan: any = null): number | undefined {
        const tasaPura = this.obtenerTasaPuraConRecargoOcupacional(cobertura, edad, deducible, plan);
        return tasaPura === undefined ? undefined : this.aplicarRecargoATasa(tasaPura);
    }

    obtenerPorcentajeFactorPorEdad(cobertura: any, edad: any) {
        const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
        return this.estado.porcentajesFactorPorCoberturaEdad?.[`${codigoAmparo}-${Number(edad)}`];
    }

    obtenerValorMaximoPorEdad(cobertura: any, edad: any) {
        const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
        return this.estado.valoresMaximosPorCoberturaEdad?.[`${codigoAmparo}-${Number(edad)}`];
    }

    calcularValorAseguradoCobertura(cobertura: any, asegurado: any): number | null {
        const valorAseguradoVida = obtenerValorAseguradoBase(asegurado);
        const plan = this.estado.planes.find((item: any) => item.id === asegurado.planId);
        const porcentajeFactor = this.esCoberturaEnfermedadesGraves(cobertura.codigo)
            ? this.obtenerFactorEnfermedadesGraves(plan, cobertura.codigo)
            : this.obtenerPorcentajeFactorPorEdad(cobertura, asegurado.edad);
        if (porcentajeFactor === undefined) return null;

        const valorCalculado = valorAseguradoVida * porcentajeFactor;
        const valorMaximo = this.obtenerValorMaximoPorEdad(cobertura, asegurado.edad);
        return Number.isFinite(valorMaximo) && valorMaximo >= 0
            ? Math.min(valorCalculado, valorMaximo)
            : valorCalculado;
    }

    formatearTasa(tasa: number): string {
        return Number.isFinite(tasa) ? tasa.toLocaleString('es-CO', { maximumFractionDigits: 12 }) : 'Sin tasa';
    }

    formatearTasaUnica(primaTotal: number, valorAseguradoTotal: number): string {
        if (!Number.isFinite(primaTotal) || !Number.isFinite(valorAseguradoTotal) || valorAseguradoTotal <= 0) return '—';
        return ((primaTotal / valorAseguradoTotal) * 1000)
            .toLocaleString('es-CO', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    }

    obtenerDetalleFraccionamiento(formaPago: string = this.estado.poliza.formaPago): { factor: number; periodos: number } {
        return CONFIG.FACTORES_FRACCIONAMIENTO[formaPago] || CONFIG.FACTORES_FRACCIONAMIENTO['Anual'];
    }

    calcularPrimaPorFormaPago(primaAnual: number, formaPago: string = this.estado.poliza.formaPago): number {
        const { factor, periodos } = this.obtenerDetalleFraccionamiento(formaPago);
        return Math.round((primaAnual * (1 + factor) / periodos) * 100) / 100;
    }

    formatearPrimaPorAsegurado(primaAnual: number, cantidadAsegurados: number): string {
        if (!Number.isFinite(primaAnual) || !Number.isFinite(cantidadAsegurados) || cantidadAsegurados <= 0) return '—';
        return formatearDinero(this.calcularPrimaPorFormaPago(primaAnual) / cantidadAsegurados);
    }

    formatearPorcentaje(valor: number): string {
        return Number.isFinite(valor)
            ? valor.toLocaleString('es-CO', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—';
    }

    /* ============================================================
       RECÁLCULO GLOBAL (app.js 7177)
       ============================================================ */

    recalcularTodo(): void {
        const estado = this.estado;
        // Los valores de los planes se aplican primero a todos los asegurados para
        // que la credibilidad se calcule una sola vez con datos consistentes.
        const aseguradosPorId = new Map<any, any>(estado.asegurados.map((item: any) => [item.id, item] as [any, any]));
        estado.planes.forEach((plan: any) => {
            const subgrupo = estado.subgrupos.find((sg: any) => sg.id === plan.subgrupoId);
            if (subgrupo) this.planService.sincronizarCoberturasPlan(plan, subgrupo, aseguradosPorId);
        });

        this.conCacheCredibilidad(() => {
            // Recalcular primas de todos los planes activos
            estado.planes.forEach((plan: any) => {
                if (estado.subgrupos.some((sg: any) => sg.id === plan.subgrupoId)) this.calcularPrimaPlanSincronizado(plan, aseguradosPorId);
            });

            // Las vistas (coberturas, asegurados, cálculos, planes) se refrescan
            // al leer el estado; se avisa del cambio en lugar de re-renderizar.
            this.store.notificarCambio();
        });
        this.store.guardarEstado();
    }

    /* ============================================================
       MODELOS PARA LAS PLANTILLAS
       ============================================================ */

    /**
     * Lógica de renderizarResumenCredibilidad().
     * Devuelve:
     *  - null: la póliza no aplica credibilidad (no pintar nada).
     *  - { tipo: 'mensaje', mensaje }: pintar `<p class="info-box">{{mensaje}}</p>`.
     *  - { tipo: 'tabla', titulo, descripcion, encabezados: string[], filas: { celdas: {texto, negrita?}[] }[] }:
     *    pintar la tarjeta `calculos-plan-card` con la tabla `table-editable tabla-calculos`
     *    (`titulo` en <strong>, `descripcion` en <span>; una <th> por encabezado y una <td> por celda).
     *    En Patronal solo hay 9 columnas (sin tasas); en Voluntaria/Mixta se añaden 5 columnas de tasas.
     */
    construirResumenCredibilidad(): ResumenCredibilidadModelo | null {
        if (this.estado.poliza.aplicaCredibilidad !== true) return null;

        const calculo = this.obtenerAjustesCredibilidad();
        if (!calculo) {
            return {
                tipo: 'mensaje',
                mensaje: 'La credibilidad se aplicará por cobertura cuando se cuente con siniestros, años de exposición, valores asegurados y tasas puras válidas.'
            };
        }

        // En Patronal solo se muestra la tasa única; el cálculo por cobertura es interno.
        const mostrarTasas = !this.esPolizaPatronal();
        const encabezados = [
            'Cobertura', 'Grupo', 'Asegurados', 'Valor asegurado', 'Siniestralidad esperada', 'Peso',
            'Siniestralidad observada asignada', 'Z6', 'Factor Z'
        ];
        if (mostrarTasas) {
            encabezados.push(
                'Tasa teórica (‰)', 'Tasa real (‰)', 'Tasa pura con credibilidad (‰)',
                'Tasa comercial con credibilidad (‰)', 'Incremento / disminución'
            );
        }
        const celdasTasas = (item: any): CeldaTexto[] => {
            if (!mostrarTasas) return [];
            return item.aplicaCredibilidad
                ? [
                    { texto: this.formatearTasa(item.tasaTeorica * 1000) },
                    { texto: this.formatearTasa(item.tasaReal * 1000) },
                    { texto: this.formatearTasa(item.tasaPuraCredibilidad * 1000), negrita: true },
                    { texto: this.formatearTasa(this.aplicarRecargoATasa(item.tasaPuraCredibilidad) * 1000) },
                    { texto: this.formatearPorcentaje(item.incrementoDisminucion) }
                ]
                : [
                    { texto: this.formatearTasa(item.tasaTeorica * 1000) },
                    { texto: '—' }, { texto: '—' }, { texto: '—' }, { texto: '—' }
                ];
        };
        const filas = ([...calculo.coberturas.values()] as any[]).map(item => {
            const comunes: CeldaTexto[] = [
                { texto: `${item.nombre} (${item.codigo})` },
                { texto: item.nombreGrupo },
                { texto: item.cantidadAsegurados.toLocaleString('es-CO') },
                { texto: formatearDinero(item.valorAsegurado) },
                { texto: formatearDinero(item.siniestralidadEsperada) }
            ];
            const celdas: CeldaTexto[] = item.aplicaCredibilidad
                ? [
                    ...comunes,
                    { texto: this.formatearPorcentaje(item.peso) },
                    { texto: formatearDinero(item.siniestralidadObservada) },
                    { texto: item.z6.toLocaleString('es-CO') },
                    { texto: this.formatearTasa(item.factorZ) }
                ]
                : [
                    ...comunes,
                    { texto: '—' },
                    { texto: '—' },
                    { texto: item.z6.toLocaleString('es-CO') },
                    { texto: '—' }
                ];
            return { celdas: [...celdas, ...celdasTasas(item)] };
        });
        const descripcionEscenario = calculo.escenario === 1
            ? 'Siniestralidad detallada por cobertura: cada grupo se distribuye entre sus coberturas según su siniestralidad esperada.'
            : 'Solo siniestralidad total: se distribuye entre Vida, ITP y Enfermedades graves según su siniestralidad esperada; las Rentas conservan el cálculo teórico.';
        const nota = mostrarTasas
            ? 'Las tasas con credibilidad incluyen el ajuste comercial correspondiente. Las coberturas sin credibilidad conservan su tasa teórica.'
            : 'Los cálculos por cobertura se realizan internamente; en pólizas Patronales solo se presenta la tasa única.';

        return {
            tipo: 'tabla',
            titulo: 'Cálculo de credibilidad por cobertura',
            descripcion: `${descripcionEscenario} Años de exposición: ${calculo.anosExposicion.toLocaleString('es-CO')} · Siniestros totales: ${formatearDinero(calculo.siniestrosTotales)}. ${nota}`,
            encabezados,
            filas
        };
    }

    /**
     * Lógica de renderizarFilasTasaPorCobertura().
     * Recibe Map<codigoCobertura, {nombre, valorAsegurado, prima}> y devuelve una fila por cobertura:
     * { codigo, nombre, etiqueta: 'Nombre (COD)', valorAsegurado: '$ ...', tasaUnica: '0,123456', prima: '$ ...' }
     * (tasaUnica en negrita en la celda "Tasa por cobertura").
     */
    construirFilasTasaPorCobertura(totalesPorCobertura: Map<string, { nombre: string; valorAsegurado: number; prima: number }>): FilaTasaCobertura[] {
        return [...totalesPorCobertura.entries()].map(([codigo, total]) => ({
            codigo,
            nombre: total.nombre,
            etiqueta: `${total.nombre} (${codigo})`,
            valorAsegurado: formatearDinero(total.valorAsegurado),
            tasaUnica: this.formatearTasaUnica(total.prima, total.valorAsegurado),
            prima: formatearDinero(total.prima)
        }));
    }

    /**
     * Lógica de renderizarTablaTasaPorCobertura(). Devuelve
     * { alcance, titulo, descripcion, clase, encabezados: ['Cobertura','Valor asegurado total','Tasa por cobertura','Prima total'], filas }
     * Se pinta como `<section class="calculos-plan-card tabla-tasa-card {{clase}}">`; `alcance` en
     * `<span class="tabla-tasa-alcance">` solo si no es ''; `descripcion` en <span> solo si no es ''.
     */
    construirTablaTasaPorCobertura(filas: FilaTasaCobertura[], alcance: string, titulo: string, descripcion: string, clase: string): TablaTasaCobertura {
        return {
            alcance,
            titulo,
            descripcion,
            clase,
            encabezados: ['Cobertura', 'Valor asegurado total', 'Tasa por cobertura', 'Prima total'],
            filas
        };
    }

    /**
     * Lógica de renderizarOpcionesFraccionamiento(primaAnual) (bloque 'Valor según forma de pago').
     * Devuelve una opción por forma de pago (Mensual, Trimestral, Semestral, Anual):
     * { formaPago, seleccionada, etiqueta, valorPorPago, valorTexto, detalle, mostrarSelectorTipoPagoMensual }.
     * Al hacer click en una opción no seleccionada la plantilla debe invocar el flujo de cambio de
     * forma de pago (CatalogoService.solicitarCambioFormaPago(formaPago)).
     */
    construirOpcionesFraccionamiento(primaAnual: number): OpcionFraccionamiento[] {
        const formaSeleccionada = this.estado.poliza.formaPago || 'Anual';
        return Object.entries(CONFIG.FACTORES_FRACCIONAMIENTO).map(([formaPago, detalle]) => {
            const seleccionada = formaPago === formaSeleccionada;
            const valorPorPago = this.calcularPrimaPorFormaPago(primaAnual, formaPago);
            return {
                formaPago,
                seleccionada,
                etiqueta: `${formaPago}${seleccionada ? ' · Seleccionada' : ''}`,
                valorPorPago,
                valorTexto: formatearDinero(valorPorPago),
                detalle: `${detalle.periodos} ${detalle.periodos === 1 ? 'pago' : 'pagos'} · Factor ${this.formatearPorcentaje(detalle.factor)}`,
                mostrarSelectorTipoPagoMensual: formaPago === 'Mensual' && seleccionada
            };
        });
    }

    /**
     * Lógica de renderizarTablaCalculos(mostrarSinCredibilidad).
     * EFECTOS: recalcula `plan.primaTotal` (salvo en comparativa), rellena `filasCalculosPorPlan` y asigna
     * `store.resumenCotizacion` (salvo en comparativa), igual que el original. Es costoso y con efectos:
     * invocarlo UNA vez (al entrar al paso 5 / cuando cambie `store.version()` / al alternar la comparativa)
     * y guardar el resultado en un campo; no llamarlo desde una expresión de la plantilla.
     * `mostrarSinCredibilidad = true` calcula sin credibilidad (comparativa); el componente conserva ese flag.
     * Devuelve CalculosPantallaModelo:
     *  - vacio / mensajeVacio: sin asegurados, pintar `<p class="calculos-vacio">{{mensajeVacio}}</p>`.
     *  - avisoComparativa: {titulo, texto} o null (`<section class="comparativa-credibilidad" role="status">`).
     *  - planes[]: TarjetaCalculoPlan (`calculos-plan-card calculos-plan-bloque`). Cabecera: secuencia, titulo,
     *    descripcion, botón ver/ocultar asegurados (solo si tieneTabla; usar listadosCalculosExpandidos vía
     *    alternarListadoCalculosPlan/obtenerPaginaCalculosPlan), primaTotalPlanTexto y primaPorAsegurado.
     *    Tabla: columnas Documento, Edad y por cobertura (encabezadoValor, encabezadoPrima); tbody con las filas de
     *    `obtenerPaginaCalculosPlan(llave).filas`; tfoot con totalesCobertura (fila `tasa-unica-row`, etiqueta
     *    etiquetaTotalesCobertura en colspan 2) y fila de etiquetaPrimaTotal (colspan colspanPrimaTotal) + primaTotalPlanTexto.
     *    Barra de paginación bajo la tabla (obtenerPaginaCalculosPlan). tablaTasas (si no es null) tras la tabla.
     *  - tablaTasasPoliza: TablaTasaCobertura o null.
     *  - totalesPoliza: {tasaUnica, primaTotalPolizaTexto, etiquetaPrimaPorAsegurado, primaPorAsegurado} para `calculos-total-poliza`
     *    ('Tasa única total de la póliza', 'Prima anual de la póliza', etiquetaPrimaPorAsegurado).
     *  - fraccionamiento: {titulo, subtitulo, opciones[], descripcionFormaPago, valorSegunFormaPago}
     *    ("{{descripcionFormaPago}}: <strong>{{valorSegunFormaPago}}</strong>.").
     *  - comparativa: {titulo, descripcion, textoBoton, mostrarSinCredibilidadAlPulsar} o null; el botón debe volver a
     *    construir el modelo con `mostrarSinCredibilidadAlPulsar`.
     * Tras este bloque el original agrega los campos de Condiciones Especiales y Continuidad (bindings a store.estado.poliza).
     */
    construirCalculosPorPlan(mostrarSinCredibilidad = false): CalculosPantallaModelo {
        const estado = this.estado;
        const esComparativaSinCredibilidad = estado.poliza.aplicaCredibilidad === true && mostrarSinCredibilidad;
        const planesPorId = new Map<string, any>(estado.planes.map((plan: any) => [plan.id, plan] as [string, any]));
        const formaPago = estado.poliza.formaPago || 'Anual';

        const modelo: CalculosPantallaModelo = {
            vacio: false,
            mensajeVacio: 'No hay asegurados cargados.',
            esComparativaSinCredibilidad,
            avisoComparativa: null,
            planes: [],
            tablaTasasPoliza: null,
            totalesPoliza: {
                tasaUnica: '—',
                primaTotalPoliza: 0,
                primaTotalPolizaTexto: formatearDinero(0),
                etiquetaPrimaPorAsegurado: `Prima ${formaPago} por asegurado`,
                primaPorAsegurado: '—'
            },
            fraccionamiento: {
                titulo: 'Valor según forma de pago',
                subtitulo: 'Selecciona la forma de pago que prefieras',
                opciones: [],
                descripcionFormaPago: '',
                valorSegunFormaPago: ''
            },
            comparativa: null
        };

        if (estado.asegurados.length === 0) {
            modelo.vacio = true;
            return modelo;
        }

        const aseguradosPorPlan = new Map<string, { plan: any; asegurados: any[] }>();
        estado.asegurados.forEach((asegurado: any) => {
            const plan = planesPorId.get(asegurado.planId) || null;
            const llave = plan?.id || 'sin-plan';
            if (!aseguradosPorPlan.has(llave)) aseguradosPorPlan.set(llave, { plan, asegurados: [] });
            aseguradosPorPlan.get(llave)!.asegurados.push(asegurado);
        });

        let primaTotalPoliza = 0;
        const resumenPlanes: any[] = [];
        this.filasCalculosPorPlan.clear();
        const totalesPolizaPorCobertura = new Map<string, { nombre: string; valorAsegurado: number; prima: number }>();
        const ajustesCredibilidad = esComparativaSinCredibilidad ? null : this.obtenerAjustesCredibilidad();
        // Patronal: no muestra los resúmenes de tasas por cobertura.
        // Voluntaria/Mixta: mantiene esos resúmenes fuera del listado de asegurados.
        const mostrarTasasCobertura = !this.esPolizaPatronal();
        const gruposPlanes = [...aseguradosPorPlan.values()].sort((grupoA, grupoB) => {
            if (!grupoA.plan) return grupoB.plan ? 1 : 0;
            if (!grupoB.plan) return -1;
            const obtenerOrdenAlfabetico = (plan: any) => {
                const letras = String(plan.nombre || '').match(/^Plan\s+([A-Z]+)(?:\s|$)/i)?.[1];
                return letras
                    ? [...letras.toUpperCase()].reduce((orden, letra) => orden * 26 + letra.charCodeAt(0) - 64, 0)
                    : null;
            };
            const ordenA = obtenerOrdenAlfabetico(grupoA.plan);
            const ordenB = obtenerOrdenAlfabetico(grupoB.plan);
            if (ordenA !== null && ordenB !== null && ordenA !== ordenB) return ordenA - ordenB;
            return String(grupoA.plan.nombre || '').localeCompare(String(grupoB.plan.nombre || ''), 'es', {
                numeric: true,
                sensitivity: 'base'
            });
        });
        const cantidadPlanesConAsegurados = gruposPlanes.filter(grupo => grupo.plan).length;
        let numeroPlan = 0;
        modelo.planes = gruposPlanes.map(({ plan, asegurados }) => {
            const coberturas: any[] = plan ? this.planService.obtenerCoberturasPlan(plan) : [];
            const secuenciaPlan = plan ? `PLAN ${++numeroPlan} DE ${cantidadPlanesConAsegurados}` : 'SIN PLAN ASIGNADO';
            const columnas = 2 + coberturas.length * 2;
            let primaTotalPlan = 0;
            const totalesPlanPorCobertura = new Map<string, { nombre: string; valorAsegurado: number; prima: number }>(
                coberturas.map(cobertura => [cobertura.codigo, {
                    nombre: cobertura.nombre || cobertura.codigo,
                    valorAsegurado: 0,
                    prima: 0
                }] as [string, { nombre: string; valorAsegurado: number; prima: number }])
            );
            const filas: FilaCalculoAsegurado[] = asegurados.map(asegurado => {
                const celdas: CeldaCalculoCobertura[] = coberturas.map(cobertura => {
                    const deducible = this.planService.obtenerDeducibleCoberturaPlan(plan, cobertura.codigo);
                    const tasaComercial = this.obtenerTasaPorEdad(cobertura, asegurado.edad, deducible, plan);
                    const tasaCredibilidad = this.obtenerTasaComercialConCredibilidadCobertura(asegurado, cobertura.codigo, ajustesCredibilidad);
                    const tasa = tasaCredibilidad ?? tasaComercial;
                    const valorAsegurado = this.calcularValorAseguradoCobertura(cobertura, asegurado);
                    const prima = tasa === undefined || valorAsegurado === null
                        ? null
                        : tasaCredibilidad !== undefined
                            ? Math.round(valorAsegurado * tasa * 100) / 100
                            : this.calcularPrimaCobertura(cobertura, valorAsegurado, asegurado.edad, deducible, plan);
                    if (prima !== null) primaTotalPlan += prima;
                    const totalPlan = totalesPlanPorCobertura.get(cobertura.codigo)!;
                    if (valorAsegurado !== null) totalPlan.valorAsegurado += valorAsegurado;
                    if (prima !== null) totalPlan.prima += prima;
                    return {
                        valorAsegurado: valorAsegurado === null ? '—' : formatearDinero(valorAsegurado),
                        prima: prima === null ? '—' : formatearDinero(prima)
                    };
                });
                return { documento: asegurado.numeroDocumento || '—', edad: asegurado.edad ?? '—', celdas };
            });
            if (plan) this.filasCalculosPorPlan.set(plan.id, filas);

            if (plan) {
                if (!esComparativaSinCredibilidad) plan.primaTotal = Math.round(primaTotalPlan * 100) / 100;
                primaTotalPoliza += primaTotalPlan;
                resumenPlanes.push({ plan, cantidadAsegurados: asegurados.length, primaTotal: primaTotalPlan, totales: totalesPlanPorCobertura });
                coberturas.forEach(cobertura => {
                    const totalPlan = totalesPlanPorCobertura.get(cobertura.codigo)!;
                    const totalPoliza = totalesPolizaPorCobertura.get(cobertura.codigo) || {
                        nombre: cobertura.nombre || cobertura.codigo,
                        valorAsegurado: 0,
                        prima: 0
                    };
                    totalPoliza.valorAsegurado += totalPlan.valorAsegurado;
                    totalPoliza.prima += totalPlan.prima;
                    totalesPolizaPorCobertura.set(cobertura.codigo, totalPoliza);
                });
            }

            const nombresComerciales = coberturas.map(cobertura => this.catalogoService.obtenerNombreComercialCobertura(cobertura.codigo));
            return {
                llave: plan?.id || 'sin-plan',
                plan,
                secuencia: secuenciaPlan,
                titulo: plan?.nombre || 'Sin plan asignado',
                descripcion: plan
                    ? `${asegurados.length} asegurado(s) · ${nombresComerciales.join(', ')}`
                    : 'Asigna estos asegurados a un plan para calcular sus coberturas.',
                cantidadAsegurados: asegurados.length,
                primaTotalPlan,
                primaTotalPlanTexto: plan ? formatearDinero(primaTotalPlan) : '—',
                etiquetaPrimaPorAsegurado: `Prima ${formaPago} por asegurado`,
                primaPorAsegurado: plan ? this.formatearPrimaPorAsegurado(primaTotalPlan, asegurados.length) : '—',
                tieneTabla: Boolean(plan),
                coberturas: coberturas.map((cobertura, indice) => ({
                    codigo: cobertura.codigo,
                    nombreComercial: nombresComerciales[indice],
                    encabezadoValor: `Valor aseg. ${nombresComerciales[indice]}`,
                    encabezadoPrima: `Prima ${nombresComerciales[indice]}`
                })),
                idListado: `listado-asegurados-${plan?.id}`,
                textoBotonVer: `Ver asegurados (${asegurados.length})`,
                textoBotonOcultar: 'Ocultar asegurados',
                filas,
                etiquetaTotalesCobertura: `Totales por cobertura ${plan?.nombre || ''}`,
                totalesCobertura: coberturas.map(cobertura => {
                    const total = totalesPlanPorCobertura.get(cobertura.codigo)!;
                    return { valorAsegurado: formatearDinero(total.valorAsegurado), prima: formatearDinero(total.prima) };
                }),
                etiquetaPrimaTotal: `Prima total ${plan?.nombre}`,
                colspanPrimaTotal: columnas - 1,
                tablaTasas: plan && mostrarTasasCobertura
                    ? this.construirTablaTasaPorCobertura(
                        this.construirFilasTasaPorCobertura(totalesPlanPorCobertura),
                        '',
                        `Tasas por cobertura · ${plan.nombre}`,
                        '',
                        'tabla-tasa-plan'
                    )
                    : null
            } as TarjetaCalculoPlan;
        });

        const filasTasaPoliza = this.construirFilasTasaPorCobertura(totalesPolizaPorCobertura);
        modelo.tablaTasasPoliza = mostrarTasasCobertura && filasTasaPoliza.length > 0
            ? this.construirTablaTasaPorCobertura(
                filasTasaPoliza,
                'TODOS LOS PLANES',
                'Tasas por cobertura · toda la póliza',
                '',
                'tabla-tasa-poliza'
            )
            : null;

        const totalVidaPoliza = totalesPolizaPorCobertura.get('WET')?.valorAsegurado || 0;
        const tasaUnicaPoliza = this.formatearTasaUnica(primaTotalPoliza, totalVidaPoliza);
        const cantidadAseguradosPoliza = resumenPlanes.reduce((total, item) => total + item.cantidadAsegurados, 0);
        const primaSegunFormaPago = this.calcularPrimaPorFormaPago(primaTotalPoliza);
        if (!esComparativaSinCredibilidad) {
            this.store.resumenCotizacion = {
                planes: resumenPlanes,
                totalesPoliza: totalesPolizaPorCobertura,
                primaTotalPoliza,
                tasaUnicaPoliza,
                sinPlan: gruposPlanes.some(grupo => !grupo.plan)
            };
        }

        if (esComparativaSinCredibilidad) {
            modelo.avisoComparativa = {
                titulo: 'Comparativa sin credibilidad',
                texto: 'Estos resultados se calculan sin usar la información de siniestros. Los datos de la póliza no se modifican.'
            };
        }

        modelo.totalesPoliza = {
            tasaUnica: tasaUnicaPoliza,
            primaTotalPoliza,
            primaTotalPolizaTexto: formatearDinero(primaTotalPoliza),
            etiquetaPrimaPorAsegurado: `Prima ${formaPago} por asegurado`,
            primaPorAsegurado: this.formatearPrimaPorAsegurado(primaTotalPoliza, cantidadAseguradosPoliza)
        };

        modelo.fraccionamiento.opciones = this.construirOpcionesFraccionamiento(primaTotalPoliza);
        modelo.fraccionamiento.descripcionFormaPago = this.catalogoService.obtenerDescripcionFormaPago();
        modelo.fraccionamiento.valorSegunFormaPago = formatearDinero(primaSegunFormaPago);

        if (estado.poliza.aplicaCredibilidad === true) {
            modelo.comparativa = {
                titulo: esComparativaSinCredibilidad ? '¿Deseas volver al cálculo con credibilidad?' : '¿Deseas revisar el cálculo sin credibilidad?',
                descripcion: esComparativaSinCredibilidad
                    ? 'Se volverán a mostrar los resultados que utilizan la información de siniestros.'
                    : 'Podrás comparar los resultados sin usar la información de siniestros, sin alterar la cotización actual.',
                textoBoton: esComparativaSinCredibilidad ? '← Volver a cálculo con credibilidad' : 'Ver comparativa sin credibilidad',
                mostrarSinCredibilidadAlPulsar: !esComparativaSinCredibilidad
            };
        }

        return modelo;
    }

    /* ---------- Paginación de la pantalla de cálculos ---------- */

    normalizarRegistrosPorPaginaCalculos(valor: any): number {
        const numero = Math.round(Number(valor));
        if (!Number.isFinite(numero)) return REGISTROS_POR_PAGINA_CALCULOS_MIN;
        return Math.min(REGISTROS_POR_PAGINA_MAX, Math.max(REGISTROS_POR_PAGINA_CALCULOS_MIN, numero));
    }

    /**
     * Lógica de renderizarPaginaCalculosPlan(llave) + renderizarBarraPaginacionCalculos.
     * Devuelve la página actual (ajusta y recuerda la página en `paginasCalculos`) de las filas del plan:
     * { filas (solo las visibles), pagina, totalPaginas, registrosPorPagina, listadoVisible, mostrarBarra,
     *   textoInfo: 'Mostrando 1-10 de 35', textoPagina: 'Página 1 de 4', enPrimera, enUltima }.
     * La plantilla muestra el tbody si `listadoVisible` y la barra si `mostrarBarra`; los botones primera/anterior
     * se deshabilitan con `enPrimera` y siguiente/última con `enUltima`.
     */
    obtenerPaginaCalculosPlan(llave: string): PaginaCalculosPlan {
        const filas = this.filasCalculosPorPlan.get(llave) || [];
        const totalPaginas = Math.max(1, Math.ceil(filas.length / this.registrosPorPaginaCalculos));
        const pagina = Math.min(Math.max(1, this.paginasCalculos.get(llave) || 1), totalPaginas);
        this.paginasCalculos.set(llave, pagina);
        const inicio = (pagina - 1) * this.registrosPorPaginaCalculos;
        const visibles = filas.slice(inicio, inicio + this.registrosPorPaginaCalculos);
        const listadoVisible = this.listadosCalculosExpandidos.has(llave);
        return {
            filas: visibles,
            pagina,
            totalPaginas,
            registrosPorPagina: this.registrosPorPaginaCalculos,
            listadoVisible,
            mostrarBarra: listadoVisible && filas.length > this.registrosPorPaginaCalculos,
            textoInfo: `Mostrando ${filas.length ? inicio + 1 : 0}-${inicio + visibles.length} de ${filas.length}`,
            textoPagina: `Página ${pagina} de ${totalPaginas}`,
            enPrimera: pagina <= 1,
            enUltima: pagina >= totalPaginas
        };
    }

    /** Botón 'Ver asegurados' / 'Ocultar asegurados' de la tarjeta del plan. Devuelve el nuevo estado (true = expandido). */
    alternarListadoCalculosPlan(llave: string): boolean {
        if (this.listadosCalculosExpandidos.has(llave)) {
            this.listadosCalculosExpandidos.delete(llave);
            return false;
        }
        this.listadosCalculosExpandidos.add(llave);
        return true;
    }

    /** Botones de la barra de paginación: 'primera' | 'anterior' | 'siguiente' | 'ultima'. */
    cambiarPaginaCalculos(llave: string, accion: 'primera' | 'anterior' | 'siguiente' | 'ultima'): void {
        const actual = this.paginasCalculos.get(llave) || 1;
        this.paginasCalculos.set(llave, accion === 'primera' ? 1
            : accion === 'anterior' ? actual - 1
            : accion === 'siguiente' ? actual + 1
            : Number.MAX_SAFE_INTEGER);
        this.obtenerPaginaCalculosPlan(llave);
    }

    /** Campo 'Registros por página (10-100)'. Devuelve el valor normalizado para reflejarlo en el input. */
    establecerRegistrosPorPaginaCalculos(valor: any): number {
        this.registrosPorPaginaCalculos = this.normalizarRegistrosPorPaginaCalculos(valor);
        this.paginasCalculos.clear();
        return this.registrosPorPaginaCalculos;
    }
}
