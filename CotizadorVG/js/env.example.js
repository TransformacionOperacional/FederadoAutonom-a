// Configuración local de autenticación (copiar a js/env.js y diligenciar; js/env.js NO se versiona).
// Equivale a un .env: este sitio es estático, por lo que las variables se exponen en window.__ENV__.
window.__ENV__ = {
    AUTH_LOGIN_API_URL: '<URL de la API 1: validar credenciales y enviar OTP>',
    AUTH_OTP_API_URL: '<URL de la API 2: validar OTP y crear sesión>'
};
