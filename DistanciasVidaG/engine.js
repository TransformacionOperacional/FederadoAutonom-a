/* engine.js — Motor de cálculos para Tablero Suscripción Vida Grupo */

// Estado global
let RAW_DATA = [];
let PREPARED_DATA = [];
let COLUMN_MAP = {};
let FILTERS_INITIALIZED = false; // Flag para evitar reinicializar Tom Select

// Mapeo de columnas - alias para encontrar las columnas correctas en el Excel
const COLUMN_ALIASES = {
  poliza: ["NUMERO_POLIZA", "Nro poliza limpio", "Nro póliza limpio", "NRO POLIZA LIMPIO", "Nro Poliza Limpio", "Poliza", "Póliza"],
  dni_tomador: ["DNI_TOMADOR", "DNI TOMADOR", "Documento Tomador", "DOCUMENTO_TOMADOR"],
  nombre_tomador: ["NOMBRE_TOMADOR", "NOMBRE TOMADOR", "Tomador", "NOMBRE DEL TOMADOR"],
  canal: ["NOMBRE_CANAL_COMERCIAL", "NOMBRE_GRUPO_CANAL_COMERCIAL", "CANAL LIMPIO", "Canal limpio", "Canal", "CANAL"],
  canal_nombre: ["NOMBRE_CANAL_COMERCIAL", "CANAL LIMPIO", "Canal limpio"],
  regional: ["REGIONAL", "NOMBRE_SUCURSAL", "Regional", "Regional limpio", "REGIONAL LIMPIO"],
  regional_nombre: ["REGIONAL", "NOMBRE_SUCURSAL"],
  clasificacion: ["Clasificacion Asegurados", "Clasificación Asegurados", "CLASIFICACION ASEGURADOS"],
  director: ["DIRECTOR", "NOMBRE_ASESOR", "Director Comercial", "DIRECTOR COMERCIAL"],
  director_nombre: ["DIRECTOR", "NOMBRE_ASESOR"],
  asesor_corredor: ["CODIGO_ASESOR", "NOMBRE_ASESOR", "Asesor/Corredor", "ASESOR/CORREDOR"],
  asesor_nombre: ["NOMBRE_ASESOR", "NOMBRE_ASESOR"],
  oficina: ["CODIGO_OFICINA", "NOMBRE_SUCURSAL", "Oficina", "OFICINA"],
  oficina_nombre: ["NOMBRE_SUCURSAL", "NOMBRE_SUCURSAL"],
  producto: ["CLASIFICACION", "Clasificacion", "Clasificación"],
  nueva_o_renovada: ["NUEVA_O_RENOVADA", "NUEVA O RENOVADA", "Nueva o renovada"],
  cant_asegurados: ["NUMERO_ASEGURADOS", "Cant asegurados", "CANT ASEGURADOS"],
  valor_asegurado: ["VALOR_ASEGURADO_VIDA", "VALOR_ASEGURADO_TOTAL", "VA_VIDA_MANU", "Valor asegurado"],
  tc_actual: ["TASA_ACTUAL", "TC Actual", "TC ACTUAL"],
  tc6: ["TC6", "TC_6", "TC 6"],
  prima_actual: ["VALOR_PRIMA_TOTAL", "Prima actual", "Prima Actual", "PRIMA ACTUAL"],
  tpr_ponderada: ["TPR_PONDERADA_POR_PERSONA", "TPR_SOLO_VIDA", "Tasa Ponderada"],
  fecha: ["FECHA_INICIO_PRIMERA_VIGENCIA", "FECHA INICIO PRIMERA VIGENCIA", "Fecha inicio primera vigencia", "FECHA_PRIMERA_VIGENCIA", "FECHA PRIMERA VIGENCIA", "Fecha primera vigencia", "FECHA DE PRIMERA VIGENCIA", "Fecha de primera vigencia", "FECHA_EMISION", "FECHA INICIO VIGENCIA", "FECHA_INICIO_VIGENCIA", "FECHA_VIGENCIA", "FECHA", "Fecha emisión", "Fecha inicio vigencia", "Fecha"],
  fecha_corte: ["FECHA_CORTE", "FECHA CORTE", "Fecha corte", "FECHA_CARGA", "FECHA CARGA", "Fecha carga"],
};

// Colores de la paleta SURA
const COLORS = {
  primaBruto: "#0033A0",
  primaSugerida: "#5B93FF",
  deficit: "#B42318",
  suficiencia: "#067647",
};

const FILTER_SPECS = [
  ["poliza", "poliza", "Número de póliza"],
  ["tomador", "tomador", "tomador"],
  ["exclusion_tomador", "tomador", "tomadores a excluir"],
  ["regional", "regional", "Regional"],
  ["canal", "canal", "Canal"],
  ["clasificacion", "clasificacion", "Clasificación Asegurados"],
  ["depurar_polizas", "depurar_polizas", "Exclusio innominadas por asegurado"],
  ["director", "director", "Director Comercial"],
  ["asesor_corredor", "asesor_corredor", "Asesor/Corredor"],
  ["oficina", "oficina", "Oficina"],
  ["producto", "producto", "Producto"],
  ["nueva_o_renovada", "nueva_o_renovada", "Nueva o renovada"],
  ["estado_tecnico", "estado_tecnico", "Estado Técnico"],
];

