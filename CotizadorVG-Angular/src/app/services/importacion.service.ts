import { inject, Injectable, Injector } from '@angular/core';
import { CONFIG, SMMLV } from '../core/config';
import { CotizadorStore } from '../core/cotizador.store';
import { UiService } from '../core/ui.service';
import {
    generarUUID,
    normalizarTexto,
    obtenerValorAseguradoBase,
    parsearValorAsegurado
} from '../core/utils';
import { AseguradoService } from './asegurado.service';
import { AsignacionService } from './asignacion.service';
import { CalculoService } from './calculo.service';

/** Resultado de validarGrupos() para la plantilla (`#simValidacion`). */
export interface ValidacionGrupos {
    valido: boolean;
    texto: string;
    /** Clase CSS: 'sim-validacion ok' | 'sim-validacion error'. */
    clase: string;
}

@Injectable({ providedIn: 'root' })
export class ImportacionService {
    static readonly TIPO_MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    private store = inject(CotizadorStore);
    private ui = inject(UiService);
    private injector = inject(Injector);

    // Dependencias perezosas hacia otros servicios (evita ciclos de DI).
    private get aseguradoService() { return this.injector.get(AseguradoService); }
    private get calculo() { return this.injector.get(CalculoService); }
    private get asignacion() { return this.injector.get(AsignacionService); }

    private get estado() { return this.store.estado; }
    /** Siempre se lee del store: la lista puede ser reemplazada. */
    get gruposSalariales() { return this.store.gruposSalariales; }

    /* ============================================================
       Estado de UI del Paso 2 (campos del panel de simulación / carga Excel)
       ============================================================ */
    /** `#simCantidad` */
    simCantidad: number | string | null = 100;
    /** `#simEdadPromedio` */
    simEdadPromedio: number | string | null = 35;
    /** `#excelStatus` */
    excelStatusTexto = '';
    /** Clase CSS de `#excelStatus`: 'excel-status' | 'excel-status ok' | 'excel-status error'. */
    excelStatusClase = 'excel-status';

    /* ============================================================
       Helpers de archivos
       ============================================================ */

    /** Carga diferida de exceljs. Devuelve null (con aviso) si no se puede cargar. */
    async cargarExcelJS(): Promise<any> {
        try {
            const modulo: any = await import('exceljs');
            return modulo.default ?? modulo;
        } catch {
            this.ui.mostrarToast('La librería Excel no está disponible. Verifica tu conexión.', 'error');
            return null;
        }
    }

