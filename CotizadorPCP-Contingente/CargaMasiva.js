// Variables globales
let datosClientes = [];
let resultadosProcesamiento = [];

// Tasas PCP por edad (del archivo Simulador - Columna PCP - VIDA COMERCIAL)
const TASAS_PCP = {
    20: 0.411, 21: 0.468, 22: 0.530, 23: 0.595, 24: 0.666, 25: 0.742, 26: 0.824, 27: 0.912, 28: 1.007,
    29: 1.108, 30: 1.217, 31: 1.334, 32: 1.460, 33: 1.596, 34: 1.741, 35: 1.898, 36: 2.066, 37: 2.246,
    38: 2.440, 39: 2.649, 40: 2.873, 41: 3.114, 42: 3.373, 43: 3.626, 44: 3.791, 45: 3.971, 46: 4.168,
    47: 4.382, 48: 4.617, 49: 4.876, 50: 5.154, 51: 5.364, 52: 5.644, 53: 6.004, 54: 6.474, 55: 7.024,
    56: 7.489, 57: 7.986, 58: 8.515, 59: 9.079, 60: 9.681, 61: 10.323, 62: 11.009, 63: 11.788, 64: 12.673,
    65: 13.679, 66: 14.825, 67: 16.131, 68: 17.624, 69: 19.332, 70: 21.290, 71: 23.542, 72: 26.137, 73: 29.135,
    74: 32.608, 75: 36.642, 76: 40.987, 77: 45.976, 78: 49.435, 79: 53.153
};

const TASAS_ITP = 0.353;

// Factores de fraccionamiento por forma de pago
const FACTORES_FRACCIONAMIENTO = {
    'Mensual': 1.092,
    'Trimestral': 1.268,
    'Semestral': 1.523,
    'Anual': 1.0
};

// Manejadores de archivo
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        document.getElementById('excelFile').files = files;
        handleFileSelect({ target: { files: files } });
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
        mostrarError('Por favor carga un archivo .xlsx o .xls');
        return;
    }

    // Verificar que XLSX esté disponible
    if (typeof XLSX === 'undefined') {
        mostrarError('❌ Error: Librería XLSX no está disponible. Intenta recargar la página.');
        console.error('XLSX no definido');
        return;
    }

    limpiarMensajes();

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            console.log('Datos leídos:', jsonData);
            console.log('Primera fila:', jsonData[0]);
            console.log('Columnas:', Object.keys(jsonData[0] || {}));

            // Filtrar datos válidos - ser flexible con espacios y mayúsculas
            datosClientes = jsonData.filter(row => {
                // Buscar campos independiente de mayúsculas/minúsculas
                const nombre = row['Nombre del Cliente'] || row['nombre del cliente'] || row['Nombre'] || '';
                const edad = row['Edad'] || row['edad'] || '';
                return nombre && edad;
            }).map(row => ({
                'Nombre del Cliente': row['Nombre del Cliente'] || row['nombre del cliente'] || row['Nombre'] || '',
                'Edad': row['Edad'] || row['edad'] || 0,
                'Valor Asegurado': row['Valor Asegurado'] || row['valor asegurado'] || row['Valor'] || 0,
                'Forma de Pago': row['Forma de Pago'] || row['forma de pago'] || row['Pago'] || 'Anual'
            }));

            if (datosClientes.length === 0) {
                mostrarError('El archivo no contiene datos válidos. Verifica que tenga las columnas: Nombre del Cliente, Edad, Valor Asegurado, Forma de Pago');
                console.error('Columnas encontradas:', Object.keys(jsonData[0] || {}));
                return;
            }

            // Validar datos
            const validados = validarDatos(datosClientes);
            if (validados.invalidos.length > 0) {
                console.warn('Filas inválidas:', validados.invalidos);
                datosClientes = validados.validos;
            }

            // Mostrar información
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('recordCount').textContent = datosClientes.length;
            document.getElementById('fileInfo').classList.add('show');

            // Mostrar preview
            mostrarPreview(datosClientes);

            // Habilitar botón procesar
            document.getElementById('procesarBtn').disabled = false;

            mostrarExito('✅ Archivo cargado correctamente. ' + datosClientes.length + ' registros listos.');

        } catch (error) {
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            mostrarError('❌ Error al leer el archivo: ' + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function validarDatos(datos) {
    const validos = [];
    const invalidos = [];

    datos.forEach((row, idx) => {
        const errores = [];

        if (!row['Nombre del Cliente']) errores.push('Nombre faltante');
        if (!row['Edad'] || isNaN(row['Edad']) || row['Edad'] < 18 || row['Edad'] > 79) {
            errores.push('Edad inválida (18-79)');
        }
        if (!row['Valor Asegurado'] || isNaN(row['Valor Asegurado']) || row['Valor Asegurado'] < 1000000) {
            errores.push('Valor < $1M');
        }
        if (!row['Forma de Pago'] || !['Mensual', 'Trimestral', 'Semestral', 'Anual'].includes(row['Forma de Pago'])) {
            errores.push('Forma de pago inválida');
        }

        if (errores.length === 0) {
            validos.push(row);
        } else {
            invalidos.push({ fila: idx + 2, cliente: row['Nombre del Cliente'], errores });
        }
    });

    return { validos, invalidos };
}

function mostrarPreview(datos) {
    const tbody = document.getElementById('previewTableBody');
    tbody.innerHTML = '';

    datos.slice(0, 10).forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row['Nombre del Cliente'] || ''}</td>
            <td>${row['Edad'] || ''}</td>
            <td>$${formatearNumero(row['Valor Asegurado'] || 0)}</td>
            <td>${row['Forma de Pago'] || ''}</td>
        `;
        tbody.appendChild(tr);
    });

    if (datos.length > 10) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center; color:#999; font-style:italic;">... y ${datos.length - 10} registros más</td>`;
        tbody.appendChild(tr);
    }

    document.getElementById('tableWrapper').classList.add('show');
}

