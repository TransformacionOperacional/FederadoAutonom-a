/**
 * Backend Express Simple para Cotizador SURA
 * Solo hace un trabajo: convertir fetch de navegador a servidor-a-servidor (sin CORS)
 */

const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    console.log('✅ Health check');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint para buscar pólizas
app.post('/api/buscar-polizas', (req, res) => {
    const { persona } = req.body;
    console.log(`\n🔍 Búsqueda para documento: ${persona}`);
    
    if (!persona) {
        return res.status(400).json({ error: 'Documento requerido' });
    }

    // Parámetros para SURA
    const postData = new URLSearchParams({
        v_cod: '1000',
        v_fech_id: '359001',
        v_cons_id: '0',
        v_persona: persona,
        v_tipocons: '038'
    }).toString();

    console.log('📤 POST a https://formsweb.suranet.com/pls/MODINT/PKG_ONYX_PVINCULACIONES.PRO_PPAL');
    console.log('📋 Parámetros:', postData);

    // Llamada HTTPS a SURA (servidor a servidor, sin CORS)
    const options = {
        hostname: 'formsweb.suranet.com',
        path: '/pls/MODINT/PKG_ONYX_PVINCULACIONES.PRO_PPAL',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
    };

    const request = https.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            console.log(`✅ Respuesta recibida (${data.length} caracteres)`);
            console.log('📄 Primeros 300 caracteres:', data.substring(0, 300));
            
            res.json({
                html: data,
                status: response.statusCode,
                persona: persona
            });
        });
    });

    request.on('error', (error) => {
        console.error(`❌ Error en conexión a SURA:`, error.message);
        
        // Retornar error pero con status 200 para que el frontend lo maneje
        res.status(500).json({
            error: error.message,
            status: 500,
            persona: persona
        });
    });

    request.on('timeout', () => {
        console.error('⏱️ Timeout en conexión a SURA');
        request.destroy();
        res.status(500).json({
            error: 'Timeout conectando a SURA',
            status: 500,
            persona: persona
        });
    });

    request.write(postData);
    request.end();
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 Backend Express iniciado                             ║
║  📍 http://localhost:${PORT}                               ║
║  🔗 Health: http://localhost:${PORT}/health              ║
║  📡 Buscar: POST http://localhost:${PORT}/api/buscar-polizas  ║
║  📝 Cuerpo: {"persona":"C1020455161"}                    ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
