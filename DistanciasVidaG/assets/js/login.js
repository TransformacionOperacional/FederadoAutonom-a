// Inicio de sesión compartido para el tablero de Vida Grupo.
(function () {
    'use strict';

    const LOGIN_URL = 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/837da8653c374ea38d3b18d141712594/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-tuTKQsJJUvueQ8daEmop0lzuzvVl4xHkUii944MRt8';

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('formulario');
        const correo = document.getElementById('Correo');
        const clave = document.getElementById('Clave');
        const respuesta = document.getElementById('respuesta');
        const cargando = document.getElementById('pantallaCarga');
        const boton = document.getElementById('login-button');

        form.addEventListener('submit', async event => {
            event.preventDefault();
            respuesta.textContent = '';
            correo.classList.remove('campo-invalido');
            clave.classList.remove('campo-invalido');
            boton.disabled = true;
            cargando.classList.add('show');

            try {
                const response = await fetch(LOGIN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        Correo: correo.value.trim(),
                        Clave: clave.value,
                        origenSolicitud: 'Pagina Web'
                    })
                });

                if (response.status === 402) {
                    correo.classList.add('campo-invalido');
                    clave.classList.add('campo-invalido');
                    respuesta.textContent = 'El correo o contraseña no es válido. Intenta de nuevo.';
                    return;
                }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                if (data.validacion !== 'OK' || !data.token || !data.token2) {
                    throw new Error('La respuesta de autenticación no contiene una sesión válida.');
                }

                localStorage.setItem('token', data.token);
                localStorage.setItem('token2', data.token2);
                window.location.replace('index.html');
            } catch (error) {
                console.error('No fue posible iniciar sesión:', error);
                respuesta.textContent = 'No fue posible validar las credenciales. Intenta nuevamente.';
            } finally {
                cargando.classList.remove('show');
                boton.disabled = false;
            }
        });
    });
})();
