# Integración API de Búsqueda de Pólizas

## Cambios Realizados

### 1. **Interfaz de Búsqueda Mejorada**
La pantalla de "Modificación / Renovación" ahora incluye:
- **Campo Tipo de Documento**: Selector con opciones (Cédula, Pasaporte, Cédula de Extranjería, NIT)
- **Campo Número de Documento**: Input para ingresar el número
- **Concatenación automática**: Se une automáticamente `Tipo + Número` (ej: C1020455161)

### 2. **Funciones Principales Nuevas**

#### `buscarPolizasRenovacion()`
- Obtiene tipo y número de documento del usuario
- Valida que ambos campos estén completos
- Llama a `consultarAPISura()` con el documento concatenado
- Procesa resultados y muestra pólizas

#### `consultarAPISura(personaId)`
- Hace POST a: `https://formsweb.suranet.com/pls/MODINT/PKG_ONYX_PVINCULACIONES.PRO_PPAL`
- Parámetros enviados:
  - `v_cod`: 1000
  - `v_fech_id`: 359001
  - `v_cons_id`: 0
  - `v_persona`: Documento concatenado (ej: C1020455161)
  - `v_tipocons`: 038

#### `extraerPolizasDelHTML(htmlResponse, personaId)`
- Parsea la respuesta HTML de la API
- Extrae la tabla de pólizas
- Retorna array con información relevante

#### `renderizarPolizasRenovacion(polizas, personaId)`
- Muestra tabla con columnas:
  - Ramo
  - Producto
  - Número de Póliza
  - Vigencia Desde
  - Vigencia Hasta
  - Estado (Vigente/Vencida)
  - Botón Seleccionar

## Información Extraída

Del HTML de la API se extrae:
- **Ramo**: Código de ramo (028, 041, 080, 083, 084, 091, etc.)
- **Producto**: Nombre del producto
- **Número de Póliza**: ID de la póliza
- **Vigencia**: Fechas de inicio y fin
- **Tipo de Vinculación**: ASEGURADO, TOMADOR, BENEFICIADO
- **Número de Riesgo**: ID interno del riesgo
- **Estado**: Determinado por si vigencia hasta > fecha actual

## Conexión a API Real

### Problema CORS
Por defecto, los navegadores bloquean las llamadas directas a dominios externos. Hay dos soluciones:

#### Opción 1: Backend Proxy (Recomendado)
Crear un endpoint en tu servidor backend que haga la llamada:

```javascript
// Backend (Node.js/Express ejemplo)
app.post('/api/buscar-polizas', async (req, res) => {
    const { personaId } = req.body;
    const formData = new URLSearchParams();
    formData.append('v_cod', '1000');
    formData.append('v_fech_id', '359001');
    formData.append('v_cons_id', '0');
    formData.append('v_persona', personaId);
    formData.append('v_tipocons', '038');

    const response = await fetch('https://formsweb.suranet.com/pls/MODINT/PKG_ONYX_PVINCULACIONES.PRO_PPAL', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    });

    const html = await response.text();
    res.json({ html });
});
```

Luego en app.js modificar `consultarAPISura()`:
```javascript
async function consultarAPISura(personaId) {
    const response = await fetch('/api/buscar-polizas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId })
    });
    const data = await response.json();
    return data.html;
}
```

#### Opción 2: CORS Proxy Temporal
Para desarrollo rápido, puedes usar un proxy CORS:

```javascript
const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
const apiUrl = proxyUrl + 'https://formsweb.suranet.com/pls/MODINT/PKG_ONYX_PVINCULACIONES.PRO_PPAL';
```

## Función Mock de Datos

Actualmente, la función `generarHTMLMockPolizas()` devuelve datos simulados.

**Para producción**, reemplázala con datos reales del HTML parseado.

Ejemplo de estructura JSON simulada:
```json
{
  "persona": "C1020455161",
  "nombre": "ARROYAVE*ANAYA**FREDY ANDRES",
  "polizas": [
    {
      "ramo": "083",
      "subramo": "101",
      "producto": "PLAN VIDA INTEGRAL",
      "poliza": "5073085",
      "vigenciaDesde": "2024/10/11",
      "vigenciaHasta": "2024/11/01",
      "tipoVinculacion": "ASEGURADO",
      "numeroRiesgo": "164934"
    }
  ]
}
```

## Flujo de Usuario

1. Usuario selecciona "Modificación / Renovación" en la pantalla inicial
2. Selecciona tipo de documento (ej: Cédula)
3. Ingresa número (ej: 1020455161)
4. Sistema concatena → C1020455161
5. Se consulta la API
6. Se muestra tabla de pólizas encontradas
7. Usuario selecciona una póliza para renovar

## Validaciones Implementadas

- ✅ Tipo de documento requerido
- ✅ Número de documento requerido
- ✅ Validación de formato de fecha para estado
- ✅ Manejo de errores API
- ✅ Mensaje si no hay pólizas encontradas

## Próximos Pasos

1. Implementar backend proxy para llamadas reales a API
2. Ajustar parsing HTML según formato exacto de respuesta
3. Agregar autenticación si es requerida por la API
4. Mejorar manejo de excepciones
5. Agregar logging para debugging
