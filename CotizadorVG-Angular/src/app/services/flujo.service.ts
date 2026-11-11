import { ApplicationRef, inject, Injectable, Injector } from '@angular/core';
import { environment } from '../../environments/environment';
import { CLAVE_POLIZA_RENOVACION, TIPO_IDENTIFICACION_POR_PREFIJO } from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService, UMBRAL_ASEGURADOS_CARGA } from '../core/ui.service';
import {
    desplazarAnioFecha,
    generarUUID,
    normalizarCanalComercial,
    obtenerFechaActualISO,
    sumarDiasISO,
    sumarUnAnioISO
} from '../core/utils';
import { AseguradoService } from './asegurado.service';
import { AsignacionService } from './asignacion.service';
import { CalculoService } from './calculo.service';
import { CatalogoService } from './catalogo.service';
import { ImportacionService } from './importacion.service';

export type PantallaCotizador = 'landing' | 'renovacion' | 'wizard';

export interface PasoNavegacion {
    numero: number;
    activo: boolean;
    completado: boolean;
    estado: 'Completado' | 'En curso' | 'Pendiente';
}

/**
 * Flujo de negocio y navegación del cotizador (SECCIÓN 15 del app.js original):
 * pantallas (landing / renovación / wizard), búsqueda y selección de pólizas, navegación
 * entre pasos con sus validaciones, fechas por defecto y reinicios de estado.
 */
@Injectable({ providedIn: 'root' })
export class FlujoService {
    private store = inject(CotizadorStore);
    private ui = inject(UiService);
    private injector = inject(Injector);
    private appRef = inject(ApplicationRef);

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get catalogo() { return this.injector.get(CatalogoService); }
    private get calculo() { return this.injector.get(CalculoService); }
    private get aseguradoService() { return this.injector.get(AseguradoService); }
    private get importacion() { return this.injector.get(ImportacionService); }
    private get asignacion() { return this.injector.get(AsignacionService); }

    private get estado() { return this.store.estado; }

    /* ============================================================
       Estado de UI del flujo (reemplaza a mostrarSoloPantalla y a los
       style.display / hidden / textContent de las pantallas previas)
       ============================================================ */
    pantalla: PantallaCotizador = 'landing';

    // Búsqueda de pólizas de renovación
    modoBusqueda: 'tomador' | 'poliza' = 'tomador';
    tipoDocBusqueda = '';
    numDocBusqueda = '';
    numPolizaBusqueda = '';
    placeholderDocumentoBusqueda = 'Ej: 1020455161';
    ayudaDocumentoBusquedaVisible = false;
    polizasRenovacion: any[] = [];
    tituloResultados = '';
    resultadosVisibles = false;
    cargandoBusqueda = false;
    errorBusqueda = '';

    // Modal de confirmación "Volver al menú de inicio"
    mostrarModalMenuInicio = false;

    /* ============================================================
       Datos para las plantillas
       ============================================================ */

    get esBusquedaPorPoliza(): boolean {
        return this.modoBusqueda === 'poliza';
    }

    /** Texto del badge de flujo activo (`actualizarBadgeFlujo`); '' si no hay flujo. */
    get badgeFlujo(): string {
        const flujo = this.store.flujo;
        const etiquetas: Record<string, string> = {
            'nuevo-simulacion': 'Seguro Nuevo \u2014 Simulación',
            'nuevo-cotizacion': 'Seguro Nuevo - Plan Vida Integral',
            'renovacion': 'Modificación / Renovación'
        };
        if (!flujo.tipo) return '';
        const clave = flujo.tipo === 'renovacion' ? 'renovacion' : `${flujo.tipo}-${flujo.subtipo}`;
        return etiquetas[clave] || '';
    }

    /** Datos de la barra de pasos (`pasosNavegacion`). */
    get pasosNavegacion(): PasoNavegacion[] {
        const actual = this.store.pasoActual;
        return [1, 2, 3, 4, 5].map(numero => ({
            numero,
            activo: numero === actual,
            completado: numero < actual,
            estado: numero < actual ? 'Completado' : (numero === actual ? 'En curso' : 'Pendiente')
        }));
    }

    /** Ancho de la barra de progreso (entre el centro del primer y último paso). */
    get anchoProgreso(): string {
        const progreso = (this.store.pasoActual - 1) / 4;
        return `calc((100% - 100% / 5) * ${progreso})`;
    }

