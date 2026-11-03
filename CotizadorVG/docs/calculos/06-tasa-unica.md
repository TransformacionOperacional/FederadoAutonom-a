# 6. Tasa única y tasas por cobertura

**Funciones:** `formatearTasaUnica(primaTotal, valorAseguradoTotal)` y `renderizarFilasTasaPorCobertura` en [`js/app.js`](../../js/app.js).

## Tasa única de la póliza

Es la prima anual total expresada **por mil** de valor asegurado de **Vida**:

$$
T_{única} = \frac{P_{póliza}}{VA_{vida\,total}} \times 1000
$$

- $P_{póliza}$ incluye **todas** las coberturas de todos los planes.
- $VA_{vida\,total}$ es la suma del valor asegurado de la cobertura `WET` de la póliza.
- Se muestra con seis decimales. Si el denominador no es mayor que cero, se muestra «—».

## Tasa por cobertura

Para cada cobertura, en cada plan y para toda la póliza:

$$
T_{cobertura} = \frac{\text{Prima de la cobertura}}{\text{Valor asegurado de la cobertura}} \times 1000
$$

La función reutiliza `formatearTasaUnica` con los totales de esa cobertura.

## Dónde se muestra

| Modalidad | Resumen en pantalla | PDF |
|-----------|--------------------|-----|
| Patronal | Solo la tasa única de la póliza | Una tabla «TASA» con la tasa única |
| Voluntaria / Mixta | Tasas por cobertura por plan y de toda la póliza, más la tasa única | Tablas «TASAS POR COBERTURA (POR MIL)» (máximo 4 planes por tabla) y la tasa única |

## Relación con las demás fórmulas

La tasa única es un indicador de **lectura**: no se usa para calcular primas. Es la consecuencia de aplicar valor asegurado, tasa pura, recargo comercial y, si corresponde, credibilidad.