    /** Descarga un archivo creando un Blob y un enlace `a[download]`. */
    descargarBlob(contenido: BlobPart, nombreArchivo: string, tipo: string): void {
        const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        enlace.style.display = 'none';
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* ============================================================
       SECCIÓN 11: IMPORT/EXPORT CSV
       ============================================================ */

    async importarCSV(evento: Event): Promise<void> {
        const input = evento.target as HTMLInputElement;
        const archivo = input.files?.[0];
        if (!archivo) return;

        try {
            const contenido = await archivo.text();
            const lineas = contenido.trim().split('\n');

            if (lineas.length < 2) {
                this.ui.mostrarToast('Archivo vacío o inválido', 'error');
                return;
            }

            // Saltar encabezado
            const nuevosAsegurados: any[] = [];
            const documentosEnArchivo = new Set<string>();
            for (let i = 1; i < lineas.length; i++) {
                const campos = lineas[i].split(',').map(c => c.trim());

                if (campos.length < 5) continue;

                const asegurado = {
                    id: generarUUID(),
                    tipoDocumento: campos[0] || 'Cédula',
                    numeroDocumento: campos[1],
                    nombreCompleto: campos[2],
                    edad: parseInt(campos[3]) || 0,
                    sexo: campos[4] || 'Masculino',
                    ocupacion: campos[5] || 'Administrativo',
                    salario: 0,
                    coberturas: this.aseguradoService.generarCoberturasPorDefecto(parsearValorAsegurado(campos[6])),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0
                };

                // Validar
                const valEdad = this.aseguradoService.validarEdad(asegurado.edad);
                const llaveDocumento = `${asegurado.tipoDocumento}|${asegurado.numeroDocumento}`;
                const documentoValido = asegurado.numeroDocumento && !documentosEnArchivo.has(llaveDocumento);

                if (documentoValido && valEdad.valido) {
                    nuevosAsegurados.push(asegurado);
                    documentosEnArchivo.add(llaveDocumento);
                }
            }

            if (nuevosAsegurados.length < CONFIG.REGLAS_COMPLEJIDAD.minAsegurados) {
                this.asignacion.mostrarAlertaRango(
                    `La base contiene ${nuevosAsegurados.length} asegurado(s) válido(s). Para continuar, debes cargar al menos ${CONFIG.REGLAS_COMPLEJIDAD.minAsegurados} asegurados. No se agregaron registros.`,
                    null,
                    'Cantidad mínima de asegurados'
                );
                return;
            }

            this.aseguradoService.reemplazarBaseAsegurados(nuevosAsegurados);
            this.calculo.recalcularTodo();
            this.ui.mostrarToast(`${nuevosAsegurados.length} asegurados importados correctamente. La base anterior fue reemplazada.`, 'success');
        } catch (err: any) {
            this.ui.mostrarToast('Error al importar: ' + err.message, 'error');
        } finally {
            input.value = '';
        }
    }

    exportarAsegurados(): void {
        let csv = 'Tipo Doc,#Documento,Nombre,Edad,Sexo,Ocupación,Valor Asegurado (COP),Prima Individual\n';

        this.estado.asegurados.forEach(a => {
            const prima = a.primaIndividual || 0;
            csv += `${a.tipoDocumento},${a.numeroDocumento},${a.nombreCompleto},${a.edad},${a.sexo},${a.ocupacion},${obtenerValorAseguradoBase(a)},${prima}\n`;
        });

        this.descargarCSV(csv, 'asegurados.csv');
    }

    async exportarAseguradosExcel(): Promise<void> {
        const ExcelJS = await this.cargarExcelJS();
        if (!ExcelJS) return;

        const libro = new ExcelJS.Workbook();
        const hoja = libro.addWorksheet('Asegurados');
        hoja.addRow(['Numero_Documento', 'Tipo_Asegurado', 'Edad', 'Valor_Asegurado_COP', 'Grupo']);
        this.estado.asegurados.forEach(asegurado => {
            hoja.addRow([
                String(asegurado.numeroDocumento || ''),
                asegurado.tipoAsegurado || '',
                Number(asegurado.edad) || '',
                obtenerValorAseguradoBase(asegurado) || '',
                asegurado.grupo || ''
            ]);
        });

        hoja.columns = [
            { width: 22 },
            { width: 20 },
            { width: 8 },
            { width: 22 },
            { width: 12 }
        ];
        hoja.getColumn(1).numFmt = '@';
        hoja.getColumn(4).numFmt = '#,##0';
        hoja.getRow(1).font = { bold: true };
        hoja.getRow(1).alignment = { horizontal: 'center' };
        hoja.views = [{ state: 'frozen', ySplit: 1 }];

        const contenido = await libro.xlsx.writeBuffer();
        this.descargarBlob(contenido, 'Asegurados_VidaGrupo.xlsx', ImportacionService.TIPO_MIME_XLSX);
        this.ui.mostrarToast('Base de asegurados exportada en Excel.', 'success');
    }

    exportarSubgrupos(): void {
        let csv = 'Subgrupo,Coberturas,Cantidad Asegurados,Planes,Prima Total\n';

        this.estado.subgrupos.forEach(sg => {
            const planes = this.estado.planes.filter(p => p.subgrupoId === sg.id).length;
            const primaTotal = this.estado.asegurados
                .filter(a => a.subgrupoId === sg.id)
                .reduce((sum, a) => sum + a.primaIndividual, 0);

            csv += `${sg.id.substring(0, 8)},${sg.coberturas},${sg.asegurados.length},${planes},${primaTotal}\n`;
        });

        this.descargarCSV(csv, 'subgrupos.csv');
    }

    exportarPlanes(): void {
        let csv = 'Plan,Subgrupo,Coberturas,Cantidad Asegurados,Prima Total\n';

        this.estado.planes.forEach(p => {
            csv += `${p.id.substring(0, 8)},${p.subgrupoId.substring(0, 8)},${p.coberturas},${p.asegurados.length},${p.primaTotal}\n`;
        });

        this.descargarCSV(csv, 'planes.csv');
    }

    generarPlantillaCSV(): void {
        const plantilla = `Tipo Doc,#Documento,Nombre,Edad,Sexo,Ocupación,Valor_Asegurado_COP
Cédula,1234567890,Juan García,35,Masculino,Administrativo,72000000
Cédula,0987654321,María López,28,Femenino,Ejecutivo,120000000
Cédula,1122334455,Carlos Rodríguez,42,Masculino,Operario,60000000`;

        this.descargarCSV(plantilla, 'plantilla_asegurados.csv');
    }

    descargarCSV(contenido: string, nombreArchivo: string): void {
        this.descargarBlob(contenido, nombreArchivo, 'text/csv;charset=utf-8');
        this.ui.mostrarToast('Descarga iniciada', 'success');
    }

    /* ============================================================
       Simulación de asegurados: grupos salariales
       (renderizarGruposSalariales desaparece: la tabla se enlaza a `gruposSalariales`)
       ============================================================ */

    agregarGrupoSalarial(): void {
        this.gruposSalariales.push({ rango: 'Nuevo rango', porcentaje: 0, salarioRef: 3 });
    }

    eliminarGrupoSalarial(index: number): void {
        if (this.gruposSalariales.length <= 1) {
            this.ui.mostrarToast('Debe haber al menos un grupo salarial', 'warning');
            return;
        }
        this.gruposSalariales.splice(index, 1);
    }

    /** Equivale a los `oninput` de la tabla de grupos salariales. */
    actualizarGrupoSalarial(index: number, campo: 'rango' | 'porcentaje' | 'salarioRef', valor: any): void {
        const grupo = this.gruposSalariales[index];
        if (!grupo) return;
        if (campo === 'rango') grupo.rango = String(valor ?? '');
        else grupo[campo] = parseFloat(valor) || 0;
    }

    validarGrupos(): boolean {
        return this.validacionGrupos.valido;
    }

    /** Texto y clase de `#simValidacion` (lógica de validarGrupos). */
    get validacionGrupos(): ValidacionGrupos {
        const total = this.gruposSalariales.reduce((s, g) => s + (parseFloat(g.porcentaje as any) || 0), 0);
        if (Math.abs(total - 100) < 0.01) {
            return { valido: true, texto: '✓ Total: 100%', clase: 'sim-validacion ok' };
        }
        return {
            valido: false,
            texto: `⚠ Los porcentajes suman ${total.toFixed(1)}% (deben sumar 100%)`,
            clase: 'sim-validacion error'
        };
    }

    generarSimulacion(): void {
        if (!this.validarGrupos()) {
            this.ui.mostrarToast('Los grupos salariales deben sumar exactamente 100%', 'error');
            return;
        }

        const cantidadInput = parseInt(String(this.simCantidad)) || 100;
        const edadPromedio = parseInt(String(this.simEdadPromedio)) || 35;

        if (cantidadInput < 1 || cantidadInput > 5000) {
            this.ui.mostrarToast('El número de asegurados debe estar entre 1 y 5000', 'error');
            return;
        }

        if (edadPromedio < 18 || edadPromedio > 70) {
            this.ui.mostrarToast('La edad promedio debe estar entre 18 y 70', 'error');
            return;
        }

        const estado = this.estado;
        const gruposSalariales = this.gruposSalariales;

        // Limpiar asegurados simulados previos (los que tienen flag simulado)
        estado.asegurados = estado.asegurados.filter(a => !a['simulado']);

        const nuevos: any[] = [];
        let contador = 1;

        gruposSalariales.forEach(grupo => {
            const n = Math.round((grupo.porcentaje / 100) * cantidadInput);
            const salarioMensual = grupo.salarioRef * 1_000_000;
            const ocupacion = this.salarioAOcupacion(salarioMensual);
            const valorVida = this.salarioAValorAsegurado(salarioMensual);

            for (let i = 0; i < n; i++) {
                // Distribución de edad: desviación aleatoria de ±8 años alrededor del promedio
                const desviacion = (Math.random() - 0.5) * 16; // -8 a +8
                const edad = Math.min(65, Math.max(18, Math.round(edadPromedio + desviacion)));

                const asegurado = {
                    id: generarUUID(),
                    tipoDocumento: 'Cédula',
                    numeroDocumento: `SIM-${String(contador).padStart(5, '0')}`,
                    nombreCompleto: `Asegurado Simulado ${contador}`,
                    edad,
                    sexo: Math.random() > 0.5 ? 'Masculino' : 'Femenino',
                    ocupacion,
                    salario: salarioMensual,
                    coberturas: this.aseguradoService.generarCoberturasPorDefecto(valorVida),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0,
                    simulado: true // flag para identificar registros simulados
                };

                nuevos.push(asegurado);
                contador++;
            }
        });

        // Si sobran o faltan por redondeo, ajustar con el último grupo
        const faltantes = cantidadInput - nuevos.length;
        if (faltantes > 0 && gruposSalariales.length > 0) {
            const ultimo = gruposSalariales[gruposSalariales.length - 1];
            const salarioMensual = ultimo.salarioRef * 1_000_000;
            const ocupacion = this.salarioAOcupacion(salarioMensual);
            const valorVida = this.salarioAValorAsegurado(salarioMensual);

            for (let i = 0; i < faltantes; i++) {
                const edad = Math.min(65, Math.max(18, Math.round(edadPromedio + (Math.random() - 0.5) * 16)));
                nuevos.push({
                    id: generarUUID(),
                    tipoDocumento: 'Cédula',
                    numeroDocumento: `SIM-${String(contador).padStart(5, '0')}`,
                    nombreCompleto: `Asegurado Simulado ${contador}`,
                    edad,
                    sexo: Math.random() > 0.5 ? 'Masculino' : 'Femenino',
                    ocupacion,
                    salario: salarioMensual,
                    coberturas: this.aseguradoService.generarCoberturasPorDefecto(valorVida),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0,
                    simulado: true
                });
                contador++;
            }
        }

        estado.asegurados.push(...nuevos);
        this.aseguradoService.mostrarSeccionAsegurados();
        this.calculo.recalcularTodo();
        this.ui.mostrarToast(`${nuevos.length} asegurados simulados generados`, 'success');
    }

    limpiarSimulados(): void {
        const antes = this.estado.asegurados.length;
        this.estado.asegurados = this.estado.asegurados.filter(a => !a['simulado']);
        this.calculo.recalcularTodo();
        this.ui.mostrarToast(`${antes - this.estado.asegurados.length} asegurados simulados eliminados`, 'success');
    }

    /* ---- Mapeadores de salario ---- */

    get SMMLV(): number { return SMMLV; }

    salarioAOcupacion(salarioMensual: number): string {
        if (salarioMensual < 2 * SMMLV) return 'Operario';
        if (salarioMensual < 5 * SMMLV) return 'Administrativo';
        if (salarioMensual < 10 * SMMLV) return 'Ejecutivo';
        return 'Ejecutivo';
    }

    salarioAValorAsegurado(salarioMensual: number): number {
        // Valor asegurado vida = 24 meses de salario, redondeado al millón más cercano
        const raw = salarioMensual * 24;
        return Math.round(raw / 1_000_000) * 1_000_000;
    }

    clasificacionAOcupacion(clasificacion: any): string {
        if (!clasificacion && clasificacion !== 0) return 'Administrativo';

        const texto = String(clasificacion).toLowerCase().trim();

        // Si ya es una ocupación conocida
        const match = CONFIG.OCUPACIONES.find(o => o.toLowerCase() === texto);
        if (match) return match;

        // Si contiene SMMLV
        if (texto.includes('smmlv') || texto.includes('smlv')) {
            const numMatch = texto.match(/(\d+[\.,]?\d*)/);
            if (numMatch) {
                const multiple = parseFloat(numMatch[1].replace(',', '.'));
                return this.salarioAOcupacion(multiple * SMMLV);
            }
        }

        // Intento numérico (salario en COP)
        const salario = parseFloat(String(clasificacion).replace(/[^0-9.]/g, ''));
        if (!isNaN(salario) && salario > 0) {
            return this.salarioAOcupacion(salario);
        }

        return 'Administrativo';
    }

    /* ---- Importación Excel (ExcelJS) ---- */

    /** Convierte el valor de una celda de ExcelJS al valor "plano" que entregaba SheetJS (`defval: ''`). */
    private valorCelda(valor: any): any {
        if (valor === null || valor === undefined) return '';
        if (valor instanceof Date) return valor.toISOString();
        if (typeof valor === 'object') {
            if ('result' in valor) return this.valorCelda(valor.result);
            if (Array.isArray(valor.richText)) return valor.richText.map((t: any) => t.text).join('');
            if ('formula' in valor || 'sharedFormula' in valor || 'error' in valor) return '';
            if ('text' in valor) return this.valorCelda(valor.text);
            return '';
        }
        return valor;
    }

    /** Equivale a `XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' })` sobre la primera hoja. */
    private async leerFilasExcel(ExcelJS: any, archivo: File): Promise<any[][]> {
        const libro = new ExcelJS.Workbook();
        await libro.xlsx.load(await archivo.arrayBuffer());
        const hoja = libro.worksheets[0];
        const filas: any[][] = [];
        if (!hoja) return filas;

        const totalFilas = hoja.rowCount;
        const totalColumnas = hoja.columnCount;
        for (let r = 1; r <= totalFilas; r++) {
            const fila = hoja.getRow(r);
            const celdas: any[] = [];
            for (let c = 1; c <= totalColumnas; c++) {
                celdas.push(this.valorCelda(fila.getCell(c).value));
            }
            filas.push(celdas);
        }
        return filas;
    }

    async importarExcel(evento: Event): Promise<void> {
        const input = evento.target as HTMLInputElement;
        const archivo = input.files?.[0];
        if (!archivo) return;

        this.excelStatusTexto = 'Leyendo archivo...';
        this.excelStatusClase = 'excel-status';

        // ExcelJS solo lee libros .xlsx (OOXML); el formato binario .xls no es compatible.
        if (!/\.xlsx$/i.test(archivo.name)) {
            const mensaje = 'Solo se admiten archivos Excel con formato .xlsx. Abre el archivo en Excel, guárdalo como "Libro de Excel (.xlsx)" y vuelve a cargarlo.';
            this.ui.mostrarToast(mensaje, 'error');
            this.excelStatusTexto = mensaje;
            this.excelStatusClase = 'excel-status error';
            input.value = '';
            return;
        }

        const ExcelJS = await this.cargarExcelJS();
        if (!ExcelJS) {
            this.excelStatusTexto = 'La librería de Excel no está disponible. Verifica tu conexión.';
            this.excelStatusClase = 'excel-status error';
            return;
        }

        this.ui.mostrarCargando('Leyendo y validando el archivo...');
        try {
            const filas = await this.leerFilasExcel(ExcelJS, archivo);

            if (filas.length < 2) {
                this.ui.mostrarToast('El archivo está vacío o solo tiene encabezados', 'error');
                this.excelStatusTexto = 'Archivo vacío.';
                this.excelStatusClase = 'excel-status error';
                return;
            }

            // Determinar si la primera fila es encabezado
            const primeraFila = filas[0];
            const esEncabezado = isNaN(primeraFila[1]) && isNaN(primeraFila[2]);
            const inicio = esEncabezado ? 1 : 0;
            const encabezados: string[] = esEncabezado
                ? primeraFila.map(valor => normalizarTexto(valor).replace(/[^a-z0-9]/g, ''))
                : [];
            const indiceColumna = (alternativas: string[], predeterminado: number) => {
                const indice = encabezados.findIndex(encabezado => alternativas.includes(encabezado));
                return indice >= 0 ? indice : predeterminado;
            };
            const columnaDocumento = indiceColumna(['numerodocumento', 'documento', 'numerodoc'], 0);
            const columnaTipoAsegurado = indiceColumna(['tipoasegurado', 'parentesco'], 1);
            const columnaEdad = indiceColumna(['edad'], 2);
            const columnaValorAsegurado = indiceColumna(['valoraseguradocop', 'valorasegurado', 'valoraseguradovida'], 3);
            const columnaGrupo = indiceColumna(['grupo'], 4);

            const nuevos: any[] = [];
            const errores: string[] = [];
            const ajustes: any[] = [];
            const documentosEnArchivo = new Set<string>();

            for (let i = inicio; i < filas.length; i++) {
                const fila = filas[i];
                if (!fila || fila.every(c => c === '' || c === null || c === undefined)) continue;

                const documento = String(fila[columnaDocumento] ?? '').trim();
                const tipoAseguradoRaw = String(fila[columnaTipoAsegurado] ?? '').trim();
                const edadRaw = fila[columnaEdad];
                const valorAseguradoRaw = fila[columnaValorAsegurado];
                const grupoRaw = String(fila[columnaGrupo] ?? '').trim();

                if (!documento) { errores.push(`Fila ${i + 1}: documento vacío`); continue; }

                const tipoAsegurado = CONFIG.TIPO_ASEGURADO.find(tipo =>
                    tipo.toLowerCase() === tipoAseguradoRaw.toLowerCase()
                );
                if (!tipoAsegurado) {
                    errores.push(`Fila ${i + 1}: Tipo_Asegurado inválido (${tipoAseguradoRaw || 'vacío'})`); continue;
                }

                const grupo = CONFIG.GRUPOS_ASIGNACION.find(item =>
                    item.toLowerCase() === grupoRaw.toLowerCase()
                );
                if (!grupo) {
                    errores.push(`Fila ${i + 1}: Grupo inválido (${grupoRaw || 'vacío'}). Selecciona Grupo 1 a Grupo 5.`); continue;
                }

                const edad = Number(edadRaw);
                if (Number.isInteger(edad) && edad > CONFIG.EDAD_MAXIMA_ASEGURADO) {
                    errores.push(`Documento ${documento}: registro eliminado porque la edad (${edad}) supera el máximo permitido de ${CONFIG.EDAD_MAXIMA_ASEGURADO} años para la carga de Excel.`); continue;
                }
                const validacionEdad = this.aseguradoService.validarEdad(edadRaw, tipoAsegurado);
                if (!validacionEdad.valido) {
                    errores.push(`Documento ${documento}: registro eliminado por edad inválida (${edadRaw}). ${validacionEdad.mensaje}.`); continue;
                }

                const valorAsegurado = parsearValorAsegurado(valorAseguradoRaw);
                if (!Number.isFinite(valorAsegurado) || valorAsegurado <= 0) {
                    errores.push(`Fila ${i + 1}: valor asegurado inválido (${valorAseguradoRaw})`); continue;
                }

                if (documentosEnArchivo.has(documento)) {
                    errores.push(`Fila ${i + 1}: documento duplicado dentro del archivo`); continue;
                }
                documentosEnArchivo.add(documento);

                const valorAseguradoLimitado = this.aseguradoService.limitarValorAseguradoParaModalidad(valorAsegurado);
                const fueAjustadoPorLimite = valorAseguradoLimitado !== valorAsegurado;
                if (fueAjustadoPorLimite) {
                    ajustes.push({
                        nombre: `Asegurado ${documento}`,
                        documento,
                        valorOriginal: valorAsegurado,
                        valorAjustado: valorAseguradoLimitado
                    });
                }

                nuevos.push({
                    id: generarUUID(),
                    tipoDocumento: 'Cédula',
                    numeroDocumento: documento,
                    tipoAsegurado,
                    grupo,
                    nombreCompleto: `Asegurado ${documento}`,
                    edad,
                    sexo: 'Masculino',
                    ocupacion: 'Administrativo',
                    salario: 0,
                    coberturas: this.aseguradoService.generarCoberturasPorDefecto(valorAseguradoLimitado),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0,
                    simulado: false,
                    ...(fueAjustadoPorLimite && {
                        valorAseguradoAjustadoPorLimite: true,
                        valorAseguradoOriginal: valorAsegurado
                    })
                });
            }

            if (nuevos.length < CONFIG.REGLAS_COMPLEJIDAD.minAsegurados) {
                const mensajeMinimo = `La base contiene ${nuevos.length} asegurado(s) válido(s). Para continuar, debes cargar al menos ${CONFIG.REGLAS_COMPLEJIDAD.minAsegurados} asegurados. No se agregaron registros.`;
                this.asignacion.mostrarAlertaRango(mensajeMinimo, null, 'Cantidad mínima de asegurados');
                this.ui.mostrarToast(mensajeMinimo, 'warning');
                this.excelStatusTexto = mensajeMinimo;
                this.excelStatusClase = 'excel-status error';
                return;
            }

            this.aseguradoService.reemplazarBaseAsegurados(nuevos);
            if (nuevos.length > 0) this.aseguradoService.mostrarSeccionAsegurados();
            this.calculo.recalcularTodo();

            const msgOk = `${nuevos.length} asegurado(s) cargado(s) correctamente. La base anterior fue reemplazada.`;
            const msgErr = errores.length > 0 ? ` ${errores.length} fila(s) con error omitidas.` : '';
            this.ui.mostrarToast(msgOk + msgErr, nuevos.length > 0 ? 'success' : 'error');
            this.aseguradoService.mostrarResumenModificaciones({ ajustes, retirados: errores });

            this.excelStatusTexto = msgOk + msgErr;
            this.excelStatusClase = `excel-status ${nuevos.length > 0 ? 'ok' : 'error'}`;
        } catch (err: any) {
            this.ui.mostrarToast('Error al leer el archivo Excel: ' + err.message, 'error');
            this.excelStatusTexto = 'Error: ' + err.message;
            this.excelStatusClase = 'excel-status error';
        } finally {
            // Limpiar input para permitir recargar el mismo archivo
            input.value = '';
            this.ui.ocultarCargando();
        }
    }

    async descargarPlantillaExcel(): Promise<void> {
        const ExcelJS = await this.cargarExcelJS();
        if (!ExcelJS) return;

        // Datos de la plantilla: encabezados + filas de ejemplo
        const datos = [
            ['Numero_Documento', 'Tipo_Asegurado', 'Edad', 'Valor_Asegurado_COP', 'Grupo'],
            ['1012345678', 'Afiliado principal', 28, 67000000, 'Grupo 1'],
            ['1023456789', 'Conyugue', 35, 132000000, 'Grupo 2'],
            ['1034567890', 'Hijos', 42, 36000000, 'Grupo 3'],
            ['1045678901', 'Padres', 31, 216000000, 'Grupo 4'],
            ['1056789012', 'Padrastos', 25, 48000000, 'Grupo 5']
        ];

        const libro = new ExcelJS.Workbook();
        const hoja = libro.addWorksheet('Asegurados');
        hoja.addRows(datos);

        hoja.columns = [
            { width: 22 },
            { width: 20 },
            { width: 8 },
            { width: 22 },
            { width: 12 }
        ];
        hoja.getColumn(1).numFmt = '@';
        hoja.getColumn(4).numFmt = '"$" #,##0';
        hoja.getRow(1).font = { bold: true };
        hoja.getRow(1).alignment = { horizontal: 'center' };
        hoja.views = [{ state: 'frozen', ySplit: 1 }];

        const opcionesTipoAsegurado = `"${CONFIG.TIPO_ASEGURADO.join(',')}"`;
        hoja.getCell('B2').dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [opcionesTipoAsegurado],
            showErrorMessage: true,
            errorStyle: 'stop',
            errorTitle: 'Tipo de asegurado inválido',
            error: 'Selecciona un valor de la lista.',
            promptTitle: 'Tipo_Asegurado',
            prompt: 'Selecciona el tipo de asegurado.'
        };
        for (let fila = 3; fila <= 1000; fila++) {
            hoja.getCell(`B${fila}`).dataValidation = { ...hoja.getCell('B2').dataValidation };
        }

        const opcionesGrupo = `"${CONFIG.GRUPOS_ASIGNACION.join(',')}"`;
        hoja.getCell('E2').dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [opcionesGrupo],
            showErrorMessage: true,
            errorStyle: 'stop',
            errorTitle: 'Grupo inválido',
            error: 'Selecciona un grupo entre Grupo 1 y Grupo 5.',
            promptTitle: 'Grupo',
            prompt: 'Selecciona el grupo que se usará como guía para la asignación manual.'
        };
        for (let fila = 3; fila <= 1000; fila++) {
            hoja.getCell(`E${fila}`).dataValidation = { ...hoja.getCell('E2').dataValidation };
        }

