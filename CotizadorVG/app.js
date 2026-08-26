/* ============================================================
   COTIZADOR VIDA GRUPO SEGUROS SURA
   app.js - Lógica de aplicación (14 secciones)
   ============================================================ */

/* ============================================================
   SECCIÓN 1: CONFIGURACIÓN Y CATÁLOGOS
   ============================================================ */

const CONFIG = {
    VERSION: '1.0.0',
    VERSIONES: [1, 3, 5, 10, 20],
    OCUPACIONES: ['Ejecutivo', 'Administrativo', 'Operario', 'Independiente', 'Docente', 'Médico'],
    GENERO: ['Masculino', 'Femenino'],
    TIPO_DOCUMENTO: ['Cédula', 'Pasaporte', 'Cédula Extranjería', 'NIT'],
    TIPO_ASEGURADO: ['Afiliado principal', 'Conyugue', 'Hijos', 'Hijastros', 'Hermanos', 'Sobrinos', 'Nietos', 'Padres', 'Padrastos'],
    COBERTURAS_EXCLUIDAS_POR_PARENTESCO: {
        // Cónyuge y descendientes no pueden contratar estos amparos.
        Conyugue: ['IPP', 'WE6', 'WE9'],
        Hijos: ['IPP', 'WE6', 'WE9'],
        Hijastros: ['IPP', 'WE6', 'WE9'],
        Hermanos: ['IPP', 'WE6', 'WE9'],
        Sobrinos: ['IPP', 'WE6', 'WE9'],
        Nietos: ['IPP', 'WE6', 'WE9']
    },
    COBERTURAS_HABILITADAS_POR_PARENTESCO: {
        // Se conservan las dos modalidades disponibles de auxilio funerario.
        Padres: ['WET', 'ITP', 'GEN', 'AFC'],
        Padrastos: ['WET', 'ITP', 'GEN', 'AFC']
    },
    CANAL_COMERCIAL: ['Sucursal', 'Promotora'],
    FACTORES_EDAD: {
        '18-25': 0.95,
        '26-35': 1.0,
        '36-45': 1.1,
        '46-55': 1.25,
        '56-65': 1.5,
        '65+': 1.8
    },
    FACTORES_OCUPACION: {
        'Ejecutivo': 0.9,
        'Administrativo': 1.0,
        'Operario': 1.2,
        'Independiente': 1.15,
        'Docente': 0.95,
        'Médico': 0.95
    },
    REGLAS_COMPLEJIDAD: {
        maxSubgrupos: 8,
        maxPlanesPorSubgrupo: 6,
        maxPlanes: 20,
        minAsegurados: 4,
        tolerancia: 0.1 // 10%
    }
};

const TASA_BASE_SISTEMA = 0.1;
const API_TASAS_COBERTURAS = 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3bdc2f33585c485f9d394c1d73122c37/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=cOMyHLPKcYp9-mpp7gV4VLy7b2TwQAwjN6t-rfVZ73M';
const coberturaVidaPredeterminada = {
    codigo: 'WET',
    codigoAmparo: 63717,
    nombre: 'VIDA',
    tasaBase: TASA_BASE_SISTEMA,
    obligatoria: true
};
let coberturasDisponibles = [coberturaVidaPredeterminada];

// La API entrega el nombre funcional en Amparo_Resumido_Definitivo.
// Los valores anteriores se mantienen como alias para cotizaciones ya guardadas.
const NOMBRES_AMPARO_RESUMIDO = {
    'INVALIDEZ POR ENFERMEDAD': 'Invalidez, Pérdida O Inutilización Por Enfermedad',
    'EG INDEPENDIENTE': 'Enfermedades graves Independientes',
    'EG': 'Enfermedades graves',
    'EG ANTICIPO': 'Enfermedades graves',
    'INVALIDEZ POR ACCIDENTE': 'Invalidez Por Accidente',
    'ITP': 'Invalidez o pérdida por un accidente o enfermedad',
    'BONO PARA ADECUACIONES DEL HOGAR': 'Bono para adecuaciones del hogar',
    'AUXILIO DE REPATRIACION': 'Auxilio de repatriación',
    'AUXILIO DE REPATRIACIÓN': 'Auxilio de repatriación',
    'MUERTE ACCIDENTAL': 'Muerte Accidental',
    'PÉRDIDA PARCIAL DE LA CAPACIDAD LABORAL': 'Pérdida Parcial De La Capacidad Laboral',
    'VIDA': 'Vida',
    'AUXILIO FUNERARIO': 'Bono funerario',
    'BONO PARA EDUCACIÓN': 'Bono para educación',
    'BONO CANASTA': 'Bono Canasta',
    'GASTOS DE CURACIÓN': 'Gastos de curación',
    'AUXILIO POR MATERNIDAD/PATERNIDAD': 'Auxilio Por Maternidad O Paternidad',
    'RENTA POR HOSPITALIZACIÓN BÁSICO': 'Renta por hospitalización',
    'RENTA POR HOSPITALIZACIÓN UCI': 'Renta por hospitalización en UCI',
    'RENTA POR INCAPACIDAD POR ACCIDENTE': 'Renta Por Incapacidad Por Accidente',
    'RENTA POR INCAPACIDAD': 'Renta por incapacidad por accidente y enfermedad'
};

// Esta lista define las coberturas que se ofrecen para crear planes. No depende
// de que la API responda una fila para cada una; la API solo complementa tasas.
const AMPAROS_RESUMIDOS_DEFINITIVOS = [
    { nombre: 'Enfermedades graves Independientes', codigo: 'WEV' },
    { nombre: 'Enfermedades graves', codigo: 'WEU' },
    { nombre: 'Invalidez o pérdida por un accidente o enfermedad', codigo: 'WEZ' },
    { nombre: 'Invalidez Por Accidente', codigo: 'WEY' },
    { nombre: 'Bono para adecuaciones del hogar', codigo: 'WES' },
    { nombre: 'Muerte Accidental', codigo: 'WE1' },
    { nombre: 'Pérdida Parcial De La Capacidad Laboral', codigo: 'WE6' },
    { nombre: 'Vida', codigo: 'WET' },
    { nombre: 'Bono para educación', codigo: 'WER' },
    { nombre: 'Bono funerario', codigo: 'WEN' },
    { nombre: 'Bono Canasta', codigo: 'WEQ' },
    { nombre: 'Gastos de curación', codigo: 'WEW' },
    { nombre: 'Auxilio Por Maternidad O Paternidad', codigo: 'WEO' },
    { nombre: 'Renta por hospitalización', codigo: 'WE7' },
    { nombre: 'Renta por hospitalización en UCI', codigo: 'WE8' },
    { nombre: 'Renta Por Incapacidad Por Accidente', codigo: 'WE9' },
    { nombre: 'Renta por incapacidad por accidente y enfermedad', codigo: 'WFA' },
    { nombre: 'Auxilio de repatriación', codigo: 'WEP' },
    { nombre: 'Invalidez, Pérdida O Inutilización Por Enfermedad', codigo: 'WE0' }
];

