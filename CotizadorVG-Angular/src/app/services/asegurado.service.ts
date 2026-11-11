import { inject, Injectable, Injector } from '@angular/core';
import {
    CONFIG,
    REGISTROS_POR_PAGINA_MAX,
    REGISTROS_POR_PAGINA_MIN,
    TASA_BASE_SISTEMA,
    VALOR_ASEGURADO_MAXIMO_VOLUNTARIA
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
import { AsignacionService } from './asignacion.service';
import { CalculoService } from './calculo.service';
import { ImportacionService } from './importacion.service';
import { PlanService } from './plan.service';

/** Ajuste de valor asegurado por el tope de pólizas contributivas. */
export interface AjusteValorAsegurado {
    nombre: string;
    documento: string;
    valorOriginal: number;
    valorAjustado: number;
}

/** Fila de la tabla de asegurados (reemplaza el HTML de renderizarTablaAsegurados). */
export interface FilaAsegurado {
    id: string;
    numeroDocumento: string;
    tipoAsegurado: string;
    edad: any;
    grupo: string;
    valorAseguradoTexto: string;
}

/** Datos que antes escribían renderizarTablaAsegurados / actualizarPaginacionAsegurados en el DOM. */
export interface PaginaAsegurados {
    filas: FilaAsegurado[];
    /** Texto de la fila vacía (`<td colspan="6" class="text-center text-muted">`); '' si hay filas. */
    mensajeVacio: string;
    /** `#paginacionAsegurados[hidden]` */
    ocultarPaginacion: boolean;
    textoInfo: string;
    textoPagina: string;
    enPrimera: boolean;
    enUltima: boolean;
}

@Injectable({ providedIn: 'root' })
export class AseguradoService {
    private store = inject(CotizadorStore);
    private ui = inject(UiService);
    private injector = inject(Injector);

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get calculo() { return this.injector.get(CalculoService); }
    private get asignacion() { return this.injector.get(AsignacionService); }
    private get importacion() { return this.injector.get(ImportacionService); }
    private get planService() { return this.injector.get(PlanService); }

    private get estado() { return this.store.estado; }

    /* ============================================================
       Estado de UI del Paso 2 (variables `let` de módulo del app.js original)
       ============================================================ */
    paginaAsegurados = 1;
    registrosPorPaginaAsegurados = REGISTROS_POR_PAGINA_MIN;
    filtroAsegurados = '';

    /** false = `.toolbar-asegurados` y `.asegurados-container` ocultos (ocultarSeccionAsegurados). */
    seccionAseguradosVisible = true;

    /* ---- Modal de asegurado (modalAsegurado) ---- */
    modalAseguradoVisible = false;
    aseguradoEditandoId: string | null = null;
    tituloModalAsegurado = 'Agregar asegurado';
    aseguradoNumeroDocumento = '';
    aseguradoTipo = 'Afiliado principal';
    aseguradoGrupo: string = CONFIG.GRUPOS_ASIGNACION[0];
    /** Valor crudo del campo (string, igual que `campoEdad.value`). */
    aseguradoEdad = '';
    /** Texto formateado del campo (`$ 10.000.000`). */
    aseguradoValor = '';
    // Resultado de actualizarValidacionEdadModal / actualizarValidacionValorAseguradoModal
    edadMinimaModal = '14';
    edadMaximaModal = String(CONFIG.EDAD_MAXIMA_ASEGURADO);
    ayudaEdadOculta = true;
    ayudaEdadTexto = 'La edad mínima permitida es de 14 años.';
    edadInvalida = false;
    valorInvalido = false;
    /** Lo registra el componente del paso 2 para devolver el foco a `#aseguradoValor`. */
    enfocarCampoValorAsegurado: (() => void) | null = null;

    /* ---- Modal de resumen de modificaciones (modalResumenModificaciones) ---- */
    modalResumenModificacionesVisible = false;
    mensajeResumenModificaciones = '';
    ajustesResumen: AjusteValorAsegurado[] = [];
    registrosOmitidosResumen: string[] = [];

    /* ---- Modal de coberturas por asegurado (modalCoberturas) ---- */
    modalCoberturasVisible = false;
    aseguradoModalCoberturasId: string | null = null;

    /* Caché del modelo de la página (evita refiltrar en cada ciclo de detección de cambios). */
    private cachePagina: { clave: string; asegurados: any; cantidad: number; version: number; modelo: PaginaAsegurados } | null = null;

    /* ============================================================
       SECCIÓN 4: GESTIÓN DE ASEGURADOS
       ============================================================ */

    agregarAsegurado(asegurado: any = null): void {
        this.aseguradoEditandoId = asegurado?.id || null;
        this.tituloModalAsegurado = asegurado ? 'Editar asegurado' : 'Agregar asegurado';
        this.aseguradoNumeroDocumento = asegurado?.numeroDocumento || '';
        this.aseguradoEdad = String(asegurado?.edad ?? '');
        this.aseguradoTipo = asegurado?.tipoAsegurado || 'Afiliado principal';
        this.aseguradoGrupo = CONFIG.GRUPOS_ASIGNACION.includes(asegurado?.grupo)
            ? asegurado.grupo
            : CONFIG.GRUPOS_ASIGNACION[0];
        this.aseguradoValor = formatearValorMonetario(asegurado ? obtenerValorAseguradoBase(asegurado) : null);
        this.actualizarValidacionEdadModal();
        this.actualizarValidacionValorAseguradoModal();
        this.modalAseguradoVisible = true;
    }

    cerrarModalAsegurado(): void {
        this.modalAseguradoVisible = false;
        this.aseguradoEditandoId = null;
    }

    guardarAseguradoDesdeModal(): void {
        const estado = this.estado;
        const numeroDocumento = this.aseguradoNumeroDocumento.trim();
        const tipoAsegurado = this.aseguradoTipo;
        const grupo = this.aseguradoGrupo;
        const edad = Number(this.aseguradoEdad);
        const valorIngresado = obtenerValorMonetario(this.aseguradoValor) || 0;
        const valorAsegurado = this.limitarValorAseguradoParaModalidad(valorIngresado);
        const asegurado: any = estado.asegurados.find(item => item.id === this.aseguradoEditandoId);
        const fueAjustadoPorLimite = valorAsegurado !== valorIngresado;

        if (fueAjustadoPorLimite) {
            this.aseguradoValor = formatearValorMonetario(valorAsegurado);
            this.ui.mostrarToast(`Para pólizas voluntarias el valor asegurado máximo es ${formatearDinero(VALOR_ASEGURADO_MAXIMO_VOLUNTARIA)}. Se ajustó automáticamente.`, 'info');
        }

        this.actualizarValidacionEdadModal();
        if (valorAsegurado < 10_000_000) {
            this.actualizarValidacionValorAseguradoModal();
            this.enfocarCampoValorAsegurado?.();
            this.ui.mostrarToast('El valor asegurado mínimo es $ 10.000.000.', 'warning');
            return;
        }
        if (!numeroDocumento || !CONFIG.TIPO_ASEGURADO.includes(tipoAsegurado) || !CONFIG.GRUPOS_ASIGNACION.includes(grupo) || !this.validarEdad(this.aseguradoEdad, tipoAsegurado).valido) {
            this.ui.mostrarToast('Completa correctamente los campos obligatorios del asegurado.', 'warning');
            return;
        }
        if (estado.asegurados.some(item => item.id !== this.aseguradoEditandoId && item.tipoDocumento === 'Cédula' && item.numeroDocumento === numeroDocumento)) {
            this.ui.mostrarToast('Este documento ya está registrado.', 'warning');
            return;
        }

        // Un plan automático conserva el valor de Vida con el que fue creado.
        // Al editar un asegurado se debe retirar esa asignación antes de guardar,
        // para que el plan no reemplace el nuevo dato al recalcular las primas.
        const habiaAsignacionAutomatica = Boolean(asegurado?.planId)
            && estado.planes.some(plan => plan.id === asegurado.planId && plan.creadoPorAsignacionAutomatica);
        if (habiaAsignacionAutomatica) this.asignacion.reiniciarAsignacionAutomatica(false);

        const datos = asegurado || {
            id: generarUUID(), tipoDocumento: 'Cédula', sexo: 'Masculino', ocupacion: 'Administrativo', salario: 0,
            coberturas: this.generarCoberturasPorDefecto(valorAsegurado), subgrupoId: null, planId: null, primaIndividual: 0, simulado: false
        };
        datos.numeroDocumento = numeroDocumento;
        datos.tipoAsegurado = tipoAsegurado;
        datos.grupo = grupo;
        datos.edad = edad;
        const vida = datos.coberturas.find((cobertura: any) => cobertura.codigo === 'WET');
        if (vida) vida.valorAsegurado = valorAsegurado;

        if (!asegurado) estado.asegurados.push(datos);
        this.calculo.recalcularTodo();
        this.cerrarModalAsegurado();
        if (fueAjustadoPorLimite) {
            this.mostrarResumenModificaciones({
                ajustes: [{
                    nombre: datos.nombreCompleto || datos.numeroDocumento,
                    documento: datos.numeroDocumento,
                    valorOriginal: valorIngresado,
                    valorAjustado: valorAsegurado
                }]
            });
        }
        this.ui.mostrarToast(`Asegurado ${asegurado ? 'actualizado' : 'agregado'} correctamente.`, 'success');
    }

    actualizarValidacionEdadModal(): void {
        const tipoAsegurado = this.aseguradoTipo;
        const admiteEdadDesdeCero = this.permiteEdadDesdeCero(tipoAsegurado);
        const validacion = this.validarEdad(this.aseguradoEdad, tipoAsegurado);

        this.edadMinimaModal = admiteEdadDesdeCero ? '0' : '14';
        this.edadMaximaModal = String(CONFIG.EDAD_MAXIMA_ASEGURADO);
        this.ayudaEdadOculta = validacion.valido && !admiteEdadDesdeCero;
        this.ayudaEdadTexto = admiteEdadDesdeCero
            ? 'Para Hijos en pólizas Voluntarias (Contributivas), se permite una edad desde 0 años.'
            : validacion.mensaje;
        this.edadInvalida = this.aseguradoEdad !== '' && !validacion.valido;
    }

    actualizarValidacionValorAseguradoModal(): void {
        const valor = obtenerValorMonetario(this.aseguradoValor) || 0;
        this.valorInvalido = this.aseguradoValor.trim() !== '' && valor < 10_000_000;
    }

    /** Equivale a `formatearCampoMoneda(campo)` (el original la tiene en la sección de campos monetarios). */
    formatearCampoMoneda(campo: { value: string }): void {
        const valor = obtenerValorMonetario(campo.value);
        campo.value = formatearValorMonetario(valor);
    }

    /** `campo` es el input `#aseguradoValor` (o cualquier objeto con `value`). Sincroniza `aseguradoValor`. */
    limitarValorAseguradoEnCampo(campo: { value: string }): void {
        const valorIngresado = obtenerValorMonetario(campo.value) || 0;
        const valorLimitado = this.limitarValorAseguradoParaModalidad(valorIngresado);
        if (valorLimitado !== valorIngresado) {
            campo.value = formatearValorMonetario(valorLimitado);
            this.ui.mostrarToast(`Para pólizas contributivas el valor asegurado máximo es ${formatearDinero(VALOR_ASEGURADO_MAXIMO_VOLUNTARIA)}.`, 'info');
        }
        this.aseguradoValor = campo.value;
        this.actualizarValidacionValorAseguradoModal();
    }

    esModalidadContributiva(): boolean {
        return ['Voluntaria (Contributiva)', 'Mixta (Contributiva)'].includes(this.estado.poliza.modalidadPlan);
    }

    limitarValorAseguradoParaModalidad(valor: any): number {
        return this.esModalidadContributiva()
            ? Math.min(Number(valor) || 0, VALOR_ASEGURADO_MAXIMO_VOLUNTARIA)
            : Number(valor) || 0;
    }

    aplicarLimiteVoluntariaAValoresExistentes(): AjusteValorAsegurado[] {
        if (!this.esModalidadContributiva()) return [];

        const ajustes: AjusteValorAsegurado[] = [];
        this.estado.asegurados.forEach((asegurado: any) => {
            const vida = asegurado.coberturas?.find((cobertura: any) =>
                cobertura.codigo === 'WET' || cobertura.codigo === 'VID' || cobertura.codigo === 'VIDA'
            );
            if (vida && Number(vida.valorAsegurado) > VALOR_ASEGURADO_MAXIMO_VOLUNTARIA) {
                const valorOriginal = Number(vida.valorAsegurado);
                vida.valorAsegurado = VALOR_ASEGURADO_MAXIMO_VOLUNTARIA;
                asegurado.valorAseguradoAjustadoPorLimite = true;
                asegurado.valorAseguradoOriginal = valorOriginal;
                ajustes.push({
                    nombre: asegurado.nombreCompleto || asegurado.numeroDocumento,
                    documento: asegurado.numeroDocumento,
                    valorOriginal,
                    valorAjustado: VALOR_ASEGURADO_MAXIMO_VOLUNTARIA
                });
            }
        });
        return ajustes;
    }

    mostrarResumenModificaciones({ ajustes = [], retirados = [] }: { ajustes?: AjusteValorAsegurado[]; retirados?: string[] } = {}): void {
        if (ajustes.length === 0 && retirados.length === 0) return;

        this.registrosOmitidosResumen = [...retirados];
        this.ajustesResumen = [...ajustes];

        const resumen: string[] = [];
        if (ajustes.length > 0) resumen.push(`${ajustes.length} valor(es) asegurado(s) fueron limitados automáticamente.`);
        if (retirados.length > 0) resumen.push(`${retirados.length} registro(s) fueron omitidos de la base.`);
        this.mensajeResumenModificaciones = resumen.join(' ');
        this.modalResumenModificacionesVisible = true;
    }

    cerrarResumenModificaciones(): void {
        this.modalResumenModificacionesVisible = false;
    }

    async exportarRegistrosOmitidosExcel(): Promise<void> {
        if (this.registrosOmitidosResumen.length === 0) return;
        const ExcelJS = await this.importacion.cargarExcelJS();
        if (!ExcelJS) return;

        const libro = new ExcelJS.Workbook();
        const hoja = libro.addWorksheet('Registros omitidos');
        hoja.addRow(['No.', 'Detalle del registro omitido']);
        this.registrosOmitidosResumen.forEach((detalle, indice) => hoja.addRow([indice + 1, String(detalle)]));
        hoja.columns = [{ width: 8 }, { width: 110 }];
        hoja.getRow(1).font = { bold: true };
        hoja.views = [{ state: 'frozen', ySplit: 1 }];

        const contenido = await libro.xlsx.writeBuffer();
        this.importacion.descargarBlob(contenido, 'Registros_Omitidos_VidaGrupo.xlsx', ImportacionService.TIPO_MIME_XLSX);
        this.ui.mostrarToast('Registros omitidos exportados en Excel.', 'success');
    }

    editarAsegurado(id: string): void {
        const asegurado = this.estado.asegurados.find(a => a.id === id);
        if (asegurado) {
            this.agregarAsegurado(asegurado);
        }
    }

    validarValoresMinimosParaCotizar(): boolean {
        const estado = this.estado;
        const valorMinimo = 10_000_000;
        const minimoAsegurados = CONFIG.REGLAS_COMPLEJIDAD.minAsegurados;
        const esPolizaPatronal = estado.poliza.modalidadPlan === 'Patronal (No Contributiva)';
        const aseguradosNoPrincipales = esPolizaPatronal
            ? estado.asegurados.filter(asegurado => asegurado.tipoAsegurado !== 'Afiliado principal')
            : [];

        if (aseguradosNoPrincipales.length > 0) {
            const detalle = aseguradosNoPrincipales.slice(0, 5)
                .map(asegurado => `Asegurado con documento ${asegurado.numeroDocumento} (${asegurado.tipoAsegurado || 'sin tipo'}).`)
                .join(' ');
            const adicionales = aseguradosNoPrincipales.length > 5
                ? ` Hay ${aseguradosNoPrincipales.length - 5} asegurado(s) adicional(es) con esta condición.`
                : '';
            this.asignacion.mostrarAlertaRango(
                `Las pólizas Patronales (No Contributivas) solo permiten asegurados de tipo “Afiliado principal”. Corrige los siguientes registros antes de continuar: ${detalle}${adicionales}`,
                null,
                'Tipo de asegurado no permitido para póliza patronal'
            );
            return false;
        }

        if (estado.asegurados.length < minimoAsegurados) {
            this.asignacion.mostrarAlertaRango(
                `Actualmente tienes ${estado.asegurados.length} asegurado(s). Para continuar con la cotización debes contar con al menos ${minimoAsegurados} asegurados. Agrega los faltantes o carga una nueva base.`,
                null,
                'Cantidad mínima de asegurados'
            );
            return false;
        }
        const noElegibles = estado.asegurados.filter(asegurado => obtenerValorAseguradoBase(asegurado) < valorMinimo);
        if (noElegibles.length === 0) return true;

        const detalle = noElegibles.slice(0, 5)
            .map(asegurado => `Asegurado con documento ${asegurado.numeroDocumento}: ${formatearDinero(obtenerValorAseguradoBase(asegurado))}.`)
            .join(' ');
        const adicionales = noElegibles.length > 5 ? ` Hay ${noElegibles.length - 5} asegurado(s) adicional(es) con esta condición.` : '';
        this.asignacion.mostrarAlertaRango(
            `No es posible continuar con la cotización mientras existan valores asegurados inferiores a ${formatearDinero(valorMinimo)}. Edita los siguientes registros: ${detalle}${adicionales}`,
            null,
            'Valor asegurado mínimo requerido'
        );
        return false;
    }

    reemplazarBaseAsegurados(nuevosAsegurados: any[]): void {
        this.estado.asegurados = nuevosAsegurados;
        this.estado.subgrupos = [];
        this.estado.planes = [];
        // `subgrupoActivoEnPlanes` es estado de UI del paso 3 (PlanService).
        (this.planService as any).subgrupoActivoEnPlanes = null;
    }

    duplicarAsegurado(id: string): void {
        const asegurado = this.estado.asegurados.find(a => a.id === id);
        if (asegurado) {
            const copia = {
                ...JSON.parse(JSON.stringify(asegurado)),
                id: generarUUID()
            };
            this.estado.asegurados.push(copia);
            this.calculo.recalcularTodo();
            this.ui.mostrarToast('Asegurado duplicado correctamente', 'success');
        }
    }

    eliminarAsegurado(id: string): void {
        this.ui.mostrarConfirmacionCotizador({
            titulo: 'Eliminar asegurado',
            mensaje: '¿Deseas eliminar este asegurado?',
            textoConfirmar: 'Eliminar',
            accion: () => {
                this.estado.asegurados = this.estado.asegurados.filter(a => a.id !== id);
                this.calculo.recalcularTodo();
                this.ui.mostrarToast('Asegurado eliminado', 'success');
            }
        });
    }

    validarDocumento(tipoDoc: string, numeroDoc: string): { valido: boolean; mensaje: string } {
        if (!numeroDoc || numeroDoc.trim().length === 0) {
            return { valido: false, mensaje: 'El documento es requerido' };
        }

        const existe = this.estado.asegurados.some(a =>
            a.numeroDocumento === numeroDoc && a.tipoDocumento === tipoDoc
        );

        if (existe) {
            return { valido: false, mensaje: 'Este documento ya está registrado' };
        }

        return { valido: true, mensaje: '' };
    }

    permiteEdadDesdeCero(tipoAsegurado: string): boolean {
        return this.esModalidadContributiva()
            && tipoAsegurado === 'Hijos';
    }

    validarEdad(edad: any, tipoAsegurado = ''): { valido: boolean; mensaje: string } {
        const e = Number(edad);
        const edadMinima = this.permiteEdadDesdeCero(tipoAsegurado) ? 0 : 14;
        const edadMaxima = CONFIG.EDAD_MAXIMA_ASEGURADO;
        if (edad === '' || !Number.isInteger(e) || e < edadMinima || e > edadMaxima) {
            return {
                valido: false,
                mensaje: edadMinima === 0
                    ? `Edad debe estar entre 0 y ${edadMaxima} años`
                    : `Edad debe estar entre 14 y ${edadMaxima} años`
            };
        }
        return { valido: true, mensaje: '' };
    }

    /* ============================================================
       Visibilidad de la sección de asegurados (irAlPaso / simulación / Excel)
       ============================================================ */

    ocultarSeccionAsegurados(): void {
        this.seccionAseguradosVisible = false;
    }

    mostrarSeccionAsegurados(): void {
        this.seccionAseguradosVisible = true;
    }

    /**
     * Parte de `irAlPaso(2)`: renderizarTablaAsegurados() y, para póliza nueva sin asegurados,
     * ocultar la tabla hasta que se carguen asegurados.
     */
    aplicarVisibilidadSeccionAsegurados(): void {
        if (this.store.flujo.tipo === 'nuevo' && this.estado.asegurados.length === 0) {
            this.ocultarSeccionAsegurados();
        } else {
            this.mostrarSeccionAsegurados();
        }
    }

    /* ============================================================
       Filtro y paginación de asegurados (app.js 3205-3310)
       ============================================================ */

    normalizarRegistrosPorPagina(valor: any): number {
        const numero = Math.round(Number(valor));
        if (!Number.isFinite(numero)) return REGISTROS_POR_PAGINA_MIN;
        return Math.min(REGISTROS_POR_PAGINA_MAX, Math.max(REGISTROS_POR_PAGINA_MIN, numero));
    }

    obtenerAseguradosFiltrados(): any[] {
        const texto = normalizarTexto(this.filtroAsegurados);
        if (!texto) return this.estado.asegurados;
        return this.estado.asegurados.filter(asegurado => {
            const valorAsegurado = obtenerValorAseguradoBase(asegurado);
            const contenido = [
                asegurado.numeroDocumento,
                asegurado.tipoAsegurado,
                asegurado.edad,
                asegurado.grupo,
                valorAsegurado > 0 ? formatearDinero(valorAsegurado) : ''
            ].join(' ');
            return normalizarTexto(contenido).includes(texto);
        });
    }

    /**
     * Lógica de renderizarTablaAsegurados() + actualizarPaginacionAsegurados(): devuelve la
     * página actual y los metadatos que consume la plantilla. Ajusta `paginaAsegurados` al rango válido.
     */
    get paginaAseguradosActual(): PaginaAsegurados {
        const asegurados = this.estado.asegurados;
        const version = this.store.version();
        const clave = `${this.filtroAsegurados}|${this.paginaAsegurados}|${this.registrosPorPaginaAsegurados}`;
        const cache = this.cachePagina;
        if (cache && cache.clave === clave && cache.asegurados === asegurados
            && cache.cantidad === asegurados.length && cache.version === version) {
            return cache.modelo;
        }

        const filtrados = this.obtenerAseguradosFiltrados();
        const totalPaginas = Math.max(1, Math.ceil(filtrados.length / this.registrosPorPaginaAsegurados));
        this.paginaAsegurados = Math.min(Math.max(1, this.paginaAsegurados), totalPaginas);
        const inicio = (this.paginaAsegurados - 1) * this.registrosPorPaginaAsegurados;
        const visibles = filtrados.slice(inicio, inicio + this.registrosPorPaginaAsegurados);

        const filas: FilaAsegurado[] = visibles.map(asegurado => {
            const valorAsegurado = obtenerValorAseguradoBase(asegurado);
            return {
                id: asegurado.id,
                numeroDocumento: asegurado.numeroDocumento,
                tipoAsegurado: asegurado.tipoAsegurado || '—',
                edad: asegurado.edad,
                grupo: asegurado.grupo || '—',
                valorAseguradoTexto: valorAsegurado > 0 ? formatearDinero(valorAsegurado) : '—'
            };
        });

        const totalFiltrados = filtrados.length;
        const modelo: PaginaAsegurados = {
            filas,
            mensajeVacio: filas.length > 0
                ? ''
                : (asegurados.length === 0 ? 'No hay asegurados registrados' : 'No se encontraron asegurados con ese criterio'),
            ocultarPaginacion: asegurados.length === 0,
            textoInfo: totalFiltrados === 0
                ? 'Sin registros'
                : `Mostrando ${inicio + 1}-${inicio + filas.length} de ${totalFiltrados}${totalFiltrados !== asegurados.length ? ` (filtrados de ${asegurados.length})` : ''}`,
            textoPagina: `P\u00e1gina ${this.paginaAsegurados} de ${totalPaginas}`,
            enPrimera: this.paginaAsegurados <= 1,
            enUltima: this.paginaAsegurados >= totalPaginas
        };

        // La clave se calcula con la página ya ajustada para que el siguiente ciclo coincida.
        this.cachePagina = {
            clave: `${this.filtroAsegurados}|${this.paginaAsegurados}|${this.registrosPorPaginaAsegurados}`,
            asegurados,
            cantidad: asegurados.length,
            version,
            modelo
        };
        return modelo;
    }

    irAPaginaAsegurados(pagina: number): void {
        this.paginaAsegurados = pagina;
    }

    /** Listener `input` de `#buscadorAsegurado`. */
    cambiarFiltroAsegurados(texto: string): void {
        this.filtroAsegurados = texto;
        this.paginaAsegurados = 1;
    }

    /** Listener `change` de `#registrosPorPaginaAsegurados`; devuelve el valor normalizado para el campo. */
    cambiarRegistrosPorPaginaAsegurados(valor: any): number {
        this.registrosPorPaginaAsegurados = this.normalizarRegistrosPorPagina(valor);
        this.irAPaginaAsegurados(1);
        return this.registrosPorPaginaAsegurados;
    }

    /** Botones de paginación (configurarPaginacionAsegurados): primera, anterior, siguiente, última. */
    irAPrimeraPaginaAsegurados(): void { this.irAPaginaAsegurados(1); }
    irAPaginaAnteriorAsegurados(): void { this.irAPaginaAsegurados(this.paginaAsegurados - 1); }
    irAPaginaSiguienteAsegurados(): void { this.irAPaginaAsegurados(this.paginaAsegurados + 1); }
    irAUltimaPaginaAsegurados(): void { this.irAPaginaAsegurados(Number.MAX_SAFE_INTEGER); }

    /* ============================================================
       Coberturas por defecto, modal de coberturas y demo (app.js 7283-7426)
       ============================================================ */

    generarCoberturasPorDefecto(valorVida = 0): any[] {
        valorVida = this.limitarValorAseguradoParaModalidad(valorVida);
        const estado = this.estado;
        const catalogo = estado.coberturasCatalogo.some(cobertura => cobertura.codigo === 'WET')
            ? estado.coberturasCatalogo
            : [this.store.coberturaVidaPredeterminada, ...estado.coberturasCatalogo.filter(cobertura => cobertura.codigo !== 'WET')];
        return catalogo.map(c => {
            let va = 0;
            if (valorVida > 0) {
                if (c.codigo === 'WET' || c.codigo === 'VID') va = valorVida;
                else if (c.obligatoria) va = valorVida;
                // otras coberturas: por defecto 0 (el asesor las configurará)
            }
            return {
                codigo: c.codigo,
                codigoAmparo: c.codigoAmparo,
                nombre: c.nombre,
                activa: c.obligatoria,
                valorAsegurado: va,
                tasa: c.tasaBase,
                prima: 0
            };
        });
    }

    /** Asegurado cuyas coberturas muestra el modal `modalCoberturas`. */
    get aseguradoModalCoberturas(): any {
        return this.estado.asegurados.find(a => a.id === this.aseguradoModalCoberturasId) || null;
    }

    modalConfigCoberturas(idAsegurado: string): void {
        const asegurado = this.estado.asegurados.find(a => a.id === idAsegurado);
        if (!asegurado) return;
        this.aseguradoModalCoberturasId = idAsegurado;
        this.modalCoberturasVisible = true;
    }

    cerrarModalCoberturas(): void {
        this.modalCoberturasVisible = false;
        this.aseguradoModalCoberturasId = null;
    }

    toggleCobertura(idAsegurado: string, codigo: string, activa: boolean): void {
        const asegurado: any = this.estado.asegurados.find(a => a.id === idAsegurado);
        if (asegurado) {
            const cobertura = asegurado.coberturas.find((c: any) => c.codigo === codigo);
            if (cobertura) {
                cobertura.activa = activa;
                if (!activa) cobertura.valorAsegurado = 0;
                this.calculo.recalcularTodo();
            }
        }
    }

    actualizarCobertura(idAsegurado: string, codigo: string, campo: string, valor: any): void {
        const asegurado: any = this.estado.asegurados.find(a => a.id === idAsegurado);
        if (asegurado) {
            const cobertura = asegurado.coberturas.find((c: any) => c.codigo === codigo);
            if (cobertura) {
                if (campo === 'valor') cobertura.valorAsegurado = parseFloat(valor) || 0;
                cobertura.tasa = TASA_BASE_SISTEMA;
                cobertura.prima = this.calculo.calcularPrimaCobertura(cobertura, cobertura.valorAsegurado, asegurado.edad);
                this.calculo.recalcularTodo();
            }
        }
    }

    cargarDemoData(): void {
        this.ui.mostrarConfirmacionCotizador({
            titulo: 'Cargar datos de demostración',
            mensaje: '¿Deseas cargar 15 asegurados de demostración?',
            textoConfirmar: 'Cargar datos',
            esDestructiva: false,
            accion: () => this.cargarDemoDataConfirmado()
        });
    }

    cargarDemoDataConfirmado(): void {
        const demoAsegurados = [
            { doc: '1001', nombre: 'Juan García', edad: 35, ocupacion: 'Ejecutivo', salario: 5000000 },
            { doc: '1002', nombre: 'María López', edad: 28, ocupacion: 'Administrativo', salario: 3000000 },
            { doc: '1003', nombre: 'Carlos Rodríguez', edad: 42, ocupacion: 'Operario', salario: 2500000 },
            { doc: '1004', nombre: 'Ana Martínez', edad: 31, ocupacion: 'Ejecutivo', salario: 5500000 },
            { doc: '1005', nombre: 'Felipe Torres', edad: 38, ocupacion: 'Docente', salario: 2800000 },
            { doc: '1006', nombre: 'Laura Gómez', edad: 25, ocupacion: 'Administrativo', salario: 2200000 },
            { doc: '1007', nombre: 'Roberto Jiménez', edad: 55, ocupacion: 'Ejecutivo', salario: 6000000 },
            { doc: '1008', nombre: 'Patricia Fernández', edad: 29, ocupacion: 'Operario', salario: 2400000 },
            { doc: '1009', nombre: 'Diego Sánchez', edad: 48, ocupacion: 'Médico', salario: 7000000 },
            { doc: '1010', nombre: 'Elena Díaz', edad: 36, ocupacion: 'Ejecutivo', salario: 5200000 },
            { doc: '1011', nombre: 'Guillermo Pérez', edad: 32, ocupacion: 'Administrativo', salario: 3100000 },
            { doc: '1012', nombre: 'Sofía Ramírez', edad: 27, ocupacion: 'Independiente', salario: 3500000 },
            { doc: '1013', nombre: 'Andrés Castro', edad: 44, ocupacion: 'Operario', salario: 2600000 },
            { doc: '1014', nombre: 'Verónica López', edad: 39, ocupacion: 'Ejecutivo', salario: 5000000 },
            { doc: '1015', nombre: 'Héctor Morales', edad: 50, ocupacion: 'Docente', salario: 3000000 }
        ];

        demoAsegurados.forEach(d => {
            const asegurado = {
                id: generarUUID(),
                tipoDocumento: 'Cédula',
                numeroDocumento: d.doc,
                nombreCompleto: d.nombre,
                edad: d.edad,
                sexo: 'Masculino',
                ocupacion: d.ocupacion,
                salario: d.salario,
                coberturas: this.estado.coberturasCatalogo.map(c => ({
                    codigo: c.codigo,
                    codigoAmparo: c.codigoAmparo,
                    nombre: c.nombre,
                    activa: c.obligatoria || Math.random() > 0.5,
                    valorAsegurado: Math.random() > 0.5 ? Math.floor(Math.random() * 5 + 10) * 1000000 : 0,
                    tasa: c.tasaBase,
                    prima: 0
                })),
                subgrupoId: null,
                planId: null,
                primaIndividual: 0
            };

            this.estado.asegurados.push(asegurado);
        });

        this.calculo.recalcularTodo();
        this.ui.mostrarToast('Datos de demostración cargados (15 asegurados)', 'success');
    }
}