        const guia = libro.addWorksheet('Guía de uso');
        guia.mergeCells('A1:B1');
        guia.getCell('A1').value = 'GUÍA DE USO - PLANTILLA DE ASEGURADOS';
        guia.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
        guia.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0033A0' } };
        guia.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        guia.getRow(1).height = 30;

        guia.mergeCells('A2:B2');
        guia.getCell('A2').value = 'Diligencie la hoja "Asegurados" siguiendo estas indicaciones. La primera hoja del archivo es la que se procesa al cargarlo en el cotizador.';
        guia.getCell('A2').alignment = { wrapText: true, vertical: 'middle' };
        guia.getRow(2).height = 34;

        guia.addRow([]);
        guia.addRow(['Campo', 'Mensaje de guía']);
        const filaEncabezadosGuia = guia.getRow(4);
        filaEncabezadosGuia.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        filaEncabezadosGuia.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        filaEncabezadosGuia.alignment = { vertical: 'middle' };

        [
            ['Numero_Documento', 'Ingrese el número de documento. Se recomienda usar únicamente números, sin puntos, comas, guiones ni espacios.'],
            ['Tipo_Asegurado', `Seleccione una opción de la lista desplegable: ${CONFIG.TIPO_ASEGURADO.join(', ')}.`],
            ['Edad', `Ingrese la edad en números enteros. La edad mínima depende del tipo de asegurado y la modalidad; el máximo permitido es de ${CONFIG.EDAD_MAXIMA_ASEGURADO} años.`],
            ['Valor_Asegurado_COP', 'Ingrese únicamente el valor asegurado en pesos colombianos como un número mayor que cero. No escriba el símbolo $ ni texto.'],
            ['Grupo', `Seleccione una opción de la lista desplegable (${CONFIG.GRUPOS_ASIGNACION.join(', ')}). El grupo sirve como referencia para la preasignación de planes.`]
        ].forEach(fila => guia.addRow(fila));

