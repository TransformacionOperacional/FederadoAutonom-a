# Cotizador Masivo - Plan Crédito Protegido (PCP)

## 📋 Descripción

Sistema web completo para la cotización masiva de planes de crédito protegido de SURA. Permite procesar múltiples clientes simultáneamente desde archivos Excel, generando calculaciones automáticas y entregando resultados en Excel con estilos corporativos.

## 🚀 Características Principales

- ✅ **Cotización Individual**: Interfaz web para cotizar un cliente a la vez con formulario completo
- ✅ **Carga Masiva**: Procesa múltiples clientes desde Excel en segundos
- ✅ **Validación Automática**: Valida datos de entrada (edad 18-75, valor mínimo $1M)
- ✅ **Cálculos Precisos**: Calcula primas por edad, incluyendo:
  - Prima Anual (VIDA + ITP)
  - Prima Mensual
  - Prima Trimestral
  - Prima Semestral
- ✅ **Excel Profesional**: Genera reportes con estilos SURA
- ✅ **Interfaz SURA**: Colores corporativos (#0033A0, #00AAEC)
- ✅ **Drag & Drop**: Carga archivos arrastrando y soltando
- ✅ **Progreso Visual**: Barra de progreso durante el procesamiento

## 📁 Archivos Incluidos

```
CotizadorPCP-Contingente/
├── Menu.html                 # Página principal - acceso a ambas modalidades
├── index.html               # Cotización individual (Pantalla 1)
├── Pantalla2PCP.html        # Cotización individual (Pantalla 2)
├── CargaMasiva.html         # Interfaz de carga masiva
├── CargaMasiva.js           # Lógica de cálculos y procesamiento
├── FuncionesPantalla1.js    # Funciones de Pantalla 1
├── FuncionesPantalla2.js    # Funciones de Pantalla 2
├── EstilosPantalla1.css     # Estilos Pantalla 1
├── EstilosPantalla2.css     # Estilos Pantalla 2
├── assets/                  # Recursos (CSS, JS, imágenes)
├── Simulador PCP 1 3.xlsx   # Archivo de referencias (tasas por edad)
└── README.md               # Este archivo
```

## 🎯 Cómo Usar

### Opción 1: Cotización Individual

1. Abre `Menu.html` en el navegador
2. Haz clic en **"Cotización Individual"**
3. Completa el formulario con los datos del cliente
4. Haz clic en "Enviar"
5. En Pantalla 2, ingresa los datos del seguro
6. Haz clic en "Cotizar"

### Opción 2: Carga Masiva

#### Paso 1: Descargar Plantilla
1. Abre `Menu.html` en el navegador
2. Haz clic en **"Carga Masiva"**
3. Haz clic en el botón **"Descargar Plantilla"**
4. Se descargará `Plantilla_Cotizador_Masivo.xlsx`

#### Paso 2: Completar Datos
Abre el archivo descargado y completa con tus cliente:

| Nombre del Cliente | Edad | Valor Asegurado | Forma de Pago |
|-------------------|------|-----------------|---------------|
| Juan Pérez García | 35 | 50000000 | Mensual |
| María González | 42 | 75000000 | Trimestral |
| Carlos Martínez | 38 | 60000000 | Semestral |

**Validaciones:**
- **Edad**: 18 a 75 años
- **Valor Asegurado**: Mínimo $1.000.000
- **Forma de Pago**: Mensual, Trimestral, Semestral o Anual

#### Paso 3: Cargar Archivo
1. En la página de Carga Masiva, arrastra el archivo Excel al área indicada
2. O haz clic para seleccionar el archivo
3. El sistema mostrará un preview de los primeros 10 registros

#### Paso 4: Procesar
1. Haz clic en **"Procesar Cotizaciones"**
2. Espera a que se completen los cálculos (barra de progreso)
3. Se mostrarán las estadísticas finales

#### Paso 5: Descargar Resultados
1. Haz clic en **"Descargar Resultados (Excel)"**
2. Se descargará un archivo con todos los cálculos

### Archivo de Salida

El Excel generado contiene:

| Columna | Descripción |
|---------|-------------|
| Nombre del Cliente | Del registro de entrada |
| Edad | Del registro de entrada |
| Valor Asegurado | Del registro de entrada |
| Forma de Pago | Del registro de entrada |
| Tasa VIDA | Tasa aplicada por edad |
| Tasa ITP | Tasa aplicada por edad |
| Prima Anual VIDA | Cálculo anual - Cobertura VIDA |
| Prima Anual ITP | Cálculo anual - Cobertura ITP |
| Prima Anual Total | Total anual (VIDA + ITP) |
| Prima Mensual VIDA | Prima Anual VIDA / 12 |
| Prima Mensual ITP | Prima Anual ITP / 12 |
| Prima Mensual Total | Total mensual (VIDA + ITP) |
| Prima Trimestral VIDA | Prima Anual VIDA / 4 |
| Prima Trimestral ITP | Prima Anual ITP / 4 |
| Prima Trimestral Total | Total trimestral (VIDA + ITP) |
| Prima Semestral VIDA | Prima Anual VIDA / 2 |
| Prima Semestral ITP | Prima Anual ITP / 2 |
| Prima Semestral Total | Total semestral (VIDA + ITP) |
| Estado | "Exitoso" o "Error" |
| Error | Descripción del error (si aplica) |

## 💡 Fórmula de Cálculo

```
Prima Anual = (Valor Asegurado × Tasa) / 1000

Donde:
- Valor Asegurado: Monto ingresado por usuario
- Tasa: Tasa por edad (tasas predefinidas en sistema)
- 1000: Factor de conversión de tasa por mil

Ejemplo:
- Valor: $50.000.000
- Edad: 35 años
- Tasa VIDA para 35: 1.898
- Prima Anual VIDA = (50.000.000 × 1.898) / 1000 = $94.900

Luego se divide según forma de pago:
- Mensual: Prima Anual / 12
- Trimestral: Prima Anual / 4
- Semestral: Prima Anual / 2
- Anual: Prima Anual (sin división)
```

## 📊 Tabla de Tasas por Edad

Las tasas están predefinidas por edad y producto:

- **VIDA COMERCIAL**: Tasas por edad ($2.020$ a $53.153$ por mil, para edades 18 a 79).
- **ITP COMERCIAL**: Tasas por edad ($0.052$ a $3.372$ por mil, para edades 18 a 76).
- Para las edades 77 a 79 no hay tasa ITP asignada; se cotiza únicamente la cobertura VIDA.

Rango de edades soportadas: 18 a 79 años

## ⚠️ Códigos de Error

| Error | Causa | Solución |
|-------|-------|----------|
| Edad fuera de rango permitido | Edad < 18 o > 75 | Verifica la edad del cliente |
| Valor asegurado menor a $1M | Valor < 1.000.000 | Aumenta el valor a cotizar |
| Tasas no disponibles | Edad fuera del rango | Edad debe estar entre 18 y 75 |
| Edad inválida | Campo vacío o no es número | Completa la edad correctamente |
| Nombre faltante | Campo vacío | Ingresa nombre del cliente |
| Forma de pago inválida | Valor no reconocido | Usa: Mensual, Trimestral, Semestral o Anual |

## 🎨 Estilos y Colores

Sistema implementa los colores corporativos SURA:

- **Azul Principal**: #0033A0
- **Azul Oscuro**: #002080
- **Azul Claro**: #EFF4FF
- **Cian**: #00AAEC
- **Blanco**: #FFFFFF
- **Gris Claro**: #F5F5F5
- **Gris Oscuro**: #888888

## 🔧 Requisitos Técnicos

### Navegador
- Chrome/Edge (versión 60+)
- Firefox (versión 55+)
- Safari (versión 11+)

### Librerías Externas (CDN)
- **XLSX.js**: Lectura de archivos Excel
- **ExcelJS**: Generación de archivos Excel
- **FontAwesome**: Iconos web

## 📱 Compatibilidad

- ✅ Escritorio (Windows, Mac, Linux)
- ✅ Tablet
- ✅ Responsive design

## 🚨 Limitaciones Conocidas

- Máximo 1000 registros por carga (por rendimiento)
- Excel debe estar en formato .xlsx o .xls
- Primera fila debe contener encabezados
- Los cálculos usan tasas predefinidas (no conectado a BD)

## 📞 Soporte

**Email**: cevidayrentas@suramericana.com.co

Para reportar problemas:
- Describe el error detalladamente
- Incluye el archivo Excel si es posible
- Adjunta pantallazos del error

## 📝 Versión

**Versión**: 1.0
**Fecha**: 2026-04-14
**Producto**: Plan Crédito Protegido (PCP)

## ⚖️ Notas Legales

Este software es propiedad de SURA y está diseñado únicamente para uso interno en la cotización de planes de crédito protegido. Las tasas y cálculos están sujetos a políticas internas y pueden cambiar sin previo aviso.

---

**¡Gracias por usar nuestro Cotizador PCP!** 🙏