let FILTERS_REFRESHING = false;
let ACTIVE_FILTER_PICKER = null;

// ====================================================
// UTILIDADES DE LIMPIEZA Y FORMATO
// ====================================================

function stripAccents(text) {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeCol(text) {
  return stripAccents(String(text))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ");
}

function normalizeKey(text) {
  return stripAccents(String(text))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers, candidates) {
  const exactMap = {};
  const softMap = {};
  const compactMap = {};

  headers.forEach(h => {
    const orig = String(h).trim();
    exactMap[orig] = h;
    softMap[normalizeCol(h)] = h;
    compactMap[normalizeKey(h)] = h;
  });

  for (const c of candidates) {
    if (exactMap[c]) return exactMap[c];
  }
  for (const c of candidates) {
    if (softMap[normalizeCol(c)]) return softMap[normalizeCol(c)];
  }
  for (const c of candidates) {
    if (compactMap[normalizeKey(c)]) return compactMap[normalizeKey(c)];
  }
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;

  let str = String(value).trim()
    .replace(/\$|%|%|\s/g, "")
    .replace(/[^0-9,.\-]/g, "");

  if (str === "" || str === "-" || str === "." || str === ",") return NaN;

  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    str = str.replace(",", ".");
  } else if (dotCount > 1 && commaCount === 0) {
    str = str.replace(/\./g, "");
  }

  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number" && value > 20_000 && value < 100_000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(value)));
  }

  const text = String(value).trim();
  const colombianDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (colombianDate) {
    const [, day, month, year] = colombianDate;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(Date.UTC(Number(fullYear), Number(month) - 1, Number(day)));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCurrentRenewalDate(firstEffectiveDate, referenceDate = new Date()) {
  if (!firstEffectiveDate) return null;

  const currentYear = referenceDate.getUTCFullYear();
  const month = firstEffectiveDate.getUTCMonth();
  const day = firstEffectiveDate.getUTCDate();
  const buildAnniversary = (year) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  };

  const today = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  ));
  const anniversary = buildAnniversary(currentYear);

  // Si el aniversario de este año aún no ocurre, pertenece al ciclo iniciado el año anterior.
  return anniversary > today ? buildAnniversary(currentYear - 1) : anniversary;
}

function cleanText(value, defaultVal = "SIN DATO") {
  if (value === null || value === undefined) return defaultVal;
  const str = String(value).trim();
  if (str === "" || str.toUpperCase() === "NA" || str.toUpperCase() === "N/A") return defaultVal;
  return str;
}

function canonicalClasificacion(value) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const key = stripAccents(raw).toUpperCase().replace(/\s+/g, "");

  if (key === "" || ["NA", "N/A", "NAN", "NONE", "NULL", "<NA>"].includes(key)) return null;
  if (key.includes("200") && !key.includes("6A1")) return "<200";
  if (key.includes("200") || key.includes("MAYOR")) return ">200";
  if (key.includes("CORRED")) return "CORREDORES";
  return raw.toUpperCase();
}

function formatInt(value) {
  if (isNaN(value)) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value, decimals = 1) {
  if (isNaN(value)) return "—";
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

function formatRate(value) {
  if (isNaN(value)) return "—";
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value);
}

