# Manual — Mermas y Pérdidas (Bitácora)

## ¿Para qué sirve?

Para saber **de dónde vienen las pérdidas del restaurante** y cuánto dinero se pierde cada día. Todo lo que se bota, se echa a perder o desaparece queda registrado con su costo, su motivo y la persona que lo registró.

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

## Próximos pasos (pendientes)

- **Consumo teórico vs. real**: comparar lo que las recetas dicen que debió gastarse contra lo realmente consumido para detectar robos, porciones excesivas y mermas no registradas.
- **Indicadores**: food cost % (meta 28%–35% de las ventas) y ranking de ingredientes con mayor pérdida.
