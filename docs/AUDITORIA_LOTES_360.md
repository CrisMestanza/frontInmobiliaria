# Auditoría técnica — Lotes, conexiones/trazos, edición, selección múltiple y sincronización 2D↔360

Fecha: 2026-06-22
Alcance: `src/pages/mapa/`, `src/pages/casa360/Modal360.jsx`, `src/pages/inmobiliaria/lote/*`, `src/pages/admin/modules/{lots,planning}/*`.

## 0. Mapa real del sistema (corrige la premisa inicial)

El primer hallazgo de esta auditoría es arquitectónico: **el sistema no es un único "mapa 2D + visor 360" con modo edición**, como sugería el enunciado original, sino **cuatro subsistemas independientes** que se comunican por convención de nombres y fetch directo a los mismos endpoints, no por código ni contratos compartidos:

| Subsistema | Archivo(s) | Rol | Edición/selección múltiple |
|---|---|---|---|
| **Visor público del mapa** | `src/pages/mapa/Map.jsx` (3531L), `PolygonOverlay.jsx`, `SpacePatternOverlay.jsx`, `MapSidebar.jsx` (1766L), `MapSidebarProyecto.jsx` (2398L) | Cliente final navega proyectos/lotes en Google Maps | **No existe.** Solo lectura, selección única (`selectedLote` escalar) |
| **Editor de geometría de lotes** | `src/pages/inmobiliaria/lote/agregarLote.jsx` (1125L), `agregarLoteBlock.jsx` (3361L), `agregarLotePDF.jsx` (1681L), `editLote.jsx` (789L), `LotesModal.jsx` (584L) | Operador dibuja/genera/edita polígonos de lotes sobre el mapa o un PDF georreferenciado | **Sí**, pero solo en `agregarLoteBlock.jsx` (array `selectedLoteIds`) |
| **Visor 360 público del proyecto** | `src/pages/mapa/Viewer360ModalCasa.jsx` (4342L) | Cliente final recorre fotos 360 del proyecto con overlay de lotes proyectado sobre la esfera | Modo dibujo/anotación implementado **pero inalcanzable** desde la UI (sin botón) |
| **Editor de tours 360 (admin)** | `src/pages/casa360/Modal360.jsx` (8447L) | Operador sube fotos 360, crea hotspots, importa y ancla el overlay 2D de lotes sobre la esfera, dibuja trazos | **Sí** — selección múltiple real (`Set` de ids), marquee, transformaciones de grupo |

Los wrappers en `src/pages/admin/modules/{lots,planning}/*.jsx` (≤150 líneas cada uno) son solo rutas del dashboard que montan `LotesModal`/`agregarLoteBlock`/`Modal360` — no contienen lógica propia.

**Implicación práctica**: cualquier corrección debe tratar estos cuatro subsistemas como módulos separados con un acoplamiento débil y peligroso entre el editor de lotes y el editor de tours 360, no como una sola feature monolítica.

---

## 1. Modelo de datos de un lote — triplicado, no compartido

Existen **tres normalizaciones de geometría de polígono independientes**, con la misma intención (ordenar vértices, calcular centroide) pero implementadas por separado:

1. `Map.jsx:831-908` (`normalizePuntosWithOrder` + `calculatePolygonCentroid`) y su copia casi idéntica en `PolygonOverlay.jsx:11-66` (`getCoordsWithFallbackOrder` + `calcularCentroide`) — visor público.
2. `agregarLoteBlock.jsx:34-75` (`normalizePolygonCoords`) y su copia en `agregarLotePDF.jsx:16-57` — editor de geometría, formato `{lat,lng}`.
3. `Modal360.jsx` (`buildImportedGeometry`, ~línea 324-394) — tercera copia, formato `{idlote, nombre, precio, moneda, area_total_m2, ancho, largo, vendido, color, points, path}`.

Tres formas de objeto "lote normalizado" distintas (`{puntos, polygonPath, polygonCenter}` vs `{coords}` vs `{points, path}`) para representar el mismo concepto. **No hay un módulo `geometry/lote.js` compartido.** Un bugfix en el algoritmo de ordenamiento angular o en el cálculo de centroide hecho en un lugar no se propaga a los otros dos.

