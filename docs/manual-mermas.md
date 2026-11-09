# Manual — Mermas y Pérdidas

## ¿Para qué sirve?

Para saber **de dónde vienen las pérdidas del restaurante** y cuánto dinero se pierde cada día. Tiene dos pantallas (pestañas):

1. **Bitácora**: todo lo que se bota, se echa a perder o desaparece queda registrado con su costo, su motivo y la persona que lo registró.
2. **Consumo y Food Cost**: compara lo que las recetas dicen que debió gastarse contra lo realmente consumido (con inventario contado) y muestra el **food cost %** del restaurante.

Las pérdidas se clasifican en dos grupos:

| Grupo | Motivos incluidos |
|-------|-------------------|
| **Operativas** (mermas y desperdicios) | Merma natural (limpieza, pelado, cocción) · Error de cocina (plato malo, quemado, comanda) · Vencimiento o deterioro · Falla de cadena de frío |
| **Financieras** (robos y hormigueo) | Consumo de personal no registrado · Cortesía no autorizada · Robo / hormigueo · Otro |

Cada registro **descuenta el stock del ingrediente** y guarda el costo al momento de la pérdida (cantidad × precio unitario del ingrediente), así que el inventario siempre queda sincronizado con la bitácora.

---

## Dónde está

En el menú lateral de admin → **Mermas** (ícono de basura 🗑). Solo aparece para roles **admin** y **encargado**.

---

## Registrar una merma

1. Entra a **Mermas** → botón **"+ Registrar"** (arriba a la derecha).
2. Completa el formulario:
   - **Fecha**: se pone la de hoy; puedes cambiarla (ej. para anotar lo del día anterior).
   - **Ingrediente** *(obligatorio)*: el desplegable muestra el **stock actual** de cada uno.
   - **Cantidad** *(obligatorio)*: cuánto se perdió, en la unidad del ingrediente (kg, litros…).
   - **Motivo** *(obligatorio)*: elige el motivo real. El sistema asigna solo el grupo (operativa o financiera) según el motivo elegido; solo si eliges **"Otro"** tendrás que indicar el grupo a mano.
   - **Notas**: detalle libre (ej. *"vencido"*, *"se quemó"*, *"caído al suelo"*).
3. Antes de guardar verás el resumen:
   - **Costo de la merma** = cantidad × precio unitario del ingrediente.
   - **Stock resultante** = stock actual − cantidad (en rojo si queda negativo; en ese caso el sistema no dejará guardar).
4. Botón **"Registrar"** → la merma queda en la bitácora y el stock baja automáticamente.

### Ejemplo práctico

> Compras 10 kg de carne a $10 cada kilo (costo total: $100). Al limpiarla y quitar grasa solo quedan 7 kg utilizables → registras una merma de **3 kg** con motivo **"Merma natural"** → el sistema descuenta 3 kg del stock y registra una pérdida de **$30**.

---

## Registrar desde la pantalla de ingredientes

1. Ve a **Ingredientes** → botón **"+ Stock"** del ingrediente.
2. Escribe la cantidad con **signo negativo** (ej. `-3`).
3. Aparecerá el campo **Motivo de la pérdida**: elige el motivo y esa salida quedará automáticamente en la bitácora de mermas.
   - Si dejas el motivo vacío, será un **ajuste manual** sin registro en la bitácora (solo cambia el stock).

---

## Consultar y filtrar

Arriba de la tabla encuentras:

- **Desde / Hasta** + botones **Este mes**, **Mes pasado**, **Año**.
- **Tipo**: todas / solo operativas / solo financieras.
- **Motivo**: filtrar por un motivo específico.
- **Buscar ingrediente**: filtro rápido por nombre.

Y cuatro tarjetas de resumen: **Pérdida total**, **Operativas**, **Financieras** y **Registros** del período filtrado.

La tabla muestra fecha, ingrediente, cantidad, costo, tipo, motivo, quién lo registró y las notas.

---

## Anular un registro (solo admin)

Si se anotó algo por error, en la fila aparece el botón **"Anular"**:

- Borra la entrada de la bitácora.
- **Devuelve la cantidad al stock** del ingrediente.

