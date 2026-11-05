// Protección de sesión compartida para el tablero de Vida Grupo.
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

    window.DistanciasVidaGAuth = { cerrarSesion };
    protegerPagina();
})();