const PLANES_SUGERIDOS = [
    { nombre: 'Plan 1', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Bono funerario'] },
    { nombre: 'Plan 2', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario'] },
    { nombre: 'Plan 3', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario', 'Pérdida Parcial De La Capacidad Laboral', 'Bono Canasta', 'Gastos de curación', 'Renta por incapacidad por accidente y enfermedad'] },
    { nombre: 'Plan 4', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario', 'Pérdida Parcial De La Capacidad Laboral', 'Bono Canasta', 'Gastos de curación', 'Renta por hospitalización'] },
    { nombre: 'Plan 5', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario', 'Pérdida Parcial De La Capacidad Laboral', 'Bono Canasta', 'Gastos de curación', 'Renta por hospitalización', 'Renta por incapacidad por accidente y enfermedad'] }
];
let planEditandoId = null;
let campoRangoConError = null;

function crearCatalogoInicial() {
    const vida = coberturasDisponibles.find(cobertura => cobertura.codigo === 'WET');
    return vida ? [{ ...vida, tasaBase: TASA_BASE_SISTEMA, obligatoria: true }] : [];
}

function sincronizarVidaObligatoria() {
    const vida = coberturasDisponibles.find(cobertura => cobertura.codigo === 'WET');
    if (!vida) return;

    estado.coberturasCatalogo = estado.coberturasCatalogo
        .filter(cobertura => cobertura.codigo !== 'VID')
        .map(cobertura => ({ ...cobertura, obligatoria: cobertura.codigo === 'WET' || cobertura.obligatoria }));

    if (!estado.coberturasCatalogo.some(cobertura => cobertura.codigo === 'WET')) {
        estado.coberturasCatalogo.unshift({ ...vida, tasaBase: TASA_BASE_SISTEMA, obligatoria: true });
    }

    estado.asegurados.forEach(asegurado => {
        const vidaAnterior = asegurado.coberturas?.find(cobertura => cobertura.codigo === 'VID');
        asegurado.coberturas = (asegurado.coberturas || []).filter(cobertura => cobertura.codigo !== 'VID');
        if (!asegurado.coberturas.some(cobertura => cobertura.codigo === 'WET')) {
            asegurado.coberturas.push({
                codigo: vida.codigo,
                codigoAmparo: vida.codigoAmparo,
                nombre: vida.nombre,
                activa: true,
                valorAsegurado: vidaAnterior?.valorAsegurado || 0,
                tasa: TASA_BASE_SISTEMA,
                prima: 0
            });
        }
    });
}

function sincronizarNombresVisiblesCoberturas() {
    const nombrePorCodigo = new Map(coberturasDisponibles.map(cobertura => [cobertura.codigo, cobertura.nombre]));
    estado.coberturasCatalogo.forEach(cobertura => {
            const amparoResumidoOriginal = nombrePorCodigo.get(cobertura.codigo) || cobertura.nombre;
            cobertura.nombre = obtenerAmparoResumidoDefinitivo(amparoResumidoOriginal);
    });
    estado.asegurados.forEach(asegurado => {
        (asegurado.coberturas || []).forEach(cobertura => {
            cobertura.nombre = nombrePorCodigo.get(cobertura.codigo) || cobertura.nombre;
        });
    });
}

/* ============================================================
   SECCIÓN 2: ESTADO GLOBAL
   ============================================================ */

let estado = {
    poliza: {
        id: generarUUID(),
        tomador: '',
        tipoIdentificacion: 'NIT',
        numeroIdentificacion: '',
        modalidadPlan: 'Voluntaria (Contributiva)',
        actividad: '',
        vigenciaDesde: '',
        vigenciaHasta: '',
        oficina: '',
        formaPago: 'Mensual',
        fechaCobro: '',
        comision: 20,
        honorarioPromotora: 10,
        valorSiniestrosTotales: 0,
        anosExposicion: 0,
        siniestrosPromedio: 0,
        asesor: '',
        canalComercial: 'Sucursal',
        observaciones: ''
    },
    coberturasCatalogo: crearCatalogoInicial(),
    tasasPorCoberturaEdad: {},
    porcentajesFactorPorCoberturaEdad: {},
    edadesMaximasPorCobertura: {},
    asegurados: [],
    subgrupos: [],   // estructura explícita: { id, nombre, coberturas[], asegurados[] }
    planes: [],      // estructura: { id, subgrupoId, nombre, valoresCobertura{}, asegurados[], primaTotal }
    sugerencias: [],
    historial: []
};

let pasoActual = 1;
let demoData = null;
let aseguradoEditandoId = null;

// Estado del flujo de negocio
let flujo = {
    tipo: null,        // 'nuevo' | 'renovacion'
    subtipo: null,     // 'simulacion' | 'cotizacion' (solo para 'nuevo')
    polizaSeleccionada: null  // póliza elegida en renovación
};

// Grupos salariales para simulación
let gruposSalariales = [
    { rango: '< 2 SMMLV',     porcentaje: 40, salarioRef: 1.5 },
    { rango: '2 - 5 SMMLV',   porcentaje: 35, salarioRef: 3.5 },
    { rango: '> 5 SMMLV',     porcentaje: 25, salarioRef: 8   }
];

/* ============================================================
   SECCIÓN 3: LOCAL STORAGE
   ============================================================ */

function guardarEstado() {
    try {
        localStorage.setItem('cotizadorEstado', JSON.stringify(estado));
        localStorage.setItem('pasoActual', JSON.stringify(pasoActual));
        return true;
    } catch (err) {
        mostrarToast('Error al guardar: ' + err.message, 'error');
        return false;
    }
}

function cargarEstado() {
    try {
        const estadoGuardado = localStorage.getItem('cotizadorEstado');
        const pasoGuardado = localStorage.getItem('pasoActual');
        
        if (estadoGuardado) {
            estado = JSON.parse(estadoGuardado);
            estado.edadesMaximasPorCobertura = estado.edadesMaximasPorCobertura || {};
            estado.asegurados = (estado.asegurados || []).map(asegurado => ({
                ...asegurado,
                tipoAsegurado: asegurado.tipoAsegurado === 'Empleado'
                    ? 'Afiliado principal'
                    : asegurado.tipoAsegurado
            }));
            estado.poliza.modalidadPlan = estado.poliza.modalidadPlan || 'Voluntaria (Contributiva)';
            estado.poliza.canalComercial = estado.poliza.canalComercial === 'Promotora' ? 'Promotora' : 'Sucursal';
            estado.poliza.comision = Math.min(Math.max(Number(estado.poliza.comision) || 0, 0), 30);
            estado.poliza.honorarioPromotora = Math.min(Math.max(Number(estado.poliza.honorarioPromotora) || 0, 0), 10);
            if (estado.poliza.canalComercial === 'Sucursal') estado.poliza.honorarioPromotora = 0;
            estado.poliza.valorSiniestrosTotales = Number(estado.poliza.valorSiniestrosTotales) || 0;
            estado.poliza.anosExposicion = Number(estado.poliza.anosExposicion) || 0;
            estado.poliza.siniestrosPromedio = Number(estado.poliza.siniestrosPromedio) || 0;
        }
        
        if (pasoGuardado) {
            pasoActual = JSON.parse(pasoGuardado);
        }
        
        return true;
    } catch (err) {
        console.error('Error al cargar estado:', err);
        return false;
    }
}

function limpiarEstado() {
    if (confirm('¿Deseas limpiar todos los datos? Esta acción no se puede deshacer.')) {
        localStorage.removeItem('cotizadorEstado');
        localStorage.removeItem('pasoActual');
        estado = {
            poliza: {
                id: generarUUID(),
                tomador: '',
                tipoIdentificacion: 'NIT',
                numeroIdentificacion: '',
                modalidadPlan: 'Voluntaria (Contributiva)',
                actividad: '',
                vigenciaDesde: '',
                vigenciaHasta: '',
                oficina: '',
                formaPago: 'Mensual',
                fechaCobro: '',
                comision: 20,
                honorarioPromotora: 10,
                valorSiniestrosTotales: 0,
                anosExposicion: 0,
                siniestrosPromedio: 0,
                asesor: '',
                canalComercial: 'Sucursal',
                observaciones: ''
            },
            coberturasCatalogo: crearCatalogoInicial(),
            tasasPorCoberturaEdad: {},
            porcentajesFactorPorCoberturaEdad: {},
            edadesMaximasPorCobertura: {},
            asegurados: [],
            subgrupos: [],
            planes: [],
            sugerencias: [],
            historial: []
        };
        pasoActual = 1;
        flujo = { tipo: null, subtipo: null, polizaSeleccionada: null };
        mostrarSoloPantalla('pantalla-landing');
        mostrarToast('Datos limpiados correctamente', 'success');
    }
}

/* ============================================================
   SECCIÓN 4: GESTIÓN DE ASEGURADOS
   ============================================================ */

function agregarAsegurado(asegurado = null) {
    const modal = document.getElementById('modalAsegurado');
    const tipo = document.getElementById('aseguradoTipo');
    if (!modal || !tipo) return;

    aseguradoEditandoId = asegurado?.id || null;
    document.getElementById('tituloModalAsegurado').textContent = asegurado ? 'Editar asegurado' : 'Agregar asegurado';
    document.getElementById('aseguradoNumeroDocumento').value = asegurado?.numeroDocumento || '';
    document.getElementById('aseguradoNombreCompleto').value = asegurado?.nombreCompleto || '';
    document.getElementById('aseguradoEdad').value = asegurado?.edad ?? '';
    tipo.innerHTML = CONFIG.TIPO_ASEGURADO.map(valor => `<option value="${valor}">${valor}</option>`).join('');
    tipo.value = asegurado?.tipoAsegurado || 'Afiliado principal';
    document.getElementById('aseguradoValor').value = formatearValorMonetario(asegurado ? obtenerValorAseguradoBase(asegurado) : null);
    modal.style.display = 'flex';
}

function cerrarModalAsegurado() {
    document.getElementById('modalAsegurado').style.display = 'none';
    aseguradoEditandoId = null;
}

function guardarAseguradoDesdeModal() {
    const numeroDocumento = document.getElementById('aseguradoNumeroDocumento').value.trim();
    const nombreCompleto = document.getElementById('aseguradoNombreCompleto').value.trim();
    const tipoAsegurado = document.getElementById('aseguradoTipo').value;
    const edad = Number(document.getElementById('aseguradoEdad').value);
    const valorAsegurado = obtenerValorMonetario(document.getElementById('aseguradoValor').value) || 0;
    const asegurado = estado.asegurados.find(item => item.id === aseguradoEditandoId);

    if (!numeroDocumento || !nombreCompleto || !CONFIG.TIPO_ASEGURADO.includes(tipoAsegurado) || !validarEdad(edad).valido) {
        mostrarToast('Completa correctamente los campos obligatorios del asegurado.', 'warning');
        return;
    }
    if (estado.asegurados.some(item => item.id !== aseguradoEditandoId && item.tipoDocumento === 'Cédula' && item.numeroDocumento === numeroDocumento)) {
        mostrarToast('Este documento ya está registrado.', 'warning');
        return;
    }

    const datos = asegurado || {
        id: generarUUID(), tipoDocumento: 'Cédula', sexo: 'Masculino', ocupacion: 'Administrativo', salario: 0,
        coberturas: generarCoberturasPorDefecto(valorAsegurado), subgrupoId: null, planId: null, primaIndividual: 0, simulado: false
    };
    datos.numeroDocumento = numeroDocumento;
    datos.nombreCompleto = nombreCompleto;
    datos.tipoAsegurado = tipoAsegurado;
    datos.edad = edad;
    const vida = datos.coberturas.find(cobertura => cobertura.codigo === 'WET');
    if (vida) vida.valorAsegurado = valorAsegurado;

    if (!asegurado) estado.asegurados.push(datos);
    recalcularTodo();
    cerrarModalAsegurado();
    mostrarToast(`Asegurado ${asegurado ? 'actualizado' : 'agregado'} correctamente.`, 'success');
}

function editarAsegurado(id) {
    const asegurado = estado.asegurados.find(a => a.id === id);
    if (asegurado) {
        agregarAsegurado(asegurado);
    }
}

function validarValoresMinimosParaCotizar() {
    const valorMinimo = 10_000_000;
    const minimoAsegurados = CONFIG.REGLAS_COMPLEJIDAD.minAsegurados;
    if (estado.asegurados.length < minimoAsegurados) {
        mostrarAlertaRango(
            `Actualmente tienes ${estado.asegurados.length} asegurado(s). Para continuar con la cotización debes contar con al menos ${minimoAsegurados} asegurados. Agrega los faltantes o carga una nueva base.`,
            null,
            'Cantidad mínima de asegurados'
        );
        return false;
    }
    const noElegibles = estado.asegurados.filter(asegurado => obtenerValorAseguradoBase(asegurado) < valorMinimo);
    if (noElegibles.length === 0) return true;

    const detalle = noElegibles.slice(0, 5)
        .map(asegurado => `${asegurado.nombreCompleto || asegurado.numeroDocumento}: ${formatearDinero(obtenerValorAseguradoBase(asegurado))}.`)
        .join(' ');
    const adicionales = noElegibles.length > 5 ? ` Hay ${noElegibles.length - 5} asegurado(s) adicional(es) con esta condición.` : '';
    mostrarAlertaRango(
        `No es posible continuar con la cotización mientras existan valores asegurados inferiores a ${formatearDinero(valorMinimo)}. Edita los siguientes registros: ${detalle}${adicionales}`,
        null,
        'Valor asegurado mínimo requerido'
    );
    return false;
}

function reemplazarBaseAsegurados(nuevosAsegurados) {
    estado.asegurados = nuevosAsegurados;
    estado.subgrupos = [];
    estado.planes = [];
    subgrupoActivoEnPlanes = null;
}

function duplicarAsegurado(id) {
    const asegurado = estado.asegurados.find(a => a.id === id);
    if (asegurado) {
        const copia = {
            ...JSON.parse(JSON.stringify(asegurado)),
            id: generarUUID()
        };
        estado.asegurados.push(copia);
        recalcularTodo();
        mostrarToast('Asegurado duplicado correctamente', 'success');
    }
}

function eliminarAsegurado(id) {
    if (confirm('¿Deseas eliminar este asegurado?')) {
        estado.asegurados = estado.asegurados.filter(a => a.id !== id);
        recalcularTodo();
        mostrarToast('Asegurado eliminado', 'success');
    }
}

function validarDocumento(tipoDoc, numeroDoc) {
    if (!numeroDoc || numeroDoc.trim().length === 0) {
        return { valido: false, mensaje: 'El documento es requerido' };
    }
    
    const existe = estado.asegurados.some(a => 
        a.numeroDocumento === numeroDoc && a.tipoDocumento === tipoDoc
    );
    
    if (existe) {
        return { valido: false, mensaje: 'Este documento ya está registrado' };
    }
    
    return { valido: true, mensaje: '' };
}

function validarEdad(edad) {
    const e = parseInt(edad);
    if (isNaN(e) || e < 18 || e > 100) {
        return { valido: false, mensaje: 'Edad debe estar entre 18 y 100 años' };
    }
    return { valido: true, mensaje: '' };
}

/* ============================================================
   SECCIÓN 5: GESTIÓN DE COBERTURAS
   ============================================================ */

function editarCobertura(codigoCobertura) {
    mostrarToast('La tasa base es definida por el sistema y no se puede modificar.', 'info');
}

async function agregarCobertura() {
    const codigo = document.getElementById('coberturaDisponible')?.value;
    const cobertura = coberturasDisponibles.find(item => item.codigo === codigo);
    if (!cobertura) {
        mostrarToast('Selecciona un amparo para agregar.', 'warning');
        return;
    }
    if (estado.coberturasCatalogo.some(item => item.codigo === codigo)) {
        mostrarToast('El amparo seleccionado ya está configurado.', 'warning');
        return;
    }

    estado.coberturasCatalogo.push({ ...cobertura, tasaBase: TASA_BASE_SISTEMA, obligatoria: false });
    
    // Agregar cobertura a todos los asegurados
    estado.asegurados.forEach(a => {
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
    
    recalcularTodo();
    mostrarToast('Amparo agregado. Consultando tasas por edad...', 'info');

    try {
        await consultarTasasCoberturas();
        recalcularTodo();
        mostrarToast('Amparo agregado y tasas por edad actualizadas.', 'success');
    } catch (error) {
        console.error('No fue posible consultar las tasas de coberturas:', error);
        mostrarToast('Amparo agregado, pero no fue posible consultar las tasas por edad.', 'warning');
    }
}

async function consultarTasasCoberturas() {
    const codigosAmparo = [...new Set(
        estado.coberturasCatalogo
            .map(cobertura => cobertura.codigoAmparo)
            .filter(codigo => codigo !== undefined && codigo !== null && codigo !== '')
            .map(codigo => String(codigo).replace(/\.0$/, ''))
    )].join(',');

    if (!codigosAmparo) {
        throw new Error('No hay códigos de amparo para consultar.');
    }

    const filas = await consultarTasasEnApi(codigosAmparo);
    const filasCoreGW = filas.filter(fila => String(fila.Core ?? '').trim().toUpperCase() === 'GW');
    if (filasCoreGW.length === 0) {
        throw new Error('La API no devolvió tasas para amparos del Core GW.');
    }

    actualizarDatosTasasDesdeFilas(filasCoreGW);

    guardarEstado();
    renderizarTablaCalculos();
    renderizarAsignacionPlanes();
    console.info('Tasas y edades máximas Core GW actualizadas:', estado.tasasPorCoberturaEdad, estado.edadesMaximasPorCobertura);
}

function actualizarDatosTasasDesdeFilas(filas) {
    const tasasPorCoberturaEdad = {};
    const porcentajesFactorPorCoberturaEdad = {};
    const edadesMaximasPorCobertura = {};

    filas.forEach(fila => {
        const codigoAmparo = String(fila.Codigo_Amparo ?? '').replace(/\.0$/, '');
        const edad = Number(fila.Edad);
        const tasa = Number(fila['Tasa -20%']);
        const porcentajeFactor = Number(fila.Porcentaje_Factor);
        const edadMaxima = Number(fila.Edad_Maxima ?? fila['Edad Maxima'] ?? fila['Edad Máxima']);
        if (codigoAmparo && Number.isFinite(edad) && Number.isFinite(tasa)) {
            tasasPorCoberturaEdad[`${codigoAmparo}-${edad}`] = tasa;
        }
        if (codigoAmparo && Number.isFinite(edad) && Number.isFinite(porcentajeFactor)) {
            porcentajesFactorPorCoberturaEdad[`${codigoAmparo}-${edad}`] = porcentajeFactor;
        }
        if (codigoAmparo && Number.isFinite(edadMaxima)) {
            edadesMaximasPorCobertura[codigoAmparo] = Math.min(edadesMaximasPorCobertura[codigoAmparo] ?? edadMaxima, edadMaxima);
        }
    });

    estado.tasasPorCoberturaEdad = tasasPorCoberturaEdad;
    estado.porcentajesFactorPorCoberturaEdad = porcentajesFactorPorCoberturaEdad;
    estado.edadesMaximasPorCobertura = edadesMaximasPorCobertura;
}

async function consultarTasasEnApi(codigosAmparo) {
    const respuesta = await fetch(API_TASAS_COBERTURAS, {
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

function eliminarCobertura(codigo) {
    if (codigo === 'WET') {
        mostrarToast('El amparo Vida debe permanecer configurado.', 'warning');
        return;
    }
    if (confirm('¿Deseas eliminar esta cobertura? Se eliminará de todos los asegurados.')) {
        estado.coberturasCatalogo = estado.coberturasCatalogo.filter(c => c.codigo !== codigo);
        
        estado.asegurados.forEach(a => {
            a.coberturas = a.coberturas.filter(c => c.codigo !== codigo);
        });
        
        recalcularTodo();
        mostrarToast('Cobertura eliminada', 'success');
    }
}

/* ============================================================
   SECCIÓN 6: CÁLCULO DE PRIMAS
   ============================================================ */

function calcularPrimaCobertura(cobertura, valorAsegurado, edad) {
    const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
    const tasaPorEdad = estado.tasasPorCoberturaEdad?.[`${codigoAmparo}-${Number(edad)}`];
    const tasa = tasaPorEdad ?? cobertura.tasa ?? cobertura.tasaBase ?? 0;
    const prima = tasaPorEdad !== undefined
        ? valorAsegurado * tasa
        : valorAsegurado * tasa * obtenerFactorEdad(edad) / 100;
    return Math.round(prima * 100) / 100;
}

function calcularPrimaIndividual(asegurado) {
    let prima = 0;
    const plan = estado.planes.find(item => item.id === asegurado.planId);
    const codigosPlan = plan ? new Set(obtenerCoberturasPlan(plan).map(cobertura => cobertura.codigo)) : null;
    asegurado.coberturas.filter(cobertura => !codigosPlan || codigosPlan.has(cobertura.codigo)).forEach(cob => {
        const coberturaCatalogo = estado.coberturasCatalogo.find(item => item.codigo === cob.codigo) || cob;
        const valorAsegurado = calcularValorAseguradoCobertura(coberturaCatalogo, asegurado);
        if (cob.activa && valorAsegurado !== null && valorAsegurado > 0) {
            prima += calcularPrimaCobertura(
                { codigoAmparo: cob.codigoAmparo, tasa: cob.tasa },
                valorAsegurado,
                asegurado.edad
            );
        }
    });
    asegurado.primaIndividual = Math.round(prima * 100) / 100;
    return asegurado.primaIndividual;
}

function calcularPrimaTotal() {
    let total = 0;
    estado.asegurados.forEach(a => {
        total += calcularPrimaIndividual(a);
    });
    return Math.round(total * 100) / 100;
}

function obtenerFactorEdad(edad) {
    const e = parseInt(edad);
    if (e < 26) return CONFIG.FACTORES_EDAD['18-25'];
    if (e < 36) return CONFIG.FACTORES_EDAD['26-35'];
    if (e < 46) return CONFIG.FACTORES_EDAD['36-45'];
    if (e < 56) return CONFIG.FACTORES_EDAD['46-55'];
    if (e < 66) return CONFIG.FACTORES_EDAD['56-65'];
    return CONFIG.FACTORES_EDAD['65+'];
}

function obtenerFactorOcupacional(ocupacion) {
    return CONFIG.FACTORES_OCUPACION[ocupacion] || 1.0;
}

/* ============================================================
   SECCIÓN 7: IDENTIFICACIÓN DE SUBGRUPOS
   ============================================================ */

function identificarSubgrupos() {
    estado.subgrupos = [];
    const subgruposMap = new Map();

    estado.asegurados.forEach(asegurado => {
        // Crear clave basada en coberturas activas
        const coberturasActivas = asegurado.coberturas
            .filter(c => c.activa)
            .map(c => c.codigo)
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
    identificarPlanes();
}

/* ============================================================
   SECCIÓN 8: IDENTIFICACIÓN DE PLANES
   ============================================================ */

function identificarPlanes() {
    estado.planes = [];
    const planesMap = new Map();

    estado.asegurados.forEach(asegurado => {
        // Crear clave: coberturas + valores asegurados
        const coberturas = asegurado.coberturas
            .filter(c => c.activa)
            .map(c => `${c.codigo}:${c.valorAsegurado}`)
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
    estado.planes.forEach(plan => {
        plan.primaTotal = plan.asegurados
            .reduce((sum, id) => {
                const asegurado = estado.asegurados.find(a => a.id === id);
                return sum + (asegurado ? calcularPrimaIndividual(asegurado) : 0);
            }, 0);
    });
}

/* ============================================================
   SECCIÓN 9: ANÁLISIS DE COMPLEJIDAD
   ============================================================ */

function analizarComplejidad() {
    const nivelComplejidad = calcularNivelComplejidad();
    const reglas = evaluarReglas();
    
    return {
        nivel: nivelComplejidad,
        reglas: reglas,
        recomendaciones: []
    };
}

function calcularNivelComplejidad() {
    const numSubgrupos = estado.subgrupos.length;
    const numPlanes = estado.planes.length;
    const planesUnicos = estado.planes.filter(p => p.asegurados.length === 1).length;
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

function evaluarReglas() {
    const reglas = [];
    const { maxSubgrupos, maxPlanesPorSubgrupo, maxPlanes } = CONFIG.REGLAS_COMPLEJIDAD;

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
    const planesUnicos = estado.planes.filter(p => p.asegurados.length === 1).length;
    if (planesUnicos > estado.planes.length * 0.3) {
        reglas.push({
            tipo: 'warning',
            mensaje: `${planesUnicos} planes con 1 solo asegurado (${Math.round(planesUnicos/estado.planes.length*100)}%)`
        });
    }

    return reglas;
}

/* ============================================================
   SECCIÓN 10: GENERACIÓN DE SUGERENCIAS
   ============================================================ */

function generarSugerencias() {
    estado.sugerencias = [];

    // 1. Valores redondeados
    const sugerenciasValores = sugerirValoresRedondeados();
    if (sugerenciasValores.length > 0) {
        estado.sugerencias.push({
            tipo: 'valores',
            titulo: 'Optimizar Valores',
            sugerencias: sugerenciasValores
        });
    }

    // 2. Agrupación
    const sugerenciasAgrupacion = sugerirAgrupacion();
    if (sugerenciasAgrupacion.length > 0) {
        estado.sugerencias.push({
            tipo: 'agrupacion',
            titulo: 'Simplificar Agrupación',
            sugerencias: sugerenciasAgrupacion
        });
    }

    // 3. Planes únicos
    const sugerenciasPlanes = detectarPlanesUnicos();
    if (sugerenciasPlanes.length > 0) {
        estado.sugerencias.push({
            tipo: 'planes',
            titulo: 'Consolidar Planes',
            sugerencias: sugerenciasPlanes
        });
    }

    // 4. Coberturas frecuentes
    const sugerenciasCoberturas = detectarCoberturasPocFrecuentes();
    if (sugerenciasCoberturas.length > 0) {
        estado.sugerencias.push({
            tipo: 'coberturas',
            titulo: 'Revisar Coberturas',
            sugerencias: sugerenciasCoberturas
        });
    }

    return estado.sugerencias;
}

function sugerirValoresRedondeados() {
    const sugerencias = [];
    const tolerance = 0.05; // 5%

    estado.asegurados.forEach((asegurado, idx) => {
        asegurado.coberturas.forEach(cob => {
            if (cob.activa && cob.valorAsegurado > 0) {
                const redondeado = Math.ceil(cob.valorAsegurado / 1000000) * 1000000;
                const diferencia = Math.abs(redondeado - cob.valorAsegurado) / cob.valorAsegurado;

                if (diferencia > tolerance && diferencia < 0.15) {
                    sugerencias.push({
                        asegurado: asegurado.nombreCompleto,
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

function sugerirAgrupacion() {
    const sugerencias = [];

    // Buscar planes con valores muy similares
    for (let i = 0; i < estado.planes.length; i++) {
        for (let j = i + 1; j < estado.planes.length; j++) {
            const p1 = estado.planes[i];
            const p2 = estado.planes[j];

            if (p1.subgrupoId === p2.subgrupoId) {
                const diferencia = Math.abs(p1.primaTotal - p2.primaTotal) / Math.max(p1.primaTotal, p2.primaTotal);

                if (diferencia < 0.1 && diferencia > 0) { // 10% de diferencia
                    sugerencias.push({
                        plan1: p1.coberturas,
                        plan2: p2.coberturas,
                        diferencia: Math.round(diferencia * 100) + '%',
                        consolidadoPrimaTotal: Math.round((p1.primaTotal + p2.primaTotal) * 100) / 100
                    });
                }
            }
        }
    }

    return sugerencias;
}

function detectarPlanesUnicos() {
    const sugerencias = [];

    estado.planes.forEach(plan => {
        if (plan.asegurados.length === 1) {
            const asegurado = estado.asegurados.find(a => a.id === plan.asegurados[0]);
            sugerencias.push({
                asegurado: asegurado.nombreCompleto,
                plan: plan.coberturas,
                prima: formatearDinero(plan.primaTotal),
                razon: 'Plan aplicable solo a 1 asegurado - Evalúa su necesidad'
            });
        }
    });

    return sugerencias;
}

function detectarCoberturasPocFrecuentes() {
    const sugerencias = [];
    const totalAsegurados = estado.asegurados.length;

    estado.coberturasCatalogo.forEach(cobertura => {
        const conCobertura = estado.asegurados.filter(a =>
            a.coberturas.find(c => c.codigo === cobertura.codigo && c.activa)
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
   SECCIÓN 11: IMPORT/EXPORT CSV
   ============================================================ */

function importarCSV(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (e) => {
        try {
            const contenido = e.target.result;
            const lineas = contenido.trim().split('\n');
            
            if (lineas.length < 2) {
                mostrarToast('Archivo vacío o inválido', 'error');
                return;
            }

            // Saltar encabezado
            const nuevosAsegurados = [];
            const documentosEnArchivo = new Set();
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
                    coberturas: generarCoberturasPorDefecto(parsearValorAsegurado(campos[6])),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0
                };

                // Validar
                const valEdad = validarEdad(asegurado.edad);
                const llaveDocumento = `${asegurado.tipoDocumento}|${asegurado.numeroDocumento}`;
                const documentoValido = asegurado.numeroDocumento && !documentosEnArchivo.has(llaveDocumento);

                if (documentoValido && valEdad.valido) {
                    nuevosAsegurados.push(asegurado);
                    documentosEnArchivo.add(llaveDocumento);
                }
            }

            if (nuevosAsegurados.length < CONFIG.REGLAS_COMPLEJIDAD.minAsegurados) {
                mostrarAlertaRango(
                    `La base contiene ${nuevosAsegurados.length} asegurado(s) válido(s). Para continuar, debes cargar al menos ${CONFIG.REGLAS_COMPLEJIDAD.minAsegurados} asegurados. No se agregaron registros.`,
                    null,
                    'Cantidad mínima de asegurados'
                );
                evento.target.value = '';
                return;
            }

            reemplazarBaseAsegurados(nuevosAsegurados);
            recalcularTodo();
            mostrarToast(`${nuevosAsegurados.length} asegurados importados correctamente. La base anterior fue reemplazada.`, 'success');
        } catch (err) {
            mostrarToast('Error al importar: ' + err.message, 'error');
        }
    };

    lector.readAsText(archivo);
}

function exportarAsegurados() {
    let csv = 'Tipo Doc,#Documento,Nombre,Edad,Sexo,Ocupación,Valor Asegurado (COP),Prima Individual\n';
    
    estado.asegurados.forEach(a => {
        const prima = a.primaIndividual || 0;
        csv += `${a.tipoDocumento},${a.numeroDocumento},${a.nombreCompleto},${a.edad},${a.sexo},${a.ocupacion},${obtenerValorAseguradoBase(a)},${prima}\n`;
    });

    descargarCSV(csv, 'asegurados.csv');
}

function exportarSubgrupos() {
    let csv = 'Subgrupo,Coberturas,Cantidad Asegurados,Planes,Prima Total\n';
    
    estado.subgrupos.forEach(sg => {
        const planes = estado.planes.filter(p => p.subgrupoId === sg.id).length;
        const primaTotal = estado.asegurados
            .filter(a => a.subgrupoId === sg.id)
            .reduce((sum, a) => sum + a.primaIndividual, 0);

        csv += `${sg.id.substring(0, 8)},${sg.coberturas},${sg.asegurados.length},${planes},${primaTotal}\n`;
    });

    descargarCSV(csv, 'subgrupos.csv');
}

function exportarPlanes() {
    let csv = 'Plan,Subgrupo,Coberturas,Cantidad Asegurados,Prima Total\n';
    
    estado.planes.forEach(p => {
        csv += `${p.id.substring(0, 8)},${p.subgrupoId.substring(0, 8)},${p.coberturas},${p.asegurados.length},${p.primaTotal}\n`;
    });

    descargarCSV(csv, 'planes.csv');
}

function generarPlantillaCSV() {
    const plantilla = `Tipo Doc,#Documento,Nombre,Edad,Sexo,Ocupación,Valor_Asegurado_COP
Cédula,1234567890,Juan García,35,Masculino,Administrativo,72000000
Cédula,0987654321,María López,28,Femenino,Ejecutivo,120000000
Cédula,1122334455,Carlos Rodríguez,42,Masculino,Operario,60000000`;

    descargarCSV(plantilla, 'plantilla_asegurados.csv');
}

function descargarCSV(contenido, nombreArchivo) {
    const elemento = document.createElement('a');
    elemento.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(contenido));
    elemento.setAttribute('download', nombreArchivo);
    elemento.style.display = 'none';
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
    mostrarToast('Descarga iniciada', 'success');
}

/* ============================================================
   SECCIÓN 12: RENDERIZACIÓN DE UI
   ============================================================ */

function renderizarTablaCoberturas() {
    const tbody = document.querySelector('.table-editable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    estado.coberturasCatalogo.forEach(cobertura => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${cobertura.codigo}</td>
            <td>${cobertura.codigoAmparo}</td>
            <td>${cobertura.nombre}</td>
            <td>${cobertura.obligatoria ? 'Sí' : 'No'}</td>
            <td>
                ${cobertura.codigo === 'WET' ? 'Amparo obligatorio' : `<button class="btn btn-small btn-danger" onclick="eliminarCobertura('${cobertura.codigo}')">Eliminar</button>`}
            </td>
        `;
        tbody.appendChild(fila);
    });

    renderizarAmparosDisponibles();
    renderizarPlanesSugeridos();
}

function renderizarPlanesSugeridos() {
    const container = document.getElementById('planesSugeridos');
    if (!container) return;

    container.innerHTML = PLANES_SUGERIDOS.map((plan, indice) => {
        const coberturas = plan.coberturas.map(buscarCoberturaPorReferencia);
        const faltantes = plan.coberturas.filter((referencia, posicion) => !coberturas[posicion]);
        const detalle = plan.coberturas
            .map((referencia, posicion) => coberturas[posicion]?.nombre || referencia)
            .join(' · ');
        return `
            <article style="border:1px solid var(--color-border,#d5dce8);border-radius:8px;padding:14px;background:#fff;">
                <strong>${plan.nombre}</strong>
                <p style="margin:8px 0;font-size:12px;line-height:1.45;color:var(--color-gray);">${detalle}</p>
                ${faltantes.length > 0
                    ? '<span style="font-size:12px;color:#a35b00;">No disponible para Core GW</span>'
                    : `<button class="btn btn-secondary btn-small" onclick="aplicarPlanSugerido(${indice + 1})">Agregar plan</button>`}
            </article>`;
    }).join('');
    renderizarResumenPlanesConfigurados();
}

function renderizarResumenPlanesConfigurados() {
    const container = document.getElementById('planesConfiguradosResumen');
    if (!container) return;

    if (estado.planes.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;margin:0;color:var(--color-gray);font-size:13px;">Aún no has agregado planes.</p>';
        return;
    }

    container.innerHTML = estado.planes.map(plan => {
        const subgrupo = estado.subgrupos.find(item => item.id === plan.subgrupoId);
        const coberturas = (subgrupo?.coberturas || [])
            .map(codigo => coberturasDisponibles.find(cobertura => cobertura.codigo === codigo)?.nombre || codigo);
        return `
            <article style="border:1px solid var(--color-border,#d5dce8);border-radius:8px;padding:14px;background:#f8fbff;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                    <strong>${plan.nombre}</strong>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                        <button class="btn btn-secondary btn-small" type="button" onclick="abrirModalEditarPlan('${plan.id}')">Editar plan</button>
                        <button class="btn btn-danger btn-small" type="button" onclick="eliminarPlan('${plan.id}')">Eliminar</button>
                    </div>
                </div>
                <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--color-gray);">${coberturas.join(' · ')}</p>
            </article>`;
    }).join('');
}

function buscarCoberturaPorReferencia(referencia) {
    const referenciaNormalizada = normalizarTexto(referencia);
    if (referenciaNormalizada === 'vida') {
        return coberturasDisponibles.find(cobertura => cobertura.codigo === 'WET');
    }
    return coberturasDisponibles.find(cobertura =>
        normalizarTexto(cobertura.amparoResumido) === referenciaNormalizada
        || (cobertura.aliasesAmparoResumido || []).some(alias => normalizarTexto(alias) === referenciaNormalizada)
        || normalizarTexto(cobertura.nombre) === referenciaNormalizada
    );
}

function aplicarPlanSugerido(sugeridoId) {
    const sugerencia = PLANES_SUGERIDOS[sugeridoId - 1];
    if (!sugerencia) return;

    const coberturas = sugerencia.coberturas.map(buscarCoberturaPorReferencia);
    if (coberturas.some(cobertura => !cobertura)) {
        mostrarToast('Una o más coberturas del plan no están disponibles en el Core GW.', 'warning');
        return;
    }

    crearPlanConCoberturas(sugerencia.nombre, coberturas);
}

function siguienteNombrePlan() {
    let numero = estado.planes.length;
    let letras = '';
    do {
        letras = String.fromCharCode(65 + (numero % 26)) + letras;
        numero = Math.floor(numero / 26) - 1;
    } while (numero >= 0);
    return `Plan ${letras}`;
}

function crearPlanConCoberturas(nombre, coberturas) {
    const vida = coberturasDisponibles.find(cobertura => cobertura.codigo === 'WET');
    if (vida && !coberturas.some(cobertura => cobertura.codigo === 'WET')) {
        coberturas = [vida, ...coberturas];
    }
    const codigos = [...new Set(coberturas.map(cobertura => cobertura.codigo))].sort();

    coberturas.forEach(cobertura => {
        if (!estado.coberturasCatalogo.some(item => item.codigo === cobertura.codigo)) {
            estado.coberturasCatalogo.push({ ...cobertura, tasaBase: TASA_BASE_SISTEMA, obligatoria: cobertura.codigo === 'WET' });
        }
    });

    const subgrupoId = generarIdSubgrupo(codigos);
    if (!estado.subgrupos.some(subgrupo => subgrupo.id === subgrupoId)) {
        estado.subgrupos.push({ id: subgrupoId, nombre: `Grupo ${estado.subgrupos.length + 1}`, coberturas: codigos, asegurados: [] });
    }

    const nombrePlan = siguienteNombrePlan();
    estado.planes.push({
        id: generarUUID(), subgrupoId, nombre: nombrePlan,
        valoresCobertura: Object.fromEntries(codigos.map(codigo => [codigo, 0])),
        asegurados: [], primaTotal: 0
    });

    guardarEstado();
    renderizarTablaCoberturas();
    renderizarPlanesSubgrupoTabs();
    mostrarToast(`${nombrePlan} creado. Define valores asegurados y asigna asegurados en Planes.`, 'success');
}

function abrirModalCrearPlan() {
    const modal = document.getElementById('modalCrearPlan');
    const nombre = document.getElementById('nombrePlanManual');
    const contenedor = document.getElementById('coberturasPlanManual');
    if (!modal || !nombre || !contenedor) return;

    planEditandoId = null;
    nombre.value = siguienteNombrePlan();
    contenedor.innerHTML = coberturasDisponibles.map(cobertura => {
        const esVida = cobertura.codigo === 'WET';
        return `<label class="cobertura-check-item${esVida ? ' obligatoria-lock' : ''}">
            <input type="checkbox" value="${cobertura.codigo}" ${esVida ? 'checked disabled' : ''}>
            <span>${cobertura.nombre}</span>
        </label>`;
    }).join('');
    modal.style.display = 'flex';
}

function cerrarModalCrearPlan() {
    const modal = document.getElementById('modalCrearPlan');
    if (modal) modal.style.display = 'none';
}

function crearPlanManual() {
    const nombre = (document.getElementById('nombrePlanManual')?.value || '').trim();
    const codigos = Array.from(document.querySelectorAll('#coberturasPlanManual input:checked'))
        .map(checkbox => checkbox.value);
    const coberturas = codigos.map(codigo => coberturasDisponibles.find(cobertura => cobertura.codigo === codigo)).filter(Boolean);
    if (!nombre) {
        mostrarToast('Ingresa el nombre del plan.', 'warning');
        return;
    }
    if (coberturas.length === 0) {
        mostrarToast('Selecciona al menos una cobertura.', 'warning');
        return;
    }
    crearPlanConCoberturas(nombre, coberturas);
    cerrarModalCrearPlan();
}

function abrirModalEditarPlan(planId) {
    const plan = estado.planes.find(item => item.id === planId);
    const modal = document.getElementById('modalEditarPlan');
    const nombre = document.getElementById('nombrePlanEdicion');
    const contenedor = document.getElementById('coberturasPlanEdicion');
    if (!plan || !modal || !nombre || !contenedor) return;

    planEditandoId = planId;
    nombre.value = plan.nombre;
    contenedor.innerHTML = coberturasDisponibles.map(cobertura => {
        const esVida = cobertura.codigo === 'WET';
        const seleccionada = esVida || estado.subgrupos
            .find(subgrupo => subgrupo.id === plan.subgrupoId)?.coberturas.includes(cobertura.codigo);
        return `<label class="cobertura-check-item${esVida ? ' obligatoria-lock' : ''}">
            <input type="checkbox" value="${cobertura.codigo}" ${seleccionada ? 'checked' : ''} ${esVida ? 'disabled' : ''}>
            <span>${cobertura.nombre}</span>
        </label>`;
    }).join('');
    modal.style.display = 'flex';
}

function cerrarModalEditarPlan() {
    const modal = document.getElementById('modalEditarPlan');
    if (modal) modal.style.display = 'none';
    planEditandoId = null;
}

function guardarEdicionPlan() {
    const plan = estado.planes.find(item => item.id === planEditandoId);
    const nombre = (document.getElementById('nombrePlanEdicion')?.value || '').trim();
    const codigos = Array.from(document.querySelectorAll('#coberturasPlanEdicion input:checked'))
        .map(checkbox => checkbox.value);
    const coberturas = codigos.map(codigo => coberturasDisponibles.find(cobertura => cobertura.codigo === codigo)).filter(Boolean);
    if (!plan || !nombre || coberturas.length === 0) {
        mostrarToast('Indica el nombre y selecciona al menos una cobertura.', 'warning');
        return;
    }

    const nuevosCodigos = [...new Set(coberturas.map(cobertura => cobertura.codigo))].sort();
    const nuevoSubgrupoId = generarIdSubgrupo(nuevosCodigos);
    if (!estado.subgrupos.some(subgrupo => subgrupo.id === nuevoSubgrupoId)) {
        estado.subgrupos.push({ id: nuevoSubgrupoId, nombre: `Grupo ${estado.subgrupos.length + 1}`, coberturas: nuevosCodigos, asegurados: [] });
    }
    coberturas.forEach(cobertura => {
        if (!estado.coberturasCatalogo.some(item => item.codigo === cobertura.codigo)) {
            estado.coberturasCatalogo.push({ ...cobertura, tasaBase: TASA_BASE_SISTEMA, obligatoria: cobertura.codigo === 'WET' });
        }
    });

    const valoresActualizados = Object.fromEntries(nuevosCodigos.map(codigo => [codigo, plan.valoresCobertura?.[codigo] || 0]));
    plan.nombre = nombre;
    plan.subgrupoId = nuevoSubgrupoId;
    plan.valoresCobertura = valoresActualizados;
    plan.asegurados.forEach(aseguradoId => {
        const asegurado = estado.asegurados.find(item => item.id === aseguradoId);
        if (!asegurado) return;
        asegurado.subgrupoId = nuevoSubgrupoId;
        asegurado.coberturas = (asegurado.coberturas || []).filter(cobertura => nuevosCodigos.includes(cobertura.codigo));
        coberturas.forEach(cobertura => {
            if (!asegurado.coberturas.some(item => item.codigo === cobertura.codigo)) {
                asegurado.coberturas.push({ codigo: cobertura.codigo, codigoAmparo: cobertura.codigoAmparo, nombre: cobertura.nombre, activa: true, valorAsegurado: 0, tasa: TASA_BASE_SISTEMA, prima: 0 });
            }
        });
    });

    recalcularPrimaPlan(plan);
    guardarEstado();
    cerrarModalEditarPlan();
    subgrupoActivoEnPlanes = nuevoSubgrupoId;
    renderizarTablaCoberturas();
    renderizarPlanesSubgrupoTabs();
    renderizarTablaCalculos();
    mostrarToast('Plan actualizado.', 'success');
}

function obtenerTasaPorEdad(cobertura, edad) {
    const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
    return estado.tasasPorCoberturaEdad?.[`${codigoAmparo}-${Number(edad)}`];
}

function obtenerPorcentajeFactorPorEdad(cobertura, edad) {
    const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
    return estado.porcentajesFactorPorCoberturaEdad?.[`${codigoAmparo}-${Number(edad)}`];
}

function calcularValorAseguradoCobertura(cobertura, asegurado) {
    const valorAseguradoVida = obtenerValorAseguradoBase(asegurado);
    const porcentajeFactor = obtenerPorcentajeFactorPorEdad(cobertura, asegurado.edad);
    return porcentajeFactor === undefined ? null : valorAseguradoVida * porcentajeFactor;
}

function formatearTasa(tasa) {
    return Number.isFinite(tasa) ? tasa.toLocaleString('es-CO', { maximumFractionDigits: 12 }) : 'Sin tasa';
}

function renderizarTablaCalculos() {
    const contenedor = document.querySelector('.calculos-container');
    if (!contenedor) return;
    const planesPorId = new Map(estado.planes.map(plan => [plan.id, plan]));

    if (estado.asegurados.length === 0) {
        contenedor.innerHTML = '<p class="calculos-vacio">No hay asegurados cargados.</p>';
        return;
    }

    const aseguradosPorPlan = new Map();
    estado.asegurados.forEach(asegurado => {
        const plan = planesPorId.get(asegurado.planId) || null;
        const llave = plan?.id || 'sin-plan';
        if (!aseguradosPorPlan.has(llave)) aseguradosPorPlan.set(llave, { plan, asegurados: [] });
        aseguradosPorPlan.get(llave).asegurados.push(asegurado);
    });

    let primaTotalPoliza = 0;
    const tarjetasPlanes = [...aseguradosPorPlan.values()].map(({ plan, asegurados }) => {
        const coberturas = plan ? obtenerCoberturasPlan(plan) : [];
        const columnas = 2 + coberturas.length * 3;
        let primaTotalPlan = 0;
        const filas = asegurados.map(asegurado => {
            const celdas = coberturas.map(cobertura => {
                const tasa = obtenerTasaPorEdad(cobertura, asegurado.edad);
                const valorAsegurado = calcularValorAseguradoCobertura(cobertura, asegurado);
                const prima = tasa === undefined || valorAsegurado === null
                    ? null
                    : calcularPrimaCobertura(cobertura, valorAsegurado, asegurado.edad);
                if (prima !== null) primaTotalPlan += prima;
                return `<td>${formatearTasa(tasa)}</td><td>${valorAsegurado === null ? '—' : formatearDinero(valorAsegurado)}</td><td>${prima === null ? '—' : formatearDinero(prima)}</td>`;
            }).join('');
            return `<tr><td>${asegurado.numeroDocumento || '—'}</td><td>${asegurado.edad ?? '—'}</td>${celdas}</tr>`;
        }).join('');

        if (plan) {
            plan.primaTotal = Math.round(primaTotalPlan * 100) / 100;
            primaTotalPoliza += plan.primaTotal;
        }
        return `<section class="calculos-plan-card">
            <header class="calculos-plan-header">
                <div><strong>${plan?.nombre || 'Sin plan asignado'}</strong><span>${plan ? `${asegurados.length} asegurado(s) · ${coberturas.map(cobertura => cobertura.codigo).join(', ')}` : 'Asigna estos asegurados a un plan para calcular sus coberturas.'}</span></div>
                <div class="calculos-plan-total"><span>Prima total del plan</span><strong>${plan ? formatearDinero(primaTotalPlan) : '—'}</strong></div>
            </header>
            ${plan ? `<div style="overflow-x:auto;"><table class="table-editable tabla-calculos"><thead><tr><th>Documento</th><th>Edad</th>${coberturas.map(cobertura => `<th>Tasa ${cobertura.codigo}</th><th>Valor aseg. ${cobertura.codigo}</th><th>Prima ${cobertura.codigo}</th>`).join('')}</tr></thead><tbody>${filas}</tbody><tfoot><tr><td colspan="${columnas - 1}"><strong>Prima total ${plan.nombre}</strong></td><td><strong>${formatearDinero(primaTotalPlan)}</strong></td></tr></tfoot></table></div>` : ''}
        </section>`;
    }).join('');

    contenedor.innerHTML = `${tarjetasPlanes}
        <section class="calculos-total-poliza">
            <span>Prima total de la póliza</span>
            <strong>${formatearDinero(primaTotalPoliza)}</strong>
        </section>`;
}

function renderizarAmparosDisponibles() {
    const selector = document.getElementById('coberturaDisponible');
    if (!selector) return;

    const codigosConfigurados = new Set(estado.coberturasCatalogo.map(cobertura => cobertura.codigo));
    const busqueda = normalizarTexto(document.getElementById('buscadorCoberturas')?.value || '');
    const disponibles = coberturasDisponibles.filter(cobertura => {
        const textoAmparo = `${cobertura.codigo} ${cobertura.codigoAmparo} ${cobertura.nombre}`;
        return !codigosConfigurados.has(cobertura.codigo) && normalizarTexto(textoAmparo).includes(busqueda);
    });
    selector.innerHTML = '<option value="">Selecciona un amparo...</option>' + disponibles
        .map(cobertura => `<option value="${cobertura.codigo}">${cobertura.nombre}</option>`)
        .join('');
    selector.disabled = disponibles.length === 0;
}

function normalizarTexto(valor) {
    return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function obtenerAmparoResumidoDefinitivo(nombre) {
    const nombreNormalizado = normalizarTexto(nombre);
    const equivalencia = Object.entries(NOMBRES_AMPARO_RESUMIDO)
        .find(([nombreAnterior]) => normalizarTexto(nombreAnterior) === nombreNormalizado);
    return equivalencia?.[1] || nombre;
}

function renderizarTablaAsegurados() {
    const tbody = document.querySelector('.table-asegurados tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    estado.asegurados.forEach(asegurado => {
        const valorAsegurado = obtenerValorAseguradoBase(asegurado);
        const valorAseguradoTexto = valorAsegurado > 0 ? formatearDinero(valorAsegurado) : '—';

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${asegurado.numeroDocumento}</td>
            <td>${asegurado.nombreCompleto}</td>
            <td>${asegurado.tipoAsegurado || '—'}</td>
            <td>${asegurado.edad}</td>
            <td>${valorAseguradoTexto}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editarAsegurado('${asegurado.id}')">Editar</button>
                <button class="btn btn-small btn-danger" onclick="eliminarAsegurado('${asegurado.id}')">Eliminar</button>
            </td>
        `;

        tbody.appendChild(fila);
    });

    if (estado.asegurados.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = '<td colspan="6" class="text-center text-muted">No hay asegurados registrados</td>';
        tbody.appendChild(fila);
    }
}

function renderizarTablaSubgrupos() {
    const tbody = document.querySelector('.table-subgrupos tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    estado.subgrupos.forEach(sg => {
        const planes = estado.planes.filter(p => p.subgrupoId === sg.id).length;
        const primaTotal = estado.asegurados
            .filter(a => a.subgrupoId === sg.id)
            .reduce((sum, a) => sum + a.primaIndividual, 0);

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${sg.id.substring(0, 8)}</td>
            <td>${sg.coberturas}</td>
            <td>${sg.asegurados.length}</td>
            <td>${planes}</td>
            <td>${formatearDinero(primaTotal)}</td>
        `;
        tbody.appendChild(fila);
    });

    if (estado.subgrupos.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = '<td colspan="5" class="text-center text-muted">No hay subgrupos</td>';
        tbody.appendChild(fila);
    }
}

function renderizarTablaPlanes() {
    const tbody = document.querySelector('.table-planes tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    estado.planes.forEach(plan => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${plan.id.substring(0, 8)}</td>
            <td>${plan.subgrupoId.substring(0, 8)}</td>
            <td>${plan.coberturas}</td>
            <td>${plan.asegurados.length}</td>
            <td>${formatearDinero(plan.primaTotal)}</td>
        `;
        tbody.appendChild(fila);
    });

    if (estado.planes.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = '<td colspan="5" class="text-center text-muted">No hay planes</td>';
        tbody.appendChild(fila);
    }
}

function renderizarDashboard() {
    const totalAsegurados = estado.asegurados.length;
    const totalSubgrupos = estado.subgrupos.length;
    const totalPlanes = estado.planes.length;

    // Prima total desde los planes (suma de primaTotal por plan)
    const primaMensual = estado.planes.reduce((s, p) => s + (p.primaTotal || 0), 0);
    const primaAnual = primaMensual * 12;

    // Complejidad
    const sinSubgrupo = estado.asegurados.filter(a => !a.subgrupoId).length;
    const sinPlan = estado.asegurados.filter(a => !a.planId).length;
    let complejidad = 'Bajo';
    if (totalSubgrupos > 4 || totalPlanes > 10) complejidad = 'Alto';
    else if (totalSubgrupos > 2 || totalPlanes > 5) complejidad = 'Medio';

    document.getElementById('totalAsegurados').textContent = totalAsegurados;
    document.getElementById('totalSubgrupos').textContent = totalSubgrupos;
    document.getElementById('totalPlanes').textContent = totalPlanes;
    document.getElementById('nivelComplejidad').textContent = complejidad;
    document.getElementById('primaMensual').textContent = formatearDinero(primaMensual);
    document.getElementById('primaAnual').textContent = formatearDinero(primaAnual);

    // Métricas y póliza en el resumen
    const infoPoliza = document.getElementById('infoPolizaResumen');
    if (infoPoliza) {
        const p = estado.poliza;
        infoPoliza.innerHTML = `
            <p><strong>Tomador:</strong> ${p.tomador || '—'}</p>
            <p><strong>Identificación:</strong> ${p.tipoIdentificacion} ${p.numeroIdentificacion || '—'}</p>
            <p><strong>Modalidad del plan:</strong> ${p.modalidadPlan || '—'}</p>
            <p><strong>Vigencia:</strong> ${p.vigenciaDesde || '—'} → ${p.vigenciaHasta || '—'}</p>
            <p><strong>Asesor:</strong> ${p.asesor || '—'}</p>
            <p><strong>Canal:</strong> ${p.canalComercial || '—'}</p>
            <p><strong>Comisión:</strong> ${p.comision || 0}%${p.canalComercial === 'Promotora' ? ` | Honorario Promotora: ${p.honorarioPromotora || 0}%` : ''}</p>
            <p><strong>Siniestralidad:</strong> ${formatearDinero(p.valorSiniestrosTotales || 0)} en ${p.anosExposicion || 0} año(s) de exposición | Promedio: ${formatearDinero(p.siniestrosPromedio || 0)}</p>
        `;
    }

    const metrics = document.getElementById('metricsResumen');
    if (metrics) {
        const sinAsig = sinSubgrupo > 0 ? `<p style="color:var(--color-danger);">&#9888; ${sinSubgrupo} asegurado(s) sin subgrupo</p>` : '';
        const sinPlanTxt = sinPlan > 0 ? `<p style="color:var(--color-warning);">&#9888; ${sinPlan} asegurado(s) sin plan</p>` : '';
        metrics.innerHTML = `
            <p><strong>Subgrupos:</strong> ${totalSubgrupos}</p>
            <p><strong>Planes:</strong> ${totalPlanes}</p>
            <p><strong>Prima mensual:</strong> ${formatearDinero(primaMensual)}</p>
            <p><strong>Prima anual:</strong> ${formatearDinero(primaAnual)}</p>
            <p><strong>Complejidad:</strong> ${complejidad}</p>
            ${sinAsig}${sinPlanTxt}
        `;
    }
}

function renderizarSugerencias() {
    const panel = document.getElementById('sugerenciasPanel');
    if (!panel) return;

    generarSugerencias();

    if (estado.sugerencias.length === 0) {
        panel.innerHTML = '<p class="text-center text-muted">No hay sugerencias en este momento</p>';
        return;
    }

    let html = '';
    estado.sugerencias.forEach(grupo => {
        html += `<div class="sugerencia-item">
            <div class="sugerencia-titulo">${grupo.titulo}</div>`;

        if (grupo.sugerencias && grupo.sugerencias.length > 0) {
            html += '<ul style="padding-left: 20px;">';
            grupo.sugerencias.forEach(sug => {
                if (typeof sug === 'string') {
                    html += `<li>${sug}</li>`;
                } else {
                    html += `<li>${JSON.stringify(sug).substring(0, 80)}...</li>`;
                }
            });
            html += '</ul>';
        }

        html += '</div>';
    });

    panel.innerHTML = html;
}

/* ============================================================
   SECCIÓN 13: EVENT LISTENERS
   ============================================================ */

function actualizarCamposComerciales() {
    const canal = document.getElementById('canalComercial');
    const contenedorComisiones = document.querySelector('.comisiones-grid');
    const grupoPromotora = document.getElementById('grupoHonorarioPromotora');
    const honorarioPromotora = document.getElementById('honorarioPromotora');
    const esPromotora = canal?.value === 'Promotora';

    if (grupoPromotora) grupoPromotora.hidden = !esPromotora;
    contenedorComisiones?.classList.toggle('solo-comision', !esPromotora);
    if (honorarioPromotora) {
        honorarioPromotora.disabled = !esPromotora;
        if (!esPromotora) honorarioPromotora.value = '0';
    }

    estado.poliza.canalComercial = esPromotora ? 'Promotora' : 'Sucursal';
    if (!esPromotora) estado.poliza.honorarioPromotora = 0;
    guardarEstado();
}

function setupEventListeners() {
    // Navegación de pasos
    document.querySelectorAll('.step').forEach((step, index) => {
        step.addEventListener('click', () => irAlPaso(index + 1));
    });

    // Botones de acción generales
    // Navegación por botones de siguiente en cada paso
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`btnSiguiente${i}`)?.addEventListener('click', () => {
            if (i === 2 && !validarValoresMinimosParaCotizar()) return;
            irAlPaso(i + 1);
        });
    }
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`btnAtras${i}`)?.addEventListener('click', () => irAlPaso(i));
    }

    // Paso 1: Póliza - campos actualizados
    const camposPoliza = [
        'tomador', 'tipoIdentificacion', 'numeroIdentificacion', 'modalidadPlan',
        'actividad', 'vigenciaDesde', 'vigenciaHasta', 'oficina',
        'formaPago', 'fechaCobro', 'asesor', 'canalComercial', 'observaciones'
    ];
    camposPoliza.forEach(campo => {
        document.getElementById(campo)?.addEventListener('change', (e) => {
            estado.poliza[campo] = e.target.value;
            guardarEstado();
        });
    });
    document.getElementById('canalComercial')?.addEventListener('change', actualizarCamposComerciales);
    ['comision', 'honorarioPromotora'].forEach(campo => {
        document.getElementById(campo)?.addEventListener('change', (e) => {
            const maximo = campo === 'comision' ? 30 : 10;
            const valor = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), maximo);
            if (valor !== parseFloat(e.target.value)) {
                e.target.value = valor;
                mostrarToast(`${campo === 'comision' ? 'La comisión' : 'El honorario de promotora'} no puede superar el ${maximo}%.`, 'warning');
            }
            estado.poliza[campo] = valor;
            guardarEstado();
        });
    });
    actualizarCamposComerciales();
    document.getElementById('valorSiniestrosTotales')?.addEventListener('input', actualizarSiniestralidad);
    document.getElementById('anosExposicion')?.addEventListener('input', actualizarSiniestralidad);

    // Paso 3: Coberturas
    document.getElementById('btnAgregarCobertura')?.addEventListener('click', agregarCobertura);
    document.getElementById('buscadorCoberturas')?.addEventListener('input', renderizarAmparosDisponibles);
    document.getElementById('btnDescargarCSV')?.addEventListener('click', generarPlantillaCSV);

    // Paso 2: Asegurados
    document.getElementById('buscadorAsegurado')?.addEventListener('input', (e) => {
        const valor = e.target.value.toLowerCase();
        const filas = document.querySelectorAll('.table-asegurados tbody tr');
        filas.forEach(fila => {
            const texto = fila.textContent.toLowerCase();
            fila.style.display = texto.includes(valor) ? '' : 'none';
        });
    });

    document.getElementById('btnAgregarAsegurado')?.addEventListener('click', () => agregarAsegurado());
    document.getElementById('aseguradoValor')?.addEventListener('input', (evento) => formatearCampoMoneda(evento.target));
    document.getElementById('btnCargarDemo')?.addEventListener('click', cargarDemoData);
    document.getElementById('btnImportarCSV')?.addEventListener('click', () => {
        document.getElementById('fileCSV')?.click();
    });
    document.getElementById('fileCSV')?.addEventListener('change', importarCSV);
    document.getElementById('btnExportarAsegurados')?.addEventListener('click', exportarAsegurados);
    document.getElementById('btnExportarAseguradosAlt')?.addEventListener('click', exportarAsegurados);
    document.getElementById('btnExportarAseguradosFinal')?.addEventListener('click', exportarAsegurados);
    document.getElementById('btnExportarCSVSubgrupos')?.addEventListener('click', exportarSubgrupos);
    document.getElementById('btnExportarCSVPlanes')?.addEventListener('click', exportarPlanes);
    document.getElementById('btnExportarJSONResumen')?.addEventListener('click', exportarResumen);
    document.getElementById('btnLimpiarTodo')?.addEventListener('click', limpiarEstado);

    // Renovación: buscar con Enter en número de documento
    document.getElementById('numDocBusqueda')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') buscarPolizasRenovacion();
    });
}

/* ============================================================
   SECCIÓN 14: INICIALIZACIÓN
   ============================================================ */

/* ============================================================
   SECCIÓN 15: FLUJO DE NEGOCIO Y PANTALLAS INICIALES
   ============================================================ */

/* ---- Navegación entre pantallas ---- */

function mostrarSoloPantalla(idPantalla) {
    const pantallas = [
        'pantalla-landing',
        'pantalla-tipo-nuevo',
        'pantalla-renovacion',
        'mainContainer'
    ];
    pantallas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === idPantalla ? (id === 'mainContainer' ? 'block' : 'flex') : 'none';
    });
}

function seleccionarTipoNegocio(tipo) {
    flujo.tipo = tipo;
    flujo.subtipo = null;
    flujo.polizaSeleccionada = null;

    if (tipo === 'nuevo') {
        mostrarSoloPantalla('pantalla-tipo-nuevo');
    } else {
        mostrarSoloPantalla('pantalla-renovacion');
        document.getElementById('tipoDocBusqueda').value = '';
        document.getElementById('numDocBusqueda').value = '';
        document.getElementById('resultadosBusqueda').style.display = 'none';
        document.getElementById('loadingBusqueda').style.display = 'none';
        document.getElementById('errorBusqueda').style.display = 'none';
    }
}

function seleccionarSubtipo(subtipo) {
    flujo.subtipo = subtipo;
    // Reiniciar datos cada vez que se inicia un flujo nuevo desde cero
    estado.asegurados = [];
    estado.subgrupos  = [];
    estado.planes     = [];
    estado.coberturasCatalogo = crearCatalogoInicial();
    estado.poliza = {
        id: generarUUID(),
        tomador: '', tipoIdentificacion: 'NIT', numeroIdentificacion: '',
        modalidadPlan: 'Voluntaria (Contributiva)', actividad: '', vigenciaDesde: '', vigenciaHasta: '',
        oficina: '', formaPago: 'Mensual', fechaCobro: '',
        comision: 20, honorarioPromotora: 10,
        valorSiniestrosTotales: 0, anosExposicion: 0, siniestrosPromedio: 0,
        asesor: '', canalComercial: '', observaciones: ''
    };
    mostrarWizard();
}

function volverAlLanding() {
    mostrarSoloPantalla('pantalla-landing');
    flujo.tipo = null;
    flujo.subtipo = null;
    flujo.polizaSeleccionada = null;
}

function mostrarWizard() {
    mostrarSoloPantalla('mainContainer');
    actualizarBadgeFlujo();
    // Mostrar / ocultar paneles de modo en paso 2 (asegurados)
    // Para renovación, no se muestran paneles de carga ya que los datos vienen del sistema
    const panelSim   = document.getElementById('panelSimulacion');
    const panelExcel = document.getElementById('panelExcel');
    const esNuevo = flujo.tipo === 'nuevo';
    if (panelSim)   panelSim.style.display   = (esNuevo && flujo.subtipo === 'simulacion') ? 'block' : 'none';
    if (panelExcel) panelExcel.style.display  = (esNuevo && flujo.subtipo === 'cotizacion') ? 'block' : 'none';
    renderizarGruposSalariales();
    renderizarTablaCoberturas();
    irAlPaso(1);
}

function actualizarBadgeFlujo() {
    const badge = document.getElementById('badgeFlujo');
    if (!badge) return;
    const labels = {
        'nuevo-simulacion': 'Seguro Nuevo &mdash; Simulación',
        'nuevo-cotizacion': 'Seguro Nuevo &mdash; Cotización con datos reales',
        'renovacion':       'Modificación / Renovación'
    };
    const key = flujo.tipo === 'renovacion' ? 'renovacion' : `${flujo.tipo}-${flujo.subtipo}`;
    badge.innerHTML = `<strong>Flujo:</strong> ${labels[key] || ''}`;
    badge.style.display = key ? 'inline-flex' : 'none';
}

async function cargarCatalogoCoberturas() {
    try {
        const respuesta = await fetch('CoberturasVG.json');
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const amparos = await respuesta.json();
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
        const filasApi = await consultarTasasEnApi(codigosAmparo);
        const filasCoreGW = filasApi.filter(fila => String(fila.Core ?? '').trim().toUpperCase() === 'GW');
        actualizarDatosTasasDesdeFilas(filasCoreGW);
        const resumenesCoreGW = new Map();
        filasCoreGW.forEach(fila => {
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
                        .filter(([, nombreNuevo]) => normalizarTexto(nombreNuevo) === normalizarTexto(amparoResumido))
                        .map(([nombreAnterior]) => nombreAnterior)
                };
            });

        // Un mismo amparo puede llegar con más de un código del Core GW. Para crear
        // planes solo se muestra una vez, usando el nuevo nombre definitivo como llave.
        const coberturaApiPorNombre = new Map(
            coberturasCoreGW.map(cobertura => [normalizarTexto(cobertura.amparoResumido || cobertura.nombre), cobertura])
        );
        const coberturaLocalPorCodigo = new Map(
            catalogoCompleto.map(cobertura => [cobertura.codigo, cobertura])
        );
        coberturasDisponibles = AMPAROS_RESUMIDOS_DEFINITIVOS.map(({ nombre, codigo }) => {
            const coberturaApi = coberturaApiPorNombre.get(normalizarTexto(nombre));
            const coberturaLocal = coberturaLocalPorCodigo.get(codigo);
            const cobertura = coberturaLocal || coberturaApi;

            if (!cobertura) return null;
            return {
                ...cobertura,
                nombre,
                amparoResumido: nombre,
                aliasesAmparoResumido: Object.entries(NOMBRES_AMPARO_RESUMIDO)
                    .filter(([, nombreDefinitivo]) => normalizarTexto(nombreDefinitivo) === normalizarTexto(nombre))
                    .map(([nombreAnterior]) => nombreAnterior)
            };
        }).filter(Boolean);

        if (coberturasDisponibles.length === 0) {
            throw new Error('La API no devolvió amparos pertenecientes al Core GW.');
        }

        if (estado.asegurados.length === 0) {
            estado.coberturasCatalogo = crearCatalogoInicial();
        } else {
            sincronizarVidaObligatoria();
        }
        sincronizarNombresVisiblesCoberturas();
        renderizarTablaCoberturas();
        renderizarAsignacionPlanes();
        guardarEstado();
        console.info(`Catálogo Core GW cargado: ${coberturasDisponibles.length} amparos.`);
    } catch (error) {
        console.warn('No se pudo cargar CoberturasVG.json:', error);
        coberturasDisponibles = [];
        if (estado.asegurados.length === 0) estado.coberturasCatalogo = [];
        renderizarTablaCoberturas();
        mostrarToast('No fue posible cargar los amparos del Core GW.', 'warning');
    }
}

/* ---- Mock API de renovación ---- */

async function buscarPolizasRenovacion() {
    const tipoDoc = document.getElementById('tipoDocBusqueda').value;
    const numDoc = (document.getElementById('numDocBusqueda').value || '').trim();
    const errorDiv = document.getElementById('errorBusqueda');
    const textoError = document.getElementById('textoError');

    console.log('🔍 Iniciando búsqueda de pólizas');

    // Validar campos
    if (!tipoDoc) {
        console.warn('⚠️ Tipo de documento no seleccionado');
        mostrarToast('Selecciona el tipo de documento', 'warning');
        return;
    }
    if (!numDoc) {
        console.warn('⚠️ Número de documento vacío');
        mostrarToast('Ingresa el número de documento', 'warning');
        return;
    }

    // Limpiar errores previos
    errorDiv.style.display = 'none';

    // Concatenar tipo + número (ej: C1020455161)
    const personaId = tipoDoc + numDoc;
    console.log('📋 Documento:', personaId);

    const loading = document.getElementById('loadingBusqueda');
    const resultados = document.getElementById('resultadosBusqueda');
    loading.style.display = 'block';
    resultados.style.display = 'none';

    try {
        // Llamar a la API
        console.log('📡 Consultando pólizas...');
        const htmlResponse = await consultarAPISura(personaId);

        // Procesar el HTML para extraer tabla de pólizas
        console.log('📊 Extrayendo datos de pólizas...');
        const polizas = extraerPolizasDelHTML(htmlResponse, personaId);
        console.log(`✅ ${polizas.length} póliza(s) encontrada(s)`, polizas);

        if (polizas.length === 0) {
            console.warn('❌ No hay pólizas para este documento');
            textoError.textContent = `No se encontraron pólizas para el documento ${personaId}`;
            errorDiv.style.display = 'block';
            loading.style.display = 'none';
            return;
        }

        // Guardar en localStorage
        try {
            const datosGuardar = {
                documento: personaId,
                fecha: new Date().toISOString(),
                polizas: polizas
            };
            localStorage.setItem('polizas_' + personaId, JSON.stringify(datosGuardar));
            console.log('💾 Datos guardados en localStorage:', datosGuardar);
        } catch (e) {
            console.warn('⚠️ No se pudo guardar en localStorage:', e);
        }

        loading.style.display = 'none';
        renderizarPolizasRenovacion(polizas, personaId);

    } catch (error) {
        console.error('❌ Error en búsqueda de pólizas:', error);
        textoError.textContent = `Error al consultar pólizas: ${error.message}`;
        errorDiv.style.display = 'block';
        loading.style.display = 'none';
    }
}

/**
 * Consulta pólizas del documento desde backend local
 * El backend hace servidor-a-servidor sin problemas CORS
 * @param {string} personaId - Documento concatenado (ej: C1020455161)
 * @returns {string} - HTML con pólizas
 */
async function consultarAPISura(personaId) {
    console.log('🔗 Consultando backend local (localhost:3001) para documento:', personaId);
    
    try {
        const response = await fetch('http://localhost:3001/api/buscar-polizas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ persona: personaId })
        });
        
        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Respuesta recibida del backend (', data.html.length, 'caracteres)');
        
        return data.html;
        
    } catch (error) {
        console.warn('❌ No se pudo conectar al backend:', error.message);
        console.log('📦 Usando datos mock como fallback...');
        
        // Fallback a mock si falla
        return generarHTMLMockPolizas(personaId);
    }
}

/**
 * Genera datos mock que simulan la respuesta de la API
 * En producción, esto vendría del backend que consume la API real
 */
function generarHTMLMockPolizas(personaId) {
    console.log('📝 Generando datos mock para:', personaId);
    // Simulación de datos reales de la API
    const polizasMock = [
        {
            ramo: '083',
            subramo: '101',
            producto: 'PLAN VIDA INTEGRAL CONTRIBUTIVO BANCOLOMBIA',
            poliza: '5073085',
            vigenciaDesde: '2024/10/11',
            vigenciaHasta: '2024/11/01',
            fechaCancelacion: '2024/11/01',
            riesgo: personaId,
            tipoVinculacion: 'ASEGURADO',
            numeroRiesgo: '164934'
        },
        {
            ramo: '083',
            subramo: '025',
            producto: 'PLAN VIDA CLÁSICO NO CONTRIBUTIVO',
            poliza: '4575091',
            vigenciaDesde: '2025/11/10',
            vigenciaHasta: '2026/11/10',
            fechaCancelacion: '--',
            riesgo: personaId,
            tipoVinculacion: 'ASEGURADO',
            numeroRiesgo: '619'
        },
        {
            ramo: '028',
            subramo: 'H20',
            producto: 'SEGURO DE HOGAR MENSUAL MULTIPLAN',
            poliza: '8356168',
            vigenciaDesde: '2026/02/01',
            vigenciaHasta: '2027/02/01',
            fechaCancelacion: '--',
            riesgo: 'CL056**A*046****0072******',
            tipoVinculacion: 'ASEGURADO',
            numeroRiesgo: '2855'
        },
        {
            ramo: '091',
            subramo: '074',
            producto: 'PLAN SALUD CLÁSICO COLECTIVO',
            poliza: '809326',
            vigenciaDesde: '2026/02/01',
            vigenciaHasta: '2027/02/01',
            fechaCancelacion: '--',
            riesgo: personaId,
            tipoVinculacion: 'ASEGURADO',
            numeroRiesgo: '332'
        }
    ];

    // Retornar estructura JSON que luego parseamos
    const respuesta = JSON.stringify({
        persona: personaId,
        nombre: 'ARROYAVE*ANAYA**FREDY ANDRES',
        polizas: polizasMock
    });
    console.log('📄 JSON Mock generado:', respuesta);
    return respuesta;
}

/**
 * Extrae pólizas del HTML retornado por la API
 * @param {string} htmlResponse - HTML o JSON con información de pólizas
 * @param {string} personaId - Documento consultado
 * @returns {Array} - Array de objetos con información de pólizas
 */
function extraerPolizasDelHTML(htmlResponse, personaId) {
    console.log('🔄 Iniciando extracción de pólizas');
    try {
        // Intentar parsear como JSON primero (formato mock)
        const datos = JSON.parse(htmlResponse);
        console.log('✅ JSON parseado correctamente');
        if (datos.polizas && Array.isArray(datos.polizas)) {
            console.log(`📌 Encontradas ${datos.polizas.length} pólizas en JSON`);
            return datos.polizas.map(p => ({
                numero: p.poliza,
                tomador: personaId,
                vigenciaIni: p.vigenciaDesde,
                vigenciaFin: p.vigenciaHasta,
                asegurados: 1,
                producto: p.producto,
                ramo: p.ramo,
                subramo: p.subramo,
                tipoVinculacion: p.tipoVinculacion,
                numeroRiesgo: p.numeroRiesgo,
                estado: esPoliciaVigente(p.vigenciaHasta) ? 'Vigente' : 'Vencida'
            }));
        }
    } catch (e) {
        // Si no es JSON, intentar parsear como HTML
        console.log('Parseando como HTML...');
    }

    // Si es HTML, parsear tablas
    const polizas = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlResponse, 'text/html');
        
        // Buscar la tabla principal de pólizas
        const rows = doc.querySelectorAll('table tr');
        let enTablaPolizas = false;

        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            
            // Detectar encabezado de tabla de pólizas
            if (row.textContent.includes('Ramo') && row.textContent.includes('Subramo')) {
                enTablaPolizas = true;
                return;
            }

            // Procesar filas de datos (saltar encabezados)
            if (enTablaPolizas && cells.length >= 8) {
                const ramo = cells[0]?.textContent?.trim() || '';
                const subramo = cells[1]?.textContent?.trim() || '';
                const producto = cells[2]?.textContent?.trim() || '';
                const poliza = cells[3]?.textContent?.trim() || '';
                const vigDesde = cells[4]?.textContent?.trim() || '';
                const vigHasta = cells[5]?.textContent?.trim() || '';

                if (poliza && poliza !== 'Póliza' && ramo) {
                    polizas.push({
                        numero: poliza,
                        tomador: personaId,
                        vigenciaIni: vigDesde,
                        vigenciaFin: vigHasta,
                        asegurados: 1,
                        producto: producto,
                        ramo: ramo,
                        subramo: subramo,
                        estado: esPoliciaVigente(vigHasta) ? 'Vigente' : 'Vencida'
                    });
                }
            }
        });
    } catch (e) {
        console.error('❌ Error parseando HTML:', e);
    }

    console.log(`📊 Total de pólizas extraídas: ${polizas.length}`);
    console.table(polizas);
    return polizas;
}

/**
 * Determina si una póliza está vigente
 */
function esPoliciaVigente(fechaHasta) {
    try {
        const fecha = new Date(fechaHasta.replace(/\//g, '-'));
        return fecha > new Date();
    } catch {
        return false;
    }
}

function renderizarPolizasRenovacion(polizas, personaId) {
    const resultados = document.getElementById('resultadosBusqueda');
    const titulo = document.getElementById('tituloResultados');
    const lista = document.getElementById('listaPolizas');

    titulo.textContent = `${polizas.length} póliza(s) encontrada(s) para "${personaId}"`;
    lista.innerHTML = '';

    // Crear tabla con información relevante
    const tabla = document.createElement('table');
    tabla.className = 'tabla-polizas-resultados';
    tabla.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        background: white;
    `;

    // Encabezado
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="background: #004080; color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Ramo</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Producto</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Nº Póliza</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Vigencia Desde</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Vigencia Hasta</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Estado</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Acción</th>
        </tr>
    `;
    tabla.appendChild(thead);

    // Cuerpo
    const tbody = document.createElement('tbody');
    polizas.forEach((p, idx) => {
        const badgeClase = p.estado === 'Vigente' ? 'background: #4CAF50; color: white;' : 'background: #f44336; color: white;';
        const row = document.createElement('tr');
        row.style.cssText = `border-bottom: 1px solid #ddd; ${idx % 2 === 0 ? 'background: #f9f9f9;' : ''}`;
        row.innerHTML = `
            <td style="padding: 12px; border: 1px solid #ddd;">${p.ramo || '--'}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">
                <div style="font-weight: 600; font-size: 13px;">${p.producto || '--'}</div>
                <div style="font-size: 11px; color: #666;">Vinculación: ${p.tipoVinculacion || '--'}</div>
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600;">${p.numero || '--'}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${p.vigenciaIni || '--'}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${p.vigenciaFin || '--'}</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; ${badgeClase}">
                    ${p.estado}
                </span>
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
                <button class="btn btn-primary" onclick="seleccionarPolizaRenovacion(${JSON.stringify(p).replace(/"/g, '&quot;')})" 
                    style="padding: 6px 12px; font-size: 12px;">
                    Seleccionar
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    tabla.appendChild(tbody);
    lista.appendChild(tabla);

    resultados.style.display = 'block';
}

function seleccionarPolizaRenovacion(poliza) {
    flujo.polizaSeleccionada = poliza;
    flujo.subtipo = 'cotizacion'; // renovación usa cotización con datos

    /* ---- Pre-llenar datos de la póliza con información mock realista ---- */
    const empresas = [
        'Industrias Andinas S.A.S.', 'Comercializadora del Pacífico Ltda.',
        'Servicios Técnicos Integrados S.A.', 'Grupo Empresarial Nacional S.A.S.',
        'Distribuidora Continental Ltda.', 'Inversiones y Proyectos S.A.'
    ];
    const actividades = [
        'Manufactura Industrial', 'Comercio al por Mayor', 'Servicios Financieros',
        'Construcción e Infraestructura', 'Tecnología y Software', 'Salud y Farmacia'
    ];
    const oficinas = ['Medellín Centro', 'Bogotá Norte', 'Cali Principal', 'Barranquilla', 'Bucaramanga'];
    const asesores = ['Juan Pérez Restrepo', 'María García López', 'Carlos Martínez Ruiz', 'Ana Rodríguez Cruz'];
    const formasPago = ['Mensual', 'Trimestral', 'Semestral', 'Anual'];
    const canales = CONFIG.CANAL_COMERCIAL;

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Fechas: la renovación extiende 1 año desde el fin de la póliza anterior
    const vigNuevaDesde = poliza.vigenciaFin;
    const vigNuevaHasta = new Date(poliza.vigenciaFin);
    vigNuevaHasta.setFullYear(vigNuevaHasta.getFullYear() + 1);
    const fechaCobroDate = new Date(poliza.vigenciaFin);
    fechaCobroDate.setDate(1);

    estado.poliza.tomador             = rand(empresas);
    estado.poliza.tipoIdentificacion  = 'NIT';
    estado.poliza.numeroIdentificacion = poliza.tomador;
    estado.poliza.modalidadPlan       = 'Voluntaria (Contributiva)';
    estado.poliza.actividad           = rand(actividades);
    estado.poliza.vigenciaDesde       = vigNuevaDesde;
    estado.poliza.vigenciaHasta       = vigNuevaHasta.toISOString().split('T')[0];
    estado.poliza.oficina             = rand(oficinas);
    estado.poliza.formaPago           = rand(formasPago);
    estado.poliza.fechaCobro          = fechaCobroDate.toISOString().split('T')[0];
    estado.poliza.comision            = 20;
    estado.poliza.honorarioPromotora  = 10;
    estado.poliza.asesor              = rand(asesores);
    estado.poliza.canalComercial      = rand(canales);

    /* ---- Generar asegurados aleatorios (cantidad igual a la póliza seleccionada) ---- */
    const cantidad = poliza.asegurados || (50 + Math.floor(Math.random() * 151));
    const smmlv = 1_300_000;
    const salariosBases = [1.5 * smmlv, 2.5 * smmlv, 4 * smmlv, 7 * smmlv, 12 * smmlv];
    const nombresM = ['Carlos', 'Juan', 'Andrés', 'Santiago', 'Luis', 'Miguel', 'David', 'Daniel', 'Jorge', 'Sergio'];
    const nombresF = ['María', 'Ana', 'Laura', 'Claudia', 'Paola', 'Sandra', 'Adriana', 'Diana', 'Patricia', 'Gloria'];
    const apellidos = ['García', 'López', 'Martínez', 'Rodríguez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Vargas'];

    estado.asegurados = [];
    for (let i = 1; i <= cantidad; i++) {
        const esMasculino = Math.random() > 0.45;
        const nombre = esMasculino ? rand(nombresM) : rand(nombresF);
        const apellido = rand(apellidos) + ' ' + rand(apellidos);
        const salarioMensual = rand(salariosBases) + (Math.random() - 0.5) * smmlv;
        const edad = 25 + Math.floor(Math.random() * 31); // 25-55

        estado.asegurados.push({
            id: generarUUID(),
            tipoDocumento: 'Cédula',
            numeroDocumento: String(10_000_000 + Math.floor(Math.random() * 90_000_000)),
            nombreCompleto: `${nombre} ${apellido}`,
            edad,
            sexo: esMasculino ? 'Masculino' : 'Femenino',
            ocupacion: salarioAOcupacion(salarioMensual),
            salario: Math.round(salarioMensual),
            coberturas: generarCoberturasPorDefecto(0),
            subgrupoId: null,
            planId: null,
            primaIndividual: 0,
            simulado: true
        });
    }

    mostrarWizard();
    mostrarToast(`Póliza ${poliza.numero} cargada · ${cantidad} asegurados generados`, 'success');

    // Poblar todos los campos del formulario DOM
    setTimeout(() => {
        const campos = {
            tomador:              estado.poliza.tomador,
            tipoIdentificacion:   estado.poliza.tipoIdentificacion,
            numeroIdentificacion: estado.poliza.numeroIdentificacion,
            modalidadPlan:         estado.poliza.modalidadPlan,
            actividad:            estado.poliza.actividad,
            vigenciaDesde:        estado.poliza.vigenciaDesde,
            vigenciaHasta:        estado.poliza.vigenciaHasta,
            oficina:              estado.poliza.oficina,
            formaPago:            estado.poliza.formaPago,
            fechaCobro:           estado.poliza.fechaCobro,
            comision:             estado.poliza.comision,
            honorarioPromotora:   estado.poliza.honorarioPromotora,
            asesor:               estado.poliza.asesor,
            canalComercial:       estado.poliza.canalComercial
        };
        for (const [id, valor] of Object.entries(campos)) {
            const el = document.getElementById(id);
            if (el) el.value = valor;
        }
        actualizarCamposComerciales();
    }, 150);
}

/* ---- Simulación de asegurados ---- */

function renderizarGruposSalariales() {
    const tbody = document.getElementById('tbody-grupos-salariales');
    if (!tbody) return;

    tbody.innerHTML = '';
    gruposSalariales.forEach((grupo, i) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><input type="text" value="${grupo.rango}" oninput="gruposSalariales[${i}].rango = this.value"></td>
            <td><input type="number" value="${grupo.porcentaje}" min="1" max="100" oninput="gruposSalariales[${i}].porcentaje = parseFloat(this.value)||0; validarGrupos()"></td>
            <td><input type="number" value="${grupo.salarioRef}" min="0.1" step="0.1" oninput="gruposSalariales[${i}].salarioRef = parseFloat(this.value)||0"></td>
            <td><button class="btn btn-small btn-danger" onclick="eliminarGrupoSalarial(${i})">✕</button></td>
        `;
        tbody.appendChild(fila);
    });
    validarGrupos();
}

function agregarGrupoSalarial() {
    gruposSalariales.push({ rango: 'Nuevo rango', porcentaje: 0, salarioRef: 3 });
    renderizarGruposSalariales();
}

function eliminarGrupoSalarial(index) {
    if (gruposSalariales.length <= 1) {
        mostrarToast('Debe haber al menos un grupo salarial', 'warning');
        return;
    }
    gruposSalariales.splice(index, 1);
    renderizarGruposSalariales();
}

function validarGrupos() {
    const total = gruposSalariales.reduce((s, g) => s + (parseFloat(g.porcentaje) || 0), 0);
    const div = document.getElementById('simValidacion');
    if (!div) return true;
    if (Math.abs(total - 100) < 0.01) {
        div.textContent = '✓ Total: 100%';
        div.className = 'sim-validacion ok';
        return true;
    } else {
        div.textContent = `⚠ Los porcentajes suman ${total.toFixed(1)}% (deben sumar 100%)`;
        div.className = 'sim-validacion error';
        return false;
    }
}

function generarSimulacion() {
    if (!validarGrupos()) {
        mostrarToast('Los grupos salariales deben sumar exactamente 100%', 'error');
        return;
    }

    const cantidadInput  = parseInt(document.getElementById('simCantidad')?.value) || 100;
    const edadPromedio   = parseInt(document.getElementById('simEdadPromedio')?.value) || 35;

    if (cantidadInput < 1 || cantidadInput > 5000) {
        mostrarToast('El número de asegurados debe estar entre 1 y 5000', 'error');
        return;
    }

    if (edadPromedio < 18 || edadPromedio > 70) {
        mostrarToast('La edad promedio debe estar entre 18 y 70', 'error');
        return;
    }

    // Limpiar asegurados simulados previos (los que tienen flag simulado)
    estado.asegurados = estado.asegurados.filter(a => !a.simulado);

    const nuevos = [];
    let contador = 1;

    gruposSalariales.forEach(grupo => {
        const n = Math.round((grupo.porcentaje / 100) * cantidadInput);
        const salarioMensual = grupo.salarioRef * 1_000_000;
        const ocupacion = salarioAOcupacion(salarioMensual);
        const valorVida = salarioAValorAsegurado(salarioMensual);

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
                coberturas: generarCoberturasPorDefecto(valorVida),
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
        const ocupacion = salarioAOcupacion(salarioMensual);
        const valorVida = salarioAValorAsegurado(salarioMensual);

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
                coberturas: generarCoberturasPorDefecto(valorVida),
                subgrupoId: null,
                planId: null,
                primaIndividual: 0,
                simulado: true
            });
            contador++;
        }
    }

    estado.asegurados.push(...nuevos);
    mostrarSeccionAsegurados();
    recalcularTodo();
    mostrarToast(`${nuevos.length} asegurados simulados generados`, 'success');
}

function limpiarSimulados() {
    const antes = estado.asegurados.length;
    estado.asegurados = estado.asegurados.filter(a => !a.simulado);
    recalcularTodo();
    mostrarToast(`${antes - estado.asegurados.length} asegurados simulados eliminados`, 'success');
}

/* ---- Mapeadores de salario ---- */

const SMMLV = 1_300_000; // Valor referencia 2024

function salarioAOcupacion(salarioMensual) {
    if (salarioMensual < 2 * SMMLV)   return 'Operario';
    if (salarioMensual < 5 * SMMLV)   return 'Administrativo';
    if (salarioMensual < 10 * SMMLV)  return 'Ejecutivo';
    return 'Ejecutivo';
}

function salarioAValorAsegurado(salarioMensual) {
    // Valor asegurado vida = 24 meses de salario, redondeado al millón más cercano
    const raw = salarioMensual * 24;
    return Math.round(raw / 1_000_000) * 1_000_000;
}

function clasificacionAOcupacion(clasificacion) {
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
            return salarioAOcupacion(multiple * SMMLV);
        }
    }

    // Intento numérico (salario en COP)
    const salario = parseFloat(String(clasificacion).replace(/[^0-9.]/g, ''));
    if (!isNaN(salario) && salario > 0) {
        return salarioAOcupacion(salario);
    }

    return 'Administrativo';
}

/* ---- Importación Excel (SheetJS) ---- */

function importarExcel(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    const statusDiv = document.getElementById('excelStatus');
    if (statusDiv) {
        statusDiv.textContent = 'Leyendo archivo...';
        statusDiv.className = 'excel-status';
    }

    if (typeof XLSX === 'undefined') {
        mostrarToast('La librería de Excel no está disponible. Verifica tu conexión.', 'error');
        return;
    }

    const lector = new FileReader();
    lector.onload = (e) => {
        try {
            const datos = new Uint8Array(e.target.result);
            const workbook = XLSX.read(datos, { type: 'array' });
            const hojaName = workbook.SheetNames[0];
            const hoja = workbook.Sheets[hojaName];
            const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });

            if (filas.length < 2) {
                mostrarToast('El archivo está vacío o solo tiene encabezados', 'error');
                if (statusDiv) { statusDiv.textContent = 'Archivo vacío.'; statusDiv.className = 'excel-status error'; }
                return;
            }

            // Determinar si la primera fila es encabezado
            const primeraFila = filas[0];
            const esEncabezado = isNaN(primeraFila[1]) && isNaN(primeraFila[2]);
            const inicio = esEncabezado ? 1 : 0;

            const nuevos = [];
            const errores = [];
            const documentosEnArchivo = new Set();

            for (let i = inicio; i < filas.length; i++) {
                const fila = filas[i];
                if (!fila || fila.every(c => c === '' || c === null || c === undefined)) continue;

                const documento = String(fila[0] ?? '').trim();
                const tipoAseguradoRaw = String(fila[1] ?? '').trim();
                const edadRaw = fila[2];
                const valorAseguradoRaw = fila[3];

                if (!documento) { errores.push(`Fila ${i + 1}: documento vacío`); continue; }

                const tipoAsegurado = CONFIG.TIPO_ASEGURADO.find(tipo =>
                    tipo.toLowerCase() === tipoAseguradoRaw.toLowerCase()
                );
                if (!tipoAsegurado) {
                    errores.push(`Fila ${i + 1}: Tipo_Asegurado inválido (${tipoAseguradoRaw || 'vacío'})`); continue;
                }

                const edad = parseInt(edadRaw);
                if (isNaN(edad) || edad < 18 || edad > 100) {
                    errores.push(`Fila ${i + 1}: edad inválida (${edadRaw})`); continue;
                }

                const valorAsegurado = parsearValorAsegurado(valorAseguradoRaw);
                if (!Number.isFinite(valorAsegurado) || valorAsegurado <= 0) {
                    errores.push(`Fila ${i + 1}: valor asegurado inválido (${valorAseguradoRaw})`); continue;
                }

                if (documentosEnArchivo.has(documento)) {
                    errores.push(`Fila ${i + 1}: documento duplicado dentro del archivo`); continue;
                }
                documentosEnArchivo.add(documento);

                nuevos.push({
                    id: generarUUID(),
                    tipoDocumento: 'Cédula',
                    numeroDocumento: documento,
                    tipoAsegurado,
                    nombreCompleto: `Asegurado ${documento}`,
                    edad,
                    sexo: 'Masculino',
                    ocupacion: 'Administrativo',
                    salario: 0,
                    coberturas: generarCoberturasPorDefecto(valorAsegurado),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0,
                    simulado: false
                });
            }

            if (nuevos.length < CONFIG.REGLAS_COMPLEJIDAD.minAsegurados) {
                const mensajeMinimo = `La base contiene ${nuevos.length} asegurado(s) válido(s). Para continuar, debes cargar al menos ${CONFIG.REGLAS_COMPLEJIDAD.minAsegurados} asegurados. No se agregaron registros.`;
                mostrarAlertaRango(mensajeMinimo, null, 'Cantidad mínima de asegurados');
                mostrarToast(mensajeMinimo, 'warning');
                if (statusDiv) {
                    statusDiv.textContent = mensajeMinimo;
                    statusDiv.className = 'excel-status error';
                }
                evento.target.value = '';
                return;
            }

            reemplazarBaseAsegurados(nuevos);
            if (nuevos.length > 0) mostrarSeccionAsegurados();
            recalcularTodo();

            const msgOk = `${nuevos.length} asegurado(s) cargado(s) correctamente. La base anterior fue reemplazada.`;
            const msgErr = errores.length > 0 ? ` ${errores.length} fila(s) con error omitidas.` : '';
            mostrarToast(msgOk + msgErr, nuevos.length > 0 ? 'success' : 'error');

            if (statusDiv) {
                statusDiv.textContent = msgOk + msgErr;
                statusDiv.className = `excel-status ${nuevos.length > 0 ? 'ok' : 'error'}`;
            }

            const erroresEdad = errores.filter(error => /edad inválida/i.test(error));
            if (erroresEdad.length > 0) {
                const detalle = erroresEdad.slice(0, 5).join(' ');
                const adicionales = erroresEdad.length > 5
                    ? ` Además, hay ${erroresEdad.length - 5} fila(s) adicional(es) con el mismo problema.`
                    : '';
                mostrarAlertaRango(
                    `Se omitieron ${erroresEdad.length} registro(s) porque la edad permitida debe estar entre 18 y 100 años. ${detalle}${adicionales}`,
                    null,
                    'Registros omitidos por edad'
                );
            }

            // Limpiar input para permitir recargar el mismo archivo
            evento.target.value = '';

        } catch (err) {
            mostrarToast('Error al leer el archivo Excel: ' + err.message, 'error');
            if (statusDiv) { statusDiv.textContent = 'Error: ' + err.message; statusDiv.className = 'excel-status error'; }
        }
    };

    lector.readAsArrayBuffer(archivo);
}

async function descargarPlantillaExcel() {
    if (typeof ExcelJS === 'undefined') {
        mostrarToast('La librería Excel no está disponible. Verifica tu conexión.', 'error');
        return;
    }

    // Datos de la plantilla: encabezados + filas de ejemplo
    const datos = [
        ['Numero_Documento', 'Tipo_Asegurado', 'Edad', 'Valor_Asegurado_COP'],
        ['1012345678', 'Afiliado principal', 28, 67000000],
        ['1023456789', 'Conyugue', 35, 132000000],
        ['1034567890', 'Hijos', 42, 36000000],
        ['1045678901', 'Padres', 31, 216000000],
        ['1056789012', 'Padrastos', 25, 48000000]
    ];

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Asegurados');
    hoja.addRows(datos);

    hoja.columns = [
        { width: 22 },
        { width: 20 },
        { width: 8 },
        { width: 22 }
    ];
    hoja.getColumn(1).numFmt = '@';
    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).alignment = { horizontal: 'center' };

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

    const contenido = await libro.xlsx.writeBuffer();
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    enlace.download = 'Plantilla_Asegurados_VidaGrupo.xlsx';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    mostrarToast('Plantilla descargada correctamente', 'success');
}

/* ---- Header: botón Menú Inicio ---- */

function irAlMenuInicio() {
    if (confirm('¿Deseas volver al menú de inicio? Los datos actuales se conservarán.')) {
        mostrarSoloPantalla('pantalla-landing');
    }
}

/* ============================================================
   FIN SECCIÓN 15
   ============================================================ */

/* ============================================================
   SECCIÓN 16: GESTIÓN DE SUBGRUPOS (explícita)
   ============================================================ */

let subgrupoActivoEnPlanes = null; // ID del subgrupo seleccionado en Step 5

/* ---- Generación de ID de subgrupo ---- */

function generarIdSubgrupo(coberturaCodes) {
    // Ordenar códigos alfabéticamente → determinístico
    return [...coberturaCodes].sort().join('-');
}

/* ---- Renderizado de la lista de subgrupos (Step 3) ---- */

function renderizarListaSubgruposConfig() {
    const lista = document.getElementById('listaSubgruposConfig');
    const contador = document.getElementById('contadorSubgrupos');
    if (!lista) return;

    if (contador) contador.textContent = `${estado.subgrupos.length} subgrupo(s) configurado(s)`;

    if (estado.subgrupos.length === 0) {
        lista.innerHTML = `
            <div class="subgrupos-vacio">
                <span class="vacio-icono">&#9783;</span>
                <p>No hay subgrupos configurados</p>
                <button class="btn btn-accent" onclick="abrirModalCrearSubgrupo()">+ Crear el primer subgrupo</button>
            </div>`;
        return;
    }

    lista.innerHTML = '';
    estado.subgrupos.forEach(sg => {
        const numAsegurados = estado.asegurados.filter(a => a.subgrupoId === sg.id).length;
        const numPlanes = estado.planes.filter(p => p.subgrupoId === sg.id).length;

        const coberturaChips = sg.coberturas.map(cod => {
            const cob = estado.coberturasCatalogo.find(c => c.codigo === cod);
            const esOblig = cob?.obligatoria ? 'chip-obligatoria' : '';
            return `<span class="cobertura-chip ${esOblig}">${cod}</span>`;
        }).join('');

        const card = document.createElement('div');
        card.className = 'subgrupo-config-card';
        card.innerHTML = `
            <div class="subgrupo-id-badge">${sg.id}</div>
            <div>
                <div class="subgrupo-info-nombre">${sg.nombre}</div>
                <div class="subgrupo-info-coberturas">${coberturaChips}</div>
                <div class="subgrupo-meta">${numAsegurados} asegurado(s) &bull; ${numPlanes} plan(es)</div>
            </div>
            <div class="subgrupo-acciones">
                <button class="btn btn-small btn-danger" onclick="eliminarSubgrupo('${sg.id}')">Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

/* ---- Modal: crear subgrupo ---- */

function abrirModalCrearSubgrupo() {
    const modal = document.getElementById('modalCrearSubgrupo');
    const grid = document.getElementById('coberturaCheckGrid');
    if (!modal || !grid) return;

    grid.innerHTML = '';
    estado.coberturasCatalogo.forEach(cob => {
        const item = document.createElement('div');
        const esOblig = cob.obligatoria;
        item.className = `cobertura-check-item${esOblig ? ' obligatoria-lock' : ''}`;
        item.innerHTML = `
            <input type="checkbox" id="chk-${cob.codigo}" value="${cob.codigo}"
                   ${esOblig ? 'checked disabled' : ''}>
            <div class="cobertura-check-body">
                <strong>${cob.codigo} ${esOblig ? '(obligatoria)' : ''}</strong>
                <span>${cob.nombre}</span>
            </div>
        `;
        if (!esOblig) {
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const chk = item.querySelector('input[type=checkbox]');
                    chk.checked = !chk.checked;
                }
                item.classList.toggle('selected', item.querySelector('input[type=checkbox]').checked);
                actualizarPreviewSubgrupoId();
            });
        } else {
            item.classList.add('selected');
        }
        grid.appendChild(item);
    });

    actualizarPreviewSubgrupoId();
    modal.style.display = 'flex';
}

function actualizarPreviewSubgrupoId() {
    const checkboxes = document.querySelectorAll('#coberturaCheckGrid input[type=checkbox]:checked');
    const codes = Array.from(checkboxes).map(c => c.value);
    const id = codes.length > 0 ? generarIdSubgrupo(codes) : '—';
    const previewEl = document.getElementById('previewSubgrupoId');
    const existeEl = document.getElementById('previewSubgrupoExiste');

    if (previewEl) previewEl.textContent = id;

    if (existeEl) {
        const existe = estado.subgrupos.some(sg => sg.id === id);
        existeEl.textContent = existe ? '⚠ Este subgrupo ya existe' : '';
    }
}

function cerrarModalCrearSubgrupo() {
    const modal = document.getElementById('modalCrearSubgrupo');
    if (modal) modal.style.display = 'none';
}

function confirmarCrearSubgrupo() {
    const checkboxes = document.querySelectorAll('#coberturaCheckGrid input[type=checkbox]:checked');
    const codes = Array.from(checkboxes).map(c => c.value);

    if (codes.length === 0) {
        mostrarToast('Selecciona al menos una cobertura', 'warning');
        return;
    }

    const id = generarIdSubgrupo(codes);

    if (estado.subgrupos.some(sg => sg.id === id)) {
        mostrarToast(`El subgrupo ${id} ya existe`, 'warning');
        return;
    }

    const numero = estado.subgrupos.length + 1;
    const subgrupo = {
        id,
        nombre: `Subgrupo ${numero}`,
        coberturas: codes.sort(),
        asegurados: []
    };

    estado.subgrupos.push(subgrupo);
    guardarEstado();
    cerrarModalCrearSubgrupo();
    renderizarListaSubgruposConfig();
    actualizarSelectoresSubgrupos();
    mostrarToast(`Subgrupo ${id} creado`, 'success');
}

function eliminarSubgrupo(id) {
    const asignados = estado.asegurados.filter(a => a.subgrupoId === id).length;
    const planes = estado.planes.filter(p => p.subgrupoId === id).length;

    if (asignados > 0 || planes > 0) {
        if (!confirm(`Este subgrupo tiene ${asignados} asegurado(s) y ${planes} plan(es). ¿Eliminar de todas formas? Los asegurados quedarán sin subgrupo.`)) return;
    }

    // Des-asignar asegurados
    estado.asegurados.forEach(a => {
        if (a.subgrupoId === id) { a.subgrupoId = null; a.planId = null; }
    });

    // Eliminar planes
    estado.planes = estado.planes.filter(p => p.subgrupoId !== id);

    // Eliminar subgrupo
    estado.subgrupos = estado.subgrupos.filter(sg => sg.id !== id);

    guardarEstado();
    renderizarListaSubgruposConfig();
    actualizarSelectoresSubgrupos();
    renderizarTablaAsegurados();
    renderizarPlanesSubgrupoTabs();
    mostrarToast('Subgrupo eliminado', 'success');
}

/* ---- Helpers para actualizar selectores en otras pantallas ---- */

function actualizarSelectoresSubgrupos() {
    // Selector para asignación masiva en Step 4
    const selectMasivo = document.getElementById('subgrupoMasivoSelect');
    if (selectMasivo) {
        const val = selectMasivo.value;
        selectMasivo.innerHTML = '<option value="">-- Seleccionar subgrupo --</option>';
        estado.subgrupos.forEach(sg => {
            const opt = document.createElement('option');
            opt.value = sg.id;
            opt.textContent = `${sg.nombre} (${sg.id})`;
            selectMasivo.appendChild(opt);
        });
        selectMasivo.value = val;
    }

    // Mostrar u ocultar la barra de asignación masiva
    const barra = document.getElementById('barraAsignacionMasiva');
    if (barra) barra.style.display = estado.subgrupos.length > 0 ? 'flex' : 'none';
}

/* ============================================================
   SECCIÓN 17: ASIGNACIÓN DE ASEGURADOS A SUBGRUPOS
   ============================================================ */

function asignarSubgrupoAAsegurado(aseguradoId, subgrupoId) {
    const asegurado = estado.asegurados.find(a => a.id === aseguradoId);
    if (!asegurado) return;

    // Si cambia de subgrupo, quitar del plan anterior
    if (asegurado.subgrupoId !== subgrupoId) {
        if (asegurado.planId) {
            const planAnterior = estado.planes.find(p => p.id === asegurado.planId);
            if (planAnterior) planAnterior.asegurados = planAnterior.asegurados.filter(id => id !== aseguradoId);
            asegurado.planId = null;
        }
    }

    asegurado.subgrupoId = subgrupoId || null;
    guardarEstado();
    renderizarTablaAsegurados();
}

function asignarTodosASubgrupo() {
    const selectMasivo = document.getElementById('subgrupoMasivoSelect');
    const subgrupoId = selectMasivo?.value;
    if (!subgrupoId) {
        mostrarToast('Selecciona un subgrupo primero', 'warning');
        return;
    }

    let asignados = 0;
    estado.asegurados.forEach(a => {
        if (!a.subgrupoId) {
            a.subgrupoId = subgrupoId;
            asignados++;
        }
    });

    guardarEstado();
    renderizarTablaAsegurados();
    mostrarToast(`${asignados} asegurado(s) asignado(s) al subgrupo ${subgrupoId}`, 'success');
}

function asignarPorSalario() {
    if (estado.subgrupos.length === 0) {
        mostrarToast('Crea al menos un subgrupo antes de asignar', 'warning');
        return;
    }

    const modal = document.getElementById('modalAsignacionSalario');
    const tbody = document.getElementById('tbody-asig-sal');
    if (!modal || !tbody) return;

    // Opciones de rango de valor asegurado predeterminadas
    const rangos = [
        { label: 'Hasta $50.000.000', maxValorAsegurado: 50000000 },
        { label: 'Hasta $100.000.000', maxValorAsegurado: 100000000 },
        { label: 'Hasta $200.000.000', maxValorAsegurado: 200000000 },
        { label: 'Más de $200.000.000', maxValorAsegurado: Infinity }
    ];

    const subgrupoOpts = estado.subgrupos.map(sg =>
        `<option value="${sg.id}">${sg.nombre} (${sg.id})</option>`
    ).join('');

    tbody.innerHTML = '';
    rangos.forEach((rango, i) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td style="font-size:13px;padding:8px;">${rango.label}</td>
            <td>
                <select class="filter-select" data-max="${rango.maxValorAsegurado}" style="width:100%;">
                    <option value="">-- Sin asignar --</option>
                    ${subgrupoOpts}
                </select>
            </td>
        `;
        tbody.appendChild(fila);
    });

    modal.style.display = 'flex';
}

function ejecutarAsignacionPorSalario() {
    const filas = document.querySelectorAll('#tbody-asig-sal tr');
    const reglas = [];
    filas.forEach(fila => {
        const select = fila.querySelector('select');
        const maxValorAsegurado = parseFloat(select.dataset.max) || Infinity;
        const subgrupoId = select.value;
        if (subgrupoId) reglas.push({ maxValorAsegurado, subgrupoId });
    });

    reglas.sort((a, b) => a.maxValorAsegurado - b.maxValorAsegurado);

    let asignados = 0;
    estado.asegurados.forEach(a => {
        const valorAsegurado = obtenerValorAseguradoBase(a);
        for (const regla of reglas) {
            if (valorAsegurado <= regla.maxValorAsegurado) {
                a.subgrupoId = regla.subgrupoId;
                a.planId = null;
                asignados++;
                break;
            }
        }
    });

    guardarEstado();
    renderizarTablaAsegurados();
    document.getElementById('modalAsignacionSalario').style.display = 'none';
    mostrarToast(`${asignados} asegurado(s) asignado(s) por rango de valor asegurado`, 'success');
}

/* ============================================================
   SECCIÓN 18: GESTIÓN DE PLANES Y VALORES ASEGURADOS
   ============================================================ */

function renderizarPlanesSubgrupoTabs() {
    const container = document.getElementById('planesSubgrupoTabs');
    if (!container) return;

    container.innerHTML = '';
    if (estado.subgrupos.length === 0) {
        container.innerHTML = '<p style="color:var(--color-gray);font-size:13px;">Aún no hay agrupaciones disponibles para configurar planes.</p>';
        return;
    }

    estado.subgrupos.forEach(sg => {
        const tab = document.createElement('button');
        tab.className = `planes-tab${subgrupoActivoEnPlanes === sg.id ? ' active' : ''}`;
        tab.textContent = `${sg.nombre} (${sg.id})`;
        tab.dataset.sgid = sg.id;
        tab.onclick = () => seleccionarSubgrupoParaPlanes(sg.id);
        container.appendChild(tab);
    });

    if (!subgrupoActivoEnPlanes && estado.subgrupos.length > 0) {
        seleccionarSubgrupoParaPlanes(estado.subgrupos[0].id);
    } else if (subgrupoActivoEnPlanes) {
        renderizarPlanesWorkspace(subgrupoActivoEnPlanes);
    }
}

function seleccionarSubgrupoParaPlanes(subgrupoId) {
    subgrupoActivoEnPlanes = subgrupoId;

    document.querySelectorAll('.planes-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.sgid === subgrupoId);
    });

    const btnAg = document.getElementById('btnAgregarPlan');
    const btnPlan = document.getElementById('btnPlanPorSalario');
    if (btnAg) btnAg.style.display = 'inline-block';
    if (btnPlan) btnPlan.style.display = 'inline-block';

    renderizarPlanesWorkspace(subgrupoId);
}

