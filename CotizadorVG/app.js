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
    CANAL_COMERCIAL: ['Directo', 'Broker', 'Corredor', 'Digital'],
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
        minAsegurados: 3,
        tolerancia: 0.1 // 10%
    }
};

const coberturasCatalogo = [
    { codigo: 'VIDA', nombre: 'Vida', tasaBase: 0.8, obligatoria: true },
    { codigo: 'INV', nombre: 'Invalidez', tasaBase: 0.3, obligatoria: false },
    { codigo: 'EG', nombre: 'Enfermedades Graves', tasaBase: 1.2, obligatoria: false },
    { codigo: 'MA', nombre: 'Muerte Accidental', tasaBase: 0.2, obligatoria: false },
    { codigo: 'RHD', nombre: 'Responsabilidad Civil', tasaBase: 0.5, obligatoria: false },
    { codigo: 'EXE', nombre: 'Exequias', tasaBase: 0.15, obligatoria: false }
];

/* ============================================================
   SECCIÓN 2: ESTADO GLOBAL
   ============================================================ */

let estado = {
    poliza: {
        id: generarUUID(),
        tomador: '',
        tipoIdentificacion: 'NIT',
        numeroIdentificacion: '',
        numeroPoliza: '',
        actividad: '',
        vigenciaDesde: '',
        vigenciaHasta: '',
        oficina: '',
        formaPago: 'Mensual',
        fechaCobro: '',
        comision: 20,
        honorarioAdmon: 0,
        honorarioPromotora: 10,
        asesor: '',
        canalComercial: 'Directo',
        observaciones: ''
    },
    coberturasCatalogo: JSON.parse(JSON.stringify(coberturasCatalogo)),
    asegurados: [],
    subgrupos: [],   // estructura explícita: { id, nombre, coberturas[], asegurados[] }
    planes: [],      // estructura: { id, subgrupoId, nombre, valoresCobertura{}, asegurados[], primaTotal }
    sugerencias: [],
    historial: []
};

let pasoActual = 1;
let demoData = null;

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
                numeroPoliza: '',
                actividad: '',
                vigenciaDesde: '',
                vigenciaHasta: '',
                oficina: '',
                formaPago: 'Mensual',
                fechaCobro: '',
                comision: 20,
                honorarioAdmon: 0,
                honorarioPromotora: 10,
                asesor: '',
                canalComercial: 'Directo',
                observaciones: ''
            },
            coberturasCatalogo: JSON.parse(JSON.stringify(coberturasCatalogo)),
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
    const modal = document.getElementById('modalAgregar');
    if (!modal) return;

    let titulo = 'Agregar Asegurado';
    let datos = {
        id: generarUUID(),
        tipoDocumento: 'Cédula',
        numeroDocumento: '',
        nombreCompleto: '',
        edad: '',
        sexo: 'Masculino',
        ocupacion: 'Administrativo',
        salario: '',
        coberturas: estado.coberturasCatalogo.map(c => ({
            codigo: c.codigo,
            nombre: c.nombre,
            activa: c.obligatoria,
            valorAsegurado: 0,
            tasa: c.tasaBase,
            prima: 0
        })),
        subgrupoId: null,
        planId: null,
        primaIndividual: 0
    };

    if (asegurado) {
        titulo = 'Editar Asegurado';
        datos = { ...asegurado };
    }

    mostrarToast(titulo + ' - Complete los datos requeridos', 'warning');
    guardarEstado();
}

function editarAsegurado(id) {
    const asegurado = estado.asegurados.find(a => a.id === id);
    if (asegurado) {
        agregarAsegurado(asegurado);
    }
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
    const cobertura = estado.coberturasCatalogo.find(c => c.codigo === codigoCobertura);
    if (!cobertura) return;

    const tasaAnterior = cobertura.tasaBase;
    const nuevaTasa = prompt(`Editar tasa base para ${cobertura.nombre}:\n(Actual: ${tasaAnterior})`, tasaAnterior);
    
    if (nuevaTasa !== null) {
        const tasa = parseFloat(nuevaTasa);
        if (!isNaN(tasa) && tasa > 0) {
            cobertura.tasaBase = tasa;
            recalcularTodo();
            mostrarToast('Cobertura actualizada', 'success');
        } else {
            mostrarToast('Valor inválido', 'error');
        }
    }
}

