export const CONFIG = {
    VERSION: '1.0.0',
    VERSIONES: [1, 3, 5, 10, 20],
    OCUPACIONES: ['Ejecutivo', 'Administrativo', 'Operario', 'Independiente', 'Docente', 'Médico'],
    GENERO: ['Masculino', 'Femenino'],
    TIPO_DOCUMENTO: ['Cédula', 'Pasaporte', 'Cédula Extranjería', 'NIT'],
    TIPO_ASEGURADO: ['Afiliado principal', 'Conyugue', 'Hijos', 'Hijastros', 'Hermanos', 'Sobrinos', 'Nietos', 'Padres', 'Padrastos'],
    EDAD_MAXIMA_ASEGURADO: 70,
    GRUPOS_ASIGNACION: ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5'],
    COBERTURAS_EXCLUIDAS_POR_PARENTESCO: <Record<string, string[]>>{
        // Cónyuge y descendientes no pueden contratar estos amparos.
        Conyugue: ['IPP', 'WE6', 'WE9'],
        Hijos: ['IPP', 'WE6', 'WE9'],
        Hijastros: ['IPP', 'WE6', 'WE9'],
        Hermanos: ['IPP', 'WE6', 'WE9'],
        Sobrinos: ['IPP', 'WE6', 'WE9'],
        Nietos: ['IPP', 'WE6', 'WE9']
    },
    COBERTURAS_HABILITADAS_POR_PARENTESCO: <Record<string, string[]>>{
        // Los códigos deben corresponder a los amparos operativos del catálogo.
        Padres: ['WET', 'WEZ', 'WEN'],
        Padrastos: ['WET', 'WEZ', 'WEN']
    },
    CANAL_COMERCIAL: ['SUCURSALES', 'PROMOTORAS', 'CORREDORES'],
    FACTORES_FRACCIONAMIENTO: <Record<string, { factor: number; periodos: number }>>{
        Mensual: { factor: 0.091, periodos: 12 },
        Trimestral: { factor: 0.267, periodos: 4 },
        Semestral: { factor: 0.522, periodos: 2 },
        Anual: { factor: 0, periodos: 1 }
    },
    FACTORES_EDAD: <Record<string, number>>{
        '18-25': 0.95,
        '26-35': 1.0,
        '36-45': 1.1,
        '46-55': 1.25,
        '56-65': 1.5,
        '65+': 1.8
    },
    FACTORES_OCUPACION: <Record<string, number>>{
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

export const TASA_BASE_SISTEMA = 0.1;
export const VALOR_ASEGURADO_MAXIMO_VOLUNTARIA = 300_000_000;
export const COBERTURA_RENTA_INCAPACIDAD = 'WFA';
export const COBERTURA_RENTA_HOSPITALIZACION = 'WE7';
export const COBERTURA_RENTA_HOSPITALIZACION_UCI = 'WE8';
export const COBERTURAS_ENFERMEDADES_GRAVES = ['WEU', 'WEV'];
export const FACTORES_ENFERMEDADES_GRAVES = [0.40, 0.50, 0.60];
export const FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO = 0.60;
// Constante Z6 de credibilidad. Se centraliza aquí porque el negocio puede
// modificar estos valores (especialmente el de Rentas).
export const Z6_CREDIBILIDAD = { GENERAL: 1900, RENTAS: 950 };
export const FACTOR_REFERENCIA_CANCER_IN_SITU = 0.50;
// La tasa fuente se expresa por mil; se convierte a tasa decimal antes de calcular el recargo.
export const TASA_CANCER_IN_SITU = 0.678 / 1000;
export const RECARGO_CANCER_IN_SITU = 0.10;
export const DEDUCIBLES_RENTA_INCAPACIDAD = ['7-30', '3-30', '15-60', '14-90'];
export const DEDUCIBLE_RENTA_INCAPACIDAD_POR_DEFECTO = '7-30';
export const CAMPOS_ACTIVIDAD_POR_COBERTURA = { WET: 'field_3', WEZ: 'field_4', WE1: 'field_5', WEY: 'field_6' };


// La API entrega el nombre funcional en Amparo_Resumido_Definitivo.
// Los valores anteriores se mantienen como alias para cotizaciones ya guardadas.
export const NOMBRES_AMPARO_RESUMIDO = {
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
export const AMPAROS_RESUMIDOS_DEFINITIVOS = [
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

// Agrupaciones para ingresar la siniestralidad por cobertura y para calcular la
// credibilidad. `codigos` identifica las coberturas del grupo, `z6` la constante
// de credibilidad y `soloDetallado` indica que el grupo solo recibe credibilidad
// cuando la siniestralidad se conoce desglosada por grupo (escenario 1).
export const AGRUPACIONES_SINIESTROS = [
    { codigo: 'VIDA', nombre: 'VIDA', codigos: ['WET'], z6: Z6_CREDIBILIDAD.GENERAL, soloDetallado: false, coberturas: ['VIDA'] },
    { codigo: 'ITP', nombre: 'ITP', codigos: ['WEZ', 'WEY', 'WE0'], z6: Z6_CREDIBILIDAD.GENERAL, soloDetallado: false, coberturas: ['Invalidez o pérdida por un accidente o enfermedad', 'Invalidez Por Accidente', 'Invalidez, Pérdida O Inutilización Por Enfermedad'] },
    { codigo: 'ENFERMEDADES_GRAVES', nombre: 'ENFERMEDADES GRAVES', codigos: ['WEU', 'WEV'], z6: Z6_CREDIBILIDAD.GENERAL, soloDetallado: false, coberturas: ['Enfermedades graves Independientes', 'Enfermedades graves'] },
    { codigo: 'RENTAS_HOSPITALIZACION', nombre: 'RENTAS POR HOSPITALIZACIÓN', codigos: ['WE7', 'WE8'], z6: Z6_CREDIBILIDAD.RENTAS, soloDetallado: true, coberturas: ['Renta por hospitalización', 'Renta por hospitalización en UCI'] },
    { codigo: 'RENTAS_INCAPACIDAD', nombre: 'RENTAS POR INCAPACIDAD', codigos: ['WE9', 'WFA'], z6: Z6_CREDIBILIDAD.RENTAS, soloDetallado: true, coberturas: ['Renta Por Incapacidad Por Accidente', 'Renta por incapacidad por accidente y enfermedad'] }
];

export const GRUPOS_COBERTURAS_EXCLUYENTES = [
    ['WE9', 'WFA'],
    ['WEZ', 'WEY', 'WE0'],
    ['WEV', 'WEU']
];

export const PLANES_SUGERIDOS = [
    { nombre: 'Plan 1', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Bono funerario'] },
    { nombre: 'Plan 2', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario'] },
    { nombre: 'Plan 3', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario', 'Pérdida Parcial De La Capacidad Laboral', 'Bono Canasta', 'Gastos de curación', 'Renta por incapacidad por accidente y enfermedad'] },
    { nombre: 'Plan 4', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario', 'Pérdida Parcial De La Capacidad Laboral', 'Bono Canasta', 'Gastos de curación', 'Renta por hospitalización'] },
    { nombre: 'Plan 5', coberturas: ['Vida', 'Invalidez o pérdida por un accidente o enfermedad', 'Enfermedades graves Independientes', 'Muerte Accidental', 'Bono funerario', 'Pérdida Parcial De La Capacidad Laboral', 'Bono Canasta', 'Gastos de curación', 'Renta por hospitalización', 'Renta por incapacidad por accidente y enfermedad'] }
];

// --- T1 CalculoService
export const REGISTROS_POR_PAGINA_MAX = 100;
export const REGISTROS_POR_PAGINA_CALCULOS_MIN = 10;

// --- T2 Catalogo/Paso1
export const NOMBRES_COMERCIALES_COBERTURA: Record<string, string> = {
    WEP: 'Aux. repatriación',
    WEO: 'Aux. matern./patern.',
    WEQ: 'Bono canasta',
    WEN: 'Bono funerario',
    WES: 'Bono adec. hogar',
    WER: 'Bono educación',
    WEU: 'Enferm. graves',
    WEV: 'Enferm. graves indep.',
    WEW: 'Gastos curación',
    WEZ: 'Inval. acc./enferm.',
    WEY: 'Inval. accidente',
    WE0: 'Inval. enfermedad',
    WE1: 'Muerte accidental',
    WE6: 'Pérdida parc. capacidad',
    WE7: 'Renta hospitalización',
    WE8: 'Renta hosp. UCI',
    WE9: 'Renta incap. accidente',
    WFA: 'Renta incap. acc./enferm.',
    WET: 'Vida'
};

// --- T3 Asegurados/Importacion
export const REGISTROS_POR_PAGINA_MIN = 20;
export const SMMLV = 1_300_000; // Valor referencia 2024


// --- T4 Planes
// Rangos de valor asegurado predeterminados de la asignación de subgrupos por rango (asignarPorSalario).
export const RANGOS_ASIGNACION_SALARIO = [
    { label: 'Hasta $50.000.000', maxValorAsegurado: 50000000 },
    { label: 'Hasta $100.000.000', maxValorAsegurado: 100000000 },
    { label: 'Hasta $200.000.000', maxValorAsegurado: 200000000 },
    { label: 'Más de $200.000.000', maxValorAsegurado: Infinity }
];

// --- T5 Asignacion
// Nombres visibles de los parentescos en el detalle de restricciones del plan (obtenerDetalleRestriccionesPlan).
export const NOMBRES_PARENTESCO_RESTRICCION: Record<string, string> = { Conyugue: 'Cónyuge', Padrastos: 'Padrastros' };

// --- T6 Paso5/PDF
export const PDF_PLANES_POR_TABLA = 4;
export const PDF_PLANES_CON_TASAS_POR_TABLA = 2;

// Geometría de la página y de la portada (assets/images/encabezado-vg.png).
export const PDF_ANCHO_PX = 794;
export const PDF_ANCHO_MM = 210;
export const PDF_MARGEN_VERTICAL_MM = 10;
export const PDF_ENCABEZADO_ANCHO = 1200;
export const PDF_ENCABEZADO_ALTO = 796;
export const PDF_ENCABEZADO_URL = 'assets/images/encabezado-vg.png';

export const PDF_ESTILOS = `
.pdf-cot { width:794px; padding:0 57px 24px; background:#fff; color:#1A2E4A; font-family:'FS Joey',-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:9pt; line-height:1.4; box-sizing:border-box; }
.pdf-cot * { box-sizing:border-box; }
.pdf-cot .pdf-espacio-encabezado { width:100%; }
.pdf-cot h1 { font-size:14pt; font-style:italic; font-weight:bold; color:#2D6DF6; margin:22px 0 8px; }
.pdf-cot h2 { font-size:9pt; font-weight:bold; color:#2D6DF6; margin:14px 0 4px; }
.pdf-cot h3 { font-size:9pt; font-weight:bold; color:#2D6DF6; margin:12px 0 4px; }
.pdf-cot .b.tit { color:#2D6DF6; }
.pdf-cot p { margin:0 0 6px; }
.pdf-cot .b { font-weight:bold; }
.pdf-cot .sep-linea { border:0; border-top:1.5px solid #E3E829; width:78px; margin:4px 0 8px; }
.pdf-cot p, .pdf-cot li, .pdf-cot h1, .pdf-cot h2, .pdf-cot h3, .pdf-cot tr, .pdf-cot .keep, .pdf-cot .sep-linea,
.pdf-cot .t-req, .pdf-cot .t-edades, .pdf-cot .t-asesores, .pdf-cot .t-cg, .pdf-cot .t-pago, .pdf-cot .t-turquesa, .pdf-cot .caja-otras { break-inside:avoid; page-break-inside:avoid; }
.pdf-cot table { border-collapse:collapse; width:100%; margin-bottom:12px; table-layout:fixed; break-inside:avoid; page-break-inside:avoid; }
.pdf-cot td, .pdf-cot th { padding:4px 8px; vertical-align:top; text-align:left; font-weight:normal; word-wrap:break-word; overflow-wrap:anywhere; }
.pdf-cot img { max-width:100%; height:auto; }
.pdf-cot a { color:#2D6DF6; }
.pdf-cot .t-turquesa, .pdf-cot .t-turquesa td { border:1px solid #00AEC7; }
.pdf-cot .t-turquesa td .lbl { font-weight:bold; display:block; color:#0033A0; }
.pdf-cot .t-turquesa td.cab-azul-osc { background:#0033A0; color:#fff; font-weight:bold; letter-spacing:1px; }
.pdf-cot .t-turquesa td.cab-azul { background:#2D6DF6; color:#fff; font-weight:bold; letter-spacing:1px; }
.pdf-cot .t-planes { font-size:8.5pt; color:#1A2E4A; }
.pdf-cot .t-planes, .pdf-cot .t-planes td { border:1px solid #B4B4B5; }
.pdf-cot .t-planes td { padding:3px 5px; }
.pdf-cot .t-planes td.titulo { background:#0033A0; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-planes tr.cab td { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-planes tr.cab td:first-child { text-align:left; }
.pdf-cot .t-planes tr.subcab td { background:#D6E4FF; color:#0033A0; font-weight:bold; text-align:center; font-size:7.5pt; }
.pdf-cot .t-planes tr.seccion td { background:#DFEAFF; color:#0033A0; font-weight:bold; }
.pdf-cot .t-planes tr.total td { font-weight:bold; background:#F9FAE1; color:#0033A0; }
.pdf-cot .t-planes td.m { text-align:right; white-space:normal; overflow-wrap:anywhere; }
.pdf-cot .t-planes td.c { text-align:center; }
.pdf-cot .t-planes td.v { background:#F9FAE1; color:#0033A0; font-weight:bold; text-align:center; white-space:normal; overflow-wrap:anywhere; word-break:break-word; }
.pdf-cot .t-req, .pdf-cot .t-req td, .pdf-cot .t-req th { border:1px solid #B4B4B5; }
.pdf-cot .t-req th { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; vertical-align:middle; }
.pdf-cot .t-req td { color:#1A2E4A; text-align:center; }
.pdf-cot .t-req td:first-child { text-align:left; }
.pdf-cot .t-edades th { background:#2D6DF6; color:#fff; font-weight:bold; padding:6px 8px; }
.pdf-cot .t-edades td { color:#1A2E4A; border:1px solid #B4B4B5; }
.pdf-cot .t-edades td.c { text-align:center; vertical-align:middle; }
.pdf-cot .t-edades td.c small { font-size:7.5pt; }
.pdf-cot .t-edades th:nth-child(n+2) { text-align:center; }
.pdf-cot .caja-otras { border:1px solid #2D6DF6; min-height:70px; margin-bottom:8px; }
.pdf-cot .t-asesores, .pdf-cot .t-asesores td, .pdf-cot .t-asesores th { border:1px solid #2D6DF6; }
.pdf-cot .t-asesores th.cab1 { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-asesores th.cab2 { background:#0033A0; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-asesores td { text-align:center; height:24px; }
.pdf-cot .t-cg, .pdf-cot .t-cg td, .pdf-cot .t-cg th { border:1px solid #2D6DF6; }
.pdf-cot .t-cg th.cab1 { background:#0033A0; color:#fff; font-weight:bold; border-color:#00AEC7; }
.pdf-cot .t-cg th.cab2 { background:#2D6DF6; color:#fff; font-weight:bold; text-align:center; }
.pdf-cot .t-cg td { height:26px; }
.pdf-cot .t-pago, .pdf-cot .t-pago td { border:0; }
.pdf-cot ul, .pdf-cot ol { margin:4px 0 8px; padding-left:22px; }
.pdf-cot li { margin-bottom:3px; }
.pdf-cot .nota-tabla { font-size:8pt; color:#888B8D; margin:-6px 0 10px; }
.pdf-cot .pdf-campo-pendiente { color:#2D6DF6; font-weight:bold; }
.pdf-cot .pdf-fila-programa { display:flex; align-items:center; gap:10px; margin:10px 0 3px; break-inside:avoid; page-break-inside:avoid; }
.pdf-cot .pdf-icono-programa { flex:0 0 100px; width:100px; height:100px; object-fit:contain; }
.pdf-cot .pdf-fila-programa h2 { margin:0; }
.pdf-cot .pdf-programa-descripcion { margin:0 0 8px 110px !important; color:#2D6DF6; }
.pdf-cot .pdf-texto-qr { margin:12px 0 4px 110px !important; color:#2D6DF6; }
.pdf-cot .pdf-qr { display:block; width:254px; height:254px; object-fit:contain; margin:10px 0 14px 110px; }
`;

// --- T7 Flujo
export const CLAVE_POLIZA_RENOVACION = 'polizaRenovacionSeleccionada';
export const TIPO_IDENTIFICACION_POR_PREFIJO: Record<string, string> = { C: 'CC', E: 'CE', A: 'NIT' };