        guia.addRow([]);
        const filaNotas = guia.rowCount + 1;
        guia.mergeCells(`A${filaNotas}:B${filaNotas}`);
        guia.getCell(`A${filaNotas}`).value = 'Recomendaciones para completar y cargar el archivo';
        guia.getCell(`A${filaNotas}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        guia.getCell(`A${filaNotas}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        [
            'Use una fila por cada asegurado y diligencie las cinco columnas.',
            'No cambie los nombres ni el orden de las columnas de la hoja "Asegurados".',
            'Las filas de ejemplo se pueden reemplazar o eliminar antes de ingresar la información real.',
            'Asigne el grupo correspondiente a cada asegurado; el cotizador acepta únicamente Grupo 1 a Grupo 5.'
        ].forEach((mensaje, indice) => {
            const fila = filaNotas + indice + 1;
            guia.mergeCells(`A${fila}:B${fila}`);
            guia.getCell(`A${fila}`).value = `- ${mensaje}`;
            guia.getCell(`A${fila}`).alignment = { wrapText: true, vertical: 'middle' };
            guia.getRow(fila).height = 30;
        });

        guia.columns = [{ width: 30 }, { width: 100 }];
        for (let fila = 5; fila <= 9; fila++) {
            guia.getRow(fila).alignment = { vertical: 'middle', wrapText: true };
            guia.getRow(fila).height = 42;
            if (fila % 2 === 1) {
                guia.getRow(fila).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FC' } };
            }
        }
        guia.views = [{ state: 'frozen', ySplit: 4 }];

        const contenido = await libro.xlsx.writeBuffer();
        this.descargarBlob(contenido, 'Plantilla_Asegurados_VidaGrupo.xlsx', ImportacionService.TIPO_MIME_XLSX);
        this.ui.mostrarToast('Plantilla descargada correctamente', 'success');
    }
}
