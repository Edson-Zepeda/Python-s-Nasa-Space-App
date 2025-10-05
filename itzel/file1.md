
 # Fórmulas para predecir el clima

## Sección 1:

###  Índice de Calor (HI) con T y HR
**Descripción:** Utiliza ecuación de regresión polinomial desarrollada por lanz Rothfusz para el servicio meteorlogico nacional de EU
**Fórmula:**    Heat Index = -42.379 + (2.04901523*T) + (10.14333127*RH) - (.22475541*T*RH) - (.00683783*T*T) - (.05481717*RH*RH) + (.00122874*T*T*RH) + (.00085282*T*RH*RH) - (.00000199*T*T*RH*RH)

**donde:** $ T - air temperatura (F), RH - humedad relativa (porcentaje)$

**Uso en la aplicación:** 



### Wind Chill (WC) con T y Viento
**Descripción:** Se aplica a temperaturas de 10 °c o menos y velocodad del viento 4.8 km/h.   servicio meteorológico nacional de EU
**Fórmula:** $Wind Chill (F) = 35.74 + 0.6215T - 35.75(V^0.16) + 0.4275T(V^0.16)$

**Uso en la aplicación:**    




### #Punto de Rocío (Td) con T y HR

**Descripción:** Hay una formula más compleja pero mas efectiva  que esta
**Fórmula:**    $Td ≈ T - ((100 - HR) / 5) $


**Uso en la aplicación:** 


## Sección 2:
#### Definir validaciones (rango de entrada) y casos sin HR (fallback).

## Validación de Rango de Entrada

### `[VREntrada]`

**Propósito:** valida que se ingrese una entrada válida

**Parámetros:**
se pasa como parámetro el valor de la variable donde se almacena lo que ingresa el usuario
**Funcionamiento:** 
primero se evalua si el valor de la varieble es de tipo numerioco o de tipo fecha, si se cumple  entonces se 
evalúa si el rango es menor o igual a 365 días, si es así el programa sigue con la ejecucuión, si no , se pedirá al usuario ingresar
un valor dento del rango de fechas.


## Plantilla de casos sin HR (Fallback)
se mostrará un mesansaje en pantalla avisando que está ocurriendo un error y que lo intente más tarde.

## 🛡️ Fallback para [ Errores ]

### `[Nombre de la Función]`

**Escenario de error:**
*   **Motivo:** describe brevemente por qué la función principal podría fallar (ej. servicio no disponible, datos faltantes, etc.).
*   **Ejemplo:** `Error al cargar, intentelo de nuevo más tarde.

**Mecanismo de Fallback:**
*   **Condición:** Si la función `[nombre_de_la_función]` falla o no puede completarse, se activa el mecanismo de fallback.
*   **Lógica de reserva:**
    1.  Se intenta una acción alternativa, como usar datos en caché o una fuente de datos local.
    2.  Si la acción alternativa también falla, se procede con una respuesta predeterminada.
*   **Resultado esperado:**
    *   La aplicación continúa funcionando, pero con funcionalidad limitada o datos menos recientes.
    *   Se muestra un mensaje al usuario indicando el problema, como "Los datos no están actualizados en este momento. Inténtelo de nuevo más tarde."

