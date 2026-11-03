# 4. Credibilidad

**Funciones:** `obtenerCalculoCredibilidad()`, `obtenerAjustesCredibilidad()` y `obtenerTasaComercialConCredibilidadCobertura()` en [`js/app.js`](../../js/app.js).

La credibilidad mezcla la **tasa teórica** con la **siniestralidad real** de la póliza cuando el usuario informa que conoce sus siniestros.

## Cuándo se aplica

Deben cumplirse todas estas condiciones:

1. `aplicaCredibilidad = true` y `siniestrosInformados = true`.
2. Años de exposición $> 0$ y valor de siniestros $\ge 0$.
3. El asegurado es **elegible**: en Patronal todos; en Voluntaria y Mixta, solo el **Afiliado principal** (los familiares conservan la tasa teórica).
4. La cobertura pertenece a un **grupo de siniestros** con credibilidad.
5. Existe siniestralidad observada para el grupo de la cobertura.

Si alguna condición falla, la cobertura conserva su tasa pura teórica.

## Grupos de siniestros y constante Z6

| Grupo | Coberturas | Z6 | Solo escenario 1 |
|-------|-----------|----|------------------|
| VIDA | `WET` | 1.900 | No |
| ITP | `WEZ`, `WEY`, `WE0` | 1.900 | No |
| ENFERMEDADES GRAVES | `WEU`, `WEV` | 1.900 | No |
| RENTAS POR HOSPITALIZACIÓN | `WE7`, `WE8` | 950 | Sí |
| RENTAS POR INCAPACIDAD | `WE9`, `WFA` | 950 | Sí |

## Escenarios

| Escenario | Condición | Siniestralidad observada usada |
|-----------|-----------|--------------------------------|
| **1** | El usuario conoce los siniestros por grupo de cobertura | El valor del grupo |
| **2** | Solo conoce el total de la cuenta | El total, repartido por peso entre coberturas. Los grupos de rentas **no** participan |

## Fórmulas (por cobertura $c$)

Sea $n_c$ el número de asegurados elegibles con la cobertura, $VA_c$ la suma de sus valores asegurados y $T_{pura,i}$ la tasa pura de cada asegurado.

**Siniestralidad esperada**

$$
E_c = \sum_i T_{pura,i} \times VA_{c,i}
\qquad
T_{teórica,c} = \frac{E_c}{VA_c}
$$

**Peso de la cobertura** dentro de su base (el grupo en el escenario 1, la cuenta completa en el 2):

$$
P_c = \frac{E_c}{E_{base}}
$$

**Siniestralidad observada asignada y tasa real** ($a$ = años de exposición):

$$
O_c = S_{base} \times P_c
\qquad
T_{real,c} = \frac{O_c}{VA_c \times a}
$$

**Factor de credibilidad** (máximo 1):

$$
Z_c = \min\!\left(1,\; \sqrt{\frac{n_c \times a}{Z6}}\right)
$$

**Tasa pura con credibilidad**

$$
T_{cred,c} = T_{real,c} \times Z_c + \bigl(1 - Z_c\bigr) \times T_{teórica,c}
$$

**Incremento o disminución respecto a la tasa teórica**

$$
\Delta_c = \frac{T_{cred,c}}{T_{teórica,c}} - 1
$$

## Tasa comercial con credibilidad

El recargo comercial se aplica **después** de la credibilidad, con la misma función que la tasa teórica:

$$
T_{comercial,c} = \frac{T_{cred,c}}{1 - FG}
$$

La prima del asegurado en esa cobertura es $VA \times T_{comercial,c}$, redondeada a dos decimales.

## Vista «sin credibilidad»

La pantalla de cálculos permite comparar contra la cotización sin credibilidad (`esComparativaSinCredibilidad`). En esa vista no se aplican los ajustes ni se actualiza `plan.primaTotal` ni el resumen que alimenta el PDF.