function formatRateAdjustment(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatDecimal(value * 100, 2)}%`;
}

function isBrokerChannel(canal) {
  return String(canal || "").toUpperCase().includes("CORRED");
}

function calculateRateAdjustment(tcActual, tcObjetivo, cantAsegurados = 0, canal = "") {
  if (!Number.isFinite(tcActual) || !Number.isFinite(tcObjetivo) || tcActual <= 0) {
    return NaN;
  }

  const ajusteRequerido = (tcObjetivo - tcActual) / tcActual;

  // CORREDORES conserva siempre el ajuste real. Para los demás canales,
  // los topes técnicos aplican solo a negocios con menos de 100 asegurados.
  if (!isBrokerChannel(canal) && cantAsegurados < 100) {
    return Math.max(-0.05, Math.min(0.20, ajusteRequerido));
  }

  return ajusteRequerido;
}

function formatMoney(value, unit) {
  if (isNaN(value)) return "—";
  const val = value / unit.divisor;
  const absVal = Math.abs(val);
  const decimals = absVal >= 100 ? 0 : 1;
  return `$${formatDecimal(val, decimals)}${unit.suffix}`;
}

function chooseMoneUnit(values) {
  const nums = values.filter(v => !isNaN(v) && v !== null).map(v => Math.abs(parseNumber(v)));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  if (max < 1_000_000) {
    return { divisor: 1_000, suffix: " mil", label: "Miles COP", fullLabel: "miles de pesos", isThousands: true };
  }
  return { divisor: 1_000_000, suffix: " M", label: "Millones COP", fullLabel: "millones de pesos", isThousands: false };
}

// ====================================================
// CARGA Y PREPARACIÓN DE DATOS
// ====================================================

async function loadData() {
  try {
    console.log("📡 Conectando a Power Automate API...");
    
    const POWER_AUTOMATE_API = "https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c5659a25448f4f7489313dab7e332cd2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=kdQqNqYfx1CiI3N9p_UI4SwjxJMTmhk7peWzEGTZ7hQ";
    
    // Credenciales para la API
    const credentials = {
      usuario: "DistanciasVG",
      contrasena: "Sura2025*"
    };
    
    console.log("📤 Enviando solicitud a Power Automate...");
    console.log(`🌐 URL: ${POWER_AUTOMATE_API}`);
    
    // Hacer fetch directamente a Power Automate API
    const response = await fetch(POWER_AUTOMATE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(credentials)
    });
    
    console.log(`📬 Respuesta recibida: HTTP ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Obtener la respuesta y loguear para debuggear
    let responseData = await response.json();
    console.log("📦 Respuesta recibida - Estructura completa:", {
      statusCode: responseData.statusCode,
      tieneBody: !!responseData.body,
      tieneTable1: !!responseData.body?.Table1,
      tabla1IsArray: Array.isArray(responseData.body?.Table1)
    });
    
    // Extraer datos de body.Table1
    if (responseData.body && responseData.body.Table1 && Array.isArray(responseData.body.Table1)) {
      responseData = responseData.body.Table1;
      console.log(`✅ Datos extraídos de body.Table1: ${responseData.length} registros`);
    } else if (!Array.isArray(responseData)) {
      console.warn("⚠️  La respuesta no está en el formato esperado");
      console.log("🔍 Estructura:", Object.keys(responseData));
      
      // Buscar en propiedades comunes
      const commonProps = ['data', 'value', 'records', 'items', 'rows', 'results', 'Table1'];
      let found = false;
      for (let prop of commonProps) {
        if (responseData[prop] && Array.isArray(responseData[prop])) {
          console.log(`✅ Encontrados datos en: ${prop}`);
          responseData = responseData[prop];
          found = true;
          break;
        } else if (responseData[prop] && responseData[prop].Table1 && Array.isArray(responseData[prop].Table1)) {
          console.log(`✅ Encontrados datos en: ${prop}.Table1`);
          responseData = responseData[prop].Table1;
          found = true;
          break;
        }
      }
      
      if (!found) {
        throw new Error(`Estructura de datos no reconocida. Claves disponibles: ${Object.keys(responseData).join(', ')}`);
      }
    }
    
    // Validar que tenemos un array
    if (!Array.isArray(responseData)) {
      throw new Error(`Los datos no son un array. Tipo recibido: ${typeof responseData}`);
    }
    
    // Guardar solo resumen en localStorage (para no exceder cuota)
    try {
      const summary = {
        count: responseData.length,
        timestamp: new Date().toISOString(),
        firstRecordKeys: responseData.length > 0 ? Object.keys(responseData[0]) : [],
        sample: responseData.length > 0 ? responseData[0] : null
      };
      localStorage.setItem('apiResponseSummary', JSON.stringify(summary));
      console.log("💾 Resumen de respuesta guardado en localStorage");
    } catch (e) {
      console.warn("⚠️  No se pudo guardar en localStorage:", e.message);
    }
    
    RAW_DATA = responseData;
    console.log(`✅ ${RAW_DATA.length} registros cargados desde API`);
    
    if (RAW_DATA.length === 0) {
      console.warn("⚠️  No hay registros en la respuesta");
    }
    
    buildColumnMap();
    prepareData();
    initFilters();
    return true;
  } catch (error) {
    console.error("❌ Error cargando datos desde API:", error);
    console.error("📋 Detalles del error:", error.message);
    
    // Mensajes de diagnóstico específicos
    if (error.message.includes("Failed to fetch")) {
      console.error("❌ Error de conexión");
      console.error("   → Verifica conexión a internet");
      console.error("   → Verifica que Power Automate sea accesible");
    } else if (error.message.includes("NetworkError")) {
      console.error("❌ Error de red");
      console.error("   → Verifica conexión a internet");
      console.error("   → Verifica que Power Automate sea accesible");
    } else if (error.message.includes("HTTP")) {
      console.error("❌ Error en la API de Power Automate");
      console.error("   → Verifica las credenciales");
      console.error("   → Verifica que la URL sea correcta");
    } else if (error.message.includes("no es un array")) {
      console.error("❌ Estructura de respuesta inesperada");
      console.error("   → La API retorna un objeto, no un array");
      console.error("   → Necesita ajuste en buildColumnMap()");
    }
    
    return false;
  }
}

function buildColumnMap() {
  if (RAW_DATA.length === 0) return;

  const headers = Object.keys(RAW_DATA[0]);
  COLUMN_MAP = {};

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    COLUMN_MAP[canonical] = findColumn(headers, aliases);
  }
}

