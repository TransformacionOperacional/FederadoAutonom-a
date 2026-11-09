// Protección de sesión del Cotizador Vida Grupo (misma API que el tablero de Vida Grupo).
(function () {
    'use strict';

    const VALIDAR_TOKEN_URL = 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/8a4ca32652c8423da0bf840c807851cd/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=dhD7PQamDrvJKiIRjygu0FyN4ZurhQrIqk-wu2H5MAs';
    const LOGIN_PAGE = 'Login.html';

    function cerrarSesion() {
        localStorage.removeItem('token');
        localStorage.removeItem('token2');
        localStorage.removeItem('correoElectronico');
        window.location.replace(LOGIN_PAGE);
    }

    function solicitarCerrarSesion() {
        const modal = document.getElementById('modalConfirmarCerrarSesion');
        if (!modal) throw new Error('No fue posible abrir la confirmación para cerrar sesión.');
        modal.style.display = 'flex';
        modal.querySelector('.btn-secondary')?.focus();
    }

    function cancelarCerrarSesion() {
        const modal = document.getElementById('modalConfirmarCerrarSesion');
        if (modal) modal.style.display = 'none';
    }

    function confirmarCerrarSesion() {
        cerrarSesion();
    }

    async function validarToken(token) {
        try {
            const response = await fetch(VALIDAR_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            if (!response.ok) return false;
            return (await response.json()).EsValido === true;
        } catch (error) {
            console.error('No fue posible validar la sesión:', error);
            return false;
        }
    }

    // Decodifica el contenido (JSON en base64) de un token; devuelve null si no es válido.
    function decodificarToken(token) {
        if (!token) return null;
        const candidatos = [token, ...String(token).split('.')];
        for (const candidato of candidatos) {
            try {
                const base64 = candidato.replace(/-/g, '+').replace(/_/g, '/');
                const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
                const bytes = Uint8Array.from(binario, caracter => caracter.charCodeAt(0));
                const datos = JSON.parse(new TextDecoder('utf-8').decode(bytes));
                if (datos && typeof datos === 'object') return datos;
            } catch (error) {
                // Se prueba con el siguiente candidato.
            }
        }
        return null;
    }

    function formatearNombre(texto) {
        return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1).toLocaleLowerCase('es');
    }

    // Datos del usuario logueado según el token de sesión.
    function obtenerUsuario() {
        const datos = decodificarToken(localStorage.getItem('token')) || decodificarToken(localStorage.getItem('token2'));
        if (!datos) return null;
        const nombreCompleto = String(datos.NombreCompleto || '').trim();
        const primerNombre = nombreCompleto.split(/\s+/)[0] || '';
        return {
            correo: String(datos.CorreoElectronico || '').trim(),
            nombreCompleto,
            primerNombre: primerNombre ? formatearNombre(primerNombre) : ''
        };
    }

    function mostrarSaludo() {
        const titulo = document.getElementById('saludoUsuario');
        const usuario = obtenerUsuario();
        if (titulo && usuario?.primerNombre) titulo.textContent = `¡Hola, ${usuario.primerNombre}!`;
    }

    async function protegerPagina() {
        const token = localStorage.getItem('token');
        const token2 = localStorage.getItem('token2');
        if (!token && !token2) {
            cerrarSesion();
            return;
        }

        const [tokenValido, token2Valido] = await Promise.all([
            token ? validarToken(token) : false,
            token2 ? validarToken(token2) : false
        ]);

        if (!tokenValido && !token2Valido) {
            cerrarSesion();
            return;
        }
        if (!tokenValido && token2Valido) localStorage.setItem('token', token2);

        document.documentElement.classList.remove('auth-pending');
    }

    window.CotizadorVGAuth = { cerrarSesion, solicitarCerrarSesion, cancelarCerrarSesion, confirmarCerrarSesion, obtenerUsuario };
    protegerPagina();
    document.addEventListener('DOMContentLoaded', mostrarSaludo);
    document.addEventListener('keydown', evento => {
        const modal = document.getElementById('modalConfirmarCerrarSesion');
        if (evento.key === 'Escape' && modal?.style.display === 'flex') cancelarCerrarSesion();
    });
})();