function procesarCotizaciones() {
    if (datosClientes.length === 0) {
        mostrarError('No hay datos para procesar');
        return;
    }

    document.getElementById('procesarBtn').disabled = true;
    document.getElementById('tableWrapper').classList.remove('show');

    // Mostrar modal simple
    document.getElementById('modal').classList.add('show');

    resultadosProcesamiento = [];
    let indice = 0;

    function procesarSiguiente() {
        if (indice >= datosClientes.length) {
            document.getElementById('modal').classList.remove('show');
            mostrarResultados();
            return;
        }

        const cliente = datosClientes[indice];
        const resultado = calcularPrimas(cliente);
        resultadosProcesamiento.push(resultado);

        const porcentaje = Math.round((indice + 1) / datosClientes.length * 100);
        document.getElementById('modalSubtext').textContent = `${indice + 1} de ${datosClientes.length}`;

        indice++;
        setTimeout(procesarSiguiente, 5);
    }

    procesarSiguiente();
}

function calcularPrimas(cliente) {
    try {
        const nombre = cliente['Nombre del Cliente'] || 'Sin nombre';
        const edad = parseInt(cliente['Edad']) || 0;
        const valorAsegurado = parseFloat(cliente['Valor Asegurado']) || 0;
        const formaPago = cliente['Forma de Pago'] || 'Anual';

        if (edad < 18 || edad > 79) {
            return { nombre, edad, valorAsegurado, formaPago, estado: 'Error', error: 'Edad fuera de rango (18-79)' };
        }

        if (valorAsegurado < 1000000) {
            return { nombre, edad, valorAsegurado, formaPago, estado: 'Error', error: 'Valor < $1.000.000' };
        }

        const tasaPCP = TASAS_PCP[edad] || TASAS_PCP[Math.floor(edad)];
        const tasaItp = TASAS_ITP;

        if (!tasaPCP) {
            return { nombre, edad, valorAsegurado, formaPago, estado: 'Error', error: 'Tasas no disponibles' };
        }

        // Calcular prima anual base (tasa por mil)
        const primaAnualPCP = (valorAsegurado * tasaPCP) / 1000;
        const primaAnualItp = (valorAsegurado * tasaItp) / 1000;
        const primaAnualTotal = primaAnualPCP + primaAnualItp;

        // Calcular primas por fraccionamiento con factor
        // Mensual: Prima Anual / 12 * 1.092
        // Trimestral: Prima Anual / 4 * 1.268
        // Semestral: Prima Anual / 2 * 1.523

        const primaMensualPCP = Math.round((primaAnualPCP / 12) * 1.092);
        const primaMensualItp = Math.round((primaAnualItp / 12) * 1.092);
        const primaMensualTotal = primaMensualPCP + primaMensualItp;

        const primaTrimestralPCP = Math.round((primaAnualPCP / 4) * 1.268);
        const primaTrimestralItp = Math.round((primaAnualItp / 4) * 1.268);
        const primaTrimestralTotal = primaTrimestralPCP + primaTrimestralItp;

        const primaSemestralPCP = Math.round((primaAnualPCP / 2) * 1.523);
        const primaSemestralItp = Math.round((primaAnualItp / 2) * 1.523);
        const primaSemestralTotal = primaSemestralPCP + primaSemestralItp;

        return {
            nombre,
            edad,
            valorAsegurado,
            formaPago,
            tasaPCP,
            tasaItp,
            primaAnualPCP: Math.round(primaAnualPCP),
            primaAnualItp: Math.round(primaAnualItp),
            primaAnualTotal: Math.round(primaAnualTotal),
            primaMensualPCP,
            primaMensualItp,
            primaMensualTotal,
            primaTrimestralPCP,
            primaTrimestralItp,
            primaTrimestralTotal,
            primaSemestralPCP,
            primaSemestralItp,
            primaSemestralTotal,
            estado: 'Exitoso',
            error: null
        };
    } catch (error) {
        return { nombre: cliente['Nombre del Cliente'] || 'Error', estado: 'Error', error: error.message };
    }
}