function prepareData() {
  console.log("🔄 Procesando datos...");
  
  PREPARED_DATA = RAW_DATA.map((row, index) => {
    try {
      // Helper para obtener valores del mapa de columnas
      const get = (key, type = "text", defaultVal = null) => {
        const col = COLUMN_MAP[key];
        if (!col || !(col in row)) return defaultVal;
        const value = row[col];

        if (type === "number") return parseNumber(value);
        if (type === "text") return cleanText(value, defaultVal || "SIN DATO");
        return value;
      };

      // Datos básicos
      const poliza = get("poliza", "text", "SIN PÓLIZA");
      const dni_tomador = get("dni_tomador", "text", "");
      const nombre_tomador = get("nombre_tomador", "text", "SIN TOMADOR");
      const tomador = dni_tomador
        ? `${dni_tomador} - ${nombre_tomador}`
        : nombre_tomador;
      const cant_asegurados = get("cant_asegurados", "number", 0);
      const valor_asegurado = get("valor_asegurado", "number", 0);
      const tc_actual = get("tc_actual", "number", 0);
      const tc6 = get("tc6", "number", 0);
      const prima_actual = get("prima_actual", "number", 0);
      const tpr_ponderada = get("tc6", "number", tc_actual); // Usar TC6 como tasa ponderada
      const fecha_primera_vigencia = parseDate(get("fecha", "raw", null));
      const fecha_corte = parseDate(get("fecha_corte", "raw", null));
      const fecha_renovacion = getCurrentRenewalDate(fecha_primera_vigencia);
      const periodo = fecha_renovacion
        ? `${fecha_renovacion.getUTCFullYear()}-${String(fecha_renovacion.getUTCMonth() + 1).padStart(2, "0")}`
        : null;

      // Información de intermediarios y oficinas con nombres descriptivos
      const canal = get("canal", "text", "SIN CANAL").toUpperCase();
      const canal_nombre = get("canal_nombre", "text", canal);
      
      const regional = get("regional", "text", "SIN REGIONAL").toUpperCase();
      const regional_nombre = get("regional_nombre", "text", regional);
      
      const director = get("director", "text", "SIN DIRECTOR");
      const director_nombre = get("director_nombre", "text", director);
      
      // Asesor/Corredor: Concatenar código + nombre
      const asesor_codigo = get("asesor_corredor", "text", "");
      const asesor_nombre_raw = get("asesor_nombre", "text", "");
      const asesor_corredor = asesor_codigo && asesor_nombre_raw ? 
        `${asesor_codigo} - ${asesor_nombre_raw}` : 
        (asesor_codigo || asesor_nombre_raw || "SIN INTERMEDIARIO");
      const asesor_nombre = asesor_nombre_raw || asesor_codigo || "SIN INTERMEDIARIO";
      
      // Oficina: Concatenar código + nombre sucursal
      const oficina_codigo = get("oficina", "text", "");
      const oficina_nombre_raw = get("oficina_nombre", "text", "");
      const oficina = oficina_codigo && oficina_nombre_raw ? 
        `${oficina_codigo} - ${oficina_nombre_raw}` : 
        (oficina_codigo || oficina_nombre_raw || "SIN OFICINA");
      const oficina_nombre = oficina_nombre_raw || oficina_codigo || "SIN OFICINA";

      const producto = get("producto", "text", "SIN PRODUCTO");
      const nueva_o_renovada = get("nueva_o_renovada", "text", "SIN DATO");

      // Estimar clasificación según número de asegurados
      const clasificacion = cant_asegurados < 100 ? "<100" : ">100";
      
      // Estimar prima sugerida basada en tasas ponderadas
      // Prima sugerida = (TPR_PONDERADA * Valor_Asegurado) / 1000
      const prima_sugerida = (tpr_ponderada * valor_asegurado) / 1000;
      
      // Cálculos
      const ajuste_tasa = calculateRateAdjustment(tc_actual, tc6, cant_asegurados, canal);
      const brecha_prima = prima_actual - prima_sugerida;
      const cumplimiento_prima = prima_sugerida > 0 ? prima_actual / prima_sugerida : 0;
      const estado_tecnico = brecha_prima < 0 ? "Déficit vs sugerida" : "Superávit vs sugerida";

      // Canal para ranking
      let canal_ranking = canal;
      if (canal.includes("ASESOR") || canal.includes("PROMOTORA") || canal.includes("SUCURSAL")) {
        canal_ranking = clasificacion === "<100" ? "ASESORES <100" : "ASESORES >100";
      } else if (canal.includes("CORRED")) {
        canal_ranking = "CORREDORES";
      }

      return {
        poliza,
        tomador,
        nombre_tomador,
        regional,
        regional_nombre,
        canal,
        canal_nombre,
        canal_ranking,
        clasificacion,
        director,
        director_nombre,
        asesor_corredor,
        asesor_nombre,
        oficina,
        oficina_nombre,
        producto,
        nueva_o_renovada,
        cant_asegurados,
        valor_asegurado,
        tc_actual,
        tc6,
        ajuste_tasa,
        tpr_ponderada,
        prima_actual,
        prima_sugerida,
        brecha_prima,
        cumplimiento_prima,
        estado_tecnico,
        fecha_primera_vigencia,
        fecha_corte,
        fecha_renovacion,
        periodo,
      };
    } catch (error) {
      console.error(`Error procesando fila ${index}:`, error);
      return null;
    }
  }).filter(r => r !== null);
  
  console.log(`✅ ${PREPARED_DATA.length} registros procesados correctamente`);
}

