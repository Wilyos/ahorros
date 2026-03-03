# Gestor de Ahorros Web

Aplicación web para gestionar ahorros con una tabla de proyección por meses, registrar ahorro real mensual y guardar/cargar información por perfil.

## Ejecutar en local

1. Instala dependencias:

```bash
npm install
```

2. Inicia el servidor:

```bash
npm start
```

3. Abre en navegador:

- http://localhost:3000

## Uso rápido

1. Escribe un **Código de perfil** (ejemplo: `familia-garcia`).
2. Pulsa **Cargar** para abrir un perfil existente o crear uno nuevo.
3. Define **Monto inicial**, **Ahorro por mes** (base), **Monto objetivo final**, **Aumento por monto** y **Tope ahorro mensual**.
4. La **Tabla de proyección** se genera automáticamente con múltiples escenarios (filas) incrementando en pasos constantes.
5. **Cada fila de la tabla** tiene sus propios checkboxes para los 12 meses - marca los meses que quieres usar cada monto.
6. Puedes combinar diferentes montos en diferentes meses (ejemplo: mes 1 con $150,000, mes 2 con $180,000, etc.).
7. El bloque **Ahorro real por mes (automático)** muestra el total ahorrado por mes sumando los checks marcados.
8. Revisa la **barra de progreso** para ver el avance del plan.
9. Pulsa **Guardar** - los checks marcados quedan bloqueados (🔒) permanentemente.
10. Para empezar un nuevo perfil, usa **Nuevo perfil** (mantiene el código para crearlo rápidamente).

### Reglas de cálculo

- La tabla genera escenarios incrementando el ahorro mensual **en pasos constantes** (según "Aumento por monto") hasta alcanzar el objetivo.
- Ejemplo: Si base es $200 y paso es $200, genera: $200, $400, $600, $800, ... hasta el tope o hasta alcanzar objetivo.
- Una vez alcanza el **Tope ahorro mensual**, repite ese valor en filas adicionales (tal como "no importa si se repiten valores").
- **Nunca** genera filas con montos superiores al tope configurado.
- Cada mes puede usar un monto diferente según qué checks marques en la matriz de escenarios.
- **Monto ahorrado actualmente** = suma de todos los montos mensuales según los checks marcados.
- **Monto pendiente por ahorrar** = `Monto objetivo - (Monto inicial + suma de ahorros)`.

## Revisar progreso en diferentes equipos

Para ver el mismo avance en distintos equipos, esta app debe estar publicada en un servidor accesible por internet (por ejemplo VPS, Render, Railway o similar) y todos deben entrar con el mismo **Código de perfil**.

## Estructura

- `src/server.js`: API y servidor web.
- `src/db.js`: persistencia SQLite (`data.sqlite`).
- `public/index.html`: interfaz.
- `public/app.js`: lógica de cálculo y sincronización.
- `public/styles.css`: estilos.