> El encargado puede registrar mermas, pero solo el **admin** puede anular.

---

## Buena práctica sugerida

- Anotar las mermas **el mismo día** (o al cierre del turno) para que el inventario no se despegue del conteo físico.
- Usar **siempre** el motivo correcto: si los robos se anotan como "merma natural", el reporte deja de mostrar el problema real.
- Revisar semanalmente el total de **pérdidas financieras**: deben estar en cero o cerca de cero.

---

## Pestaña: Consumo y Food Cost (teórico vs. real)

Esta pantalla responde dos preguntas: **¿cuánto debió gastarse según las recetas?** y **¿cuánto se gastó de verdad?** La diferencia es dinero que no aparece en ninguna merma anotada: posibles robos, porciones excesivas o pérdidas no registradas.

### Los números principales

| Tarjeta | Qué significa |
|---------|---------------|
| **Food cost %** | Costo real de la materia prima vendida sobre las ventas. **Meta: 28%–35%**. Verde si está en meta, amarillo hasta 45%, rojo por encima. |
| **Ventas** | Total vendido en el período seleccionado. |
| **Costo teórico** | Lo que las recetas dicen que debió gastarse (recetas × ventas). |
| **Mermas anotadas** | Lo que ya quedó registrado en la bitácora (fase A). |
| **No registrado** | Lo que **falta** contra el conteo físico: pérdida invisible. En rojo si hay faltante, en verde si está en cero. |
| **Compras** | Facturas de proveedor del período (materia prima comprada). |

También verás el **ranking de mayores pérdidas** (mermas + faltante, de mayor a menor) y la tabla **Consumo por ingrediente** con las columnas:

- **Teórico**: cantidad y costo que debió gastarse según la receta.
- **Mermas**: lo anotado en la bitácora.
- **Conteo**: lo que se contó físicamente en el último cierre.
- **Stock sistema**: lo que el sistema cree que hay.
- **Diferencia**: stock sistema − conteo. **Positivo (rojo) = falta material**; negativo (ámbar) = sobró conteo; cero (verde) = todo cuadra.
- **Real**: teórico + mermas + diferencia = lo que realmente salió del inventario.
- **Estado**: OK / Falta / Sobra / Sin conteo.

### El conteo de cierre (paso obligatorio)

La comparación solo funciona si existe un **conteo físico del inventario**. Sin conteo, la pantalla avisa: *"Falta el inventario contado…"*.

1. Botón **"+ Conteo de cierre"** (o "Registrar conteo" en el aviso).
2. **Primero** registra en el sistema las compras y mermas del día.
3. Elige la **fecha del conteo** y escribe en la columna **Contado** lo que realmente hay en almacén de cada ingrediente (viene pre-llenado con el stock del sistema: solo corrige las diferencias).
   - Si el contado es **menor** que el sistema, la celda se marca en rojo (falta material).
4. **"Guardar conteo"** → si vuelves a contar el mismo día, el sistema reemplaza el anterior.

### Ejemplo completo

> Al cierre de mes: las recetas dicen que se debieron gastar **$800** en ingredientes; en la bitácora se anotaron **$40** de mermas; el conteo físico muestra **$60 menos** de lo que el sistema dice tener.
> - No registrado = **$60** → posible robo o pérdida no anotada.
> - Real = 800 + 40 + 60 = **$900**.
> - Si en el mes se vendió $3.000, food cost % = 900 / 3.000 = **30%** → en meta ✅

### Buena práctica

- Hacer el conteo **al cierre del mes** (o de la semana), siempre **después** de registrar compras y mermas del día.
- Revisar primero el **ranking de mayores pérdidas**: ahí están los ingredientes donde conviene cuidar más.
- Un food cost por encima de **45%** es una alerta: revisar porciones, recetas y mermas sin anotar.

---

## Roles

| Acción | admin | encargado |
|--------|:-----:|:---------:|
| Registrar mermas | ✅ | ✅ |
| Anular mermas | ✅ | ❌ |
| Ver consumo y food cost | ✅ | ✅ |
| Registrar conteo de cierre | ✅ | ✅ |
