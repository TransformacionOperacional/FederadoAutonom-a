import { inject, Injectable, Injector } from '@angular/core';
import { environment } from '../../environments/environment';
import {
    AGRUPACIONES_SINIESTROS,
    AMPAROS_RESUMIDOS_DEFINITIVOS,
    CAMPOS_ACTIVIDAD_POR_COBERTURA,
    NOMBRES_AMPARO_RESUMIDO,
    NOMBRES_COMERCIALES_COBERTURA,
    TASA_BASE_SISTEMA
} from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService } from '../core/ui.service';
import {
    formatearValorMonetario,
    normalizarCanalComercial,
    normalizarTexto,
    obtenerAmparoResumidoDefinitivo,
    obtenerValorMonetario
} from '../core/utils';
import { AseguradoService } from './asegurado.service';
import { AsignacionService } from './asignacion.service';
import { CalculoService } from './calculo.service';
import { FlujoService } from './flujo.service';

/** Fila de la lista de siniestros por agrupación (reemplaza a renderizarListaSiniestrosCobertura). */
export interface FilaSiniestroCobertura {
    grupo: (typeof AGRUPACIONES_SINIESTROS)[number];
    item: any;
    activa: boolean;
    vacio: boolean;
    texto: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
    private store = inject(CotizadorStore);
    private ui = inject(UiService);
    private injector = inject(Injector);

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get calculo() { return this.injector.get(CalculoService); }
    private get flujo() { return this.injector.get(FlujoService); }
    private get aseguradoService() { return this.injector.get(AseguradoService); }
    private get asignacion() { return this.injector.get(AsignacionService); }

    private get estado() { return this.store.estado; }
    private get poliza() { return this.store.estado.poliza; }

    /* ============================================================
       Estado interno (variables sueltas del app.js original)
       ============================================================ */
    ultimoCodigoAsesorConsultado = '';
    consultaAsesorEnCurso = 0;
    formaPagoPendiente: string | null = null;
    temporizadorRecalculoSiniestralidad: ReturnType<typeof setTimeout> | null = null;

    /* ============================================================
       Estado de UI del Paso 1 (reemplaza lecturas/escrituras al DOM)
       ============================================================ */
    // Asesor
    campoCodigoAsesor = '';
    ayudaCodigoAsesor = '';

    // Actividad económica
    textoActividad = '';
    actividadDeshabilitada = true;
    placeholderActividad = 'Busca una actividad económica...';
    ayudaActividadVisible = true;
    listaActividadesVisible = false;
    coincidenciasActividades: { actividad: any; indice: number }[] = [];

    // Comisión / retorno. `retornoCampoTexto` solo es distinto de null mientras el usuario escribe.
    retornoCampoTexto: string | null = null;

    // Siniestralidad
    campoAplicaCredibilidad: 'si' | 'no' = 'no';
    campoDetalleSiniestros: 'si' | 'no' = 'no';
    campoValorSiniestrosTotales = '';
    campoAnosExposicion: number | string | null = '';
    campoSiniestrosPromedio = '';
    modalGruposSiniestrosVisible = false;
    gruposSiniestrosSeleccionados: string[] = [];

    /** Equivale a la clase `campo-invalido` de cada campo (clave = id original del campo). */
    invalidos: Record<string, boolean> = {};

    /* ============================================================
       SECCIÓN 5: GESTIÓN DE COBERTURAS
       ============================================================ */

    editarCobertura(_codigoCobertura?: string): void {
        this.ui.mostrarToast('La tasa base es definida por el sistema y no se puede modificar.', 'info');
    }

    /** `codigo` es el amparo elegido en el selector `coberturaDisponible` del paso 3. */
    async agregarCobertura(codigo: string): Promise<void> {
        const cobertura = this.store.coberturasDisponibles.find(item => item.codigo === codigo);
        if (!cobertura) {
            this.ui.mostrarToast('Selecciona un amparo para agregar.', 'warning');
            return;
        }
        if (this.estado.coberturasCatalogo.some(item => item.codigo === codigo)) {
            this.ui.mostrarToast('El amparo seleccionado ya está configurado.', 'warning');
            return;
        }

        this.estado.coberturasCatalogo.push({ ...cobertura, tasaBase: TASA_BASE_SISTEMA, obligatoria: false });

        // Agregar cobertura a todos los asegurados
        this.estado.asegurados.forEach((a: any) => {
            a.coberturas.push({
                codigo: codigo,
                codigoAmparo: cobertura.codigoAmparo,
                nombre: cobertura.nombre,
                activa: false,
                valorAsegurado: 0,
                tasa: TASA_BASE_SISTEMA,
                prima: 0
            });
        });

        this.calculo.recalcularTodo();
        this.ui.mostrarToast('Amparo agregado. Consultando tasas por edad...', 'info');

        try {
            await this.consultarTasasCoberturas();
            this.calculo.recalcularTodo();
            this.ui.mostrarToast('Amparo agregado y tasas por edad actualizadas.', 'success');
        } catch (error) {
            console.error('No fue posible consultar las tasas de coberturas:', error);
            this.ui.mostrarToast('Amparo agregado, pero no fue posible consultar las tasas por edad.', 'warning');
        }
    }

    async consultarTasasCoberturas(): Promise<void> {
        const codigosAmparo = [...new Set(
            this.estado.coberturasCatalogo
                .map(cobertura => cobertura.codigoAmparo)
                .filter(codigo => codigo !== undefined && codigo !== null && codigo !== '')
                .map(codigo => String(codigo).replace(/\.0$/, ''))
        )].join(',');

        if (!codigosAmparo) {
            throw new Error('No hay códigos de amparo para consultar.');
        }

        const filas = await this.consultarTasasEnApi(codigosAmparo);
        const filasCoreGW = filas.filter((fila: any) => String(fila.Core ?? '').trim().toUpperCase() === 'GW');
        if (filasCoreGW.length === 0) {
            throw new Error('La API no devolvió tasas para amparos del Core GW.');
        }

        this.actualizarDatosTasasDesdeFilas(filasCoreGW);

        this.store.guardarEstado();
        this.store.notificarCambio(); // renderizarTablaCalculos + renderizarAsignacionPlanes
        console.info('Tasas y edades máximas Core GW actualizadas:', this.estado.tasasPorCoberturaEdad, this.estado.edadesMaximasPorCobertura);
    }