function mostrarResultados() {
    const exitosos = resultadosProcesamiento.filter(r => r.estado === 'Exitoso').length;
    const conError = resultadosProcesamiento.filter(r => r.estado === 'Error').length;

    document.getElementById('totalProcesados').textContent = resultadosProcesamiento.length;
    document.getElementById('exitosos').textContent = exitosos;
    document.getElementById('conError').textContent = conError;

    document.getElementById('stats').classList.add('show');
    document.getElementById('resultadosCard').style.display = 'block';

    mostrarExito(`✅ Procesamiento completado. ${exitosos} exitosos, ${conError} con errores.`);
}

async function descargarResultados() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resultados', { pageSetup: { orientation: 'landscape' } });

        worksheet.columns = [
            { header: 'Nombre', key: 'nombre', width: 25 },
            { header: 'Edad', key: 'edad', width: 8 },
            { header: 'Valor Asegurado', key: 'valorAsegurado', width: 18 },
            { header: 'Forma de Pago', key: 'formaPago', width: 15 },
            { header: 'Tasa VIDA', key: 'tasaPCP', width: 12 },
            { header: 'Prima Anual VIDA', key: 'primaAnualPCP', width: 16 },
            { header: 'Prima Anual ITP', key: 'primaAnualItp', width: 16 },
            { header: 'Prima Anual Total', key: 'primaAnualTotal', width: 16 },
            { header: 'Prima Mensual', key: 'primaMensualTotal', width: 15 },
            { header: 'Prima Trimestral', key: 'primaTrimestralTotal', width: 15 },
            { header: 'Prima Semestral', key: 'primaSemestralTotal', width: 15 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Error', key: 'error', width: 30 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: '0033A0' } };
        headerRow.font = { bold: true, color: { rgb: 'FFFFFF' }, size: 11 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        headerRow.height = 22;

        resultadosProcesamiento.forEach((resultado, idx) => {
            const row = worksheet.addRow(resultado);

            if (resultado.valorAsegurado) row.getCell('valorAsegurado').numFmt = '#,##0';
            if (resultado.primaAnualPCP) {
                row.getCell('primaAnualPCP').numFmt = '#,##0';
                row.getCell('primaAnualItp').numFmt = '#,##0';
                row.getCell('primaAnualTotal').numFmt = '#,##0';
                row.getCell('primaMensualTotal').numFmt = '#,##0';
                row.getCell('primaTrimestralTotal').numFmt = '#,##0';
                row.getCell('primaSemestralTotal').numFmt = '#,##0';
            }

            if (resultado.estado === 'Exitoso') {
                row.getCell('estado').fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'D4EDDA' } };
                row.getCell('estado').font = { color: { rgb: '155724' }, bold: true };
            } else {
                row.getCell('estado').fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'F8D7DA' } };
                row.getCell('estado').font = { color: { rgb: '721C24' }, bold: true };
            }

            if (idx % 2 === 0) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'F5F5F5' } };
            }

            row.alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell('nombre').alignment = { horizontal: 'left' };
        });

        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cotizaciones_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        mostrarExito('✅ Archivo descargado correctamente');
    } catch (error) {
        console.error('Error:', error);
        mostrarError('❌ Error al generar el archivo: ' + error.message);
    }
}

function descargarPlantilla() {
    try {
        // Crear un link y descargar el archivo que ya existe en el servidor
        const link = document.createElement('a');
        link.href = 'Plantilla_Cotizador_PCP.xlsx';
        link.download = 'Plantilla_Cotizador_PCP.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        mostrarExito('✅ Plantilla descargada correctamente');
    } catch (error) {
        console.error('Error:', error);
        mostrarError('❌ Error al descargar plantilla: ' + error.message);
    }
}

function limpiarCarga() {
    datosClientes = [];
    resultadosProcesamiento = [];
    document.getElementById('excelFile').value = '';
    document.getElementById('fileInfo').classList.remove('show');
    document.getElementById('tableWrapper').classList.remove('show');
    document.getElementById('resultadosCard').style.display = 'none';
    document.getElementById('stats').classList.remove('show');
    document.getElementById('previewTableBody').innerHTML = '';
    document.getElementById('procesarBtn').disabled = true;
    limpiarMensajes();
}

// Funciones de UI
function mostrarError(mensaje) {
    const elem = document.getElementById('errorMessage');
    elem.textContent = mensaje;
    elem.classList.add('show');
    setTimeout(() => elem.classList.remove('show'), 5000);
}

function mostrarExito(mensaje) {
    const elem = document.getElementById('successMessage');
    elem.textContent = mensaje;
    elem.classList.add('show');
    setTimeout(() => elem.classList.remove('show'), 5000);
}

function limpiarMensajes() {
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');
}

function mostrarModal(mostrar, texto = '') {
    const modal = document.getElementById('modal');
    const modalText = document.getElementById('modalText');

    if (mostrar) {
        modal.classList.add('show');
        if (texto && modalText) modalText.textContent = texto;
    } else {
        modal.classList.remove('show');
    }
}

function formatearNumero(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