**Importante**: el lote *nunca* tiene campos de transformación propios (`rotation`, `scale`, `offsetX/Y`). Toda "transformación" en el editor de lotes (`agregarLoteBlock.jsx`) se resuelve reescribiendo la lista completa de vértices absolutos tras cada drag — no existe un modelo afín (posición + rotación + escala) a nivel de lote individual. La única rotación real es la de la *grilla completa* al generarla (`rotationDeg`) o la del *overlay del PDF* (`pdfRotation`), conceptos distintos sin relación entre sí.

---

## 2. Causa raíz confirmada: por qué los lotes se desordenan en el visor 360

Esta es la pregunta central del encargo. La causa tiene **dos componentes que se combinan**:

### 2.1 El visor 360 (admin) congela un snapshot que nunca se invalida

`Modal360.jsx` importa la geometría 2D **manualmente y bajo demanda** (`load2DGeometry`, ~línea 2817), llamando directamente a `listPuntosProyecto/{id}` y `listPuntosLoteProyecto/{id}` — los mismos endpoints crudos que usa el editor de lotes, pero sin pasar por ningún contrato compartido. Una vez importada, la geometría se "ancla" a coordenadas esféricas (yaw/pitch) y ese anclaje se congela deliberadamente: el propio código documenta esta decisión (comentario cerca de la línea 2800-2805): *"Rebuilding here would re-project the 2D overlay through the CURRENT camera position, which may differ from when the user positioned the lots, corrupting the stored spherical coordinates"*.

Esto es correcto como decisión puntual (evita que un giro de cámara arruine coordenadas ya fijadas), **pero no existe ningún mecanismo que detecte que la geometría 2D de origen cambió** (el operador movió un vértice, dividió o unió un lote en `agregarLoteBlock.jsx`) y marque el anclaje 360 como obsoleto. El operador debe acordarse de pulsar "reimportar/reanclar" manualmente; si no lo hace, el 360 sigue mostrando geometría vieja indefinidamente.

### 2.2 Cuando sí se reancla, el emparejamiento lote↔marcador es por índice/nombre, no por id estable

En `Viewer360ModalCasa.jsx` (visor público), `getLoteId` (línea 295-296) cae en cascada por `idlote ?? id ?? id_lote ?? lote_id`. Cuando ninguno está poblado, el id del marcador PSV (`markerKey`, líneas 2564-2565/2628-2629) usa `lote.nombre ?? index`. El plugin `markers-plugin` de Photo Sphere Viewer usa ese id como clave de reconciliación (equivalente a `key` en React). Como el array de lotes se reconstruye en cada recálculo de overlay (cambio de imagen, de viewport, de selección) y su orden de iteración depende de cómo el backend serializó `geometry.lotes`, **un lote sin id real puede recibir un índice distinto entre dos renders**, y el plugin lo trata como una entidad nueva en vez de actualizar la existente. Esto se percibe como lotes que "saltan" de posición o intercambian su etiqueta.

A esto se suma que `agregarLoteBlock.jsx` reasigna ids temporales al dividir/unir lotes (`nextGeneratedLoteIdRef`/`getNextTempLoteId`) — si el anclaje 360 fue capturado *antes* de una operación de unir/dividir y el operador reancla después, el array de lotes nuevo tiene ids que no corresponden a los anclajes esféricos guardados previamente para esos mismos lotes (geométricamente en la misma posición, pero con id distinto), produciendo el efecto exacto reportado.

### 2.3 Conclusión técnica y dirección de la corrección

El problema **no es un bug de ordenamiento (`sort` sin comparador) ni de proyección matemática** — la trigonometría esférica está correctamente implementada y es consistente entre `Modal360.jsx` y `Viewer360ModalCasa.jsx` (el propio código de `Modal360.jsx` lo documenta: *"Mismo estilo y misma matemática de proyección que el visor 360 público... para que un trazo se vea idéntico en ambos lados"*, ~línea 1824). El problema es de **identidad y invalidación de caché**:

1. Falta una clave primaria de lote garantizada no-nula desde el backend hasta el render del marker (eliminar todos los fallbacks a `nombre`/`index` como id).
2. Falta un mecanismo de invalidación: cuando se modifica geometría en el editor de lotes, el anclaje 360 correspondiente a ese proyecto debe marcarse `stale` (un timestamp/hash de geometría comparado contra el guardado en el anclaje basta) y advertir al operador en `Modal360.jsx` en vez de mostrar datos desactualizados silenciosamente.

---

## 3. Conexiones y trazos — tres modelos paralelos, uno de ellos código muerto

| Tipo | Dónde vive el dato | Persiste en backend | Dónde se crea |
|---|---|---|---|
| **Hotspot** (foto→foto) | `{id, yaw, pitch, destino:{id_imagen,...}}` | Sí, vía `Modal360.jsx` (`POST` en `saveTourToBackend`) | `Modal360.jsx` (`connectToExisting`, `createAndConnectImage`) |
| **Trazo/dibujo libre** (`userDrawings`) | `{id, type:"polygon", points[], sphericalPoints?, scenarioKey, depth, strokeWidth}` | Sí en `Modal360.jsx`; **NO en `Viewer360ModalCasa.jsx`** | `Modal360.jsx` (editor); en el visor público la lógica existe pero está **inalcanzable desde la UI** (sin botón que active `drawMode`) |
| **Anotación puntual** | `{id, yaw, pitch, label, description}` | Sí en `Modal360.jsx`; en `Viewer360ModalCasa.jsx` solo local (`localAnnotations`), se pierde al cerrar el modal | Ambos archivos, mismo patrón |

El hallazgo más relevante aquí es **código muerto significativo en `Viewer360ModalCasa.jsx`**: ~300 líneas de lógica de dibujo (`drawMode`, `closePolygon`, `undoLastDrawing`, etc.) y otras ~300 líneas de un sistema de etiquetas de lote desactivado por flag (`LOT_LABELS_ENABLED = false`, línea 204) que nunca se ejecutan en producción. Esto es deuda técnica que aumenta el costo de mantenimiento sin aportar valor — debe decidirse explícitamente si se reactiva o se elimina.

---

## 4. Modo edición — comportamiento real por subsistema

- **`Map.jsx` (visor público): no tiene modo edición.** Polígonos con `draggable:false, editable:false` explícito (`LotesOverlay`, línea 162-163).
- **`agregarLoteBlock.jsx` (editor de lotes)**: modo edición por lote vía clic + `editable`/`draggable` de Google Maps nativo; persute solo al final con un botón "Registrar todos" (`POST registerLotesMasivo/`), sin autoguardado incremental.
- **`Modal360.jsx` (editor 360)**: `layoutEditMode` con dos sub-modos (plano "tarjeta flotante" vs. "zoom" anclado a la esfera). Mientras está activo se congela la cámara del visor para que el overlay 2D no se desincronice del giro de cámara — diseño correcto y deliberado.
- **`Viewer360ModalCasa.jsx` (visor 360 público)**: tiene la misma maquinaria de `drawMode`/`annotationMode` que `Modal360.jsx`, pero **sin UI que la active** — funcionalidad fantasma.

No hay un solo "modo edición" transversal a auditar y arreglar: hay dos implementaciones reales (lotes 2D, tour 360 admin) y una implementación fantasma (visor 360 público).

---

## 5. Selección múltiple — solo existe en un lugar

Únicamente `agregarLoteBlock.jsx` (`selectedLoteIds`, array) y `Modal360.jsx` (`selectedLotIds`, `Set`, con selección por rectángulo "marquee" estilo Windows) implementan selección múltiple real. Son **implementaciones independientes, sin código compartido**, con semántica ligeramente distinta:

- `agregarLoteBlock.jsx`: push/pop manual sobre array, sincronizado por un helper (`syncSelectionWithLotes`) llamado en cada punto de mutación — frágil si se olvida en un nuevo handler.
- `Modal360.jsx`: `Set` + snapshot base (`groupEditBaseRef`) al iniciar arrastre, con hit-testing que difiere según el sub-modo de edición (lee `getBoundingClientRect()` de markers ya renderizados en modo zoom, o proyecta centroides en modo plano).

