# Guía de uso de Vinculivo (versión privada)

## 1. Instalación

Desde GitHub Actions del [PR #1](https://github.com/Drako01/vinculivo/pull/1), descargá el ZIP `vinculivo-private-vsix`. Compará el SHA-256 y utilizá **Extensions → Install from VSIX** en ArmoTuSitio IDE; recargá la ventana.

## 2. Overview: documentos y fuentes

Abrí el icono de Vinculivo en la Activity Bar. El Control Center ocupa el editor central, no la sidebar. Elegí el proyecto (si hay varias carpetas) y usá **Scan sources**. El escaneo es manual. Podés buscar títulos y contenido, filtrar por instrucciones de agentes, ADR y documentación y abrir cada fuente en su línea de origen.

## 3. Decisions: registrar acuerdos arquitectónicos

Creá una propuesta con título, descripción y justificación. Asociá un documento (si existe) y rutas relativas afectadas, como `src/security/authorization.ts` o `src/auth/**`. Se almacenan por workspace, no se agregan a Git. Para marcarla como aceptada primero revisá sus fuentes y presioná **Review & accept**: el IDE pedirá confirmación. Si editás una decisión aceptada, vuelve a `proposed`.

## 4. Detectar señales de obsolescencia

Modificá una ruta asociada, ejecutá **Scan sources** y revisá la señal del registro. `Review suggested` indica que se detectó un cambio que puede requerir inspección; **no** significa automáticamente que el diseño está mal. Si no se puede determinar el Git baseline, la señal será `Unknown`, no un PASS falso.

## 5. Preflight y handoff

En **Preflight & handoff**, escribí la tarea concreta, elegí Claude Code, Codex, Copilot o Markdown genérico y ajustá el presupuesto aproximado de tokens. Generá una vista previa, verificá fuentes y advertencias y presioná **Copy approved handoff**. Antes de pegar el texto en un asistente, revisá que no haya datos sensibles; la redacción de secretos es heurística.

## 6. Evidence y portabilidad

**Evidence** permite importar un resumen JSON mediante el esquema documentado, siempre de manera explícita. Para trasladar decisiones entre IDEs, usá **Export register** y posteriormente **Import register**. Los registros importados se convierten en propuestas pendientes de revisión: ningún archivo externo puede autoaprobar decisiones.

## 7. Pruebas antes de publicar

Validá estados vacíos, permisos de workspace, varios roots, documentación cambiada, rutas que faltan, evidencia malformada, navegación con teclado, tema claro/oscuro, zoom, captura auténtica del Control Center instalado y VSIX después de reinstalar. Publicación solo después de aceptación expresa.