// ====================================================
// FILTRADO Y OPCIONES
// ====================================================

function getFilterOptions(column, rows = PREPARED_DATA) {
  if (column === "depurar_polizas") {
    return ["1", "2", "3", "4", "5"];
  }

  const options = new Set();
  rows.forEach(row => {
    const value = row[column];
    if (value && value !== "SIN DATO") options.add(value);
  });
  return Array.from(options).sort();
}

function getLatestCutoffDate() {
  const dates = PREPARED_DATA
    .map(row => row.fecha_corte)
    .filter(date => date instanceof Date && !Number.isNaN(date.getTime()));

  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(date => date.getTime())));
}

function getSelectValues(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return [];

  if (select.tomselect) {
    const values = select.tomselect.items;
    return Array.isArray(values) ? values : [];
  }

  return Array.from(select.selectedOptions).map(option => option.value);
}

function getFilterSelectionsFromDom() {
  return Object.fromEntries(
    FILTER_SPECS.map(([fieldKey]) => [fieldKey, getSelectValues(`filter_${fieldKey}`)])
  );
}

function filterData(selections) {
  return PREPARED_DATA.filter(row => {
    for (const [col, selected] of Object.entries(selections)) {
      if (col === "depurar_polizas") {
        if (selected?.includes(String(row.cant_asegurados))) {
          return false;
        }
        continue;
      }

      if (col === "exclusion_tomador") {
        if (selected?.includes(row.tomador)) {
          return false;
        }
        continue;
      }

      if (selected && selected.length > 0 && !selected.includes(row[col])) {
        return false;
      }
    }
    return true;
  });
}

function refreshFilterOptions() {
  const selections = getFilterSelectionsFromDom();

  FILTER_SPECS.forEach(([fieldKey, dataCol]) => {
    const select = document.getElementById(`filter_${fieldKey}`);
    if (!select) return;

    const currentValues = getSelectValues(`filter_${fieldKey}`);
    const otherSelections = { ...selections };
    delete otherSelections[fieldKey];

    const activeSelections = Object.fromEntries(
      Object.entries(otherSelections).filter(([, values]) => Array.isArray(values) && values.length > 0)
    );

    const filteredRows = filterData(activeSelections);
    const options = getFilterOptions(dataCol, filteredRows);
    const validCurrentValues = currentValues.filter(value => options.includes(value));

    if (select.tomselect) {
      select.tomselect.clearOptions();
      options.forEach(option => {
        select.tomselect.addOption({ value: option, text: option });
      });
      select.tomselect.refreshOptions(false);

      if (validCurrentValues.length > 0) {
        select.tomselect.setValue(validCurrentValues, true);
      } else {
        select.tomselect.clear(true);
      }
    } else {
      select.innerHTML = '';
      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        optionElement.selected = validCurrentValues.includes(option);
        select.appendChild(optionElement);
      });
    }
  });
}

function resetFilterSelections() {
  FILTERS_REFRESHING = true;
  try {
    FILTER_SPECS.forEach(([fieldKey]) => {
      const select = document.getElementById(`filter_${fieldKey}`);
      if (!select) return;

      if (select.tomselect) {
        select.tomselect.clear(true);
      } else {
        Array.from(select.options).forEach(option => {
          option.selected = false;
        });
        select.value = '';
      }
    });

    refreshFilterOptions();
    syncAllFilterPickerButtons();
  } finally {
    FILTERS_REFRESHING = false;
  }
}

function handleFilterChange() {
  if (FILTERS_REFRESHING) return;

  FILTERS_REFRESHING = true;
  try {
    refreshFilterOptions();
    syncAllFilterPickerButtons();
    if (typeof window !== 'undefined' && typeof window.updateDashboard === 'function') {
      window.updateDashboard();
    }
  } finally {
    FILTERS_REFRESHING = false;
  }
}

function syncFilterPickerButton(select) {
  const button = select?.closest('.filter-wrap')?.querySelector('.filter-picker-button');
  if (!button) return;

  const values = getSelectValues(select.id);
  const placeholder = select.getAttribute('placeholder') || 'Seleccionar opciones...';
  button.textContent = values.length === 0
    ? placeholder
    : values.length === 1
      ? values[0]
      : `${values.length} opciones seleccionadas`;
  button.classList.toggle('has-selection', values.length > 0);
}

function syncAllFilterPickerButtons() {
  FILTER_SPECS.forEach(([fieldKey]) => syncFilterPickerButton(document.getElementById(`filter_${fieldKey}`)));
}

function normalizeSearchText(value) {
  return stripAccents(String(value || '')).toLocaleLowerCase('es-CO');
}

function closeFilterPickers(except = null) {
  document.querySelectorAll('.filter-picker-dropdown').forEach(dropdown => {
    if (dropdown !== except) dropdown.hidden = true;
  });
  if (!except) ACTIVE_FILTER_PICKER = null;
}

