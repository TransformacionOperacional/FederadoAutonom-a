/* engine.js — Motor de cálculos para Tablero Suscripción Vida Grupo */

// Estado global
let RAW_DATA = [];
let PREPARED_DATA = [];
let COLUMN_MAP = {};
let FILTERS_INITIALIZED = false; // Flag para evitar reinicializar Tom Select

// Mapeo de columnas - alias para encontrar las columnas correctas en el Excel
const COLUMN_ALIASES = {
  poliza: ["NUMERO_POLIZA", "Nro poliza limpio", "Nro póliza limpio", "NRO POLIZA LIMPIO", "Nro Poliza Limpio", "Poliza", "Póliza"],
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
  producto: ["GRUPO_PRODUCTO", "Producto", "PRODUCTO"],
  cant_asegurados: ["NUMERO_ASEGURADOS", "Cant asegurados", "CANT ASEGURADOS"],
  valor_asegurado: ["VALOR_ASEGURADO_TOTAL", "VALOR_ASEGURADO_VIDA", "VA_VIDA_MANU", "Valor asegurado"],
  tc_actual: ["TASA_ACTUAL", "TC Actual", "TC ACTUAL"],
  tc6: ["TC6", "TC_6", "TC 6"],
  prima_actual: ["VALOR_PRIMA_TOTAL", "Prima actual", "Prima Actual", "PRIMA ACTUAL"],
  tpr_ponderada: ["TPR_PONDERADA_POR_PERSONA", "TPR_SOLO_VIDA", "Tasa Ponderada"],
};