    /* ============================================================
       Búsqueda de renovación
       ============================================================ */

    cambiarModoBusquedaRenovacion(modo: 'tomador' | 'poliza'): void {
        this.modoBusqueda = modo === 'poliza' ? 'poliza' : 'tomador';
        this.resultadosVisibles = false;
        this.errorBusqueda = '';
        this.actualizarAyudaDocumentoBusqueda();
    }

    actualizarAyudaDocumentoBusqueda(): void {
        const esNit = this.tipoDocBusqueda === 'A';
        this.placeholderDocumentoBusqueda = esNit ? 'Ej: 8909037905' : 'Ej: 1020455161';
        this.ayudaDocumentoBusquedaVisible = esNit;
    }

    /** Clase `busqueda-form-con-ayuda-nit` del formulario. */
    get busquedaConAyudaNit(): boolean {
        return this.ayudaDocumentoBusquedaVisible && !this.esBusquedaPorPoliza;
    }

    private limpiarPantallaBusqueda(): void {
        this.resultadosVisibles = false;
        this.cargandoBusqueda = false;
        this.errorBusqueda = '';
    }

    normalizarPolizaRenovacion(fila: any): any {
        const texto = (valor: any) => String(valor ?? '').trim();
        const vigenciaIni = texto(fila.FECHA_INICIO_PRIMERA_VIGENCIA).slice(0, 10);
        return {
            documento: texto(fila.DNI_TOMADOR),
            nombreTomador: texto(fila.NOMBRE_TOMADOR),
            numero: texto(fila.NUMERO_POLIZA),
            polizaId: fila.POLIZA_ID ?? null,
            grupoProducto: texto(fila.GRUPO_PRODUCTO),
            canalComercial: texto(fila.NOMBRE_CANAL_COMERCIAL),
            grupoCanalComercial: texto(fila.NOMBRE_GRUPO_CANAL_COMERCIAL),
            codigoOficina: texto(fila.CODIGO_OFICINA),
            sucursal: texto(fila.NOMBRE_SUCURSAL),
            codigoAsesor: texto(fila.CODIGO_ASESOR),
            nombreAsesor: texto(fila.NOMBRE_ASESOR),
            vigenciaIni,
            vigenciaFin: sumarUnAnioISO(vigenciaIni)
        };
    }