function agregarCobertura() {
    const nombre = prompt('Nombre de la nueva cobertura:');
    if (!nombre) return;
    
    const codigo = nombre.substring(0, 3).toUpperCase();
    const tasa = parseFloat(prompt('Tasa base (ej: 0.5):'));
    
    if (isNaN(tasa) || tasa <= 0) {
        mostrarToast('Tasa inválida', 'error');
        return;
    }
    
    estado.coberturasCatalogo.push({
        codigo: codigo,
        nombre: nombre,
        tasaBase: tasa,
        obligatoria: false
    });
    
    // Agregar cobertura a todos los asegurados
    estado.asegurados.forEach(a => {
        a.coberturas.push({
            codigo: codigo,
            nombre: nombre,
            activa: false,
            valorAsegurado: 0,
            tasa: tasa,
            prima: 0
        });
    });
    
    recalcularTodo();
    mostrarToast('Cobertura agregada', 'success');
}

function eliminarCobertura(codigo) {
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
    const factorEdad = obtenerFactorEdad(edad);
    const tasa = cobertura.tasa || cobertura.tasaBase;
    const prima = valorAsegurado * tasa * factorEdad / 100;
    return Math.round(prima * 100) / 100;
}

function calcularPrimaIndividual(asegurado) {
    let prima = 0;
    asegurado.coberturas.forEach(cob => {
        if (cob.activa && cob.valorAsegurado > 0) {
            prima += calcularPrimaCobertura(
                { tasa: cob.tasa },
                cob.valorAsegurado,
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
                    salario: parseInt(campos[6]) || 0,
                    coberturas: generarCoberturasPorDefecto(),
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0
                };

                // Validar
                const valDocumento = validarDocumento(asegurado.tipoDocumento, asegurado.numeroDocumento);
                const valEdad = validarEdad(asegurado.edad);

                if (valDocumento.valido && valEdad.valido) {
                    nuevosAsegurados.push(asegurado);
                }
            }

            estado.asegurados.push(...nuevosAsegurados);
            recalcularTodo();
            mostrarToast(`${nuevosAsegurados.length} asegurados importados correctamente`, 'success');
        } catch (err) {
            mostrarToast('Error al importar: ' + err.message, 'error');
        }
    };

    lector.readAsText(archivo);
}