No hay mover/rotar/escalar como transformación rígida de grupo en `agregarLoteBlock.jsx` (cada lote seleccionado se arrastra independientemente); sí existe en `Modal360.jsx` (`groupEdit`/`sphericalGroupEdit`, con rotación, escala, skew, tilt, flip, profundidad).

---

## 6. Inventario de problemas por severidad

### Críticos (causan el bug reportado o riesgo de datos)
1. **Sin invalidación de anclaje 360 al editar geometría 2D** — §2.1. Causa raíz directa del desorden reportado.
2. **`getLoteId` con fallback a nombre/índice** en `Viewer360ModalCasa.jsx:295-296` y uso de ese fallback como clave de reconciliación de markers — §2.2.
3. **Reasignación de ids temporales al dividir/unir lotes** en `agregarLoteBlock.jsx` sin propagar a anclajes 360 existentes.

### Altos (mantenibilidad / riesgo de divergencia)
4. Normalización de geometría triplicada sin módulo compartido (§1) — Map.jsx/PolygonOverlay.jsx, agregarLoteBlock.jsx/agregarLotePDF.jsx, Modal360.jsx.
5. `RotatableOverlay` (clase completa) copiada literalmente 3 veces (`agregarLote.jsx:109-209`, `agregarLoteBlock.jsx:311-411`, `agregarLotePDF.jsx:109-211`).
6. Motor de generación de grilla (`detectPolygonOrientation`, `calculateOrientedBoundingBox`, `clipRectangleToPolygon`, etc.) duplicado entre `agregarLoteBlock.jsx:699-1307` y `agregarLotePDF.jsx:540-816`, ya divergente (uno sanea solapes con turf, el otro no).
7. `MapSidebar.jsx`/`MapSidebarProyecto.jsx`: lógica financiera y de "bottom sheet" táctil duplicada casi 1:1 entre ambos (cientos de líneas).
8. Tres componentes default-exportados con el mismo nombre `LoteModal` en `agregarLote.jsx`, `agregarLoteBlock.jsx`, `agregarLotePDF.jsx`, importados con alias distintos (`LoteBlockModal`, `InmobiliariaModal`, `LotePDF`) — nomenclatura invertida que confunde la navegación.
9. `agregarLotePDF.jsx`: el dibujo de polígono base y el guardado real están **comentados/deshabilitados** (líneas ~905-922, ~945-968) — toda la maquinaria de grilla de ese archivo es código muerto inalcanzable; "Guardar cambios" solo escribe en `localStorage`.

### Medios (deuda técnica localizada)
10. Código muerto en `Viewer360ModalCasa.jsx`: `drawMode`/`annotationMode` sin UI (~300L) + `LOT_LABELS_ENABLED=false` (~300L).
11. God components: `Map.jsx` (3531L), `Modal360.jsx` (8447L, con un único `return` JSX de ~2657 líneas), `agregarLoteBlock.jsx` (3361L), `MapSidebarProyecto.jsx` (2398L) — mezclan fetch, geometría, animaciones y JSX sin descomponer.
12. `markers.clearMarkers()` + reconstrucción total de todos los markers en cada cambio de selección en `Viewer360ModalCasa.jsx` (línea ~2421) — O(n) DOM churn por cada clic en un lote.
13. `sanitizeGeneratedLotesGeometry` en `agregarLoteBlock.jsx` es O(n²) con operaciones turf costosas, ejecutado en cascada de `useEffect`s ante cualquier cambio de parámetro de grilla.
14. Prop muerta `mapRef` pasada a ambos sidebars sin uso interno.
15. Magic numbers sin constante: timeouts (220/140/260/720/180ms), umbrales de zoom (13/16), `scale=2.5` para render de PDF, `widthDegrees=0.002`, tolerancias geométricas (`1e-10`, `0.05`) sin unidad documentada — repetidos en múltiples archivos.