    actualizarDatosTasasDesdeFilas(filas: any[]): void {
        const tasasPorCoberturaEdad: Record<string, any> = {};
        const tasasPorCoberturaEdadDeducible: Record<string, any> = {};
        const porcentajesFactorPorCoberturaEdad: Record<string, any> = {};
        const valoresMaximosPorCoberturaEdad: Record<string, any> = {};
        const edadesMaximasPorCobertura: Record<string, any> = {};

        filas.forEach(fila => {
            const codigoAmparo = String(fila.Codigo_Amparo ?? '').replace(/\.0$/, '');
            const edad = Number(fila.Edad);
            const tasa = Number(fila['Tasa -20%']);
            const deducible = String(fila.Deducible ?? '').trim();
            const porcentajeFactor = Number(fila.Porcentaje_Factor);
            const valorMaximoRaw = fila.Valor_Maximo;
            const valorMaximo = valorMaximoRaw === null
                || valorMaximoRaw === undefined
                || String(valorMaximoRaw).trim() === ''
                || String(valorMaximoRaw).trim().toUpperCase() === 'NULL'
                ? undefined
                : Number(valorMaximoRaw);
            const edadMaxima = Number(fila.Edad_Maxima ?? fila['Edad Maxima'] ?? fila['Edad Máxima']);
            if (codigoAmparo && Number.isFinite(edad) && Number.isFinite(tasa)) {
                tasasPorCoberturaEdad[`${codigoAmparo}-${edad}`] = tasa;
                if (deducible) tasasPorCoberturaEdadDeducible[`${codigoAmparo}-${edad}-${deducible}`] = tasa;
            }
            if (codigoAmparo && Number.isFinite(edad) && Number.isFinite(porcentajeFactor)) {
                porcentajesFactorPorCoberturaEdad[`${codigoAmparo}-${edad}`] = porcentajeFactor;
            }
            if (codigoAmparo && Number.isFinite(edad) && valorMaximo !== undefined && valorMaximo >= 0) {
                const llave = `${codigoAmparo}-${edad}`;
                valoresMaximosPorCoberturaEdad[llave] = Math.min(valoresMaximosPorCoberturaEdad[llave] ?? valorMaximo, valorMaximo);
            }
            if (codigoAmparo && Number.isFinite(edadMaxima)) {
                edadesMaximasPorCobertura[codigoAmparo] = Math.min(edadesMaximasPorCobertura[codigoAmparo] ?? edadMaxima, edadMaxima);
            }
        });

        this.estado.tasasPorCoberturaEdad = tasasPorCoberturaEdad;
        this.estado.tasasPorCoberturaEdadDeducible = tasasPorCoberturaEdadDeducible;
        this.estado.porcentajesFactorPorCoberturaEdad = porcentajesFactorPorCoberturaEdad;
        this.estado.valoresMaximosPorCoberturaEdad = valoresMaximosPorCoberturaEdad;
        this.estado.edadesMaximasPorCobertura = edadesMaximasPorCobertura;
    }

