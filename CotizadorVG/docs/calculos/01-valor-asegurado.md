# 1. Valor asegurado por cobertura

**Función:** `calcularValorAseguradoCobertura(cobertura, asegurado)` en [`js/app.js`](../../js/app.js).

El usuario captura (o importa por Excel) un único valor por asegurado: el de **Vida** (`WET`). El valor de las demás coberturas se deriva de él.

## Fórmula

$$
VA_{cobertura} = \min\bigl(VA_{vida} \times F,\; VA_{máx}\bigr)
$$

| Símbolo | Significado | Origen |
|---------|-------------|--------|
| $VA_{vida}$ | Valor asegurado de Vida del asegurado | Captura / Excel (`obtenerValorAseguradoBase`) |
| $F$ | Porcentaje de factor respecto a Vida | API de tasas, columna `Porcentaje_Factor`, por amparo y edad |
| $VA_{máx}$ | Valor máximo de la cobertura | API de tasas, columna `Valor_Maximo`, por amparo y edad (opcional) |

- Si no existe `Porcentaje_Factor` para la cobertura y la edad, el valor asegurado es **`null`**: la cobertura no se calcula y se muestra «—».
- Si no existe `Valor_Maximo`, no se aplica tope.

## Caso especial: Enfermedades Graves (`WEU`, `WEV`)

$F$ no viene de la API, sino del plan: se elige entre **40 %, 50 % o 60 %** del valor de Vida (por defecto 60 %). Sigue aplicando el tope `Valor_Maximo` por edad.

Función auxiliar: `obtenerFactorEnfermedadesGraves(plan, codigo)`.

## Restricciones sobre el valor de Vida

| Regla | Detalle |
|-------|---------|
| Modalidades contributivas (Voluntaria y Mixta) | El valor de Vida se limita a **$300.000.000** (`VALOR_ASEGURADO_MAXIMO_VOLUNTARIA`). Si se supera, se ajusta automáticamente y se avisa al usuario |
| Patronal (No Contributiva) | Sin límite adicional |

## Coberturas permitidas por parentesco

Definidas en `CONFIG` (`js/app.js`):

- **Cónyuge, hijos, hijastros, hermanos, sobrinos, nietos:** no pueden contratar `IPP`, `WE6` ni `WE9`.
- **Padres y padrastros:** solo `WET`, `WEZ` y `WEN`.

## Coberturas excluyentes

No pueden convivir en el mismo plan (`GRUPOS_COBERTURAS_EXCLUYENTES`):

- `WE9` con `WFA`
- `WEZ` con `WEY` con `WE0`
- `WEV` con `WEU`
