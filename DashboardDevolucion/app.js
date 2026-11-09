// Tablero de Devoluciones: lee data/Devolucion.csv (resultado del query) y se refresca solo
// cuando el archivo cambia. También permite cargar un CSV manualmente o arrastrarlo a la página.
(function () {
    'use strict';

    const ARCHIVO_DATOS = 'data/Devolucion.csv';
    const INTERVALO_REVISION_MS = 30000;
    const FILAS_POR_PAGINA = 20;
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    const CAMPOS = {
        poliza: ['poliza'],
        dni: ['dniasegurado', 'dni'],
        siniestro: ['siniestro'],
        fecha: ['fechaapertura'],
        asegurado: ['asegurado'],
        expedicion: ['expedicion'],
        codag: ['codag'],
        agente: ['agente'],
        plan: ['nombreplan', 'plan']
    };

    const COLUMNAS_TABLA = [
        { campo: 'poliza', titulo: 'Póliza' },
        { campo: 'siniestro', titulo: 'Siniestro' },
        { campo: 'fecha', titulo: 'Fecha apertura' },
        { campo: 'asegurado', titulo: 'Asegurado' },
        { campo: 'dni', titulo: 'DNI' },
        { campo: 'expedicion', titulo: 'Expedición' },
        { campo: 'codag', titulo: 'Cód. agente' },
        { campo: 'agente', titulo: 'Agente' },
        { campo: 'plan', titulo: 'Plan' }
    ];

    const estado = {
        filas: [],
        filtradas: [],
        huella: '',
        origen: '',
        pagina: 1,
        orden: { campo: 'fecha', asc: false },
        agente: '',
        revision: null
    };

    const $ = id => document.getElementById(id);
    const formatoNumero = new Intl.NumberFormat('es-CO');

    function crear(etiqueta, clase, texto) {
        const nodo = document.createElement(etiqueta);
        if (clase) nodo.className = clase;
        if (texto !== undefined) nodo.textContent = texto;
        return nodo;
    }

    // ---------- Lectura del CSV ----------

    function decodificar(buffer) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch (error) {
            return new TextDecoder('windows-1252').decode(buffer);
        }
    }

    function parsearCsv(texto) {
        if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
        const saltoLinea = texto.search(/\r|\n/);
        const primeraLinea = saltoLinea >= 0 ? texto.slice(0, saltoLinea) : texto;
        const delimitador = primeraLinea.split(';').length > primeraLinea.split(',').length ? ';' : ',';

        const filas = [];
        let fila = [];
        let campo = '';
        let entreComillas = false;

        for (let i = 0; i < texto.length; i++) {
            const c = texto[i];
            if (entreComillas) {
                if (c === '"') {
                    if (texto[i + 1] === '"') { campo += '"'; i++; } else { entreComillas = false; }
                } else {
                    campo += c;
                }
            } else if (c === '"') {
                entreComillas = true;
            } else if (c === delimitador) {
                fila.push(campo);
                campo = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && texto[i + 1] === '\n') i++;
                fila.push(campo);
                campo = '';
                if (fila.length > 1 || fila[0] !== '') filas.push(fila);
                fila = [];
            } else {
                campo += c;
            }
        }
        if (campo !== '' || fila.length) {
            fila.push(campo);
            filas.push(fila);
        }
        return filas;
    }

    const normalizar = texto => String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const limpiar = texto => String(texto ?? '').replace(/\s+/g, ' ').trim();

    function fechaValida(texto) {
        const valor = limpiar(texto).slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : '';
    }

    function diasEntre(desde, hasta) {
        const [a1, m1, d1] = desde.split('-').map(Number);
        const [a2, m2, d2] = hasta.split('-').map(Number);
        return (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000;
    }

    function construirFilas(matriz) {
        if (matriz.length < 2) throw new Error('El archivo no contiene registros.');
        const indice = {};
        const cabecera = matriz[0].map(normalizar);
        Object.entries(CAMPOS).forEach(([campo, alias]) => {
            indice[campo] = cabecera.findIndex(nombre => alias.includes(nombre));
        });
        if (indice.siniestro < 0 || indice.fecha < 0) {
            throw new Error('El archivo no tiene las columnas esperadas (Siniestro, Fecha apertura...).');
        }

        return matriz.slice(1).map(celdas => {
            const leer = campo => (indice[campo] >= 0 ? limpiar(celdas[indice[campo]]) : '');
            const fila = {
                poliza: leer('poliza'),
                dni: leer('dni'),
                siniestro: leer('siniestro'),
                fecha: fechaValida(leer('fecha')),
                asegurado: leer('asegurado'),
                expedicion: fechaValida(leer('expedicion')),
                codag: leer('codag'),
                agente: leer('agente'),
                plan: leer('plan')
            };
            fila.antiguedadDias = fila.fecha && fila.expedicion ? diasEntre(fila.expedicion, fila.fecha) : null;
            fila.busqueda = normalizar([fila.poliza, fila.siniestro, fila.asegurado, fila.dni, fila.agente, fila.codag].join(' '));
            return fila;
        }).filter(fila => fila.siniestro || fila.poliza);
    }

    function calcularHuella(buffer) {
        const bytes = new Uint8Array(buffer);
        let hash = 2166136261;
        for (let i = 0; i < bytes.length; i++) {
            hash ^= bytes[i];
            hash = Math.imul(hash, 16777619);
        }
        return `${bytes.length}:${hash >>> 0}`;
    }

    // ---------- Carga de datos ----------

    function aplicarDatos(buffer, origen, fechaDatos, esArchivo) {
        const huella = calcularHuella(buffer);
        const huboCambio = huella !== estado.huella;
        const primeraCarga = estado.filas.length === 0;
        if (!huboCambio && esArchivo === (estado.origen === 'archivo')) {
            actualizarEstado(origen, fechaDatos);
            return false;
        }

        const filas = construirFilas(parsearCsv(decodificar(buffer)));
        estado.filas = filas;
        estado.huella = huella;
        estado.origen = esArchivo ? 'archivo' : 'manual';
        estado.pagina = 1;
        actualizarEstado(origen, fechaDatos);
        $('panelVacio').hidden = true;
        $('contenido').hidden = false;
        poblarPlanes();
        render();
        if (!primeraCarga) mostrarAviso('Datos actualizados');
        return true;
    }

    function actualizarEstado(origen, fecha) {
        const parrafo = $('estadoDatos');
        parrafo.classList.remove('error');
        const cuando = fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
        const revision = estado.origen === 'archivo' ? ' · se actualiza automáticamente' : ' · carga manual';
        parrafo.textContent = `Origen: ${origen} · ${formatoNumero.format(estado.filas.length)} registros · datos del ${cuando}${revision}`;
    }

    function mostrarVacio(mensaje) {
        $('contenido').hidden = true;
        $('panelVacio').hidden = false;
        $('mensajeVacio').textContent = mensaje;
        const parrafo = $('estadoDatos');
        parrafo.classList.add('error');
        parrafo.textContent = 'Sin datos cargados.';
    }

    async function leerArchivoDatos(manual) {
        try {
            const respuesta = await fetch(`${ARCHIVO_DATOS}?t=${Date.now()}`, { cache: 'no-store' });
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const buffer = await respuesta.arrayBuffer();
            const modificado = respuesta.headers.get('Last-Modified');
            aplicarDatos(buffer, 'data/Devolucion.csv', modificado ? new Date(modificado) : new Date(), true);
            iniciarRevision();
            if (manual) mostrarAviso('Datos leídos nuevamente');
        } catch (error) {
            console.error('No fue posible leer el archivo de datos:', error);
            if (!estado.filas.length) {
                mostrarVacio('No fue posible leer data/Devolucion.csv. Abre el tablero con iniciar.ps1 (servidor local) o carga el archivo manualmente.');
            } else if (manual) {
                mostrarAviso('No fue posible leer data/Devolucion.csv');
            }
        }
    }

    function iniciarRevision() {
        if (estado.revision) return;
        estado.revision = setInterval(() => {
            if (estado.origen === 'archivo' && !document.hidden) leerArchivoDatos(false);
        }, INTERVALO_REVISION_MS);
    }

    async function cargarArchivoManual(archivo) {
        if (!archivo) return;
        try {
            aplicarDatos(await archivo.arrayBuffer(), archivo.name, new Date(archivo.lastModified), false);
        } catch (error) {
            console.error('No fue posible cargar el CSV:', error);
            mostrarAviso(error.message || 'No fue posible cargar el CSV');
        }
    }

    let temporizadorAviso = null;
    function mostrarAviso(texto) {
        const aviso = $('toast');
        aviso.textContent = texto;
        aviso.hidden = false;
        clearTimeout(temporizadorAviso);
        temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 3500);
    }

    // ---------- Filtros ----------

    function poblarPlanes() {
        const select = $('filtroPlan');
        const actual = select.value;
        const planes = [...new Set(estado.filas.map(fila => fila.plan).filter(Boolean))].sort();
        select.replaceChildren(new Option('Todos', ''), ...planes.map(plan => new Option(plan, plan)));
        select.value = planes.includes(actual) ? actual : '';
    }

    function aplicarFiltros() {
        const busqueda = normalizar($('filtroBusqueda').value);
        const desde = $('filtroDesde').value;
        const hasta = $('filtroHasta').value;
        const plan = $('filtroPlan').value;

        estado.filtradas = estado.filas.filter(fila =>
            (!busqueda || fila.busqueda.includes(busqueda))
            && (!desde || (fila.fecha && fila.fecha >= desde))
            && (!hasta || (fila.fecha && fila.fecha <= hasta))
            && (!plan || fila.plan === plan)
            && (!estado.agente || fila.agente === estado.agente)
        );
    }

    function render() {
        aplicarFiltros();
        renderIndicadores();
        renderMeses();
        renderAntiguedad();
        renderAgentes();
        renderTabla();
        const chip = $('chipAgente');
        chip.hidden = !estado.agente;
        $('chipAgenteTexto').textContent = `Agente: ${estado.agente}`;
    }

    // ---------- Indicadores y gráficos ----------

    function renderIndicadores() {
        const filas = estado.filtradas;
        const unicos = campo => new Set(filas.map(fila => fila[campo]).filter(Boolean)).size;
        $('kpiSiniestros').textContent = formatoNumero.format(unicos('siniestro'));
        $('kpiPolizas').textContent = formatoNumero.format(unicos('poliza'));
        $('kpiAsegurados').textContent = formatoNumero.format(unicos('dni'));
        $('kpiAgentes').textContent = formatoNumero.format(unicos('codag'));

        const antiguedades = filas.map(fila => fila.antiguedadDias).filter(dias => dias !== null && dias >= 0);
        if (antiguedades.length) {
            const meses = antiguedades.reduce((suma, dias) => suma + dias, 0) / antiguedades.length / 30.44;
            $('kpiAntiguedad').textContent = `${meses.toFixed(1).replace('.', ',')} meses`;
        } else {
            $('kpiAntiguedad').textContent = '-';
        }
    }

    function etiquetaMes(clave) {
        const [anio, mes] = clave.split('-').map(Number);
        return `${MESES[mes - 1]} ${anio}`;
    }

    function renderMeses() {
        const contenedor = $('graficoMeses');
        contenedor.replaceChildren();
        const conteo = new Map();
        estado.filtradas.forEach(fila => {
            if (!fila.fecha) return;
            const clave = fila.fecha.slice(0, 7);
            conteo.set(clave, (conteo.get(clave) || 0) + 1);
        });
        if (!conteo.size) {
            contenedor.appendChild(crear('p', 'sin-datos', 'Sin datos para los filtros seleccionados.'));
            return;
        }

        const claves = [...conteo.keys()].sort();
        const meses = [];
        let [anio, mes] = claves[0].split('-').map(Number);
        const [anioFin, mesFin] = claves[claves.length - 1].split('-').map(Number);
        while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
            meses.push(`${anio}-${String(mes).padStart(2, '0')}`);
            if (++mes > 12) { mes = 1; anio++; }
        }

        const maximo = Math.max(...conteo.values());
        meses.forEach(clave => {
            const valor = conteo.get(clave) || 0;
            const columna = crear('div', 'columna-mes');
            columna.title = `${etiquetaMes(clave)}: ${formatoNumero.format(valor)}`;
            columna.appendChild(crear('span', 'valor', formatoNumero.format(valor)));
            const relleno = crear('div', 'relleno');
            relleno.style.height = `${Math.round(valor / maximo * 85)}%`;
            columna.appendChild(relleno);
            columna.appendChild(crear('span', 'etiqueta', etiquetaMes(clave)));
            contenedor.appendChild(columna);
        });
    }

    function pintarBarras(contenedor, elementos, alHacerClic) {
        contenedor.replaceChildren();
        if (!elementos.length) {
            contenedor.appendChild(crear('p', 'sin-datos', 'Sin datos para los filtros seleccionados.'));
            return;
        }
        const maximo = Math.max(...elementos.map(elemento => elemento.valor));
        elementos.forEach(elemento => {
            const fila = crear('div', alHacerClic ? 'barra-fila clicable' : 'barra-fila');
            const etiqueta = crear('span', 'barra-etiqueta', elemento.etiqueta);
            etiqueta.title = elemento.titulo || elemento.etiqueta;
            const pista = crear('div', 'barra-pista');
            const relleno = crear('div', 'barra-relleno');
            relleno.style.width = `${maximo ? elemento.valor / maximo * 100 : 0}%`;
            pista.appendChild(relleno);
            fila.append(etiqueta, pista, crear('span', 'barra-valor', formatoNumero.format(elemento.valor)));
            if (alHacerClic) fila.addEventListener('click', () => alHacerClic(elemento));
            contenedor.appendChild(fila);
        });
    }

    function renderAntiguedad() {
        const rangos = [
            { etiqueta: 'Menos de 3 meses', maxDias: 91.3, valor: 0 },
            { etiqueta: '3 a 6 meses', maxDias: 182.6, valor: 0 },
            { etiqueta: '6 a 12 meses', maxDias: 365.25, valor: 0 },
            { etiqueta: '1 a 2 años', maxDias: 730.5, valor: 0 },
            { etiqueta: 'Más de 2 años', maxDias: Infinity, valor: 0 }
        ];
        let sinDato = 0;
        estado.filtradas.forEach(fila => {
            if (fila.antiguedadDias === null || fila.antiguedadDias < 0) { sinDato++; return; }
            rangos.find(rango => fila.antiguedadDias < rango.maxDias).valor++;
        });
        if (sinDato) rangos.push({ etiqueta: 'Sin dato', valor: sinDato });
        pintarBarras($('graficoAntiguedad'), estado.filtradas.length ? rangos : []);
    }

    function renderAgentes() {
        const conteo = new Map();
        estado.filtradas.forEach(fila => {
            if (!fila.agente) return;
            const dato = conteo.get(fila.agente) || { etiqueta: fila.agente, titulo: `${fila.agente} (${fila.codag})`, valor: 0 };
            dato.valor++;
            conteo.set(fila.agente, dato);
        });
        const top = [...conteo.values()].sort((a, b) => b.valor - a.valor).slice(0, 10);
        pintarBarras($('graficoAgentes'), top, elemento => {
            estado.agente = elemento.etiqueta;
            estado.pagina = 1;
            render();
        });
    }

    // ---------- Tabla ----------

    function renderTabla() {
        const { campo, asc } = estado.orden;
        const filas = [...estado.filtradas].sort((a, b) => {
            const resultado = String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'es', { numeric: true });
            return asc ? resultado : -resultado;
        });

        const paginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
        estado.pagina = Math.min(estado.pagina, paginas);
        const inicio = (estado.pagina - 1) * FILAS_POR_PAGINA;

        const cabecera = crear('tr');
        COLUMNAS_TABLA.forEach(columna => {
            const celda = crear('th', '', columna.titulo);
            if (columna.campo === campo) celda.appendChild(crear('span', 'flecha', asc ? '▲' : '▼'));
            celda.addEventListener('click', () => {
                estado.orden = { campo: columna.campo, asc: estado.orden.campo === columna.campo ? !estado.orden.asc : true };
                estado.pagina = 1;
                renderTabla();
            });
            cabecera.appendChild(celda);
        });
        $('tablaCabecera').replaceChildren(cabecera);

        const cuerpo = $('tablaCuerpo');
        cuerpo.replaceChildren();
        if (!filas.length) {
            const fila = crear('tr');
            const celda = crear('td', 'vacio', 'No hay registros para los filtros seleccionados.');
            celda.colSpan = COLUMNAS_TABLA.length;
            fila.appendChild(celda);
            cuerpo.appendChild(fila);
        } else {
            filas.slice(inicio, inicio + FILAS_POR_PAGINA).forEach(dato => {
                const fila = crear('tr');
                COLUMNAS_TABLA.forEach(columna => fila.appendChild(crear('td', '', dato[columna.campo])));
                cuerpo.appendChild(fila);
            });
        }

        $('resumenTabla').textContent = `${formatoNumero.format(filas.length)} registros`;
        $('textoPagina').textContent = `Página ${estado.pagina} de ${paginas}`;
        $('btnAnterior').disabled = estado.pagina <= 1;
        $('btnSiguiente').disabled = estado.pagina >= paginas;
    }

    // ---------- Eventos ----------

    function iniciarEventos() {
        const refiltrar = () => { estado.pagina = 1; render(); };
        let temporizador = null;
        $('filtroBusqueda').addEventListener('input', () => {
            clearTimeout(temporizador);
            temporizador = setTimeout(refiltrar, 200);
        });
        ['filtroDesde', 'filtroHasta', 'filtroPlan'].forEach(id => $(id).addEventListener('change', refiltrar));

        $('btnLimpiar').addEventListener('click', () => {
            $('filtroBusqueda').value = '';
            $('filtroDesde').value = '';
            $('filtroHasta').value = '';
            $('filtroPlan').value = '';
            estado.agente = '';
            refiltrar();
        });
        $('chipAgenteQuitar').addEventListener('click', () => { estado.agente = ''; refiltrar(); });

        $('btnAnterior').addEventListener('click', () => { estado.pagina--; renderTabla(); });
        $('btnSiguiente').addEventListener('click', () => { estado.pagina++; renderTabla(); });

        $('btnActualizar').addEventListener('click', () => leerArchivoDatos(true));
        const seleccionar = () => $('inputArchivo').click();
        $('btnCargar').addEventListener('click', seleccionar);
        $('btnCargarVacio').addEventListener('click', seleccionar);
        $('inputArchivo').addEventListener('change', evento => {
            cargarArchivoManual(evento.target.files[0]);
            evento.target.value = '';
        });

        let nivelArrastre = 0;
        window.addEventListener('dragenter', evento => { evento.preventDefault(); nivelArrastre++; document.body.classList.add('arrastrando'); });
        window.addEventListener('dragleave', () => { if (--nivelArrastre <= 0) { nivelArrastre = 0; document.body.classList.remove('arrastrando'); } });
        window.addEventListener('dragover', evento => evento.preventDefault());
        window.addEventListener('drop', evento => {
            evento.preventDefault();
            nivelArrastre = 0;
            document.body.classList.remove('arrastrando');
            cargarArchivoManual(evento.dataTransfer.files[0]);
        });
    }

    iniciarEventos();
    leerArchivoDatos(false);
})();
