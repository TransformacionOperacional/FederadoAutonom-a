# 2. Tasa pura

**Función:** `obtenerTasaPuraConRecargoOcupacional(cobertura, edad, deducible, plan)` en [`js/app.js`](../../js/app.js).

La tasa pura es la tasa técnica de la cobertura **antes** de gastos comerciales. Se construye en tres pasos.

## Paso 1: tasa base

$$
T_{base} =
\begin{cases}
T_{API}(amparo, edad) & \text{si la API devuelve tasa} \\[4pt]
\dfrac{T_{cat} \times FE(edad)}{100} & \text{si no hay tasa de la API}
\end{cases}
$$

- $T_{API}$ proviene de la columna **`Tasa -20%`** de la API de tasas, filtrada por `Core = GW`, indexada por `código de amparo + edad`.
- $T_{cat}$ es la tasa del catálogo de la cobertura (por defecto `TASA_BASE_SISTEMA = 0,1`).
- $FE(edad)$ es el factor de edad de respaldo (`CONFIG.FACTORES_EDAD`):

| Edad | Factor |
|------|--------|
| 18 – 25 | 0,95 |
| 26 – 35 | 1,00 |
| 36 – 45 | 1,10 |
| 46 – 55 | 1,25 |
| 56 – 65 | 1,50 |
| 66 o más | 1,80 |

### Renta por incapacidad (`WFA`)

La tasa depende también del **deducible** (`7-30`, `3-30`, `15-60`, `14-90`; por defecto `7-30`). La llave de búsqueda es `amparo-edad-deducible`. Si no existe tasa para esa combinación, la cobertura **no se calcula** (prima 0 y «Sin tasa»).

## Paso 2: extraprima de Cáncer in Situ

Solo aplica a Enfermedades Graves (`WEU`, `WEV`) cuando el plan activa la opción de Cáncer in Situ:

$$
R_{CIS} = T_{CIS} \times \frac{F_{EG}}{0{,}50} \times 10\%
$$

| Símbolo | Valor |
|---------|-------|
| $T_{CIS}$ | $0{,}678 / 1000$ (`TASA_CANCER_IN_SITU`) |
| $F_{EG}$ | Factor de Enfermedades Graves del plan (0,40 / 0,50 / 0,60) |
| $0{,}50$ | Factor de referencia (`FACTOR_REFERENCIA_CANCER_IN_SITU`) |
| $10\%$ | Recargo (`RECARGO_CANCER_IN_SITU`) |

$$
T_{CIS\,total} = T_{base} + R_{CIS}
$$

## Paso 3: recargo por actividad económica

$$
T_{pura} = T_{CIS\,total} \times \bigl(1 + R_{act}\bigr)
$$

$R_{act}$ proviene de la actividad económica elegida en la póliza (`obtenerRecargoPorActividad`). Solo existe para cuatro coberturas:

| Cobertura | Campo de la actividad |
|-----------|-----------------------|
| `WET` Vida | `field_3` |
| `WEZ` Invalidez | `field_4` |
| `WE1` | `field_5` |
| `WEY` Invalidez por accidente | `field_6` |

La API entrega el recargo como factor decimal (`0,5` equivale a 50 %); el código lo convierte a puntos porcentuales y luego lo divide entre 100. Las demás coberturas tienen recargo 0.

> El recargo por actividad es de **póliza**: se aplica igual a todos los asegurados. No existe recargo por ocupación individual; `CONFIG.FACTORES_OCUPACION` y `obtenerFactorOcupacional` existen pero no se usan en el cálculo.

## Resultado

$$
T_{pura} = \bigl(T_{base} + R_{CIS}\bigr) \times \bigl(1 + R_{act}\bigr)
$$