### Bajos (cosméticos / limpieza)
16. `setselectedProyecto` (minúscula) rompe convención de nombres en `Map.jsx:226`.
17. Bloques JSX completos comentados sin eliminar (`MapSidebar.jsx`, `MapSidebarProyecto.jsx`, `agregarLote.jsx`).
18. `console.log`/`console.warn` de depuración en `Viewer360ModalCasa.jsx` (`warmUpImage`).

---

## 7. Dirección de la solución (propuesta, pendiente de validar con el equipo)

No se ha modificado ningún archivo todavía. Propuesta de secuencia, de menor a mayor riesgo:

**Fase 1 — Corregir el bug reportado (críticos #1-3), bajo riesgo de regresión:**
- Garantizar `idlote` no-nulo de extremo a extremo: rechazar/alertar en `agregarLoteBlock.jsx` si se genera un lote sin id estable antes de permitir registrar; eliminar el fallback silencioso a `nombre`/`index` en `getLoteId`/`markerKey` de `Viewer360ModalCasa.jsx` (fallar visiblemente en vez de degradar en silencio).
- Añadir un hash/timestamp de geometría por proyecto; comparar contra el guardado en el anclaje 360 al abrir `Modal360.jsx` y mostrar un aviso "el plano 2D cambió desde el último anclaje" con botón de reanclar — en vez de servir datos obsoletos sin indicación.

**Fase 2 — Extraer un módulo de geometría compartido** (`src/shared/geometry/lotePolygon.js` o similar) con: normalización de puntos + orden angular + centroide (shoelace) + point-in-polygon, usado por `Map.jsx`, `PolygonOverlay.jsx`, `agregarLoteBlock.jsx`, `agregarLotePDF.jsx` y `Modal360.jsx`. Esto resuelve los problemas #4-6 de raíz y reduce el riesgo de que el fix de la Fase 1 tenga que repetirse en 3 sitios.

**Fase 3 — Consolidar duplicación de UI/negocio no geométrica**: unificar `RotatableOverlay`, fusionar lógica financiera/bottom-sheet de los sidebars, decidir el destino de `agregarLotePDF.jsx` (¿reparar el flujo de guardado o retirarlo si `agregarLoteBlock.jsx` ya cubre la extracción por IA desde PDF?).

**Fase 4 — Limpieza de código muerto y UX**: retirar o reactivar deliberadamente `drawMode`/`annotationMode`/`LOT_LABELS_ENABLED` en `Viewer360ModalCasa.jsx`; resolver el triple-nombre `LoteModal`; documentar magic numbers como constantes nombradas.

**No recomendado**: reescribir `Modal360.jsx`/`agregarLoteBlock.jsx` de una sola vez. Son los componentes con más superficie de funcionalidad validada en producción (incluye trabajo reciente sin commitear en `Modal360.jsx`: borrador local, controles de transformación flip/dz/pivot/lens, arrastre de vértice individual, fijado automático de lotes — ver diff actual). Un refactor monolítico sin pruebas automatizadas existentes es alto riesgo; conviene fase por fase con verificación manual entre cada una.

---

## Apéndice — Endpoints de escritura relevantes localizados

| Endpoint | Método | Archivo:línea |
|---|---|---|
| `registerLote/` | POST | `agregarLote.jsx:639` |
| `extractLotesFromOverlay/` | POST | `agregarLoteBlock.jsx:1703` |
| `registerLotesMasivo/` | POST | `agregarLoteBlock.jsx:2202` |
| `updateLote/{id}/` | PUT | `editLote.jsx:372` |
| `updateLoteVendido/{id}/` | PATCH | `LotesModal.jsx:153` |
| `deleteLote/{id}/` | DELETE | `LotesModal.jsx:177` |
| `saveTourToBackend` (hotspots, overlays, anclajes) | POST | `Modal360.jsx:4134` |
| `get_hotspots_por_imagen/{id}/` | GET | `Viewer360ModalCasa.jsx:2070` |
| `listPuntosProyecto/{id}` / `listPuntosLoteProyecto/{id}/` | GET | `Modal360.jsx` (`load2DGeometry`, ~2817-2865) |
