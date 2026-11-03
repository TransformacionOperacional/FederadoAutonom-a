# 8. Parámetros y constantes

Valores que alimentan los cálculos. Están definidos al inicio de [`js/app.js`](../../js/app.js) (secciones `CONFIG` y constantes `*_CREDIBILIDAD`, `*_CANCER_IN_SITU`, etc.). Cambiar un valor aquí requiere cambiarlo en el código.

## Tarifación

| Constante | Valor | Uso |
|-----------|-------|-----|
| `TASA_BASE_SISTEMA` | 0,1 | Tasa del catálogo cuando la API no devuelve tasa |
| `CONFIG.FACTORES_EDAD` | 0,95 – 1,80 | Respaldo de tasa por banda de edad |
| `TASA_CANCER_IN_SITU` | 0,678 / 1000 | Extraprima de Cáncer in Situ |
| `FACTOR_REFERENCIA_CANCER_IN_SITU` | 0,50 | Referencia del factor de Enfermedades Graves |
| `RECARGO_CANCER_IN_SITU` | 10 % | Recargo de Cáncer in Situ |
| `FACTORES_ENFERMEDADES_GRAVES` | 0,40 / 0,50 / 0,60 | Opciones de porcentaje sobre Vida |
| `FACTOR_ENFERMEDADES_GRAVES_POR_DEFECTO` | 0,60 | Porcentaje si el plan no define uno válido |

## Factor de gasto

| Concepto | Valor |
|----------|-------|
| Comisión | 10 – 30 (variable) |
| Honorario promotora | 0 – 10 (solo promotoras) |
| Retorno | 0 |
| Costo de contrato | 1,64 |
| IVA | 19 % sobre comisión + honorario + retorno |
| Gasto administrativo | 8 (promotoras) / 13 (otros canales) |
| Utilidad | 1,6 |

## Credibilidad

| Constante | Valor |
|-----------|-------|
| `Z6_CREDIBILIDAD.GENERAL` | 1.900 |
| `Z6_CREDIBILIDAD.RENTAS` | 950 |

## Forma de pago

| Forma | Factor | Periodos |
|-------|--------|----------|
| Anual | 0 | 1 |
| Semestral | 0,522 | 2 |
| Trimestral | 0,267 | 4 |
| Mensual | 0,091 | 12 |

## Límites y reglas de negocio

| Regla | Valor |
|-------|-------|
| Valor asegurado máximo en modalidades contributivas | \$300.000.000 |
| Edad máxima de asegurado (`CONFIG.EDAD_MAXIMA_ASEGURADO`) | 70 años |
| Deducibles de Renta por incapacidad | `7-30`, `3-30`, `15-60`, `14-90` (por defecto `7-30`) |
| Coberturas de renta | Incapacidad `WFA`, hospitalización `WE7`, UCI `WE8` |

## Fuentes de datos externas

| Dato | Fuente |
|------|--------|
| Tasas, porcentaje de factor, valor máximo y edad máxima por amparo y edad | API de tasas de coberturas (Power Automate), filas con `Core = GW`; columna de tasa `Tasa -20%` |
| Catálogo de coberturas | [`data/CoberturasVG.json`](../../data/CoberturasVG.json) |
| Recargo por actividad económica | API de actividades económicas (Power Automate) |
| Datos del asesor y pólizas del tomador | APIs de asesores y de pólizas (Power Automate) |

> Los modelos de referencia históricos están en [`docs/referencia`](../referencia): `Prototipo-Version-Ultima.xlsx` y `Prototipo-Version-Ultima-Migracion.xlsx`.
