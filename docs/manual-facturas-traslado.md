# Manual — Facturas de Traslado de Mercancía

## ¿Para qué sirve?

Para llevar un registro ordenado de las mercancías que se envían de la sucursal principal a la otra sucursal. Cada envío se registra como una factura numerada (FT-001, FT-002, …) y se puede **descargar en PDF** con el logo del negocio para enviarla al encargado de la otra sucursal.

---

## Dónde está

En el menú lateral de admin → **Traslados** (ícono de flechas ⇄).

---

## Crear una factura nueva

1. Entra a **Traslados** → botón **"+ Nueva Factura"** (amarillo, arriba a la derecha).
2. Completa los datos:
   - **Señor(es)** *(obligatorio)*: nombre del encargado o sucursal destino (ej. "Sucursal Planta").
   - **Dirección**: dirección de la otra sucursal.
   - **RIF / Cédula**: RIF o cédula del destinatario.
   - **Fecha**: se pone la de hoy automáticamente; puedes cambiarla.
   - **Notas**: observaciones opcionales (ej. "Envío semanal").
3. Agrega los productos a la factura:

   ### Selector de items
   El desplegable tiene **dos grupos**:

   | Grupo | Qué contiene | Precio |
   |-------|-------------|--------|
   | **Ingredientes** | Masa de Jojoto, Queso de mano, Pan de perro, Tocineta, etc. | Precio unitario del ingrediente |
   | **Productos** | Cachapas, Hamburguesas, Refrescos, Malta, etc. | Precio de costo del producto |

   - Al elegir un ítem del desplegable, **la descripción y el precio se llenan solos**.
   - También puedes escribir a mano: elige **"— Manual —"** y escribe descripción, cantidad y precio libremente.
   - La **cantidad** puede ser decimal (ej. 2.5 kg).
   - El **importe** se calcula automáticamente: cantidad × precio unitario.
   - Usa **"+ Agregar item"** para añadir más filas; la **✕** roja quita una fila.

4. El **Sub-Total** se calcula en tiempo real abajo de la tabla.
5. Botón **"Guardar Factura"** → se crea con número automático (FT-001, FT-002, …) y se abre la vista de la factura.

> **Inventario:** al guardar, el sistema **descuenta el stock** de lo enviado: si elegiste un *Ingrediente*, baja directamente su stock; si elegiste un *Producto con receta*, bajan los ingredientes de su receta. Si falta material, **no se crea la factura** y aparece el aviso *"Sin stock para este traslado: …"* indicando qué ingrediente y cuánto falta. Los items escritos a mano ("— Manual —") no mueven stock.

---

## Ver una factura y descargar el PDF

1. En **Traslados**, haz clic en **"Ver / PDF"** de la factura que quieras.
2. Verás la vista previa con el formato de factura:
   - Logo del negocio arriba
   - **Comercializadora NICOBA, C.A** — RIF: J501089256
   - Datos del destinatario, N° y fecha
   - Tabla de items (Cant. / Descripción / P.Unit / Importe)
   - Sub-Total y Total
   - Espacios para firmas
3. Botón **"⬇ Descargar PDF"** → se descarga un archivo `Factura_FT-001.pdf` listo para enviar por WhatsApp o imprimir.

---

## Eliminar una factura

En la lista de Traslados, botón rojo **"Eliminar"** (solo admin). Pide confirmación antes de borrar. Se elimina la factura, sus items y **se devuelve al inventario el stock que había descontado**.

---

## Preguntas frecuentes

**¿Puedo editar una factura ya creada?**
No. Si te equivocaste, elimínala y créala de nuevo.

**¿El número se repite si borro una?**
No. La secuencia sigue avanzando (si borras FT-005, la siguiente será FT-006).

**¿El precio del PDF es en dólares?**
Sí, todo en USD ($), igual que lo registraste.

**¿Quién puede crear facturas?**
Admin y Encargado. Solo admin puede eliminar.

**¿Qué pasa si un producto no está en el catálogo?**
Escribe la descripción a mano con el precio que necesites (selector "— Manual —").

**¿Se descuenta el inventario automáticamente?**
Sí. Al guardar la factura baja el stock (del ingrediente elegido o de los ingredientes de la receta del producto). Si no hay stock suficiente no se guarda y te avisa qué falta. Al eliminar la factura (admin), el stock vuelve.
