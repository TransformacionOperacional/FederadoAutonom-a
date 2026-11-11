// Protección de sesión del Cotizador Vida Grupo.
// La sesión se crea en Login.html tras validar usuario/contraseña y el OTP (ver js/login.js).
(function () {
    'use strict';

    const LOGIN_PAGE = 'Login.html';
    const CLAVE_DATOS_USUARIO = 'datosUsuario';
    const MAX_TIMEOUT_MS = 2147483647;

    function cerrarSesion() {
        localStorage.removeItem('token');
        localStorage.removeItem('token2');
        localStorage.removeItem(CLAVE_DATOS_USUARIO);
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

    // Datos de la sesión (no sensibles) guardados por login.js tras validar el OTP; null si no existen.
    function leerSesion() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE_DATOS_USUARIO));
            return datos && typeof datos === 'object' ? datos : null;
        } catch (error) {
            return null;
        }
    }

    function milisegundosHastaExpirar(sesion) {
        const expiracion = sesion?.fechaExpiracion ? new Date(sesion.fechaExpiracion).getTime() : NaN;
        return Number.isFinite(expiracion) ? expiracion - Date.now() : Infinity;
    }

    function sesionVigente() {
        const sesion = leerSesion();
        return Boolean(
            localStorage.getItem('token') &&
            localStorage.getItem('token2') &&
            sesion &&
            milisegundosHastaExpirar(sesion) > 0
        );
    }

    function formatearNombre(texto) {
        return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1).toLocaleLowerCase('es');
    }

    // Datos del usuario logueado según la respuesta de la API de validación del OTP.
    function obtenerUsuario() {
        const datos = leerSesion();
        if (!datos) return null;
        const nombreCompleto = String(datos.nombreCompleto || '').trim();
        const primerNombre = nombreCompleto.split(/\s+/)[0] || '';
        return {
            usuario: String(datos.usuario || '').trim(),
            correo: String(datos.correo || '').trim(),
            nombreCompleto,
            perfil: String(datos.perfil || '').trim(),
            fechaExpiracion: datos.fechaExpiracion || null,
            primerNombre: primerNombre ? formatearNombre(primerNombre) : ''
        };
    }

    function mostrarSaludo() {
        const titulo = document.getElementById('saludoUsuario');
        const usuario = obtenerUsuario();
        if (titulo && usuario?.primerNombre) titulo.textContent = `¡Hola, ${usuario.primerNombre}!`;
    }

    // Cierra la sesión en el momento de la expiración, y la revalida al volver a la pestaña
    // (los temporizadores se pausan si el equipo se suspende).
    function vigilarExpiracion() {
        const restante = milisegundosHastaExpirar(leerSesion());
        if (Number.isFinite(restante)) setTimeout(cerrarSesion, Math.min(Math.max(restante, 0), MAX_TIMEOUT_MS));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !sesionVigente()) cerrarSesion();
        });
    }

    function protegerPagina() {
        if (!sesionVigente()) {
            cerrarSesion();
            return;
        }
        vigilarExpiracion();
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