function renderizarPlanesWorkspace(subgrupoId) {
    const subgrupo = estado.subgrupos.find(sg => sg.id === subgrupoId);
    const titulo = document.getElementById('planesWorkspaceTitulo');
    const sub = document.getElementById('planesWorkspaceSub');
    const container = document.getElementById('planesTablaContainer');
    if (!subgrupo || !container) return;

    if (titulo) titulo.textContent = `${subgrupo.nombre} — ${subgrupo.id}`;
    if (sub) {
        const coberturas = subgrupo.coberturas.join(', ');
        const asignados = estado.asegurados.filter(a => a.subgrupoId === subgrupoId).length;
        sub.textContent = `Coberturas: ${coberturas} | ${asignados} asegurado(s)`;
    }

    const planes = estado.planes.filter(p => p.subgrupoId === subgrupoId);

    if (planes.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:32px;color:var(--color-gray);">
                <p>No hay planes configurados para este subgrupo</p>
                <button class="btn btn-accent" onclick="agregarPlanAlSubgrupo()" style="margin-top:12px;">+ Agregar primer plan</button>
            </div>`;
        return;
    }

    // Construir tabla con una columna por cobertura
    const cobHeaders = subgrupo.coberturas.map(cod => `<th>${cod}<br><small>Valor aseg.</small></th>`).join('');
    let html = `
        <div style="overflow-x:auto;">
        <table class="tabla-planes-valores">
            <thead>
                <tr>
                    <th>Plan</th>
                    ${cobHeaders}
                    <th>Asegurados</th>
                    <th>Prima Total</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    planes.forEach(plan => {
        const valCeldas = subgrupo.coberturas.map(cod => {
            const val = plan.valoresCobertura?.[cod] || 0;
            return `<td>
                <input type="number" class="valor-aseg-input"
                    value="${val}" min="0" step="1000000"
                    onchange="actualizarValorPlan('${plan.id}','${cod}',this.value)">
            </td>`;
        }).join('');

        const numAseg = plan.asegurados?.length || 0;
        const prima = formatearDinero(plan.primaTotal || 0);

        html += `
            <tr>
                <td><input type="text" class="plan-nombre-input" value="${plan.nombre}"
                    onchange="plan_${plan.id}_nombre = this.value; actualizarNombrePlan('${plan.id}', this.value)"></td>
                ${valCeldas}
                <td style="text-align:center;">${numAseg}</td>
                <td class="plan-prima-cell">${prima}</td>
                <td>
                    <button class="btn btn-small btn-secondary" onclick="abrirModalEditarPlan('${plan.id}')">Editar</button>
                    <button class="btn btn-small btn-secondary" onclick="abrirAsignadorPlan('${plan.id}')">Asignar</button>
                    <button class="btn btn-small btn-danger" onclick="eliminarPlan('${plan.id}')">Eliminar</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function agregarPlanAlSubgrupo() {
    if (!subgrupoActivoEnPlanes) {
        mostrarToast('Selecciona un subgrupo primero', 'warning');
        return;
    }

    const subgrupo = estado.subgrupos.find(sg => sg.id === subgrupoActivoEnPlanes);
    if (!subgrupo) return;

    // Valores por defecto (0)
    const valoresCobertura = {};
    subgrupo.coberturas.forEach(cod => { valoresCobertura[cod] = 0; });

    const plan = {
        id: generarUUID(),
        subgrupoId: subgrupoActivoEnPlanes,
        nombre: siguienteNombrePlan(),
        valoresCobertura,
        asegurados: [],
        primaTotal: 0
    };

    estado.planes.push(plan);
    guardarEstado();
    renderizarPlanesWorkspace(subgrupoActivoEnPlanes);
    mostrarToast(`Plan ${plan.nombre} creado`, 'success');
}

function actualizarNombrePlan(planId, nombre) {
    const plan = estado.planes.find(p => p.id === planId);
    if (plan) { plan.nombre = nombre; guardarEstado(); }
}

function actualizarValorPlan(planId, coberturaCod, valor) {
    const plan = estado.planes.find(p => p.id === planId);
    if (!plan) return;

    plan.valoresCobertura[coberturaCod] = parseFloat(valor) || 0;

    // Recalcular prima del plan
    recalcularPrimaPlan(plan);
    renderizarTablaCalculos();
    renderizarPlanesWorkspace(plan.subgrupoId);
    guardarEstado();
}

function recalcularPrimaPlan(plan) {
    const subgrupo = estado.subgrupos.find(sg => sg.id === plan.subgrupoId);
    if (!subgrupo) return;

    // Prima = suma de (valorAsegurado * tasa * factorEdad / 100) por cada asegurado del plan
    let primaTotal = 0;
    plan.asegurados.forEach(asegId => {
        const asegurado = estado.asegurados.find(a => a.id === asegId);
        if (!asegurado) return;

        // Actualizar coberturas del asegurado con los valores del plan
        subgrupo.coberturas.forEach(cod => {
            const cob = asegurado.coberturas.find(c => c.codigo === cod);
            const valorConfiguradoPlan = Number(plan.valoresCobertura?.[cod]);
            if (cob) {
                if (Number.isFinite(valorConfiguradoPlan) && valorConfiguradoPlan > 0) {
                    cob.valorAsegurado = valorConfiguradoPlan;
                }
                cob.activa = true;
            }
        });

        const primaInd = calcularPrimaIndividual(asegurado);
        asegurado.primaIndividual = primaInd;
        primaTotal += primaInd;
    });

    plan.primaTotal = primaTotal;
}

function eliminarPlan(planId) {
    if (!confirm('¿Eliminar este plan? Los asegurados quedarán sin plan asignado.')) return;

    const plan = estado.planes.find(p => p.id === planId);
    if (plan) {
        plan.asegurados.forEach(asegId => {
            const asegurado = estado.asegurados.find(a => a.id === asegId);
            if (asegurado) asegurado.planId = null;
        });
    }

    estado.planes = estado.planes.filter(p => p.id !== planId);
    guardarEstado();
    renderizarPlanesWorkspace(subgrupoActivoEnPlanes);
    renderizarTablaCoberturas();
    renderizarPlanesSubgrupoTabs();
    renderizarAsignacionPlanes();
    mostrarToast('Plan eliminado', 'success');
}

function abrirAsignadorPlan(planId) {
    const plan = estado.planes.find(p => p.id === planId);
    if (!plan) return;

    const aseguradosDelSubgrupo = estado.asegurados.filter(a => a.subgrupoId === plan.subgrupoId);
    if (aseguradosDelSubgrupo.length === 0) {
        mostrarToast('No hay asegurados asignados a este subgrupo', 'warning');
        return;
    }

    // Asignar todos los asegurados del subgrupo sin plan a este plan
    let asignados = 0;
    aseguradosDelSubgrupo.forEach(a => {
        if (!a.planId) {
            a.planId = planId;
            if (!plan.asegurados.includes(a.id)) plan.asegurados.push(a.id);
            asignados++;
        }
    });

    recalcularPrimaPlan(plan);
    guardarEstado();
    renderizarPlanesWorkspace(plan.subgrupoId);
    mostrarToast(`${asignados} asegurado(s) asignado(s) al plan`, 'success');
}

/* ---- Plan por rango de valor asegurado ---- */

let planSalarioSubgrupoActivo = null;

function abrirModalPlanSalario() {
    if (!subgrupoActivoEnPlanes) return;
    planSalarioSubgrupoActivo = subgrupoActivoEnPlanes;

    const subgrupo = estado.subgrupos.find(sg => sg.id === subgrupoActivoEnPlanes);
    if (!subgrupo) return;

    const modal = document.getElementById('modalPlanSalario');
    const container = document.getElementById('planSalarioFilas');
    if (!modal || !container) return;

    // Cabecera de columnas de coberturas
    const cobCols = subgrupo.coberturas.map(cod => `<th style="text-align:center;">${cod}</th>`).join('');
    container.innerHTML = `
        <table class="tabla-planes-valores" id="tablaPlanSalario">
            <thead>
                <tr>
                    <th>Rango de valor asegurado (hasta COP)</th>
                    ${cobCols}
                </tr>
            </thead>
            <tbody id="tbody-plan-salario">
            </tbody>
        </table>
    `;

    // Agregar dos filas por defecto
    agregarFilaPlanSalario();
    agregarFilaPlanSalario();

    modal.style.display = 'flex';
}

function agregarFilaPlanSalario() {
    const subgrupo = estado.subgrupos.find(sg => sg.id === planSalarioSubgrupoActivo);
    if (!subgrupo) return;
    const tbody = document.getElementById('tbody-plan-salario');
    if (!tbody) return;

    const cobInputs = subgrupo.coberturas.map(cod =>
        `<td><input type="number" class="valor-aseg-input" placeholder="0" min="0" step="1000000" data-cod="${cod}"></td>`
    ).join('');

    const fila = document.createElement('tr');
    fila.innerHTML = `
        <td><input type="number" class="valor-aseg-input" placeholder="Ej: 50000000" step="1000000" data-tipo="valor-asegurado"></td>
        ${cobInputs}
        <td><button class="btn btn-small btn-danger" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    tbody.appendChild(fila);
}

function ejecutarPlanPorSalario() {
    const subgrupo = estado.subgrupos.find(sg => sg.id === planSalarioSubgrupoActivo);
    if (!subgrupo) return;

    const filas = document.querySelectorAll('#tbody-plan-salario tr');
    const reglas = [];

    filas.forEach(fila => {
        const maxValorAsegurado = parseFloat(fila.querySelector('[data-tipo=valor-asegurado]')?.value) || 0;
        if (maxSal <= 0) return;

        const vals = {};
        fila.querySelectorAll('[data-cod]').forEach(inp => {
            vals[inp.dataset.cod] = parseFloat(inp.value) || 0;
        });

        reglas.push({ maxValorAsegurado, valoresCobertura: vals });
    });

    if (reglas.length === 0) {
        mostrarToast('Define al menos un rango de valor asegurado mayor a 0', 'warning');
        return;
    }

    reglas.sort((a, b) => a.maxValorAsegurado - b.maxValorAsegurado);

    // Eliminar planes existentes del subgrupo
    const planesAnteriores = estado.planes.filter(p => p.subgrupoId === planSalarioSubgrupoActivo);
    planesAnteriores.forEach(p => {
        p.asegurados.forEach(id => {
            const a = estado.asegurados.find(x => x.id === id);
            if (a) a.planId = null;
        });
    });
    estado.planes = estado.planes.filter(p => p.subgrupoId !== planSalarioSubgrupoActivo);

    // Crear planes por rango y asignar asegurados
    const aseguradosDelSubgrupo = estado.asegurados.filter(a => a.subgrupoId === planSalarioSubgrupoActivo);

    const planesCreados = reglas.map((regla, i) => ({
        id: generarUUID(),
        subgrupoId: planSalarioSubgrupoActivo,
        nombre: `Plan ${i + 1} (≤ ${formatearDinero(regla.maxValorAsegurado)})`,
        valoresCobertura: regla.valoresCobertura,
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
        a.planId = planAsignado.id;
        planAsignado.asegurados.push(a.id);
    });

    // Calcular primas
    planesCreados.forEach(p => recalcularPrimaPlan(p));

    estado.planes.push(...planesCreados);
    guardarEstado();
    renderizarPlanesWorkspace(planSalarioSubgrupoActivo);
    document.getElementById('modalPlanSalario').style.display = 'none';
    mostrarToast(`${planesCreados.length} plan(es) creado(s) por rango de valor asegurado`, 'success');
}

/* ============================================================
   FIN SECCIONES 16–18
   ============================================================ */

function inicializar() {
    cargarEstado();
    establecerFechasDefault();
    setupEventListeners();
    actualizarSiniestralidad(true);
    renderizarTablaCoberturas();
    renderizarTablaAsegurados();
    renderizarTablaSubgrupos();
    renderizarTablaPlanes();
    renderizarDashboard();
    cargarCatalogoCoberturas();

    // Mostrar pantalla de inicio (no ir directo al wizard)
    mostrarSoloPantalla('pantalla-landing');
}

function establecerFechasDefault() {
    const hoje = new Date().toISOString().split('T')[0];
    const proxAnio = new Date();
    proxAnio.setFullYear(proxAnio.getFullYear() + 1);
    const proxAnioStr = proxAnio.toISOString().split('T')[0];

    const inputDesde = document.getElementById('vigenciaDesde');
    const inputHasta = document.getElementById('vigenciaHasta');
    const inputCobro = document.getElementById('fechaCobro');

    if (inputDesde && !estado.poliza.vigenciaDesde) {
        inputDesde.value = hoje;
        estado.poliza.vigenciaDesde = hoje;
    } else if (inputDesde && estado.poliza.vigenciaDesde) {
        inputDesde.value = estado.poliza.vigenciaDesde;
    }

    if (inputHasta && !estado.poliza.vigenciaHasta) {
        inputHasta.value = proxAnioStr;
        estado.poliza.vigenciaHasta = proxAnioStr;
    } else if (inputHasta && estado.poliza.vigenciaHasta) {
        inputHasta.value = estado.poliza.vigenciaHasta;
    }

    if (inputCobro && !estado.poliza.fechaCobro) {
        inputCobro.value = hoje;
        estado.poliza.fechaCobro = hoje;
    } else if (inputCobro && estado.poliza.fechaCobro) {
        inputCobro.value = estado.poliza.fechaCobro;
    }
}

function pasosNavegacion() {
    document.querySelectorAll('.step-section').forEach(section => {
        section.classList.remove('active');
    });

    const seccionActiva = document.getElementById(`step${pasoActual}`);
    if (seccionActiva) {
        seccionActiva.classList.add('active');
    }

    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.toggle('active', index + 1 === pasoActual);
    });

    // Actualizar barra de progreso
    const progreso = ((pasoActual - 1) / 6) * 100;
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = progreso + '%';
    }

    // Mostrar/ocultar botones de navegación apropiados
    for (let i = 1; i <= 6; i++) {
        const btnSiguiente = document.getElementById(`btnSiguiente${i}`);
        if (btnSiguiente) btnSiguiente.style.display = pasoActual === i ? 'inline-block' : 'none';
    }
    for (let i = 1; i <= 6; i++) {
        const btnAtras = document.getElementById(`btnAtras${i}`);
        if (btnAtras) btnAtras.style.display = pasoActual === i + 1 ? 'inline-block' : 'none';
    }
}

function ocultarSeccionAsegurados() {
    const toolbar = document.querySelector('.toolbar-asegurados');
    const container = document.querySelector('.asegurados-container');
    const barra = document.getElementById('barraAsignacionMasiva');
    if (toolbar) toolbar.style.display = 'none';
    if (container) container.style.display = 'none';
    if (barra) barra.style.display = 'none';
}

function mostrarSeccionAsegurados() {
    const toolbar = document.querySelector('.toolbar-asegurados');
    const container = document.querySelector('.asegurados-container');
    if (toolbar) toolbar.style.display = '';
    if (container) container.style.display = '';
    // barraAsignacionMasiva permanece controlada por su propia lógica (solo si hay subgrupos)
}

function renderizarAsignacionPlanes() {
    const cuerpoRangos = document.getElementById('tbody-rangos-planes');
    const cuerpoAsignacion = document.getElementById('tbody-asignacion-planes');
    if (!cuerpoRangos || !cuerpoAsignacion) return;

    if (estado.planes.length === 0) {
        cuerpoRangos.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Crea al menos un plan en el paso de coberturas.</td></tr>';
        cuerpoAsignacion.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay planes disponibles para asignar.</td></tr>';
        return;
    }

    cuerpoRangos.innerHTML = estado.planes.map(plan => `
        <tr>
            <td>${plan.nombre}</td>
            <td>${formatearCoberturasPlan(plan)}</td>
            <td>${plan.generadoPorEdad ? formatearValorMonetario(plan.valorDesde) || 'Sin mínimo' : `<input type="text" inputmode="numeric" data-plan-id="${plan.id}" data-limite="desde" value="${formatearValorMonetario(plan.valorDesde)}" placeholder="$ 0" oninput="formatearCampoMoneda(this); revisarRangosEnFormulario(this)" onchange="actualizarRangoPlan('${plan.id}', 'desde', this.value, this)">`}</td>
            <td>${plan.generadoPorEdad ? formatearValorMonetario(plan.valorHasta) || 'Sin máximo' : `<input type="text" inputmode="numeric" data-plan-id="${plan.id}" data-limite="hasta" value="${formatearValorMonetario(plan.valorHasta)}" placeholder="Sin máximo" oninput="formatearCampoMoneda(this); revisarRangosEnFormulario(this)" onchange="actualizarRangoPlan('${plan.id}', 'hasta', this.value, this)">`}</td>
            <td>${formatearEdadMaximaPlan(plan)}</td>
        </tr>`).join('');

    const opcionesPlanes = estado.planes.map(plan => `<option value="${plan.id}">${plan.nombre}</option>`).join('');
    cuerpoAsignacion.innerHTML = estado.asegurados.map(asegurado => `
        <tr>
            <td>${asegurado.numeroDocumento || '—'}</td>
            <td>${asegurado.nombreCompleto || '—'}</td>
            <td>${asegurado.edad ?? '—'}</td>
            <td>${asegurado.tipoAsegurado || '—'}</td>
            <td>${formatearDinero(obtenerValorAseguradoBase(asegurado))}</td>
            <td><select onchange="asignarPlanAAsegurado('${asegurado.id}', this.value)"><option value="">Sin asignar</option>${opcionesPlanes}</select></td>
        </tr>`).join('');
    estado.asegurados.forEach(asegurado => {
        const selector = cuerpoAsignacion.querySelector(`select[onchange*="'${asegurado.id}'"]`);
        if (selector) selector.value = asegurado.planId || '';
    });
}

function obtenerValorMonetario(valor) {
    const digitos = String(valor ?? '').replace(/\D/g, '');
    return digitos === '' ? null : Number(digitos);
}

function formatearValorMonetario(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    return `$ ${Number(valor).toLocaleString('es-CO')}`;
}

function formatearCampoMoneda(campo) {
    const valor = obtenerValorMonetario(campo.value);
    campo.value = formatearValorMonetario(valor);
}

function actualizarSiniestralidad(restaurarValoresGuardados = false) {
    const campoTotal = document.getElementById('valorSiniestrosTotales');
    const campoAnos = document.getElementById('anosExposicion');
    const campoPromedio = document.getElementById('siniestrosPromedio');
    if (!campoTotal || !campoAnos || !campoPromedio) return;

    const total = obtenerValorMonetario(campoTotal.value)
        ?? (restaurarValoresGuardados ? Number(estado.poliza.valorSiniestrosTotales) || 0 : 0);
    const anos = Number(campoAnos.value)
        || (restaurarValoresGuardados ? Number(estado.poliza.anosExposicion) || 0 : 0);
    const promedio = anos > 0 ? total / anos : 0;

    campoTotal.value = formatearValorMonetario(total);
    campoAnos.value = anos || '';
    campoPromedio.value = formatearValorMonetario(promedio);
    estado.poliza.valorSiniestrosTotales = total;
    estado.poliza.anosExposicion = anos;
    estado.poliza.siniestrosPromedio = promedio;
    guardarEstado();
}

function revisarRangosEnFormulario(campoActivo = null) {
    const campos = Array.from(document.querySelectorAll('#tbody-rangos-planes input[data-plan-id]'));
    campos.forEach(campo => campo.classList.remove('rango-plan-error'));

    const rangos = estado.planes.map(plan => {
        const desdeCampo = campos.find(campo => campo.dataset.planId === plan.id && campo.dataset.limite === 'desde');
        const hastaCampo = campos.find(campo => campo.dataset.planId === plan.id && campo.dataset.limite === 'hasta');
        return {
            plan,
            desde: obtenerValorMonetario(desdeCampo?.value),
            hasta: obtenerValorMonetario(hastaCampo?.value),
            desdeCampo,
            hastaCampo
        };
    }).filter(rango => rango.desde !== null && rango.hasta !== null).sort((a, b) => a.desde - b.desde);

    let mensaje = '';
    for (let indice = 0; indice < rangos.length; indice++) {
        const rango = rangos[indice];
        if (rango.desde > rango.hasta) {
            rango.desdeCampo?.classList.add('rango-plan-error');
            rango.hastaCampo?.classList.add('rango-plan-error');
            mensaje = `${rango.plan.nombre}: el valor desde no puede ser mayor que el valor hasta.`;
            break;
        }
        const anterior = rangos[indice - 1];
        if (anterior && rango.desde <= anterior.hasta) {
            anterior.hastaCampo?.classList.add('rango-plan-error');
            rango.desdeCampo?.classList.add('rango-plan-error');
            mensaje = `${rango.plan.nombre}: el valor desde debe ser mayor que el valor hasta de ${anterior.plan.nombre}.`;
            break;
        }
    }
    return { valido: !mensaje, mensaje, campoError: campoActivo?.classList.contains('rango-plan-error') ? campoActivo : rangos.find(rango => rango.desdeCampo?.classList.contains('rango-plan-error'))?.desdeCampo };
}

function validarRangosPlanes() {
    const rangos = estado.planes
        .filter(plan => !plan.generadoPorEdad)
        .filter(plan => plan.valorDesde !== null && plan.valorDesde !== undefined && plan.valorHasta !== null && plan.valorHasta !== undefined)
        .map(plan => ({ nombre: plan.nombre, desde: plan.valorDesde, hasta: plan.valorHasta }))
        .sort((a, b) => a.desde - b.desde);

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

function mostrarAlertaRango(mensaje, campo, titulo = 'Revisa el rango de valor asegurado') {
    const modal = document.getElementById('modalAlertaRango');
    const texto = document.getElementById('mensajeAlertaRango');
    const encabezado = document.getElementById('tituloAlertaRango');
    if (!modal || !texto || !encabezado) return;
    campoRangoConError = campo || null;
    encabezado.textContent = titulo;
    texto.textContent = mensaje;
    modal.style.display = 'flex';
    document.getElementById('btnAceptarAlertaRango')?.focus();
}

function cerrarAlertaRango() {
    const modal = document.getElementById('modalAlertaRango');
    if (modal) modal.style.display = 'none';
    campoRangoConError?.focus();
    campoRangoConError = null;
}

function actualizarRangoPlan(planId, limite, valor, campo) {
    const plan = estado.planes.find(item => item.id === planId);
    if (!plan) return;
    const propiedad = limite === 'desde' ? 'valorDesde' : 'valorHasta';
    const valorAnterior = plan[propiedad];
    plan[propiedad] = obtenerValorMonetario(valor);
    const validacion = validarRangosPlanes();
    if (!validacion.valido) {
        plan[propiedad] = valorAnterior;
        const revision = revisarRangosEnFormulario(campo);
        mostrarAlertaRango(validacion.mensaje, revision.campoError || campo);
        return;
    }
    revisarRangosEnFormulario();
    guardarEstado();
}

function asignarPlanAAsegurado(aseguradoId, planId) {
    const asegurado = estado.asegurados.find(item => item.id === aseguradoId);
    if (!asegurado) return;
    let plan = estado.planes.find(item => item.id === planId);
    if (plan) {
        const planOriginal = plan;
        plan = crearPlanFiltradoPorParentesco(plan, asegurado.tipoAsegurado);
        const edadMaxima = obtenerEdadMaximaPlan(plan);
        if (edadMaxima !== null && Number(asegurado.edad) > edadMaxima) {
            mostrarAlertaRango(
                `${asegurado.nombreCompleto || 'El asegurado'} tiene ${asegurado.edad} años y supera la edad máxima de ${edadMaxima} años para ${plan.nombre}. No se realizó la asignación.`,
                null,
                'Restricción de edad para el plan'
            );
            renderizarAsignacionPlanes();
            return;
        }
        if (plan !== planOriginal) {
            mostrarToast(`${plan.nombre} fue creado con las coberturas habilitadas para ${asegurado.tipoAsegurado}.`, 'info');
        }
    }
    estado.planes.forEach(item => { item.asegurados = (item.asegurados || []).filter(id => id !== aseguradoId); });
    asegurado.planId = plan?.id || null;
    if (plan) {
        plan.asegurados = [...new Set([...(plan.asegurados || []), aseguradoId])];
        asegurado.subgrupoId = plan.subgrupoId;
        sincronizarCoberturasAseguradoConPlan(asegurado, plan);
    }
    guardarEstado();
    renderizarAsignacionPlanes();
    renderizarTablaCalculos();
}

function obtenerCoberturasPlan(plan) {
    const subgrupo = estado.subgrupos.find(item => item.id === plan.subgrupoId);
    return (subgrupo?.coberturas || []).map(codigo =>
        coberturasDisponibles.find(cobertura => cobertura.codigo === codigo)
        || estado.coberturasCatalogo.find(cobertura => cobertura.codigo === codigo)
    ).filter(Boolean);
}

function obtenerCoberturasPermitidasPorParentesco(coberturas, tipoAsegurado) {
    const habilitadas = CONFIG.COBERTURAS_HABILITADAS_POR_PARENTESCO[tipoAsegurado];
    if (habilitadas) {
        return coberturas.filter(cobertura => habilitadas.includes(cobertura.codigo));
    }

    const excluidas = CONFIG.COBERTURAS_EXCLUIDAS_POR_PARENTESCO[tipoAsegurado] || [];
    return coberturas.filter(cobertura => !excluidas.includes(cobertura.codigo));
}

function crearPlanFiltradoPorParentesco(planBase, tipoAsegurado) {
    const coberturasBase = obtenerCoberturasPlan(planBase);
    const coberturasPermitidas = obtenerCoberturasPermitidasPorParentesco(coberturasBase, tipoAsegurado);
    const codigosBase = coberturasBase.map(cobertura => cobertura.codigo).sort().join(',');
    const codigosPermitidos = coberturasPermitidas.map(cobertura => cobertura.codigo).sort().join(',');

    if (codigosPermitidos === codigosBase) return planBase;

    const planExistente = estado.planes.find(plan =>
        plan.generadoPorParentesco
        && plan.planBaseId === planBase.id
        && plan.parentescoRestriccion === tipoAsegurado
        && obtenerCoberturasPlan(plan).map(cobertura => cobertura.codigo).sort().join(',') === codigosPermitidos
    );
    if (planExistente) return planExistente;

    const subgrupoId = generarIdSubgrupo(coberturasPermitidas.map(cobertura => cobertura.codigo));
    if (!estado.subgrupos.some(subgrupo => subgrupo.id === subgrupoId)) {
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
        nombre: `${siguienteNombrePlan()} — ${tipoAsegurado}`,
        planBaseId: planBase.id,
        generadoPorParentesco: true,
        generadoPorEdad: Boolean(planBase.generadoPorEdad),
        parentescoRestriccion: tipoAsegurado,
        valorDesde: planBase.valorDesde,
        valorHasta: planBase.valorHasta,
        valoresCobertura: Object.fromEntries(coberturasPermitidas.map(cobertura => [
            cobertura.codigo,
            planBase.valoresCobertura?.[cobertura.codigo] || 0
        ])),
        asegurados: [],
        primaTotal: 0
    };
    estado.planes.push(plan);
    return plan;
}

function sincronizarCoberturasAseguradoConPlan(asegurado, plan) {
    const coberturasPlan = obtenerCoberturasPlan(plan);
    const codigosPlan = new Set(coberturasPlan.map(cobertura => cobertura.codigo));
    asegurado.coberturas = (asegurado.coberturas || []).filter(cobertura => codigosPlan.has(cobertura.codigo));
    coberturasPlan.forEach(cobertura => {
        if (!asegurado.coberturas.some(item => item.codigo === cobertura.codigo)) {
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

function formatearCoberturasPlan(plan) {
    const coberturas = obtenerCoberturasPlan(plan);
    return coberturas.length > 0
        ? coberturas.map(cobertura => cobertura.nombre || cobertura.codigo).join(', ')
        : 'Sin coberturas';
}

function obtenerEdadMaximaCobertura(cobertura) {
    const codigoAmparo = String(cobertura.codigoAmparo ?? '').replace(/\.0$/, '');
    const edadMaxima = estado.edadesMaximasPorCobertura?.[codigoAmparo];
    return Number.isFinite(edadMaxima) ? edadMaxima : null;
}

function obtenerEdadMaximaPlan(plan) {
    const edadesMaximas = obtenerCoberturasPlan(plan)
        .map(obtenerEdadMaximaCobertura)
        .filter(edad => edad !== null);
    return edadesMaximas.length > 0 ? Math.min(...edadesMaximas) : null;
}

function formatearEdadMaximaPlan(plan) {
    const edadMaxima = obtenerEdadMaximaPlan(plan);
    return edadMaxima === null ? 'Sin información' : `${edadMaxima} años`;
}

function crearPlanElegiblePorEdad(planBase, coberturasElegibles) {
    const codigos = coberturasElegibles.map(cobertura => cobertura.codigo).sort();
    const subgrupoId = generarIdSubgrupo(codigos);
    if (!estado.subgrupos.some(subgrupo => subgrupo.id === subgrupoId)) {
        estado.subgrupos.push({ id: subgrupoId, nombre: `Grupo ${estado.subgrupos.length + 1}`, coberturas: codigos, asegurados: [] });
    }

    const plan = {
        id: generarUUID(),
        subgrupoId,
        nombre: `${siguienteNombrePlan()} — coberturas por edad`,
        generadoPorEdad: true,
        valorDesde: planBase.valorDesde,
        valorHasta: planBase.valorHasta,
        valoresCobertura: Object.fromEntries(codigos.map(codigo => [codigo, planBase.valoresCobertura?.[codigo] || 0])),
        asegurados: [],
        primaTotal: 0
    };
    estado.planes.push(plan);
    return plan;
}

function asignarAseguradoAPlanElegible(asegurado, plan) {
    estado.planes.forEach(item => { item.asegurados = (item.asegurados || []).filter(id => id !== asegurado.id); });
    asegurado.planId = plan.id;
    asegurado.subgrupoId = plan.subgrupoId;
    plan.asegurados.push(asegurado.id);
    sincronizarCoberturasAseguradoConPlan(asegurado, plan);
}

function asignarPlanesPorRango() {
    const validacion = validarRangosPlanes();
    if (!validacion.valido) {
        mostrarToast(validacion.mensaje, 'warning');
        return;
    }
    let asignados = 0;
    let planesPorEdadCreados = 0;
    let sinCoberturasElegibles = 0;
    const ajustesPorEdad = [];
    const planesElegibles = new Map();
    estado.asegurados.forEach(asegurado => {
        const valor = obtenerValorAseguradoBase(asegurado);
        const plan = estado.planes.find(item => !item.generadoPorEdad && !item.generadoPorParentesco
            &&
            (item.valorDesde === null || item.valorDesde === undefined || valor >= item.valorDesde)
            && (item.valorHasta === null || item.valorHasta === undefined || valor <= item.valorHasta)
        );
        if (plan) {
            const coberturasPlan = obtenerCoberturasPlan(plan);
            const coberturasElegibles = coberturasPlan.filter(cobertura => {
                const edadMaxima = obtenerEdadMaximaCobertura(cobertura);
                return edadMaxima === null || Number(asegurado.edad) <= edadMaxima;
            });
            if (coberturasElegibles.length === 0) {
                sinCoberturasElegibles++;
                ajustesPorEdad.push(`${asegurado.nombreCompleto || asegurado.numeroDocumento || 'Asegurado sin nombre'}: no tiene coberturas habilitadas.`);
                return;
            }

            let planAsignado = plan;
            if (coberturasElegibles.length !== coberturasPlan.length) {
                const coberturasRetiradas = coberturasPlan
                    .filter(cobertura => !coberturasElegibles.some(elegible => elegible.codigo === cobertura.codigo))
                    .map(cobertura => cobertura.nombre || cobertura.codigo);
                ajustesPorEdad.push(`${asegurado.nombreCompleto || asegurado.numeroDocumento || 'Asegurado sin nombre'}: se retiraron ${coberturasRetiradas.join(', ')}.`);
                const llave = `${plan.id}:${coberturasElegibles.map(cobertura => cobertura.codigo).sort().join(',')}`;
                planAsignado = planesElegibles.get(llave);
                if (!planAsignado) {
                    planAsignado = crearPlanElegiblePorEdad(plan, coberturasElegibles);
                    planesElegibles.set(llave, planAsignado);
                    planesPorEdadCreados++;
                }
            }
            planAsignado = crearPlanFiltradoPorParentesco(planAsignado, asegurado.tipoAsegurado);
            asignarAseguradoAPlanElegible(asegurado, planAsignado);
            asignados++;
        }
    });
    estado.planes.forEach(recalcularPrimaPlan);
    guardarEstado();
    renderizarAsignacionPlanes();
    renderizarPlanesSubgrupoTabs();
    renderizarTablaCalculos();
    const detalleEdad = planesPorEdadCreados > 0 ? ` Se crearon ${planesPorEdadCreados} plan(es) con coberturas elegibles por edad.` : '';
    const detalleSinCobertura = sinCoberturasElegibles > 0 ? ` ${sinCoberturasElegibles} asegurado(s) no tienen coberturas habilitadas para su edad.` : '';
    mostrarToast(`${asignados} asegurado(s) asignado(s) por rango de valor asegurado.${detalleEdad}${detalleSinCobertura}`, sinCoberturasElegibles > 0 ? 'warning' : 'success');
    if (ajustesPorEdad.length > 0) {
        const detalle = ajustesPorEdad.slice(0, 5).join(' ');
        const adicionales = ajustesPorEdad.length > 5 ? ` Además, hay ${ajustesPorEdad.length - 5} caso(s) adicional(es).` : '';
        mostrarAlertaRango(
            `Se aplicaron restricciones de edad a ${ajustesPorEdad.length} asegurado(s). ${detalle}${adicionales}`,
            null,
            'Coberturas ajustadas por edad'
        );
    }
}

function irAlPaso(numero) {
    if (numero < 1 || numero > 7) return;
    if (numero === 3 && !validarValoresMinimosParaCotizar()) return;

    pasoActual = numero;
    pasosNavegacion();

    // Renderizado específico por paso
    if (numero === 2) {
        renderizarTablaAsegurados();
        // Para póliza nueva: ocultar tabla hasta que se carguen asegurados
        if (flujo.tipo === 'nuevo' && estado.asegurados.length === 0) {
            ocultarSeccionAsegurados();
        } else {
            mostrarSeccionAsegurados();
        }
    } else if (numero === 4) {
        renderizarAsignacionPlanes();
    } else if (numero === 5) {
        renderizarTablaCalculos();
    } else if (numero === 6) {
        renderizarPlanesSubgrupoTabs();
    } else if (numero === 7) {
        renderizarDashboard();
    }

    guardarEstado();
}

function recalcularTodo() {
    // Recalcular primas de todos los planes activos
    estado.planes.forEach(plan => recalcularPrimaPlan(plan));

    // Re-renderizar vistas activas
    renderizarTablaCoberturas();
    renderizarTablaAsegurados();
    renderizarTablaCalculos();
    if (subgrupoActivoEnPlanes) renderizarPlanesWorkspace(subgrupoActivoEnPlanes);
    renderizarDashboard();
    guardarEstado();
}

/* ============================================================
   FUNCIONES AUXILIARES
   ============================================================ */

function generarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatearDinero(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
}

function parsearValorAsegurado(valor) {
    if (typeof valor === 'number') return valor;
    return Number(String(valor ?? '').replace(/[^0-9]/g, ''));
}

function obtenerValorAseguradoBase(asegurado) {
    const coberturaVida = asegurado.coberturas?.find(cobertura =>
        cobertura.codigo === 'WET' || cobertura.codigo === 'VID' || cobertura.codigo === 'VIDA'
    );
    return coberturaVida?.valorAsegurado || 0;
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensaje;
        toast.className = `toast show ${tipo}`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

function generarCoberturasPorDefecto(valorVida = 0) {
    return estado.coberturasCatalogo.map(c => {
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

function modalConfigCoberturas(idAsegurado) {
    const asegurado = estado.asegurados.find(a => a.id === idAsegurado);
    if (!asegurado) return;

    const modal = document.getElementById('modalCoberturas');
    if (!modal) return;

    let html = `<div class="form-grid">`;
    asegurado.coberturas.forEach(cob => {
        html += `
            <div class="form-group">
                <label>
                    <input type="checkbox" ${cob.activa ? 'checked' : ''} 
                           onchange="toggleCobertura('${idAsegurado}', '${cob.codigo}', this.checked)">
                    ${cob.nombre}
                </label>
                <input type="number" step="1000000" placeholder="Valor Asegurado"
                       value="${cob.valorAsegurado}" 
                       onchange="actualizarCobertura('${idAsegurado}', '${cob.codigo}', 'valor', this.value)"
                       ${!cob.activa ? 'disabled' : ''}>
                  <small class="text-muted">Tasa base del sistema: ${cob.tasa}</small>
                <small class="text-muted">Prima: ${formatearDinero(cob.prima)}</small>
            </div>
        `;
    });
    html += `</div>`;

    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.innerHTML = html;
    }

    modal.style.display = 'flex';
}

function toggleCobertura(idAsegurado, codigo, activa) {
    const asegurado = estado.asegurados.find(a => a.id === idAsegurado);
    if (asegurado) {
        const cobertura = asegurado.coberturas.find(c => c.codigo === codigo);
        if (cobertura) {
            cobertura.activa = activa;
            if (!activa) cobertura.valorAsegurado = 0;
            recalcularTodo();
        }
    }
}

function actualizarCobertura(idAsegurado, codigo, campo, valor) {
    const asegurado = estado.asegurados.find(a => a.id === idAsegurado);
    if (asegurado) {
        const cobertura = asegurado.coberturas.find(c => c.codigo === codigo);
        if (cobertura) {
            if (campo === 'valor') cobertura.valorAsegurado = parseFloat(valor) || 0;
            cobertura.tasa = TASA_BASE_SISTEMA;
            cobertura.prima = calcularPrimaCobertura(cobertura, cobertura.valorAsegurado, asegurado.edad);
            recalcularTodo();
        }
    }
}

function cargarDemoData() {
    if (confirm('¿Deseas cargar 15 asegurados de demostración?')) {
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
                coberturas: estado.coberturasCatalogo.map(c => ({
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

            estado.asegurados.push(asegurado);
        });

        recalcularTodo();
        mostrarToast('Datos de demostración cargados (15 asegurados)', 'success');
    }
}

function exportarResumen() {
    const resumen = {
        poliza: estado.poliza,
        coberturas: estado.coberturasCatalogo.map(cobertura => ({
            Codigo_Amparo_Op: cobertura.codigo,
            Codigo_Amparo: cobertura.codigoAmparo,
            Amparo_Detallado: cobertura.nombre,
            tasaBase: cobertura.tasaBase,
            obligatoria: cobertura.obligatoria
        })),
        estadisticas: {
            totalAsegurados: estado.asegurados.length,
            totalSubgrupos: estado.subgrupos.length,
            totalPlanes: estado.planes.length,
            primaMensual: calcularPrimaTotal(),
            primaAnual: calcularPrimaTotal() * 12,
            nivelComplejidad: calcularNivelComplejidad()
        },
        resumenPor: {
            subgrupos: estado.subgrupos.map(sg => ({
                coberturas: sg.coberturas,
                asegurados: sg.asegurados.length,
                planes: estado.planes.filter(p => p.subgrupoId === sg.id).length
            }))
        }
    };

    const datauri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resumen, null, 2));
    const element = document.createElement('a');
    element.setAttribute('href', datauri);
    element.setAttribute('download', 'resumen_cotizacion.json');
    element.click();
    mostrarToast('Resumen exportado como JSON', 'success');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializar);
