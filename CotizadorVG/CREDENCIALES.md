# Configuración de Credenciales - API SURA

## 📋 Pasos para Obtener las Credenciales

### 1. Obtener las Cookies de SURA

**Pasos en Google Chrome:**

1. Abre https://formsweb.suranet.com en tu navegador
2. Presiona `F12` para abrir Developer Tools
3. Ve a la pestaña **Application** o **Storage**
4. En el panel izquierdo, bajo **Cookies**, selecciona `https://formsweb.suranet.com`
5. Busca y copia los valores de estas 3 cookies:

#### Cookie 1: `visid_incap_2394671`
```
Buscar en la tabla de cookies por nombre: visid_incap_2394671
Copiar el valor (ej: GCBidoJ5SBekvzFDsRTb5JVyXmkAAAAAQUIPAAAAAABsxwfTcUFnGEq2iZfn1Uqr)
```

#### Cookie 2: `appTag`
```
Buscar en la tabla de cookies por nombre: appTag
Copiar el valor (ej: 92ed87652e320765c9fd1d8128374d2a5050e1be94f958916ae86b7b3f552078)
```

#### Cookie 3: `XSRF-TOKEN`
```
Buscar en la tabla de cookies por nombre: XSRF-TOKEN
Copiar el valor (ej: b9309dd0db4e31dac15d088d9da26bb3e17ce8fb51b6054408054797c131acdb)
```

---

## 🔧 Actualizar config.credentials.json

Una vez tengas los valores, actualiza el archivo `config.credentials.json`:

```json
{
  "apiUrl": "https://formsweb.suranet.com/pls/MODINT/PKG_ONYX_PVINCULACIONES.PRO_PPAL",
  "headers": {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://formsweb.suranet.com",
    "Referer": "https://formsweb.suranet.com/pls/MODINT/pkg_onyx_pvinculaciones.PRO_VINC_CLIENTE?v_cod=1000&v_fech_id=359001&v_cons_id=0",
    "User-Agent": "Mozilla/5.0"
  },
  "cookies": {
    "visid_incap": "GCBidoJ5SBekvzFDsRTb5JVyXmkAAAAAQUIPAAAAAABsxwfTcUFnGEq2iZfn1Uqr",
    "appTag": "92ed87652e320765c9fd1d8128374d2a5050e1be94f958916ae86b7b3f552078",
    "xsrf_token": "b9309dd0db4e31dac15d088d9da26bb3e17ce8fb51b6054408054797c131acdb"
  },
  "formParams": {
    "v_cod": "1000",
    "v_fech_id": "359001",
    "v_cons_id": "0",
    "v_tipocons": "038"
  }
}
```

**Nota:** Reemplaza los valores ejemplo por los que copiaste de tus cookies reales.

---

## ⚠️ Consideraciones Importantes

### Expiración de Cookies
Las cookies de SURA expiran después de cierto tiempo. Si dejas de recibir respuestas:
1. Abre nuevamente https://formsweb.suranet.com
2. Repite el proceso para obtener cookies actualizadas
3. Actualiza el archivo `config.credentials.json`

### Seguridad
- **NO** compartas el archivo `config.credentials.json` en repositorios públicos
- Agrega a `.gitignore`:
```
config.credentials.json
```
- En producción, almacena las credenciales en variables de entorno o un servidor seguro

### CORS y Seguridad del Navegador
Si obtienes error de CORS al llamar desde el navegador:
- Solución: Implementa un backend proxy que haga la llamada server-to-server
- O: Usa un backend Node.js/Express que maneje las credenciales de forma segura

---

## 🧪 Prueba de Conexión

Una vez configurado `config.credentials.json`:

1. Abre el cotizador
2. Ve a "Modificación / Renovación"
3. Selecciona "Cédula"
4. Ingresa: `1020455161`
5. Haz clic en "Buscar pólizas"
6. Deberías ver una tabla con las pólizas reales del documento

---

## 📱 Ejemplo de Llamada

La función `consultarAPISura()` ahora hace:

```javascript
// 1. Carga credenciales de config.credentials.json
// 2. Construye los parámetros:
//    - v_cod: 1000
//    - v_fech_id: 359001
//    - v_cons_id: 0
//    - v_persona: C1020455161 (concatenado: tipo + número)
//    - v_tipocons: 038

// 3. Envía POST con cookies en headers
// 4. Recibe HTML con tabla de pólizas
// 5. Parsea y muestra en tabla

// Si hay error, cae a datos mock automáticamente
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Network Error" | Verifica que las cookies sean válidas (pueden haber expirado) |
| "CORS Error" | Implementa backend proxy para hacer la llamada server-to-server |
| "No se encuentran pólizas" | Verifica que el número de documento sea válido |
| "Página en blanco" | Abre Developer Tools (F12) y revisa la consola por errores |

---

## 📞 Contacto / Soporte

Si tienes preguntas, contacta al equipo de desarrollo de SURA.