function exportarAsegurados() {
    let csv = 'Tipo Doc,#Documento,Nombre,Edad,Sexo,Ocupación,Salario,Prima Individual\n';
    
    estado.asegurados.forEach(a => {
        const prima = a.primaIndividual || 0;
        csv += `${a.tipoDocumento},${a.numeroDocumento},${a.nombreCompleto},${a.edad},${a.sexo},${a.ocupacion},${a.salario},${prima}\n`;
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
    const plantilla = `Tipo Doc,#Documento,Nombre,Edad,Sexo,Ocupación,Salario
Cédula,1234567890,Juan García,35,Masculino,Administrativo,3000000
Cédula,0987654321,María López,28,Femenino,Ejecutivo,5000000
Cédula,1122334455,Carlos Rodríguez,42,Masculino,Operario,2500000`;

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
            <td>${cobertura.nombre}</td>
            <td><input type="number" step="0.01" value="${cobertura.tasaBase}" class="tasa-input" data-codigo="${cobertura.codigo}"></td>
            <td><input type="checkbox" ${cobertura.obligatoria ? 'checked' : ''} class="obligatoria-input" data-codigo="${cobertura.codigo}"></td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editarCobertura('${cobertura.codigo}')">Editar</button>
                <button class="btn btn-small btn-danger" onclick="eliminarCobertura('${cobertura.codigo}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

function renderizarTablaAsegurados() {
    const tbody = document.querySelector('.table-asegurados tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Construir opciones de subgrupo una vez
    const subgrupoOpts = '<option value="">-- Sin subgrupo --</option>' +
        estado.subgrupos.map(sg =>
            `<option value="${sg.id}">${sg.nombre} (${sg.id})</option>`
        ).join('');

    estado.asegurados.forEach(asegurado => {
        const salarioTexto = asegurado.salario > 0 ? formatearDinero(asegurado.salario) : '—';
        const esAsignado = !!asegurado.subgrupoId;

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${asegurado.numeroDocumento}</td>
            <td>${asegurado.nombreCompleto}</td>
            <td>${asegurado.edad}</td>
            <td>${salarioTexto}</td>
            <td>
                <select class="asig-subgrupo-select${esAsignado ? ' asignado' : ''}"
                    onchange="asignarSubgrupoAAsegurado('${asegurado.id}', this.value)">
                    ${subgrupoOpts}
                </select>
            </td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editarAsegurado('${asegurado.id}')">Editar</button>
                <button class="btn btn-small btn-danger" onclick="eliminarAsegurado('${asegurado.id}')">Eliminar</button>
            </td>
        `;

        // Establecer valor seleccionado
        const select = fila.querySelector('select');
        if (select) select.value = asegurado.subgrupoId || '';

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
            <p><strong>N° Póliza:</strong> ${p.numeroPoliza || '—'}</p>
            <p><strong>Vigencia:</strong> ${p.vigenciaDesde || '—'} → ${p.vigenciaHasta || '—'}</p>
            <p><strong>Asesor:</strong> ${p.asesor || '—'}</p>
            <p><strong>Canal:</strong> ${p.canalComercial || '—'}</p>
            <p><strong>Comisión:</strong> ${p.comision || 0}% | Honorario Admon: ${p.honorarioAdmon || 0}% | Promotora: ${p.honorarioPromotora || 0}%</p>
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

function setupEventListeners() {
    // Navegación de pasos
    document.querySelectorAll('.step').forEach((step, index) => {
        step.addEventListener('click', () => irAlPaso(index + 1));
    });

    // Botones de acción generales
    // Navegación por botones de siguiente en cada paso
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`btnSiguiente${i}`)?.addEventListener('click', () => irAlPaso(i + 1));
        if (i > 1) {
            document.getElementById(`btnAtras${i - 1}`)?.addEventListener('click', () => irAlPaso(i - 1));
        }
    }

    // Paso 1: Póliza - campos actualizados
    const camposPoliza = [
        'tomador', 'tipoIdentificacion', 'numeroIdentificacion', 'numeroPoliza',
        'actividad', 'vigenciaDesde', 'vigenciaHasta', 'oficina',
        'formaPago', 'fechaCobro', 'asesor', 'canalComercial', 'observaciones'
    ];
    camposPoliza.forEach(campo => {
        document.getElementById(campo)?.addEventListener('change', (e) => {
            estado.poliza[campo] = e.target.value;
            guardarEstado();
        });
    });
    ['comision', 'honorarioAdmon', 'honorarioPromotora'].forEach(campo => {
        document.getElementById(campo)?.addEventListener('change', (e) => {
            estado.poliza[campo] = parseFloat(e.target.value) || 0;
            guardarEstado();
        });
    });

    // Paso 2: Coberturas
    document.getElementById('btnAgregarCobertura')?.addEventListener('click', agregarCobertura);
    document.getElementById('btnDescargarCSV')?.addEventListener('click', generarPlantillaCSV);

    // Paso 3: Asegurados
    document.getElementById('buscadorAsegurado')?.addEventListener('input', (e) => {
        const valor = e.target.value.toLowerCase();
        const filas = document.querySelectorAll('.table-asegurados tbody tr');
        filas.forEach(fila => {
            const texto = fila.textContent.toLowerCase();
            fila.style.display = texto.includes(valor) ? '' : 'none';
        });
    });

    document.getElementById('btnAgregarAsegurado')?.addEventListener('click', () => agregarAsegurado());
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
    estado.poliza = {
        id: generarUUID(),
        tomador: '', tipoIdentificacion: 'NIT', numeroIdentificacion: '',
        numeroPoliza: '', actividad: '', vigenciaDesde: '', vigenciaHasta: '',
        oficina: '', formaPago: 'Mensual', fechaCobro: '',
        comision: 20, honorarioAdmon: 0, honorarioPromotora: 10,
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
    // Mostrar / ocultar paneles de modo en paso 4 (asegurados)
    // Para renovación, no se muestran paneles de carga ya que los datos vienen del sistema
    const panelSim   = document.getElementById('panelSimulacion');
    const panelExcel = document.getElementById('panelExcel');
    const esNuevo = flujo.tipo === 'nuevo';
    if (panelSim)   panelSim.style.display   = (esNuevo && flujo.subtipo === 'simulacion') ? 'block' : 'none';
    if (panelExcel) panelExcel.style.display  = (esNuevo && flujo.subtipo === 'cotizacion') ? 'block' : 'none';
    renderizarGruposSalariales();
    renderizarListaSubgruposConfig();
    actualizarSelectoresSubgrupos();
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
    const canales = ['Agente', 'Corredor', 'Banca Seguros', 'Directo'];

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
    estado.poliza.numeroPoliza        = poliza.numero + '-R';
    estado.poliza.actividad           = rand(actividades);
    estado.poliza.vigenciaDesde       = vigNuevaDesde;
    estado.poliza.vigenciaHasta       = vigNuevaHasta.toISOString().split('T')[0];
    estado.poliza.oficina             = rand(oficinas);
    estado.poliza.formaPago           = rand(formasPago);
    estado.poliza.fechaCobro          = fechaCobroDate.toISOString().split('T')[0];
    estado.poliza.comision            = 20;
    estado.poliza.honorarioAdmon      = 5;
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
            numeroPoliza:         estado.poliza.numeroPoliza,
            actividad:            estado.poliza.actividad,
            vigenciaDesde:        estado.poliza.vigenciaDesde,
            vigenciaHasta:        estado.poliza.vigenciaHasta,
            oficina:              estado.poliza.oficina,
            formaPago:            estado.poliza.formaPago,
            fechaCobro:           estado.poliza.fechaCobro,
            comision:             estado.poliza.comision,
            honorarioAdmon:       estado.poliza.honorarioAdmon,
            honorarioPromotora:   estado.poliza.honorarioPromotora,
            asesor:               estado.poliza.asesor
        };
        for (const [id, valor] of Object.entries(campos)) {
            const el = document.getElementById(id);
            if (el) el.value = valor;
        }
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
                coberturas: generarCoberturasPorDefecto(0), // valores vienen de planes en Step 5
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
                coberturas: generarCoberturasPorDefecto(0), // valores vienen de planes en Step 5
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

            for (let i = inicio; i < filas.length; i++) {
                const fila = filas[i];
                if (!fila || fila.every(c => c === '' || c === null || c === undefined)) continue;

                const documento    = String(fila[0] ?? '').trim();
                const edadRaw      = fila[1];
                const clasificacion = fila[2];

                if (!documento) { errores.push(`Fila ${i + 1}: documento vacío`); continue; }

                const edad = parseInt(edadRaw);
                if (isNaN(edad) || edad < 18 || edad > 100) {
                    errores.push(`Fila ${i + 1}: edad inválida (${edadRaw})`); continue;
                }

                const valDoc = validarDocumento('Cédula', documento);
                if (!valDoc.valido) { errores.push(`Fila ${i + 1}: ${valDoc.mensaje}`); continue; }

                const ocupacion = clasificacionAOcupacion(clasificacion);
                const salarioNum = parseFloat(String(clasificacion).replace(/[^0-9.]/g, ''));
                const salario = isNaN(salarioNum) ? 0 : salarioNum;
                const valorVida = salarioAValorAsegurado(salario || 2 * SMMLV);

                nuevos.push({
                    id: generarUUID(),
                    tipoDocumento: 'Cédula',
                    numeroDocumento: documento,
                    nombreCompleto: `Asegurado ${documento}`,
                    edad,
                    sexo: 'Masculino',
                    ocupacion,
                    salario,
                    coberturas: generarCoberturasPorDefecto(0), // valores vienen de planes en Step 5
                    subgrupoId: null,
                    planId: null,
                    primaIndividual: 0,
                    simulado: false
                });
            }

            estado.asegurados.push(...nuevos);
            if (nuevos.length > 0) mostrarSeccionAsegurados();
            recalcularTodo();

            const msgOk = `${nuevos.length} asegurado(s) cargado(s) correctamente.`;
            const msgErr = errores.length > 0 ? ` ${errores.length} fila(s) con error omitidas.` : '';
            mostrarToast(msgOk + msgErr, nuevos.length > 0 ? 'success' : 'error');

            if (statusDiv) {
                statusDiv.textContent = msgOk + msgErr;
                statusDiv.className = `excel-status ${nuevos.length > 0 ? 'ok' : 'error'}`;
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

function descargarPlantillaExcel() {
    if (typeof XLSX === 'undefined') {
        mostrarToast('La librería Excel no está disponible', 'error');
        return;
    }

    // Datos de la plantilla: encabezados + filas de ejemplo
    const datos = [
        ['Numero_Documento', 'Edad', 'Salario_Mensual_COP'],
        ['1012345678', 28, 2800000],
        ['1023456789', 35, 5500000],
        ['1034567890', 42, 1500000],
        ['1045678901', 31, 9000000],
        ['1056789012', 25, 2000000]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datos);

    // Ancho de columnas
    ws['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 22 }];

    // Estilo de encabezado (solo compatible con xlsx-style, pero la estructura queda)
    XLSX.utils.book_append_sheet(wb, ws, 'Asegurados');

    XLSX.writeFile(wb, 'Plantilla_Asegurados_VidaGrupo.xlsx');
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

    // Opciones de rango salarial predeterminadas
    const rangos = [
        { label: '< 2 SMMLV (< $2,600,000)', maxSalario: 2600000 },
        { label: '2 – 5 SMMLV ($2.6M – $6.5M)', maxSalario: 6500000 },
        { label: '5 – 10 SMMLV ($6.5M – $13M)', maxSalario: 13000000 },
        { label: '> 10 SMMLV (> $13M)', maxSalario: Infinity }
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
                <select class="filter-select" data-max="${rango.maxSalario}" style="width:100%;">
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
        const maxSalario = parseFloat(select.dataset.max) || Infinity;
        const subgrupoId = select.value;
        if (subgrupoId) reglas.push({ maxSalario, subgrupoId });
    });

    reglas.sort((a, b) => a.maxSalario - b.maxSalario);

    let asignados = 0;
    estado.asegurados.forEach(a => {
        const salario = a.salario || 0;
        for (const regla of reglas) {
            if (salario <= regla.maxSalario) {
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
    mostrarToast(`${asignados} asegurado(s) asignado(s) por rango salarial`, 'success');
}

/* ============================================================
   SECCIÓN 18: GESTIÓN DE PLANES Y VALORES ASEGURADOS
   ============================================================ */

function renderizarPlanesSubgrupoTabs() {
    const container = document.getElementById('planesSubgrupoTabs');
    if (!container) return;

    container.innerHTML = '';
    if (estado.subgrupos.length === 0) {
        container.innerHTML = '<p style="color:var(--color-gray);font-size:13px;">No hay subgrupos configurados. Ve al Paso 3 para crearlos.</p>';
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

    const numPlanes = estado.planes.filter(p => p.subgrupoId === subgrupoActivoEnPlanes).length + 1;

    // Valores por defecto (0)
    const valoresCobertura = {};
    subgrupo.coberturas.forEach(cod => { valoresCobertura[cod] = 0; });

    const plan = {
        id: generarUUID(),
        subgrupoId: subgrupoActivoEnPlanes,
        nombre: `Plan ${numPlanes}`,
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
            if (cob) {
                cob.valorAsegurado = plan.valoresCobertura[cod] || 0;
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

/* ---- Plan por rango salarial ---- */

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
                    <th>Rango salarial (hasta COP)</th>
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
        <td><input type="number" class="valor-aseg-input" placeholder="Ej: 2600000" step="100000" data-tipo="salario"></td>
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
        const maxSal = parseFloat(fila.querySelector('[data-tipo=salario]')?.value) || 0;
        if (maxSal <= 0) return;

        const vals = {};
        fila.querySelectorAll('[data-cod]').forEach(inp => {
            vals[inp.dataset.cod] = parseFloat(inp.value) || 0;
        });

        reglas.push({ maxSalario: maxSal, valoresCobertura: vals });
    });

    if (reglas.length === 0) {
        mostrarToast('Define al menos un rango salarial con salario > 0', 'warning');
        return;
    }

    reglas.sort((a, b) => a.maxSalario - b.maxSalario);

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
        nombre: `Plan ${i + 1} (≤ ${formatearDinero(regla.maxSalario)})`,
        valoresCobertura: regla.valoresCobertura,
        asegurados: [],
        primaTotal: 0
    }));

    // Asignar asegurados a planes según su salario
    aseguradosDelSubgrupo.forEach(a => {
        const salario = a.salario || 0;
        let planAsignado = planesCreados[planesCreados.length - 1]; // último plan para los que superen todos los rangos
        for (const plan of planesCreados) {
            const maxSal = reglas[planesCreados.indexOf(plan)].maxSalario;
            if (salario <= maxSal) { planAsignado = plan; break; }
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
    mostrarToast(`${planesCreados.length} plan(es) creado(s) por rango salarial`, 'success');
}

/* ============================================================
   FIN SECCIONES 16–18
   ============================================================ */

function inicializar() {
    cargarEstado();
    establecerFechasDefault();
    setupEventListeners();
    renderizarTablaCoberturas();
    renderizarTablaAsegurados();
    renderizarTablaSubgrupos();
    renderizarTablaPlanes();
    renderizarDashboard();

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
    const progreso = ((pasoActual - 1) / 5) * 100;
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = progreso + '%';
    }

    // Mostrar/ocultar botones de navegación apropiados
    for (let i = 1; i <= 5; i++) {
        const btnSiguiente = document.getElementById(`btnSiguiente${i}`);
        const btnAtras = document.getElementById(`btnAtras${i - 1}`);
        if (btnSiguiente) btnSiguiente.style.display = pasoActual === i ? 'inline-block' : 'none';
        if (btnAtras) btnAtras.style.display = pasoActual === i ? 'inline-block' : 'none';
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

function irAlPaso(numero) {
    if (numero < 1 || numero > 6) return;

    pasoActual = numero;
    pasosNavegacion();

    // Renderizado específico por paso
    if (numero === 3) {
        renderizarListaSubgruposConfig();
    } else if (numero === 4) {
        actualizarSelectoresSubgrupos();
        renderizarTablaAsegurados();
        // Para póliza nueva: ocultar tabla hasta que se carguen asegurados
        if (flujo.tipo === 'nuevo' && estado.asegurados.length === 0) {
            ocultarSeccionAsegurados();
        } else {
            mostrarSeccionAsegurados();
        }
    } else if (numero === 5) {
        renderizarPlanesSubgrupoTabs();
    } else if (numero === 6) {
        renderizarDashboard();
    }

    guardarEstado();
}

function recalcularTodo() {
    // Recalcular primas de todos los planes activos
    estado.planes.forEach(plan => recalcularPrimaPlan(plan));

    // Re-renderizar vistas activas
    renderizarTablaAsegurados();
    renderizarListaSubgruposConfig();
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
            if (c.codigo === 'VIDA') va = valorVida;
            else if (c.obligatoria) va = valorVida;
            // otras coberturas: por defecto 0 (el asesor las configurará)
        }
        return {
            codigo: c.codigo,
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
                <input type="number" step="0.01" placeholder="Tasa"
                       value="${cob.tasa}"
                       onchange="actualizarCobertura('${idAsegurado}', '${cob.codigo}', 'tasa', this.value)"
                       ${!cob.activa ? 'disabled' : ''}>
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
            if (campo === 'tasa') cobertura.tasa = parseFloat(valor) || cobertura.tasaBase;
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