function createFilterPicker(select) {
  const dropdown = document.createElement('div');
  dropdown.className = 'filter-picker-dropdown';
  dropdown.hidden = true;
  dropdown.innerHTML = `
    <input class="filter-picker-search" type="search" placeholder="Buscar por nombre o código..." autocomplete="off">
    <div class="filter-picker-options"></div>
    <div class="filter-picker-dropdown__actions">
      <button type="button" class="btn btn-reset filter-picker-clear">Limpiar</button>
      <div>
        <button type="button" class="btn btn-reset filter-picker-cancel">Cancelar</button>
        <button type="button" class="btn btn-primary filter-picker-apply">Aplicar</button>
      </div>
    </div>`;

  const search = dropdown.querySelector('.filter-picker-search');
  const optionsContainer = dropdown.querySelector('.filter-picker-options');
  let pendingValues = new Set();
  let renderTimer;
  const render = () => {
    const query = normalizeSearchText(search.value.trim());
    const options = Object.values(select.tomselect?.options || {});
    const matches = options.filter(option => !query || normalizeSearchText(option.text).includes(query));
    const visibleOptions = matches.slice(0, 200);
    optionsContainer.replaceChildren();

    if (visibleOptions.length === 0) {
      optionsContainer.textContent = 'No se encontraron opciones.';
      return;
    }

    visibleOptions.forEach(option => {
      const label = document.createElement('label');
      label.className = 'filter-picker-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option.value;
      checkbox.checked = pendingValues.has(option.value);
      checkbox.addEventListener('change', () => {
        checkbox.checked ? pendingValues.add(option.value) : pendingValues.delete(option.value);
      });
      const text = document.createElement('span');
      text.textContent = option.text;
      label.append(checkbox, text);
      optionsContainer.appendChild(label);
    });

    if (matches.length > visibleOptions.length) {
      const note = document.createElement('div');
      note.className = 'filter-picker-option';
      note.textContent = `Mostrando ${visibleOptions.length} de ${matches.length}. Escribe más para acotar la búsqueda.`;
      optionsContainer.appendChild(note);
    }
  };
  const close = () => closeFilterPickers();

  search.addEventListener('input', () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  });
  dropdown.querySelector('.filter-picker-clear').addEventListener('click', () => {
    pendingValues.clear();
    render();
  });
  dropdown.querySelector('.filter-picker-cancel').addEventListener('click', close);
  dropdown.querySelector('.filter-picker-apply').addEventListener('click', () => {
    select.tomselect.setValue([...pendingValues]);
    syncFilterPickerButton(select);
    close();
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-picker-button';
  button.addEventListener('click', () => {
    const opening = dropdown.hidden;
    closeFilterPickers(dropdown);
    if (!opening) return close();
    ACTIVE_FILTER_PICKER = select;
    pendingValues = new Set(getSelectValues(select.id));
    search.value = '';
    dropdown.classList.remove('align-right');
    dropdown.hidden = false;
    const container = button.closest('.filters-section') || document.documentElement;
    const limit = Math.min(container.getBoundingClientRect().right, document.documentElement.clientWidth);
    if (dropdown.getBoundingClientRect().right > limit) dropdown.classList.add('align-right');
    render();
    search.focus({ preventScroll: true });
  });

  const wrapper = select.tomselect?.wrapper;
  if (wrapper) wrapper.insertAdjacentElement('afterend', button);
  else select.insertAdjacentElement('afterend', button);
  button.insertAdjacentElement('afterend', dropdown);
}

// ====================================================
// CÁLCULOS DE MÉTRICAS
// ====================================================

function meanSafe(values) {
  const nums = values.filter(v => !isNaN(v));
  if (nums.length === 0) return NaN;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function weightedMean(values, weights) {
  const mask = values.map((v, i) => !isNaN(v) && !isNaN(weights[i]) && weights[i] > 0);
  const filteredValues = values.filter((_, i) => mask[i]);
  const filteredWeights = weights.filter((_, i) => mask[i]);

  if (filteredValues.length === 0) return NaN;

  const sum = filteredValues.reduce((acc, v, i) => acc + v * filteredWeights[i], 0);
  const weightSum = filteredWeights.reduce((a, b) => a + b, 0);
  return weightSum > 0 ? sum / weightSum : NaN;
}

function tasaSugeridaPromedio(filtered, weightMode = "Pólizas únicas") {
  const g1 = filtered.filter(r => r.clasificacion === "<100" && !isNaN(r.tc_6a1));
  const g2 = filtered.filter(r => [">100", "CORREDORES"].includes(r.clasificacion) && !isNaN(r.tc_6));

  const avg1 = meanSafe(g1.map(r => r.tc_6a1));
  const avg2 = meanSafe(g2.map(r => r.tc_6));

  let w1, w2;
  if (weightMode === "Asegurados") {
    w1 = g1.reduce((sum, r) => sum + (r.cant_asegurados || 0), 0);
    w2 = g2.reduce((sum, r) => sum + (r.cant_asegurados || 0), 0);
  } else if (weightMode === "Pólizas únicas") {
    w1 = new Set(g1.map(r => r.poliza)).size || g1.length;
    w2 = new Set(g2.map(r => r.poliza)).size || g2.length;
  } else {
    w1 = g1.length;
    w2 = g2.length;
  }

  return weightedMean([avg1, avg2], [w1, w2]);
}

function calculateMetrics(filtered) {
  const primActualTotal = filtered.reduce((sum, r) => sum + (r.prima_actual || 0), 0);
  const primSugeridaTotal = filtered.reduce((sum, r) => sum + (r.prima_sugerida || 0), 0);
  const brechaTotal = primActualTotal - primSugeridaTotal;
  const brechaDeficit = filtered.reduce((sum, r) => sum + Math.min(r.brecha_prima || 0, 0), 0);
  const brechaSuperavit = filtered.reduce((sum, r) => sum + Math.max(r.brecha_prima || 0, 0), 0);
  const polizasTotal = new Set(filtered.map(r => r.poliza)).size || filtered.length;
  const polizasDeficit = new Set(
    filtered.filter(r => (r.brecha_prima || 0) < 0).map(r => r.poliza)
  ).size;
  const polizasSuperavit = new Set(
    filtered.filter(r => (r.brecha_prima || 0) > 0).map(r => r.poliza)
  ).size;
  const aseguradosTotal = filtered.reduce((sum, r) => sum + (r.cant_asegurados || 0), 0);

  // Promedios ponderados por VALOR_ASEGURADO_VIDA.
  const tcActualProm = weightedMean(
    filtered.map(r => r.tc_actual),
    filtered.map(r => r.valor_asegurado)
  );
  
  const tcSugeridaProm = weightedMean(
    filtered.map(r => r.tc6),
    filtered.map(r => r.valor_asegurado)
  );
  const cumplimientoTc = tcSugeridaProm > 0 ? tcActualProm / tcSugeridaProm : NaN;

  return {
    primActualTotal,
    primSugeridaTotal,
    brechaTotal,
    brechaDeficit,
    brechaSuperavit,
    polizasTotal,
    polizasDeficit,
    polizasSuperavit,
    aseguradosTotal,
    tcActualProm,
    tcSugeridaProm,
    cumplimientoTc,
  };
}

// ====================================================
// RANKINGS
// ====================================================

function buildRankingTable(data, groupCol, groupLabel, nameCol = null, weightMode = "Pólizas únicas") {
  const groups = {};

  data.forEach(row => {
    const key = row[groupCol] || "SIN VALOR";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  });

  const ranking = Object.entries(groups).map(([groupValue, rows]) => {
    const polizas = new Set(rows.map(r => r.poliza)).size || rows.length;
    const asegurados = rows.reduce((sum, r) => sum + (r.cant_asegurados || 0), 0);
    const primActual = rows.reduce((sum, r) => sum + (r.prima_actual || 0), 0);
    const primSugerida = rows.reduce((sum, r) => sum + (r.prima_sugerida || 0), 0);
    
    // Promedios ponderados por VALOR_ASEGURADO_VIDA.
    const tcActualProm = weightedMean(
      rows.map(r => r.tc_actual),
      rows.map(r => r.valor_asegurado)
    );
    
    const tcSugeridaProm = weightedMean(
      rows.map(r => r.tc6),
      rows.map(r => r.valor_asegurado)
    );
    const todosSonCorredores = rows.length > 0 && rows.every(row => isBrokerChannel(row.canal));
    const ajusteTasa = calculateRateAdjustment(
      tcActualProm,
      tcSugeridaProm,
      asegurados,
      todosSonCorredores ? "CORREDORES" : ""
    );
    
    const brecha = primActual - primSugerida;
    const cumplimiento = primSugerida > 0 ? primActual / primSugerida : NaN;
    
    // Si hay columna de nombre, obtener el primer nombre disponible
    const displayName = nameCol && rows.length > 0 && rows[0][nameCol] ? rows[0][nameCol] : groupValue;

    return {
      [groupLabel]: groupValue,
      [`${groupLabel} (Nombre)`]: displayName,
      polizas,
      asegurados,
      primActual,
      primSugerida,
      tcActualProm,
      tcSugeridaProm,
      ajusteTasa,
      brecha,
      cumplimiento,
      estado: brecha >= 0 ? "Suficiente" : "Déficit",
    };
  });

  // Ordenar por brecha (mejor a peor desempeño)
  ranking.sort((a, b) => b.brecha - a.brecha);

  // Agregar posición
  ranking.forEach((row, idx) => {
    row.posicion = idx + 1;
  });

  return ranking;
}

// ====================================================
// EXPORTACIÓN CSV
// ====================================================

function splitCodeAndName(value, fallbackName = "") {
  const text = String(value ?? "").trim();
  const separatorIndex = text.indexOf(" - ");

  if (separatorIndex === -1) {
    return { code: text, name: String(fallbackName ?? "").trim() };
  }

  return {
    code: text.slice(0, separatorIndex).trim(),
    name: text.slice(separatorIndex + 3).trim() || String(fallbackName ?? "").trim(),
  };
}

function exportToCSV(data, filename = "detalle_tablero_vida_grupo.csv") {
  const headers = [
    "Póliza", "Regional", "Regional (Nombre)", "Canal", "Canal (Nombre)", "Clasificación", 
    "Nueva o renovada", "Producto", "Director", "Director (Nombre)", "Código Asesor/Corredor", "Nombre Asesor/Corredor",
    "Código Oficina", "Nombre Oficina",
    "Asegurados", "Valor Asegurado", "TC Actual", "TC Objetivo", "% Ajuste de tasa", "Prima Actual", "Prima Sugerida",
    "Brecha", "Cumplimiento", "Estado Técnico"
  ];

  const rows = data.map(row => {
    const asesor = splitCodeAndName(row.asesor_corredor, row.asesor_nombre);
    const oficina = splitCodeAndName(row.oficina, row.oficina_nombre);

    return [
      row.poliza, 
      row.regional, 
      row.regional_nombre || row.regional,
      row.canal, 
      row.canal_nombre || row.canal,
      row.clasificacion,
      row.nueva_o_renovada,
      row.producto,
      row.director, 
      row.director_nombre || row.director,
      asesor.code,
      asesor.name,
      oficina.code,
      oficina.name,
      formatInt(row.cant_asegurados), 
      formatMoney(row.valor_asegurado, { divisor: 1, suffix: "" }),
      formatRate(row.tc_actual), 
      formatRate(row.tpr_ponderada),
      formatRateAdjustment(row.ajuste_tasa),
      formatMoney(row.prima_actual, { divisor: 1, suffix: "" }), 
      formatMoney(row.prima_sugerida, { divisor: 1, suffix: "" }),
      formatMoney(row.brecha_prima, { divisor: 1, suffix: "" }), 
      `${formatDecimal(row.cumplimiento_prima * 100, 2)}%`,
      row.estado_tecnico
    ];
  });

  const csv = [headers.join(";"), ...rows.map(r => r.map(cell => `"${cell}"`).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ====================================================
// INICIALIZACIÓN
// ====================================================

function initFilters() {
  // Si ya fue inicializado, no volver a hacerlo
  if (FILTERS_INITIALIZED) {
    console.log("✅ Filtros ya inicializados, omitiendo reinicialización");
    return;
  }

  console.log("⚙️  Inicializando filtros y Tom Select...");

  FILTER_SPECS.forEach(([fieldKey, dataCol, label]) => {
    try {
      const selectId = `filter_${fieldKey}`;
      const select = document.getElementById(selectId);
      
      if (!select) {
        console.warn(`⚠️  Elemento #${selectId} no encontrado en HTML`);
        return;
      }

      // Limpiar opciones previas
      select.innerHTML = '';

      // Obtener opciones únicas del dataset
      const options = getFilterOptions(dataCol);
      
      // Poblar el select con opciones
      options.forEach(opt => {
        const optionElement = document.createElement('option');
        optionElement.value = opt;
        optionElement.textContent = opt;
        select.appendChild(optionElement);
      });

      console.log(`✅ Pobladas ${options.length} opciones en ${selectId}`);

      // Inicializar Tom Select si está disponible
      if (typeof TomSelect !== "undefined") {
        // Destruir instancia anterior si existe
        if (select.tomselect) {
          select.tomselect.destroy();
          console.log(`🔄 Tom Select anterior destruido en ${selectId}`);
        }
        
        // Crear nueva instancia
        new TomSelect(`#${selectId}`, {
          maxItems: null,
          create: false,
          placeholder: `Selecciona ${label}...`,
        });
        
        console.log(`✅ Tom Select inicializado en ${selectId}`);
      } else {
        console.warn("⚠️  Tom Select no está disponible");
      }

      createFilterPicker(select);
      syncFilterPickerButton(select);
    } catch (error) {
      console.error(`❌ Error en filtro ${fieldKey}:`, error.message);
    }
  });
  
  // Agregar listeners a los selects
  const selects = document.querySelectorAll('[id^="filter_"]');
  selects.forEach(select => {
    select.addEventListener('change', handleFilterChange);
  });
  
  console.log(`✅ ${selects.length} listeners de cambio agregados`);

  syncAllFilterPickerButtons();
  document.addEventListener('click', event => {
    if (!event.target.closest('.filter-wrap')) closeFilterPickers();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeFilterPickers();
  });

  // Marcar como inicializado
  FILTERS_INITIALIZED = true;
  console.log("✅ Sistema de filtros completamente inicializado");
}

// Exportar funciones para usar en HTML
window.tableEngine = {
  loadData,
  filterData,
  calculateMetrics,
  buildRankingTable,
  chooseMoneUnit,
  formatMoney,
  formatInt,
  formatDecimal,
  formatRate,
  formatRateAdjustment,
  calculateRateAdjustment,
  exportToCSV,
  getLatestCutoffDate,
  getFilterOptions,
  getFilterSelections: getFilterSelectionsFromDom,
  refreshFilterOptions,
  resetFilterSelections,
  getPreparedData: () => PREPARED_DATA,
};