    async consultarTasasEnApi(codigosAmparo: string): Promise<any[]> {
        const respuesta = await fetch(environment.apis.tasasCoberturas, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ CodigosAmparo: codigosAmparo })
        });

        if (!respuesta.ok) {
            throw new Error(`La API de tasas respondió HTTP ${respuesta.status}.`);
        }

        const datos = await respuesta.json();
        const filas = Array.isArray(datos.Table1) ? datos.Table1 : [];
        if (filas.length === 0) {
            throw new Error('La API no devolvió tasas en Table1.');
        }
        return filas;
    }

    async cargarActividadesEconomicas(): Promise<void> {
        this.actividadDeshabilitada = true;
        this.textoActividad = '';
        this.placeholderActividad = 'Cargando actividades económicas...';
        this.ayudaActividadVisible = true;

        try {
            const respuesta = await fetch(environment.apis.actividadesEconomicas, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ Usuario: environment.apiUsuario, Contrasena: environment.apiContrasena })
            });
            if (!respuesta.ok) throw new Error(`La API respondió HTTP ${respuesta.status}.`);

            const datos = await respuesta.json();
            this.store.actividadesEconomicas = Array.isArray(datos) ? datos : (datos.value || datos.Table1 || []);
            if (!this.store.actividadesEconomicas.length) throw new Error('La API no devolvió actividades económicas.');

            this.placeholderActividad = 'Busca una actividad económica...';
            this.actividadDeshabilitada = false;
        } catch (error) {
            console.error('No fue posible cargar las actividades económicas:', error);
            this.placeholderActividad = 'No fue posible cargar las actividades';
            this.ui.mostrarToast('No fue posible cargar las actividades económicas.', 'warning');
        } finally {
            this.ayudaActividadVisible = false;
        }
    }

    /* ============================================================
       Asesor / oficina
       ============================================================ */

    limpiarDatosAsesor(limpiarCodigo = false): void {
        if (limpiarCodigo) this.campoCodigoAsesor = '';
        this.ayudaCodigoAsesor = '';
        this.poliza.asesor = '';
        this.poliza.oficinasAsesor = [];
        this.poliza.oficinaAsesor = '';
        this.poliza.codigoOficinaAsesor = '';
        this.poliza.regional = '';
        this.poliza.canalComercial = '';
        this.actualizarCamposComerciales();
    }

    /** Índice de la oficina seleccionada (valor del `<select>` de oficinas; '' = ninguna). */
    get indiceOficinaAsesor(): string {
        const lista: any[] = this.poliza.oficinasAsesor || [];
        const indiceActual = lista.findIndex(oficina =>
            oficina.codigo === this.poliza.codigoOficinaAsesor && oficina.nombre === this.poliza.oficinaAsesor);
        return indiceActual >= 0 ? String(indiceActual) : '';
    }

    seleccionarOficinaAsesor(indice: number | string): void {
        const oficina = (this.poliza.oficinasAsesor || [])[Number(indice)];
        this.poliza.oficinaAsesor = oficina ? oficina.nombre : '';
        this.poliza.codigoOficinaAsesor = oficina ? oficina.codigo : '';
        this.poliza.regional = oficina ? oficina.regional : '';
        this.poliza.canalComercial = oficina ? oficina.canal : '';

        this.ayudaCodigoAsesor = '';
        if (oficina && !oficina.canal) {
            this.ayudaCodigoAsesor = 'El canal comercial de la oficina no es reconocido.';
            this.ui.mostrarToast(`Canal comercial no reconocido: ${oficina.canalOriginal || 'sin dato'}.`, 'warning');
        }
        this.actualizarCamposComerciales();
    }

    extraerFilasAsesor(datos: any): any[] {
        const candidatos = [datos, datos?.ResultSets?.Table1, datos?.value, datos?.Table1, datos?.data];
        const filas = candidatos.find(Array.isArray) || [];
        return filas.map((fila: any) => Object.fromEntries(
            Object.entries(fila || {}).map(([clave, valor]) => [clave.toUpperCase(), valor])
        ));
    }

    /** Evento `input` del campo código de asesor. */
    alIngresarCodigoAsesor(valor: string): void {
        this.campoCodigoAsesor = valor;
        this.ultimoCodigoAsesorConsultado = '';
        this.limpiarDatosAsesor();
        this.poliza.codigoAsesor = valor.trim();
        this.store.guardarEstado();
    }

    async consultarAsesorPorCodigo(): Promise<void> {
        const codigo = this.campoCodigoAsesor.trim();
        this.poliza.codigoAsesor = codigo;
        if (!codigo) {
            this.ultimoCodigoAsesorConsultado = '';
            this.limpiarDatosAsesor();
            this.store.guardarEstado();
            return;
        }
        if (codigo === this.ultimoCodigoAsesorConsultado) return;

        this.ultimoCodigoAsesorConsultado = codigo;
        const consultaId = ++this.consultaAsesorEnCurso;
        this.limpiarDatosAsesor();
        this.ayudaCodigoAsesor = 'Consultando asesor...';

        try {
            const respuesta = await fetch(environment.apis.asesores, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ Usuario: environment.apiUsuario, Contrasena: environment.apiContrasena, CodigoAsesor: codigo })
            });
            if (!respuesta.ok) throw new Error(`La API respondió HTTP ${respuesta.status}.`);

            const filas = this.extraerFilasAsesor(await respuesta.json());
            if (consultaId !== this.consultaAsesorEnCurso) return;

            const filasAsesor = filas.filter(fila => fila.NOMBRE_ASESOR);
            if (!filasAsesor.length) {
                this.ultimoCodigoAsesorConsultado = '';
                this.ayudaCodigoAsesor = 'No se encontró un asesor con ese código.';
                this.ui.mostrarToast('No se encontró un asesor con ese código.', 'warning');
                return;
            }

            const clavesVistas = new Set<string>();
            const oficinasAsesor: any[] = [];
            filasAsesor.forEach(fila => {
                const nombre = String(fila.SUCURSAL || '').trim();
                const codigoOficina = String(fila.CODIGO_OFICINA || '').trim();
                const clave = `${codigoOficina}|${nombre}`;
                if (!nombre || clavesVistas.has(clave)) return;
                clavesVistas.add(clave);
                oficinasAsesor.push({
                    codigo: codigoOficina,
                    nombre,
                    regional: String(fila.REGIONAL || '').trim(),
                    canal: normalizarCanalComercial(fila.CANAL_COMERCIAL),
                    canalOriginal: fila.CANAL_COMERCIAL
                });
            });

            this.poliza.asesor = String(filasAsesor[0].NOMBRE_ASESOR).trim();
            this.poliza.oficinasAsesor = oficinasAsesor;

            if (oficinasAsesor.length === 1) {
                this.seleccionarOficinaAsesor(0);
            } else {
                this.actualizarCamposComerciales();
                this.ayudaCodigoAsesor = oficinasAsesor.length
                    ? 'El asesor tiene varias oficinas. Selecciona una.'
                    : 'El asesor no tiene oficinas asociadas.';
            }
        } catch (error) {
            if (consultaId !== this.consultaAsesorEnCurso) return;
            console.error('No fue posible consultar el asesor:', error);
            this.ultimoCodigoAsesorConsultado = '';
            this.ayudaCodigoAsesor = 'No fue posible consultar el asesor. Intenta de nuevo.';
            this.ui.mostrarToast('No fue posible consultar el asesor.', 'warning');
        }
    }

    /* ============================================================
       Actividad económica
       ============================================================ */

    /** Calcula las coincidencias del buscador y abre la lista (renderizarActividadesEconomicas). */
    renderizarActividadesEconomicas(): void {
        if (this.actividadDeshabilitada) return;

        const texto = normalizarTexto(this.textoActividad);
        this.coincidenciasActividades = this.store.actividadesEconomicas
            .map((actividad, indice) => ({ actividad, indice }))
            .filter(({ actividad }) => normalizarTexto(actividad.field_1 || actividad.Title || '').includes(texto));
        this.listaActividadesVisible = true;
    }

    ocultarListaActividades(): void {
        this.listaActividadesVisible = false;
    }

    nombreActividad(actividad: any): string {
        return actividad?.field_1 || actividad?.Title || 'Actividad sin nombre';
    }

    /** Evento `input` del buscador de actividad. */
    alIngresarActividad(valor: string): void {
        this.textoActividad = valor;
        this.poliza.actividad = '';
        this.poliza.actividadDetalle = null;
        this.renderizarActividadesEconomicas();
    }

    esNoAsegurableActividad(valor: any): boolean {
        return String(valor ?? '').trim().toUpperCase() === 'NO ASEGURABLE';
    }

    actualizarActividadEconomica(indice: number | string): void {
        const actividad = this.store.actividadesEconomicas[Number(indice)] || null;
        if (!actividad) return;
        this.textoActividad = actividad.field_1 || actividad.Title || '';
        this.poliza.actividad = actividad?.field_1 || '';
        this.poliza.actividadDetalle = actividad;
        this.actualizarCoberturasPorActividad();
        this.store.guardarEstado();

        if (actividad && this.esNoAsegurableActividad(actividad.field_3)) {
            this.asignacion.mostrarAlertaRango('La actividad seleccionada no es asegurable.', this.obtenerElemento('#actividad'), 'Actividad no asegurable');
        }
        this.ocultarListaActividades();
    }

    actualizarCoberturasPorActividad(): void {
        const actividad = this.poliza.actividadDetalle;
        this.store.coberturasDisponibles = this.store.catalogoCoberturasCompleto.filter(cobertura => {
            const campo = (CAMPOS_ACTIVIDAD_POR_COBERTURA as Record<string, string>)[cobertura.codigo];
            return !campo || !this.esNoAsegurableActividad(actividad?.[campo]);
        });
        const codigosPermitidos = new Set(this.store.coberturasDisponibles.map(cobertura => cobertura.codigo));
        this.estado.coberturasCatalogo = this.estado.coberturasCatalogo.filter(cobertura => codigosPermitidos.has(cobertura.codigo));
        this.estado.asegurados.forEach((asegurado: any) => {
            asegurado.coberturas = (asegurado.coberturas || []).filter((cobertura: any) => codigosPermitidos.has(cobertura.codigo));
        });
        this.estado.subgrupos.forEach((subgrupo: any) => {
            subgrupo.coberturas = (subgrupo.coberturas || []).filter((codigo: string) => codigosPermitidos.has(codigo));
        });
        this.store.notificarCambio(); // renderizarTablaCoberturas + renderizarAmparosDisponibles
        this.calculo.recalcularTodo();
    }

    validarActividadAsegurable(): boolean {
        if (!this.poliza.actividad) {
            this.asignacion.mostrarAlertaRango('Selecciona una actividad económica antes de continuar.', this.obtenerElemento('#actividad'), 'Actividad económica requerida');
            return false;
        }
        if (this.esNoAsegurableActividad(this.poliza.actividadDetalle?.field_3)) {
            this.asignacion.mostrarAlertaRango('La actividad seleccionada no es asegurable para Vida. Selecciona otra actividad económica para continuar con la cotización.', this.obtenerElemento('#actividad'), 'Actividad no asegurable');
            return false;
        }
        return true;
    }

    /** Recargo (en %) por actividad económica para una cobertura. */
    obtenerRecargoPorActividad(cobertura: any): number {
        const codigo = String(cobertura?.codigo || '').toUpperCase();
        const campo = (CAMPOS_ACTIVIDAD_POR_COBERTURA as Record<string, string>)[codigo];
        const valor = campo ? this.poliza.actividadDetalle?.[campo] : null;
        const recargo = Number(String(valor ?? '').replace('%', '').replace(',', '.').trim());
        // La API entrega factores decimales: 1 equivale a 100% y 0.5 equivale a 50%.
        return Number.isFinite(recargo) ? recargo * 100 : 0;
    }

    eliminarCobertura(codigo: string): void {
        if (codigo === 'WET') {
            this.ui.mostrarToast('El amparo Vida debe permanecer configurado.', 'warning');
            return;
        }
        this.ui.mostrarConfirmacionCotizador({
            titulo: 'Eliminar cobertura',
            mensaje: '¿Deseas eliminar esta cobertura? Se eliminará de todos los asegurados.',
            textoConfirmar: 'Eliminar',
            accion: () => {
                this.estado.coberturasCatalogo = this.estado.coberturasCatalogo.filter(c => c.codigo !== codigo);

                this.estado.asegurados.forEach((a: any) => {
                    a.coberturas = a.coberturas.filter((c: any) => c.codigo !== codigo);
                });

                this.calculo.recalcularTodo();
                this.ui.mostrarToast('Cobertura eliminada', 'success');
            }
        });
    }

    /* ============================================================
       Orden / búsqueda / nombres de coberturas
       ============================================================ */

    ordenarCoberturasPorNombre(coberturas: any[], vidaPrimero = false): any[] {
        return [...coberturas].sort((primera, segunda) => {
            if (vidaPrimero && primera.codigo === 'WET') return -1;
            if (vidaPrimero && segunda.codigo === 'WET') return 1;
            return String(primera.nombre || primera.codigo).localeCompare(
                String(segunda.nombre || segunda.codigo),
                'es',
                { sensitivity: 'base' }
            );
        });
    }

    buscarCoberturaPorReferencia(referencia: string): any {
        const referenciaNormalizada = normalizarTexto(referencia);
        if (referenciaNormalizada === 'vida') {
            return this.store.coberturasDisponibles.find(cobertura => cobertura.codigo === 'WET');
        }
        return this.store.coberturasDisponibles.find(cobertura =>
            normalizarTexto(cobertura['amparoResumido']) === referenciaNormalizada
            || (cobertura['aliasesAmparoResumido'] || []).some((alias: string) => normalizarTexto(alias) === referenciaNormalizada)
            || normalizarTexto(cobertura.nombre) === referenciaNormalizada
        );
    }

    // Solo para mostrar en la pantalla de cálculos; no altera la lógica ni los datos.
    obtenerNombreComercialCobertura(codigo: string): string {
        return NOMBRES_COMERCIALES_COBERTURA[String(codigo || '').toUpperCase()] || codigo;
    }

    async cargarCatalogoCoberturas(): Promise<void> {
        try {
            const respuesta = await fetch('data/CoberturasVG.json');
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

            const amparos: any[] = await respuesta.json();
            const catalogoCompleto = amparos.map(amparo => ({
                codigo: amparo.Codigo_Amparo_Op,
                codigoAmparo: amparo.Codigo_Amparo,
                nombre: amparo.Amparo_Detallado,
                tasaBase: TASA_BASE_SISTEMA,
                obligatoria: amparo.Codigo_Amparo_Op === 'WET'
            }));

            const codigosAmparo = catalogoCompleto
                .map(cobertura => String(cobertura.codigoAmparo).replace(/\.0$/, ''))
                .join(',');
            const filasApi = await this.consultarTasasEnApi(codigosAmparo);
            const filasCoreGW = filasApi.filter((fila: any) => String(fila.Core ?? '').trim().toUpperCase() === 'GW');
            this.actualizarDatosTasasDesdeFilas(filasCoreGW);
            const resumenesCoreGW = new Map<string, any>();
            filasCoreGW.forEach((fila: any) => {
                const codigo = String(fila.Codigo_Amparo ?? '').replace(/\.0$/, '');
                if (!resumenesCoreGW.has(codigo)) {
                    resumenesCoreGW.set(codigo,
                        fila.Amparo_Resumido_Definitivo
                        ?? fila['Amparo_Resumido Definitivo']
                        ?? fila['Amparo_Resumido(Nuevo Nombre)']
                        ?? fila.Amparo_Resumido_Nuevo_Nombre
                        ?? fila.Amparo_Resumido
                        ?? ''
                    );
                }
            });
            const coberturasCoreGW = catalogoCompleto
                .filter(cobertura => resumenesCoreGW.has(String(cobertura.codigoAmparo).replace(/\.0$/, '')))
                .map(cobertura => {
                    const amparoResumidoOriginal = resumenesCoreGW.get(String(cobertura.codigoAmparo).replace(/\.0$/, ''));
                    const amparoResumido = obtenerAmparoResumidoDefinitivo(amparoResumidoOriginal);
                    return {
                        ...cobertura,
                        amparoDetallado: cobertura.nombre,
                        nombre: amparoResumido || cobertura.nombre,
                        amparoResumido,
                        aliasesAmparoResumido: Object.entries(NOMBRES_AMPARO_RESUMIDO)
                            .filter(([, nombreNuevo]) => normalizarTexto(nombreNuevo as string) === normalizarTexto(amparoResumido))
                            .map(([nombreAnterior]) => nombreAnterior)
                    };
                });

            // Un mismo amparo puede llegar con más de un código del Core GW. Para crear
            // planes solo se muestra una vez, usando el nuevo nombre definitivo como llave.
            const coberturaApiPorNombre = new Map<string, any>(
                coberturasCoreGW.map(cobertura => [normalizarTexto(cobertura.amparoResumido || cobertura.nombre), cobertura])
            );
            const coberturaLocalPorCodigo = new Map<string, any>(
                catalogoCompleto.map(cobertura => [cobertura.codigo, cobertura])
            );
            this.store.coberturasDisponibles = AMPAROS_RESUMIDOS_DEFINITIVOS.map(({ nombre, codigo }) => {
                const coberturaApi = coberturaApiPorNombre.get(normalizarTexto(nombre));
                const coberturaLocal = coberturaLocalPorCodigo.get(codigo);
                const cobertura = coberturaLocal || coberturaApi;

                if (!cobertura) return null;
                return {
                    ...cobertura,
                    nombre,
                    amparoResumido: nombre,
                    aliasesAmparoResumido: Object.entries(NOMBRES_AMPARO_RESUMIDO)
                        .filter(([, nombreDefinitivo]) => normalizarTexto(nombreDefinitivo as string) === normalizarTexto(nombre))
                        .map(([nombreAnterior]) => nombreAnterior)
                };
            }).filter(Boolean) as any[];

            if (this.store.coberturasDisponibles.length === 0) {
                throw new Error('La API no devolvió amparos pertenecientes al Core GW.');
            }

            this.store.catalogoCoberturasCompleto = [...this.store.coberturasDisponibles];
            this.actualizarCoberturasPorActividad();

            if (this.estado.asegurados.length === 0) {
                this.estado.coberturasCatalogo = this.store.crearCatalogoInicial();
            } else {
                this.store.sincronizarVidaObligatoria();
            }
            this.store.sincronizarNombresVisiblesCoberturas();
            this.store.notificarCambio(); // renderizarTablaCoberturas + renderizarAsignacionPlanes
            this.store.guardarEstado();
            console.info(`Catálogo Core GW cargado: ${this.store.coberturasDisponibles.length} amparos.`);
        } catch (error) {
            console.warn('No se pudo cargar data/CoberturasVG.json:', error);
            this.store.coberturasDisponibles = [];
            if (this.estado.asegurados.length === 0) this.estado.coberturasCatalogo = [];
            this.store.notificarCambio();
            this.ui.mostrarToast('No fue posible cargar los amparos del Core GW.', 'warning');
        }
    }

    /* ============================================================
       Continuidad, forma de pago y tipo de pago mensual
       ============================================================ */

    /** Evento `change` de los radios `esContinuidad` (paso 5). */
    cambiarEsContinuidad(esContinuidad: boolean): void {
        this.poliza.esContinuidad = esContinuidad;
        this.actualizarVisibilidadCamposContinuidad();
        this.store.guardarEstado();
    }

    /** Antes ocultaba/mostraba `#camposContinuidad` (ahora lo hace la plantilla con `poliza.esContinuidad`). */
    actualizarVisibilidadCamposContinuidad(): void {
        delete this.invalidos['numeroPolizaAnterior'];
        delete this.invalidos['companiaAnterior'];
    }

    /** Eventos `input`/`change` de `numeroPolizaAnterior` y `companiaAnterior` (paso 5). */
    actualizarCampoContinuidad(campo: 'numeroPolizaAnterior' | 'companiaAnterior', valor: string): void {
        this.poliza[campo] = valor;
        delete this.invalidos[campo];
        this.store.guardarEstado();
    }

    /** Evento `input` de `condicionesEspeciales` (paso 5). */
    actualizarCondicionesEspeciales(valor: string): void {
        this.poliza.condicionesEspeciales = valor;
        this.store.guardarEstado();
    }

    validarDatosContinuidad(mostrarMensaje = false): boolean {
        if (this.poliza.esContinuidad !== true) return true;
        const campos = [
            { id: 'numeroPolizaAnterior', nombre: 'el número de póliza anterior' },
            { id: 'companiaAnterior', nombre: 'el nombre de la compañía anterior' }
        ];
        const campoIncompleto = campos.find(({ id }) =>
            !String(this.poliza[id] || '').trim()
        );
        if (!campoIncompleto) return true;
        this.invalidos[campoIncompleto.id] = true;
        if (mostrarMensaje) {
            this.enfocarCampo(`#${campoIncompleto.id}`);
            this.ui.mostrarToast(`Completa ${campoIncompleto.nombre} para indicar la continuidad.`, 'warning');
        }
        return false;
    }

    solicitarCambioFormaPago(formaPago: string): void {
        const formaPagoActual = this.poliza.formaPago || 'Anual';
        if (!formaPago || formaPago === formaPagoActual) return;

        this.formaPagoPendiente = formaPago;
        // El modal se muestra con `formaPagoPendiente`; el foco al botón lo hace su componente.
    }

    confirmarCambioFormaPago(): void {
        if (!this.formaPagoPendiente) return;

        this.poliza.formaPago = this.formaPagoPendiente;
        this.actualizarCampoPagoMensual();

        this.formaPagoPendiente = null;
        this.store.guardarEstado();
        this.store.notificarCambio(); // renderizarTablaCalculos + renderizarDashboard
        this.ui.mostrarToast('Forma de pago actualizada.', 'success');
    }

    cancelarCambioFormaPago(): void {
        this.formaPagoPendiente = null;
    }

    /** Antes mostraba/ocultaba `#grupoTipoPagoMensual`; ahora lo resuelve `esPagoMensual` en la plantilla. */
    get esPagoMensual(): boolean {
        return this.poliza.formaPago === 'Mensual';
    }

    actualizarCampoPagoMensual(): void {
        this.store.notificarCambio();
    }

    obtenerDescripcionFormaPago(): string {
        if (this.poliza.formaPago !== 'Mensual') return this.poliza.formaPago || 'Anual';
        return `Mensual (${this.poliza.tipoPagoMensual || 'Vencida'})`;
    }

    actualizarTipoPagoMensual(tipoPagoMensual: string): void {
        if (!['Anticipada', 'Vencida'].includes(tipoPagoMensual)) return;

        this.poliza.tipoPagoMensual = tipoPagoMensual;
        this.store.guardarEstado();
        this.store.notificarCambio(); // renderizarTablaCalculos + renderizarDashboard
    }

    /* ============================================================
       Comisión, retorno y factor de gasto
       ============================================================ */

    actualizarCamposComerciales(): void {
        const canalActual = normalizarCanalComercial(this.poliza.canalComercial);
        const esPromotora = canalActual === 'PROMOTORAS';

        this.poliza.canalComercial = canalActual;
        if (!esPromotora) this.poliza.honorarioPromotora = 0;
        this.actualizarFactorGasto();
        this.store.guardarEstado();
    }

    /** Texto actual del campo retorno (lo que antes era `campoRetorno.value`). */
    private obtenerRetornoCampo(): string {
        if (this.retornoCampoTexto !== null) return this.retornoCampoTexto;
        const retorno = this.poliza.retorno;
        return retorno === null || retorno === undefined ? '' : String(retorno);
    }

    obtenerRetornoMaximo(): number {
        const comision = Number(this.poliza.comision);
        const disponible = Number.isFinite(comision) ? 40 - comision : 30;
        return Math.max(0, Math.min(30, Math.round(disponible * 10) / 10));
    }

    ajustarRetornoAlLimite(): void {
        const maximo = this.obtenerRetornoMaximo();
        const texto = this.obtenerRetornoCampo();
        if (texto === '') return;
        const retorno = Number(texto);
        if (Number.isFinite(retorno) && retorno > maximo) {
            if (this.retornoCampoTexto !== null) this.retornoCampoTexto = String(maximo);
            this.poliza.retorno = maximo;
            this.ui.mostrarToast(`El retorno se ajustó a ${maximo}% para que comisión + retorno no supere 40% ni el retorno supere 30%.`, 'info');
        }
    }

    validarComisionRetorno(mostrarMensaje = false): boolean {
        const comision = Number(this.poliza.comision);
        const texto = this.obtenerRetornoCampo();
        const retorno = Number(texto);
        let mensaje = '';
        if (texto === '' || !Number.isFinite(retorno) || retorno < 0 || retorno > 30) {
            mensaje = 'El retorno debe ser un valor entre 0% y 30%.';
        } else if (Number.isFinite(comision) && comision + retorno > 40) {
            mensaje = 'La suma de comisión y retorno no puede superar 40%.';
        } else if (this.hayDesajustePasoRetorno(retorno)) {
            mensaje = 'El retorno debe ingresarse en incrementos de 0,1%.';
        }

        this.invalidos['retorno'] = Boolean(mensaje);
        if (mostrarMensaje && mensaje) {
            this.enfocarCampo('#retorno');
            this.ui.mostrarToast(mensaje, 'warning');
            return false;
        }
        return !mensaje;
    }

    /** Equivale a `validity.stepMismatch` del input (min 0, step 0.1). */
    private hayDesajustePasoRetorno(retorno: number): boolean {
        const pasos = retorno / 0.1;
        return Math.abs(pasos - Math.round(pasos)) > 1e-6;
    }

    actualizarFactorGasto(): void {
        const detalle = this.calculo.obtenerRecargoComercial();
        this.poliza.factorGasto = detalle.total;
        this.store.notificarCambio(); // renderizarTablaCalculos
    }

    /**
     * Evento `change` de `comision` / `honorarioPromotora`. Devuelve el valor final que
     * debe mostrar el campo (puede haber sido corregido).
     */
    actualizarCampoComercial(campo: 'comision' | 'honorarioPromotora', valorIngresado: number): number {
        const maximo = campo === 'comision' ? 30 : 10;
        const minimo = campo === 'comision' ? 10 : 0;
        const valor = Math.min(Math.max(Math.round(valorIngresado) || minimo, minimo), maximo);
        if (valor !== valorIngresado) {
            const nombre = campo === 'comision' ? 'La comisión' : 'El honorario de promotora';
            this.ui.mostrarToast(`${nombre} debe ser un número entero entre ${minimo}% y ${maximo}%.`, 'warning');
        }
        this.poliza[campo] = valor;
        if (campo === 'comision') this.ajustarRetornoAlLimite();
        this.validarComisionRetorno(false);
        this.actualizarFactorGasto();
        this.store.guardarEstado();
        return valor;
    }

    /** Evento `input` de `retorno`. Devuelve el texto que debe quedar en el campo. */
    alIngresarRetorno(texto: string): string {
        this.retornoCampoTexto = texto;
        this.ajustarRetornoAlLimite();
        this.validarComisionRetorno(false);
        return this.retornoCampoTexto ?? texto;
    }

    /** Evento `change` de `retorno`. Devuelve el valor final que debe mostrar el campo. */
    alCambiarRetorno(texto: string): number {
        const retornoIngresado = texto === '' ? 0 : Number(texto);
        const retorno = Number.isFinite(retornoIngresado) ? retornoIngresado : 0;
        const maximo = this.obtenerRetornoMaximo();
        const valor = Math.min(Math.max(Math.round(retorno * 10) / 10, 0), maximo);
        if (valor !== retorno) {
            this.ui.mostrarToast(`El retorno se ajustó a ${valor}% (máximo permitido: ${maximo}%).`, 'warning');
        }
        this.retornoCampoTexto = null;
        this.poliza.retorno = valor;
        this.validarComisionRetorno(false);
        this.actualizarFactorGasto();
        this.store.guardarEstado();
        return valor;
    }

    /* ============================================================
       Credibilidad / siniestralidad
       ============================================================ */

    get usaDetalleSiniestros(): boolean {
        return this.poliza.aplicaCredibilidad === true && this.poliza.detalleSiniestrosCobertura === true;
    }

    /** Filas de la lista de agrupaciones (reemplaza a renderizarListaSiniestrosCobertura). */
    get filasSiniestrosCobertura(): FilaSiniestroCobertura[] {
        const lista: any[] = this.poliza.siniestrosPorCobertura || [];
        const gruposPoliza: string[] = this.poliza.gruposSiniestrosPoliza || [];
        return AGRUPACIONES_SINIESTROS.filter(grupo => gruposPoliza.includes(grupo.codigo)).map(grupo => {
            const item = lista.find(elemento => elemento.codigo === grupo.codigo);
            const activa = Boolean(item);
            const vacio = !item || item.valor === null || item.valor === undefined;
            return { grupo, item, activa, vacio, texto: vacio ? '' : formatearValorMonetario(item.valor) };
        });
    }

    /** Lleva a los campos de la pantalla el estado guardado (sin recalcular ni guardar). */
    sincronizarCamposPaso1(): void {
        const p = this.poliza;
        this.retornoCampoTexto = null;
        this.campoAplicaCredibilidad = p.aplicaCredibilidad === true ? 'si' : 'no';
        this.sincronizarDetalleSiniestrosUI();
        if (p.aplicaCredibilidad === true) {
            const informado = p.siniestrosInformados === true;
            const anos = Number(p.anosExposicion) || 0;
            this.campoValorSiniestrosTotales = informado ? formatearValorMonetario(p.valorSiniestrosTotales) : '';
            this.campoAnosExposicion = anos || '';
            this.campoSiniestrosPromedio = informado ? formatearValorMonetario(p.siniestrosPromedio) : '';
        } else {
            this.campoValorSiniestrosTotales = '';
            this.campoAnosExposicion = '';
            this.campoSiniestrosPromedio = '';
        }
        if (p.codigoAsesor) {
            this.campoCodigoAsesor = p.codigoAsesor;
            if (p.asesor) this.ultimoCodigoAsesorConsultado = p.codigoAsesor;
        } else if (!p.asesor) {
            this.campoCodigoAsesor = '';
        }
        if (!this.textoActividad && p.actividad) this.textoActividad = p.actividad;
    }

    actualizarAplicacionCredibilidad(restaurarValorGuardado = false): void {
        const aplica = restaurarValorGuardado
            ? this.poliza.aplicaCredibilidad === true
            : this.campoAplicaCredibilidad === 'si';

        this.campoAplicaCredibilidad = aplica ? 'si' : 'no';
        this.poliza.aplicaCredibilidad = aplica;

        if (!aplica) {
            this.campoValorSiniestrosTotales = '';
            this.campoAnosExposicion = '';
            this.campoSiniestrosPromedio = '';
            this.invalidos['valorSiniestrosTotales'] = false;
            this.invalidos['anosExposicion'] = false;
            this.poliza.valorSiniestrosTotales = 0;
            this.poliza.anosExposicion = 0;
            this.poliza.siniestrosPromedio = 0;
            this.poliza.siniestrosInformados = false;
            this.poliza.detalleSiniestrosCobertura = false;
            this.poliza.gruposSiniestrosPoliza = [];
            this.poliza.siniestrosPorCobertura = [];
        }

        this.sincronizarDetalleSiniestrosUI();
        this.store.guardarEstado();
        if (!restaurarValorGuardado) this.calculo.recalcularTodo();
    }

    sincronizarDetalleSiniestrosUI(): void {
        // La visibilidad del bloque, la nota y el `readonly` del total se resuelven en la
        // plantilla con `usaDetalleSiniestros`; aquí solo se sincroniza el selector.
        this.campoDetalleSiniestros = this.usaDetalleSiniestros ? 'si' : 'no';
    }

    alternarAgrupacionSiniestro(codigo: string, activa: boolean): void {
        const grupo = AGRUPACIONES_SINIESTROS.find(item => item.codigo === codigo);
        if (!grupo) return;
        if (!Array.isArray(this.poliza.siniestrosPorCobertura)) this.poliza.siniestrosPorCobertura = [];

        if (activa) {
            if (!this.poliza.siniestrosPorCobertura.some((item: any) => item.codigo === codigo)) {
                this.poliza.siniestrosPorCobertura.push({ codigo, nombre: grupo.nombre, valor: null });
            }
        } else {
            this.poliza.siniestrosPorCobertura = this.poliza.siniestrosPorCobertura.filter((item: any) => item.codigo !== codigo);
        }
        this.actualizarSiniestralidad();
        if (activa) {
            // El campo se habilita al refrescar la vista; se enfoca después de ese ciclo.
            setTimeout(() => this.enfocarCampo(`#listaSiniestrosCobertura input[data-codigo="${codigo}"]`));
        }
    }

    /** Evento `input` de un valor por agrupación. Devuelve el texto formateado del campo. */
    actualizarValorSiniestroCobertura(codigo: string, textoCampo: string): string {
        const item = (this.poliza.siniestrosPorCobertura || []).find((elemento: any) => elemento.codigo === codigo);
        if (!item) return textoCampo;

        const valor = obtenerValorMonetario(textoCampo);
        item.valor = valor;
        this.actualizarSiniestralidad();
        return formatearValorMonetario(valor);
    }

    cambiarDetalleSiniestros(): void {
        this.poliza.detalleSiniestrosCobertura = this.campoDetalleSiniestros === 'si';
        this.sincronizarDetalleSiniestrosUI();
        this.actualizarSiniestralidad();
        if (this.poliza.detalleSiniestrosCobertura && !(this.poliza.gruposSiniestrosPoliza || []).length) {
            this.abrirModalGruposSiniestros();
        }
    }

    abrirModalGruposSiniestros(): void {
        this.gruposSiniestrosSeleccionados = [...(this.poliza.gruposSiniestrosPoliza || [])];
        this.modalGruposSiniestrosVisible = true;
    }

    alternarGrupoSiniestroSeleccionado(codigo: string, marcado: boolean): void {
        this.gruposSiniestrosSeleccionados = marcado
            ? [...this.gruposSiniestrosSeleccionados.filter(c => c !== codigo), codigo]
            : this.gruposSiniestrosSeleccionados.filter(c => c !== codigo);
    }

    cerrarModalGruposSiniestros(): void {
        this.modalGruposSiniestrosVisible = false;
        if (this.poliza.detalleSiniestrosCobertura && !(this.poliza.gruposSiniestrosPoliza || []).length) {
            this.poliza.detalleSiniestrosCobertura = false;
            this.sincronizarDetalleSiniestrosUI();
            this.actualizarSiniestralidad();
        }
    }

    confirmarGruposSiniestros(): void {
        const codigos = this.gruposSiniestrosSeleccionados;
        if (!codigos.length) {
            this.ui.mostrarToast('Selecciona al menos una agrupación que tuviera la póliza anterior.', 'warning');
            return;
        }

        const previos: any[] = this.poliza.siniestrosPorCobertura || [];
        this.poliza.gruposSiniestrosPoliza = AGRUPACIONES_SINIESTROS.map(grupo => grupo.codigo).filter(codigo => codigos.includes(codigo));
        this.poliza.siniestrosPorCobertura = AGRUPACIONES_SINIESTROS
            .filter(grupo => codigos.includes(grupo.codigo))
            .map(grupo => previos.find(item => item.codigo === grupo.codigo) || { codigo: grupo.codigo, nombre: grupo.nombre, valor: null });

        this.modalGruposSiniestrosVisible = false;
        this.actualizarSiniestralidad();
        this.store.guardarEstado();
    }

    actualizarSiniestralidad(restaurarValoresGuardados = false): void {
        if (this.poliza.aplicaCredibilidad !== true) {
            this.campoValorSiniestrosTotales = '';
            this.campoAnosExposicion = '';
            this.campoSiniestrosPromedio = '';
            return;
        }

        let total = 0;
        let informado = false;
        if (this.poliza.detalleSiniestrosCobertura === true) {
            const lista: any[] = this.poliza.siniestrosPorCobertura || [];
            total = lista.reduce((suma, item) => suma + (Number(item.valor) || 0), 0);
            informado = lista.length > 0 && lista.every(item => item.valor !== null && item.valor !== undefined);
        } else {
            const valorCampo = obtenerValorMonetario(this.campoValorSiniestrosTotales);
            if (valorCampo !== null) {
                total = valorCampo;
                informado = true;
            } else if (restaurarValoresGuardados && this.poliza.siniestrosInformados === true) {
                total = Number(this.poliza.valorSiniestrosTotales) || 0;
                informado = true;
            }
        }
        const anos = Math.min(4, Math.max(0, Math.round(Number(this.campoAnosExposicion)
            || (restaurarValoresGuardados ? Number(this.poliza.anosExposicion) || 0 : 0))));
        const promedio = anos > 0 ? total / anos : 0;

        this.campoValorSiniestrosTotales = informado ? formatearValorMonetario(total) : '';
        this.campoAnosExposicion = anos || '';
        this.campoSiniestrosPromedio = informado ? formatearValorMonetario(promedio) : '';
        this.invalidos['valorSiniestrosTotales'] = !informado;
        this.invalidos['anosExposicion'] = anos <= 0;
        this.poliza.valorSiniestrosTotales = total;
        this.poliza.siniestrosInformados = informado;
        this.poliza.anosExposicion = anos;
        this.poliza.siniestrosPromedio = promedio;
        if (restaurarValoresGuardados) {
            this.store.guardarEstado();
            this.calculo.recalcularTodo();
        } else {
            this.programarRecalculoSiniestralidad();
        }
    }

    // El recálculo completo es costoso con muchos asegurados; se agrupa mientras
    // el usuario sigue escribiendo para no ejecutarlo en cada tecla.
    programarRecalculoSiniestralidad(): void {
        if (this.temporizadorRecalculoSiniestralidad) clearTimeout(this.temporizadorRecalculoSiniestralidad);
        this.temporizadorRecalculoSiniestralidad = setTimeout(() => {
            this.temporizadorRecalculoSiniestralidad = null;
            this.ui.ejecutarConCarga(this.estado.asegurados.length, 'Recalculando la cotización con la siniestralidad...', () => {
                this.store.guardarEstado();
                this.calculo.recalcularTodo();
            });
        }, 400);
    }

    validarSiniestralidadRequerida(): boolean {
        if (this.poliza.aplicaCredibilidad !== true) return true;

        const usaDetalle = this.poliza.detalleSiniestrosCobertura === true;
        const lista: any[] = this.poliza.siniestrosPorCobertura || [];
        const informado = this.poliza.siniestrosInformados === true;
        const anos = Number(this.poliza.anosExposicion) || 0;

        if (!informado) {
            let campoInvalido: HTMLElement | null = this.obtenerElemento('#valorSiniestrosTotales');
            let mensaje = 'Diligencia el valor de siniestros totales antes de continuar. Si no hubo siniestros, ingresa $ 0.';
            if (usaDetalle) {
                const filaVacia = this.filasSiniestrosCobertura.find(fila => fila.activa && obtenerValorMonetario(fila.texto) === null);
                campoInvalido = (filaVacia
                    ? this.obtenerElemento(`#listaSiniestrosCobertura input[data-codigo="${filaVacia.grupo.codigo}"]`)
                    : null) || this.obtenerElemento('#listaSiniestrosCobertura input[data-codigo-check]');
                mensaje = lista.length === 0
                    ? 'Marca al menos una agrupación con información siniestral y diligencia su valor antes de continuar.'
                    : 'Diligencia el valor de siniestros de cada agrupación marcada. Si no hubo siniestros, ingresa $ 0.';
            }
            this.invalidos['valorSiniestrosTotales'] = true;
            this.asignacion.mostrarAlertaRango(mensaje, campoInvalido, 'Información de siniestralidad requerida');
            return false;
        }

        this.invalidos['valorSiniestrosTotales'] = false;
        this.invalidos['anosExposicion'] = anos <= 0;
        if (anos > 0) return true;

        this.asignacion.mostrarAlertaRango('Diligencia una cantidad de años de exposición mayor a 0 antes de continuar.', this.obtenerElemento('#anosExposicion'), 'Información de siniestralidad requerida');
        return false;
    }

    /* ============================================================
       Acceso mínimo al DOM (solo para foco / referencia de campo al mostrar alertas)
       ============================================================ */

    private obtenerElemento(selector: string): HTMLElement | null {
        return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(selector);
    }

    private enfocarCampo(selector: string): void {
        this.obtenerElemento(selector)?.focus();
    }
}
