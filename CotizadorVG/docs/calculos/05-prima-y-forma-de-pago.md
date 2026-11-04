# 5. Prima y forma de pago

**Funciones:** `calcularPrimaCobertura`, `calcularPrimaIndividual`, `calcularPrimaTotal`, `renderizarTablaCalculos` y `calcularPrimaPorFormaPago` en [`js/app.js`](../../js/app.js).

## Prima por cobertura

Sin credibilidad:

$$
P_{cob} = VA_{cob} \times \frac{T_{pura}}{1 - FG}
$$

Con credibilidad (asegurado elegible y cobertura con grupo):

$$
P_{cob} = VA_{cob} \times \frac{T_{cred}}{1 - FG}
$$

En ambos casos se redondea a dos decimales. Una cobertura sin tasa o sin valor asegurado aporta 0 y se muestra «—».

## Agregación

```mermaid
flowchart LR
    A[Prima por cobertura] --> B[Prima del asegurado<br/>suma de coberturas activas del plan]
    B --> C[Prima del plan<br/>suma de sus asegurados]
    C --> D[Prima de la póliza<br/>suma de los planes]
```

| Nivel | Cálculo |
|-------|---------|
| Asegurado | Suma de las coberturas **activas** que pertenecen a su plan (`calcularPrimaIndividual`) |
| Plan | Suma de las primas de los asegurados asignados (`plan.primaTotal`) |
| Póliza | Suma de las primas de todos los planes con asegurados |

Los asegurados sin plan asignado no calculan prima.

La pantalla de cálculos y el PDF muestran además la prima anual promedio por asegurado en cada plan y en toda la póliza. Se obtiene dividiendo la prima anual correspondiente por la cantidad de asegurados asignados a ese plan o a la póliza; es un dato informativo y no altera el cálculo de las primas.

## Totales por cobertura

Para cada plan y para toda la póliza se acumulan, por cobertura, el **valor asegurado total** y la **prima total**. Estos totales alimentan la tabla de planes del resumen y del PDF.

## Fraccionamiento por forma de pago

La prima calculada es **anual**. Para pagos fraccionados se aplica un recargo y se divide entre los periodos:

$$
P_{pago} = \frac{P_{anual} \times (1 + f)}{n}
$$

| Forma de pago | Factor $f$ | Periodos $n$ |
|---------------|-----------|--------------|
| Anual | 0 | 1 |
| Semestral | 0,522 | 2 |
| Trimestral | 0,267 | 4 |
| Mensual | 0,091 | 12 |

- El resultado se redondea a dos decimales (`calcularPrimaPorFormaPago`).
- En **Mensual** el usuario elige si el pago es *Anticipada* o *Vencida*; esto no cambia el valor, solo se informa en el slip.
- El PDF indica «¿Tiene recargo por fraccionamiento?» con **Sí** cuando $f > 0$.

> Los factores de la tabla son los definidos en `CONFIG.FACTORES_FRACCIONAMIENTO`; el valor $f$ ya está expresado como fracción (0,091 equivale a 9,1 %).