// Colores de la paleta SURA
const COLORS = {
  primaBruto: "#0033A0",
  primaSugerida: "#00AEC7",
  deficit: "#B42318",
  suficiencia: "#067647",
};

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
      const cant_asegurados = get("cant_asegurados", "number", 0);
      const valor_asegurado = get("valor_asegurado", "number", 0);
      const tc_actual = get("tc_actual", "number", 0);
      const tc6 = get("tc6", "number", 0);
      const prima_actual = get("prima_actual", "number", 0);
      const tpr_ponderada = get("tpr_ponderada", "number", tc_actual);

      // Información de intermediarios y oficinas con nombres descriptivos
      const canal = get("canal", "text", "SIN CANAL").toUpperCase();
      const canal_nombre = get("canal_nombre", "text", canal);
      
      const regional = get("regional", "text", "SIN REGIONAL").toUpperCase();
      const regional_nombre = get("regional_nombre", "text", regional);
      
      const director = get("director", "text", "SIN DIRECTOR");
      const director_nombre = get("director_nombre", "text", director);
      
      const asesor_corredor = get("asesor_corredor", "text", "SIN INTERMEDIARIO");
      const asesor_nombre = get("asesor_nombre", "text", asesor_corredor);
      
      const oficina = get("oficina", "text", "SIN OFICINA");
      const oficina_nombre = get("oficina_nombre", "text", oficina);

      const producto = get("producto", "text", "SIN PRODUCTO");

      // Estimar clasificación según número de asegurados
      const clasificacion = cant_asegurados < 200 ? "<200" : ">200";
      
      // Estimar prima sugerida basada en tasas ponderadas
      // Prima sugerida = (TPR_PONDERADA * Valor_Asegurado) / 1000
      const prima_sugerida = (tpr_ponderada * valor_asegurado) / 1000;
      
      // Cálculos
      const brecha_prima = prima_actual - prima_sugerida;
      const cumplimiento_prima = prima_sugerida > 0 ? prima_actual / prima_sugerida : 0;
      const estado_tecnico = brecha_prima < 0 ? "Déficit vs sugerida" : "Superávit vs sugerida";

      // Canal para ranking
      let canal_ranking = canal;
      if (canal.includes("ASESOR") || canal.includes("PROMOTORA") || canal.includes("SUCURSAL")) {
        canal_ranking = clasificacion === "<200" ? "ASESORES <200" : "ASESORES >200";
      } else if (canal.includes("CORRED")) {
        canal_ranking = "CORREDORES";
      }

      return {
        poliza,
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
        cant_asegurados,
        valor_asegurado,
        tc_actual,
        tc6,
        tpr_ponderada,
        prima_actual,
        prima_sugerida,
        brecha_prima,
        cumplimiento_prima,
        estado_tecnico,
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

function getFilterOptions(column) {
  const options = new Set();
  PREPARED_DATA.forEach(row => {
    const value = row[column];
    if (value && value !== "SIN DATO") options.add(value);
  });
  return Array.from(options).sort();
}

function filterData(selections) {
  return PREPARED_DATA.filter(row => {
    for (const [col, selected] of Object.entries(selections)) {
      if (selected && selected.length > 0 && !selected.includes(row[col])) {
        return false;
      }
    }
    return true;
  });
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
  const g1 = filtered.filter(r => r.clasificacion === "<200" && !isNaN(r.tc_6a1));
  const g2 = filtered.filter(r => ["&gt;200", "CORREDORES"].includes(r.clasificacion) && !isNaN(r.tc_6));

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
  const polizasTotal = new Set(filtered.map(r => r.poliza)).size || filtered.length;
  const aseguradosTotal = filtered.reduce((sum, r) => sum + (r.cant_asegurados || 0), 0);

  // Promedios ponderados por NUMERO_ASEGURADOS
  const tcActualProm = weightedMean(
    filtered.map(r => r.tc_actual),
    filtered.map(r => r.cant_asegurados)
  );
  
  const tcSugeridaProm = weightedMean(
    filtered.map(r => r.tc6),
    filtered.map(r => r.cant_asegurados)
  );

  return {
    primActualTotal,
    primSugeridaTotal,
    brechaTotal,
    polizasTotal,
    aseguradosTotal,
    tcActualProm,
    tcSugeridaProm,
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
    
    // Promedios ponderados por NUMERO_ASEGURADOS
    const tcActualProm = weightedMean(
      rows.map(r => r.tc_actual),
      rows.map(r => r.cant_asegurados)
    );
    
    const tcSugeridaProm = weightedMean(
      rows.map(r => r.tc6),
      rows.map(r => r.cant_asegurados)
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
      brecha,
      cumplimiento,
      estado: brecha >= 0 ? "🟢 Suficiente" : "🔴 Déficit",
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

function exportToCSV(data, filename = "detalle_tablero_vida_grupo.csv") {
  const headers = [
    "Póliza", "Regional", "Regional (Nombre)", "Canal", "Canal (Nombre)", "Clasificación", 
    "Director", "Director (Nombre)", "Asesor/Corredor", "Asesor (Nombre)", "Oficina", "Oficina (Nombre)",
    "Asegurados", "Valor Asegurado", "TC Actual", "TC Ponderada", "Prima Actual", "Prima Sugerida",
    "Brecha", "Cumplimiento", "Estado Técnico"
  ];

  const rows = data.map(row => [
    row.poliza, 
    row.regional, 
    row.regional_nombre || row.regional,
    row.canal, 
    row.canal_nombre || row.canal,
    row.clasificacion,
    row.director, 
    row.director_nombre || row.director,
    row.asesor_corredor, 
    row.asesor_nombre || row.asesor_corredor,
    row.oficina, 
    row.oficina_nombre || row.oficina,
    formatInt(row.cant_asegurados), 
    formatMoney(row.valor_asegurado, { divisor: 1, suffix: "" }),
    formatRate(row.tc_actual), 
    formatRate(row.tpr_ponderada),
    formatMoney(row.prima_actual, { divisor: 1, suffix: "" }), 
    formatMoney(row.prima_sugerida, { divisor: 1, suffix: "" }),
    formatMoney(row.brecha_prima, { divisor: 1, suffix: "" }), 
    formatDecimal(row.cumplimiento_prima, 2),
    row.estado_tecnico
  ]);

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

  const filterSpecs = [
    ["regional", "regional", "Regional"],
    ["canal", "canal", "Canal"],
    ["clasificacion", "clasificacion", "Clasificación Asegurados"],
    ["director", "director", "Director Comercial"],
    ["asesor_corredor", "asesor_corredor", "Asesor/Corredor"],
    ["oficina", "oficina", "Oficina"],
    ["producto", "producto", "Producto"],
    ["estado_tecnico", "estado_tecnico", "Estado Técnico"],
  ];

  filterSpecs.forEach(([fieldKey, dataCol, label]) => {
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
    } catch (error) {
      console.error(`❌ Error en filtro ${fieldKey}:`, error.message);
    }
  });
  
  // Agregar listeners a los selects
  const selects = document.querySelectorAll('[id^="filter_"]');
  selects.forEach(select => {
    select.addEventListener('change', updateDashboard);
  });
  
  console.log(`✅ ${selects.length} listeners de cambio agregados`);

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
  exportToCSV,
  getFilterOptions,
  getPreparedData: () => PREPARED_DATA,
};
