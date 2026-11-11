// Inicio de sesión en dos pasos: 1) usuario y contraseña (se envía un OTP al correo), 2) validación del OTP.
// Los endpoints se leen de window.__ENV__ (js/env.js, no versionado). Ver js/env.example.js.
(function () {
    'use strict';

    const CLAVE_TOKEN = 'token';
    const CLAVE_TOKEN2 = 'token2';
    const CLAVE_DATOS_USUARIO = 'datosUsuario';
    const DESTINO_LOGIN = 'index.html';
    const TIMEOUT_MS = 45000;
    const LONGITUD_OTP = 6;
    const MENSAJE_LOGIN_ERROR = 'No fue posible validar las credenciales.';
    const MENSAJE_OTP_INVALIDO = 'El código es inválido o ha expirado.';
    const MENSAJE_OTP_ERROR = 'No fue posible validar el código. Intenta nuevamente.';

    // Estado temporal en memoria (nunca se persiste).
    let solicitudId = null;
    let enviandoLogin = false;
    let enviandoOtp = false;

    function limpiarSesionLocal() {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_TOKEN2);
        localStorage.removeItem(CLAVE_DATOS_USUARIO);
        localStorage.removeItem('correoElectronico');
    }

    function leerConfiguracion() {
        const env = window.__ENV__ || {};
        const loginUrl = String(env.AUTH_LOGIN_API_URL || '');
        const otpUrl = String(env.AUTH_OTP_API_URL || '');
        return loginUrl && otpUrl ? { loginUrl, otpUrl } : null;
    }

    // POST JSON con timeout. Devuelve { status, ok, data } (data = null si no hay JSON válido).
    async function postJson(url, cuerpo) {
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo),
                signal: controlador.signal
            });
            let data = null;
            try {
                data = await response.json();
            } catch (error) {
                data = null;
            }
            return { status: response.status, ok: response.ok, data };
        } finally {
            clearTimeout(temporizador);
        }
    }

    function mensajeSeguro(data, porDefecto) {
        const texto = data && typeof data.mensaje === 'string' ? data.mensaje.trim() : '';
        return texto && texto.length <= 200 ? texto : porDefecto;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('formulario');
        const usuario = document.getElementById('Usuario');
        const clave = document.getElementById('Clave');
        const respuesta = document.getElementById('respuesta');
        const cargando = document.getElementById('pantallaCarga');
        const boton = document.getElementById('login-button');
        const tarjeta = document.getElementById('tarjetaLogin');

        const modal = document.getElementById('modalVerificacionOtp');
        const formOtp = document.getElementById('formularioOtp');
        const campoOtp = document.getElementById('codigoOtp');
        const errorOtp = document.getElementById('errorOtp');
        const cargandoOtp = document.getElementById('cargandoOtp');
        const btnVerificar = document.getElementById('btnVerificarOtp');
        const btnCancelar = document.getElementById('btnCancelarOtp');
        const btnCerrar = document.getElementById('btnCerrarOtp');

        function otpCompleto() {
            return campoOtp.value.length === LONGITUD_OTP;
        }

        function actualizarEstadoOtp() {
            btnVerificar.disabled = enviandoOtp || !otpCompleto();
            btnCancelar.disabled = enviandoOtp;
            btnCerrar.disabled = enviandoOtp;
            campoOtp.disabled = enviandoOtp;
            cargandoOtp.hidden = !enviandoOtp;
            modal.setAttribute('aria-busy', String(enviandoOtp));
        }

        function mostrarErrorOtp(mensaje) {
            errorOtp.textContent = mensaje;
            errorOtp.hidden = !mensaje;
        }

        function abrirModalOtp() {
            campoOtp.value = '';
            mostrarErrorOtp('');
            modal.hidden = false;
            tarjeta.inert = true;
            actualizarEstadoOtp();
            campoOtp.focus();
        }

        function cerrarModalOtp() {
            if (enviandoOtp) return;
            campoOtp.value = '';
            solicitudId = null;
            mostrarErrorOtp('');
            modal.hidden = true;
            tarjeta.inert = false;
            clave.value = '';
            clave.focus();
        }

        // --- Paso 1: usuario y contraseña ---
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (enviandoLogin) return;

            respuesta.textContent = '';
            usuario.classList.remove('campo-invalido');
            clave.classList.remove('campo-invalido');

            const usuarioIngresado = usuario.value.trim();
            const claveIngresada = clave.value;
            if (!usuarioIngresado || !claveIngresada) {
                if (!usuarioIngresado) usuario.classList.add('campo-invalido');
                if (!claveIngresada) clave.classList.add('campo-invalido');
                respuesta.textContent = 'Ingresa tu usuario y contraseña.';
                (usuarioIngresado ? clave : usuario).focus();
                return;
            }

            const configuracion = leerConfiguracion();
            if (!configuracion) {
                console.error('Configuración de autenticación no disponible (js/env.js).');
                respuesta.textContent = MENSAJE_LOGIN_ERROR;
                return;
            }

            enviandoLogin = true;
            boton.disabled = true;
            cargando.classList.add('show');
            limpiarSesionLocal();

            try {
                const { ok, data } = await postJson(configuracion.loginUrl, {
                    usuario: usuarioIngresado,
                    password: claveIngresada
                });

                const idSolicitud = data && typeof data.solicitudId === 'string' ? data.solicitudId.trim() : '';
                if (!ok || !data || data.success !== true || data.requiresOtp !== true || !idSolicitud) {
                    usuario.classList.add('campo-invalido');
                    clave.classList.add('campo-invalido');
                    respuesta.textContent = MENSAJE_LOGIN_ERROR;
                    return;
                }

                solicitudId = idSolicitud;
                abrirModalOtp();
            } catch (error) {
                console.error('No fue posible iniciar sesión.');
                respuesta.textContent = MENSAJE_LOGIN_ERROR;
            } finally {
                enviandoLogin = false;
                cargando.classList.remove('show');
                boton.disabled = false;
            }
        });

        // --- Paso 2: código OTP ---
        // Solo dígitos, máximo seis (también al pegar).
        campoOtp.addEventListener('beforeinput', event => {
            if (event.data && /\D/.test(event.data)) event.preventDefault();
        });
        campoOtp.addEventListener('input', () => {
            campoOtp.value = campoOtp.value.replace(/\D/g, '').slice(0, LONGITUD_OTP);
            actualizarEstadoOtp();
        });

        formOtp.addEventListener('submit', async event => {
            event.preventDefault();
            if (enviandoOtp || !otpCompleto() || !solicitudId) return;

            const configuracion = leerConfiguracion();
            if (!configuracion) {
                mostrarErrorOtp(MENSAJE_OTP_ERROR);
                return;
            }

            enviandoOtp = true;
            mostrarErrorOtp('');
            actualizarEstadoOtp();

            let autenticado = false;
            try {
                const { data } = await postJson(configuracion.otpUrl, {
                    solicitudId,
                    codigo: campoOtp.value
                });

                const tokenSesion = data && typeof data.tokenSesion === 'string' ? data.tokenSesion.trim() : '';
                if (!data || data.success !== true || !tokenSesion) {
                    limpiarSesionLocal();
                    mostrarErrorOtp(mensajeSeguro(data, MENSAJE_OTP_INVALIDO));
                    return;
                }

                const fechaExpiracion = Number.isFinite(new Date(data.fechaExpiracion).getTime())
                    ? String(data.fechaExpiracion)
                    : null;
                const datosUsuario = {
                    usuario: String(data.usuario || ''),
                    nombreCompleto: String(data.nombreCompleto || ''),
                    correo: String(data.correo || ''),
                    perfil: String(data.perfil || ''),
                    fechaExpiracion
                };

                // Compatibilidad: token y token2 conservan su nombre; ambos llevan el token de sesión.
                localStorage.setItem(CLAVE_TOKEN, tokenSesion);
                localStorage.setItem(CLAVE_TOKEN2, tokenSesion);
                localStorage.setItem(CLAVE_DATOS_USUARIO, JSON.stringify(datosUsuario));

                autenticado = true;
                campoOtp.value = '';
                solicitudId = null;
                window.location.replace(DESTINO_LOGIN);
            } catch (error) {
                console.error('No fue posible validar el código.');
                limpiarSesionLocal();
                mostrarErrorOtp(MENSAJE_OTP_ERROR);
            } finally {
                if (!autenticado) {
                    enviandoOtp = false;
                    campoOtp.value = '';
                    actualizarEstadoOtp();
                    campoOtp.focus();
                }
            }
        });

        btnCancelar.addEventListener('click', cerrarModalOtp);
        btnCerrar.addEventListener('click', cerrarModalOtp);

        // Clic fuera del contenido: cierra solo si no hay una solicitud en curso.
        modal.addEventListener('mousedown', event => {
            if (event.target === modal) cerrarModalOtp();
        });

        // Escape cierra (si no se está enviando) y Tab queda atrapado dentro del modal.
        document.addEventListener('keydown', event => {
            if (modal.hidden) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                cerrarModalOtp();
                return;
            }
            if (event.key !== 'Tab') return;
            const enfocables = [...modal.querySelectorAll('button, input')].filter(el => !el.disabled && !el.hidden);
            if (!enfocables.length) {
                event.preventDefault();
                return;
            }
            const primero = enfocables[0];
            const ultimo = enfocables[enfocables.length - 1];
            if (event.shiftKey && document.activeElement === primero) {
                event.preventDefault();
                ultimo.focus();
            } else if (!event.shiftKey && document.activeElement === ultimo) {
                event.preventDefault();
                primero.focus();
            }
        });
    });
})();
