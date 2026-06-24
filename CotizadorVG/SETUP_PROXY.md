# 🚀 Configuración del Proxy API SURA

## ❌ Problema: CORS

El navegador bloquea llamadas directas a `https://formsweb.suranet.com` desde `http://localhost`.

```
Error: Access to fetch at 'https://formsweb.suranet.com/...' 
from origin 'http://127.0.0.1:5500' has been blocked by CORS policy
```

## ✅ Solución: Proxy Local

Se proporcionan dos opciones:

---

## Opción 1: Servidor Proxy Node.js (Recomendado)

### Requisitos
- Node.js instalado: https://nodejs.org/

### Pasos

#### 1️⃣ Abre terminal/PowerShell en la carpeta `CotizadorVG`

```bash
cd C:\Repogerencia\FederadoAutonom-a\CotizadorVG
```

#### 2️⃣ Inicia el servidor proxy

```bash
node proxy-server.js
```

Deberías ver:
```
✅ Servidor Proxy escuchando en http://localhost:3001
📡 Ruta: POST /buscar-polizas
🔗 El cotizador puede llamar a: http://localhost:3001/buscar-polizas

⚠️  Deja este servidor corriendo mientras usas el cotizador
```

#### 3️⃣ Abre el cotizador en otro navegador

Accede a: `http://127.0.0.1:5500/CotizadorVG/index.html` (o donde tengas el servidor local)

#### 4️⃣ Prueba

1. Selecciona "Modificación / Renovación"
2. Tipo: "Cédula"
3. Número: "1020455161"
4. Haz clic en "Buscar pólizas"
5. ✅ Deberías ver las pólizas reales de SURA

#### ⚠️ Mantener activo

**Importante:** Deja el proxy corriendo (`node proxy-server.js`) mientras usas el cotizador.

Si cierras la terminal del proxy, el cotizador no podrá conectarse.

---

## Opción 2: Usar Python como Proxy (Alternativa)

Si no tienes Node.js:

```bash
cd C:\Repogerencia\FederadoAutonom-a\CotizadorVG
python proxy-server.py
```

(Requiere crear `proxy-server.py` con Flask o similar)

---

## 🔍 Debugging

### El proxy se abrió pero dice "No se puede conectar"

**En la consola del navegador (F12):**

```
Failed to fetch: http://localhost:3001/buscar-polizas
```

**Solución:**
- Verifica que el terminal del proxy sigue corriendo
- Recarga la página (Ctrl+R)
- Si sigue sin funcionar, reinicia el proxy

### El proxy corre pero no trae pólizas

**Mira la consola del proxy:**

Si ves errores en el terminal donde corre `node proxy-server.js`, son errores de conexión a SURA.

Posibles causas:
- Las cookies del APIS.txt están expiradas
- La API de SURA cambió
- Problema de conexión a internet

### Usa datos mock mientras resuelves

Si los problemas persisten, el cotizador caerá automáticamente a datos mock (simulados).

---

## 📝 Archivos Involucrados

```
CotizadorVG/
├── index.html                          # Cotizador web
├── app.js                              # Lógica (usa proxy en localhost:3001)
├── proxy-server.js                     # ⭐ Servidor proxy (ejecutar con Node)
├── config.credentials.json             # (No usar, el proxy usa cookies del APIS.txt)
├── CREDENCIALES.md                     # Docs anteriores
└── SETUP_PROXY.md                      # Este archivo
```

---

## 🔐 Seguridad

- El proxy **NO** almacena credenciales
- Las cookies están embebidas en el código (para desarrollo)
- **Para producción**: Almacenar cookies en variables de entorno

---

## 📞 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| `ERR_CONNECTION_REFUSED` | Abre terminal: `node proxy-server.js` |
| `CORS Error` | El proxy debe estar corriendo |
| `No pólizas encontradas` | Verifica número de documento válido |
| `Error 500 en proxy` | Cookies expiradas o API caída |

---

## ✨ Todo Listo

Una vez el proxy esté corriendo, el cotizador buscará pólizas reales en SURA automáticamente. 🎯