    async buscarPolizasRenovacion(): Promise<void> {
        const tipoDoc = this.tipoDocBusqueda;
        const numDoc = (this.numDocBusqueda || '').trim().toUpperCase();

        if (!tipoDoc) {
            this.ui.mostrarToast('Selecciona el tipo de documento', 'warning');
            return;
        }
        if (!numDoc) {
            this.ui.mostrarToast('Ingresa el número de documento', 'warning');
            return;
        }

        // La API recibe un solo campo: prefijo del tipo de documento + número
        // (C = Cédula, E = Cédula de extranjería, A = NIT).
        const documentoTomador = `${tipoDoc}${numDoc}`;

        this.errorBusqueda = '';
        this.cargandoBusqueda = true;
        this.resultadosVisibles = false;

        try {
            const respuesta = await fetch(environment.apis.polizasTomador, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ DNI_TOMADOR: documentoTomador })
            });
            if (!respuesta.ok) throw new Error(`La API respondió HTTP ${respuesta.status}.`);

            const datos = await respuesta.json();
            const filas: any[] = Array.isArray(datos) ? datos : (datos?.value || datos?.Table1 || datos?.body || []);
            const polizas = filas.filter(fila => fila?.NUMERO_POLIZA).map(fila => this.normalizarPolizaRenovacion(fila));

            if (polizas.length === 0) {
                this.errorBusqueda = `No se encontraron pólizas para el documento ${documentoTomador}`;
                return;
            }

            const nombreTomador = polizas.find(poliza => poliza.nombreTomador)?.nombreTomador || documentoTomador;
            this.polizasRenovacion = polizas;
            this.tituloResultados = `${polizas.length} póliza(s) encontrada(s) para "${nombreTomador}"`;
            this.resultadosVisibles = true;
        } catch (error: any) {
            console.error('Error en búsqueda de pólizas:', error);
            this.errorBusqueda = `Error al consultar pólizas: ${error.message}`;
        } finally {
            this.cargandoBusqueda = false;
        }
    }

    seleccionarPolizaRenovacion(indice: number): void {
        const poliza = this.polizasRenovacion[indice];
        if (!poliza) return;

        try {
            localStorage.setItem(CLAVE_POLIZA_RENOVACION, JSON.stringify(poliza));
        } catch (error) {
            console.warn('No se pudo guardar la póliza seleccionada:', error);
        }

        const flujo = this.store.flujo;
        flujo.polizaSeleccionada = poliza;
        flujo.subtipo = 'cotizacion'; // renovación usa cotización con datos

        const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

        // Fechas: la renovación extiende 1 año desde el fin de la póliza anterior
        const vigNuevaDesde = poliza.vigenciaFin;
        const vigNuevaHasta = sumarUnAnioISO(poliza.vigenciaFin);
        const fechaCobro = poliza.vigenciaFin ? `${poliza.vigenciaFin.slice(0, 8)}01` : '';

        this.catalogo.limpiarDatosAsesor(true);
        this.estado.poliza.segmento = '';
        this.estado.poliza.direccionCorrespondencia = '';
        this.estado.poliza.validezOferta = '';
        this.limpiarCamposAdicionalesCotizacion();
        const p = this.estado.poliza;
        p.tomador = poliza.nombreTomador;
        p.tipoIdentificacion = TIPO_IDENTIFICACION_POR_PREFIJO[poliza.documento.charAt(0)] || 'CC';
        p.numeroIdentificacion = poliza.documento.slice(1);
        p.modalidadPlan = 'Voluntaria (Contributiva)';
        p.actividad = '';
        p.actividadDetalle = null;
        p.vigenciaDesde = vigNuevaDesde;
        p.vigenciaHasta = vigNuevaHasta;
        p.fechaCobro = fechaCobro;
        p.numeroPoliza = String(poliza.numero || '');
        p.comision = 20;
        p.honorarioPromotora = 10;
        p.codigoAsesor = poliza.codigoAsesor;
        p.canalComercial = normalizarCanalComercial(poliza.canalComercial);

        /* ---- Generar asegurados aleatorios (cantidad igual a la póliza seleccionada) ---- */
        const cantidad: number = poliza.asegurados || (50 + Math.floor(Math.random() * 151));
        const smmlv = 1_300_000;
        const salariosBases = [1.5 * smmlv, 2.5 * smmlv, 4 * smmlv, 7 * smmlv, 12 * smmlv];
        const nombresM = ['Carlos', 'Juan', 'Andrés', 'Santiago', 'Luis', 'Miguel', 'David', 'Daniel', 'Jorge', 'Sergio'];
        const nombresF = ['María', 'Ana', 'Laura', 'Claudia', 'Paola', 'Sandra', 'Adriana', 'Diana', 'Patricia', 'Gloria'];
        const apellidos = ['García', 'López', 'Martínez', 'Rodríguez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Vargas'];

        this.estado.asegurados = [];
        for (let i = 1; i <= cantidad; i++) {
            const esMasculino = Math.random() > 0.45;
            const nombre = esMasculino ? rand(nombresM) : rand(nombresF);
            const apellido = rand(apellidos) + ' ' + rand(apellidos);
            const salarioMensual = rand(salariosBases) + (Math.random() - 0.5) * smmlv;
            const edad = 25 + Math.floor(Math.random() * 31); // 25-55

            this.estado.asegurados.push({
                id: generarUUID(),
                tipoDocumento: 'Cédula',
                numeroDocumento: String(10_000_000 + Math.floor(Math.random() * 90_000_000)),
                nombreCompleto: `${nombre} ${apellido}`,
                edad,
                sexo: esMasculino ? 'Masculino' : 'Femenino',
                ocupacion: this.importacion.salarioAOcupacion(salarioMensual),
                salario: Math.round(salarioMensual),
                coberturas: this.aseguradoService.generarCoberturasPorDefecto(0),
                subgrupoId: null,
                planId: null,
                primaIndividual: 0,
                simulado: true
            });
        }

        this.mostrarWizard();
        this.catalogo.cargarActividadesEconomicas();
        this.ui.mostrarToast(`Póliza ${poliza.numero} cargada · ${cantidad} asegurados generados`, 'success');

        // Equivale al setTimeout que poblaba los campos del DOM: aquí los campos leen el estado.
        this.catalogo.actualizarCamposComerciales();

        // El asesor, su oficina y su canal se resuelven con la API de asesores
        if (poliza.codigoAsesor) {
            this.catalogo.campoCodigoAsesor = poliza.codigoAsesor;
            this.catalogo.ultimoCodigoAsesorConsultado = '';
            this.catalogo.consultarAsesorPorCodigo();
        }
        this.store.guardarEstado();
    }

    /* ============================================================
       Navegación entre pantallas
       ============================================================ */

    seleccionarTipoNegocio(tipo: 'nuevo' | 'renovacion'): void {
        const flujo = this.store.flujo;
        flujo.tipo = tipo;
        flujo.subtipo = null;
        flujo.polizaSeleccionada = null;

        if (tipo === 'nuevo') {
            this.seleccionarSubtipo('cotizacion');
        } else {
            this.reiniciarDatosCotizacion();
            this.pantalla = 'renovacion';
            this.tipoDocBusqueda = '';
            this.numDocBusqueda = '';
            this.actualizarAyudaDocumentoBusqueda();
            this.limpiarPantallaBusqueda();
        }
    }

    seleccionarSubtipo(subtipo: 'simulacion' | 'cotizacion'): void {
        this.store.flujo.subtipo = subtipo;
        this.reiniciarDatosCotizacion();
        this.mostrarWizard();
        this.catalogo.cargarActividadesEconomicas();
    }

    volverAlLanding(): void {
        this.pantalla = 'landing';
        const flujo = this.store.flujo;
        flujo.tipo = null;
        flujo.subtipo = null;
        flujo.polizaSeleccionada = null;
    }

    mostrarWizard(): void {
        this.pantalla = 'wizard';
        // El badge y los paneles del paso 2 se derivan del flujo en las plantillas.
        this.catalogo.actualizarCampoPagoMensual();
        this.irAlPaso(1);
    }

    /* ---- Header: botón Menú Inicio ---- */

    irAlMenuInicio(): void {
        this.mostrarModalMenuInicio = true;
    }

    cerrarConfirmacionMenuInicio(): void {
        this.mostrarModalMenuInicio = false;
    }

    confirmarMenuInicio(): void {
        this.cerrarConfirmacionMenuInicio();
        this.reiniciarDatosCotizacion();
        this.store.flujo = { tipo: null, subtipo: null, polizaSeleccionada: null };
        this.tipoDocBusqueda = '';
        this.numDocBusqueda = '';
        this.numPolizaBusqueda = '';
        this.limpiarPantallaBusqueda();
        this.cambiarModoBusquedaRenovacion('tomador');
        this.pantalla = 'landing';
    }

    /* ============================================================
       Reinicios de datos
       ============================================================ */

    /** Equivale al `form.reset()` + quitar `campo-invalido` del formulario del paso 1. */
    private reiniciarCamposPaso1(): void {
        const catalogo = this.catalogo;
        catalogo.consultaAsesorEnCurso++;
        catalogo.ultimoCodigoAsesorConsultado = '';
        catalogo.textoActividad = '';
        catalogo.retornoCampoTexto = null;
        catalogo.invalidos = {};
    }

    limpiarDatosGeneralesPoliza(): void {
        this.reiniciarCamposPaso1();

        Object.assign(this.estado.poliza, {
            tomador: '',
            tipoIdentificacion: 'NIT',
            numeroIdentificacion: '',
            modalidadPlan: 'Patronal (No Contributiva)',
            actividad: '',
            actividadDetalle: null,
            vigenciaDesde: '',
            vigenciaHasta: '',
            formaPago: 'Anual',
            tipoPagoMensual: 'Vencida',
            fechaCobro: '',
            numeroPoliza: '',
            segmento: '',
            direccionCorrespondencia: '',
            validezOferta: '',
            comision: 20,
            retorno: 0,
            honorarioPromotora: 10,
            aplicaCredibilidad: false,
            valorSiniestrosTotales: 0,
            anosExposicion: 0,
            siniestrosPromedio: 0,
            siniestrosInformados: false,
            detalleSiniestrosCobertura: false,
            gruposSiniestrosPoliza: [],
            siniestrosPorCobertura: [],
            codigoAsesor: '',
            asesor: '',
            regional: '',
            oficinasAsesor: [],
            oficinaAsesor: '',
            codigoOficinaAsesor: '',
            canalComercial: ''
        });

        this.catalogo.validarComisionRetorno(false);
        this.limpiarCamposAdicionalesCotizacion();
        this.establecerFechasDefault();
        this.catalogo.limpiarDatosAsesor(true);
        this.catalogo.actualizarCampoPagoMensual();
        this.catalogo.actualizarAplicacionCredibilidad(true);
        this.catalogo.ocultarListaActividades();
        this.calculo.recalcularTodo();
    }

    reiniciarDatosCotizacion(): void {
        this.reiniciarCamposPaso1();
        this.store.pasoActual = 1;
        this.estado.asegurados = [];
        this.estado.subgrupos = [];
        this.estado.planes = [];
        this.store.coberturasDisponibles = [...this.store.catalogoCoberturasCompleto];
        this.estado.coberturasCatalogo = this.store.crearCatalogoInicial();
        this.estado.poliza = {
            id: generarUUID(),
            tomador: '', tipoIdentificacion: 'NIT', numeroIdentificacion: '',
            modalidadPlan: 'Patronal (No Contributiva)', actividad: '', vigenciaDesde: '', vigenciaHasta: '',
            actividadDetalle: null,
            oficina: '', formaPago: 'Anual', tipoPagoMensual: 'Vencida', fechaCobro: '',
            condicionesEspeciales: '',
            esContinuidad: false, numeroPolizaAnterior: '', companiaAnterior: '',
            numeroPoliza: '', segmento: '', direccionCorrespondencia: '', validezOferta: '',
            comision: 20, retorno: 0, honorarioPromotora: 10,
            aplicaCredibilidad: false,
            valorSiniestrosTotales: 0, anosExposicion: 0, siniestrosPromedio: 0,
            siniestrosInformados: false, detalleSiniestrosCobertura: false, gruposSiniestrosPoliza: [], siniestrosPorCobertura: [],
            codigoAsesor: '', asesor: '', regional: '', oficinasAsesor: [], oficinaAsesor: '', codigoOficinaAsesor: '',
            canalComercial: ''
        };
        this.catalogo.validarComisionRetorno(false);
        this.limpiarCamposAdicionalesCotizacion();
        this.establecerFechasDefault();
        this.catalogo.limpiarDatosAsesor(true);
        this.catalogo.actualizarAplicacionCredibilidad(true);
        this.catalogo.actualizarSiniestralidad(true);
        this.catalogo.ocultarListaActividades();
        this.store.guardarEstado();
    }

    limpiarCamposAdicionalesCotizacion(): void {
        const poliza = this.estado.poliza;
        poliza.numeroPoliza = '';
        poliza.segmento = '';
        poliza.direccionCorrespondencia = '';
        poliza.validezOferta = sumarDiasISO(obtenerFechaActualISO(), 30);
    }

    limpiarEstado(): void {
        this.ui.mostrarConfirmacionCotizador({
            titulo: 'Limpiar datos',
            mensaje: '¿Deseas limpiar todos los datos? Esta acción no se puede deshacer.',
            textoConfirmar: 'Limpiar datos',
            accion: () => this.limpiarEstadoConfirmado()
        });
    }

    limpiarEstadoConfirmado(): void {
        this.store.borrarEstadoGuardado();
        this.store.reiniciarEstado(); // estado nuevo, pasoActual = 1 y flujo vacío
        this.reiniciarCamposPaso1();
        this.limpiarCamposAdicionalesCotizacion();
        this.catalogo.limpiarDatosAsesor(true);
        this.catalogo.actualizarAplicacionCredibilidad(true);
        this.catalogo.actualizarSiniestralidad(true);
        this.pantalla = 'landing';
        this.ui.mostrarToast('Datos limpiados correctamente', 'success');
    }

    /* ============================================================
       Inicialización y fechas
       ============================================================ */

    /** Equivale a `inicializar()` del app.js (lo invoca el shell al montarse). */
    inicializar(): void {
        const catalogo = this.catalogo;
        this.store.cargarEstado();
        catalogo.sincronizarCamposPaso1(); // campo retorno / asesor / actividad desde el estado
        catalogo.ajustarRetornoAlLimite();
        catalogo.validarComisionRetorno(false);
        this.establecerFechasDefault();
        catalogo.actualizarCamposComerciales(); // de setupEventListeners
        catalogo.actualizarAplicacionCredibilidad(true);
        catalogo.actualizarSiniestralidad(true);
        catalogo.cargarCatalogoCoberturas();

        // Mostrar pantalla de inicio (no ir directo al wizard)
        this.pantalla = 'landing';
    }

    sincronizarVigencia(campoModificado: string, valor: string): void {
        if (!valor) return;
        const esDesde = campoModificado === 'vigenciaDesde';
        const hoy = obtenerFechaActualISO();
        const fechaMinimaDesde = sumarDiasISO(hoy, -60);
        let fechaDesde = valor;
        if (!esDesde) {
            fechaDesde = desplazarAnioFecha(valor, -1);
        }
        if (fechaDesde < fechaMinimaDesde) fechaDesde = fechaMinimaDesde;
        const fechaHasta = esDesde ? desplazarAnioFecha(fechaDesde, 1) : valor;
        if (!fechaDesde || !fechaHasta) return;

        this.estado.poliza.vigenciaDesde = fechaDesde;
        this.estado.poliza.vigenciaHasta = fechaHasta;
        this.store.guardarEstado();
    }

    sincronizarFechaCobro(valor: string): void {
        const hoy = obtenerFechaActualISO();
        this.estado.poliza.fechaCobro = !valor || valor < hoy ? hoy : valor;
        this.store.guardarEstado();
    }

    establecerFechasDefault(): void {
        const poliza = this.estado.poliza;
        const hoy = obtenerFechaActualISO();
        const proxAnio = desplazarAnioFecha(hoy, 1);

        const fechaMinimaDesde = sumarDiasISO(hoy, -60);
        if (!poliza.vigenciaDesde || poliza.vigenciaDesde < fechaMinimaDesde) {
            poliza.vigenciaDesde = hoy;
        }

        const fechaMinHasta = poliza.vigenciaDesde || hoy;
        if (!poliza.vigenciaHasta || poliza.vigenciaHasta < fechaMinHasta) {
            poliza.vigenciaHasta = proxAnio;
        }

        if (!poliza.fechaCobro || poliza.fechaCobro < hoy) {
            poliza.fechaCobro = hoy;
        }

        if (!poliza.validezOferta || poliza.validezOferta < hoy) {
            poliza.validezOferta = sumarDiasISO(hoy, 30);
        }
    }

    /* ============================================================
       Navegación entre pasos
       ============================================================ */

    irAlPaso(numero: number): void {
        const store = this.store;
        const catalogo = this.catalogo;
        if (numero < 1 || numero > 5) return;
        if (numero > store.pasoActual && store.pasoActual === 1 && !catalogo.validarComisionRetorno(true)) return;
        if (numero > store.pasoActual && store.pasoActual === 5 && !catalogo.validarDatosContinuidad(true)) return;
        if (numero === 2 && store.pasoActual === 1 && !catalogo.validarSiniestralidadRequerida()) return;
        if (numero === 3 && !this.aseguradoService.validarValoresMinimosParaCotizar()) return;
        if (numero === 5 && !this.asignacion.validarAseguradosAsignadosParaCalculos()) return;

        const aplicarPaso = () => {
            store.pasoActual = numero;
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            if (document.documentElement) document.documentElement.scrollTop = 0;
            if (document.body) document.body.scrollTop = 0;
            store.guardarEstado();
            store.notificarCambio();
        };

        const total = this.estado.asegurados.length;
        if (numero >= 4 && total >= UMBRAL_ASEGURADOS_CARGA) {
            // Con muchos asegurados se muestra primero el indicador de carga y el paso se monta
            // (render síncrono) mientras el indicador sigue visible.
            const resultado = this.ui.ejecutarConCarga(total, 'Calculando, por favor espera...', () => {
                aplicarPaso();
                this.appRef.tick();
            });
            Promise.resolve(resultado).catch(error => console.error('No fue posible abrir el paso:', error));
        } else {
            aplicarPaso();
        }
    }
}
