# Conexiones documentales: evidencia y límites

Revisión: 5 de noviembre de 2026 (Perú).

## SENAMHI

Páginas oficiales consultadas con HTTP 200:

- https://observatorio.senamhi.gob.pe/
- https://observatorio.senamhi.gob.pe/investigadores/boletines
- https://observatorio.senamhi.gob.pe/gestion-riesgo-desastres/avisos-hidrologicos

La página de boletines no contiene enlaces PDF en su HTML inicial; el cliente carga el catálogo por HTTP. Se inspeccionaron los recursos públicos referenciados por la propia página:

- `main-TIPZ4EGY.js`: asocia la ruta de boletines con `chunk-BOQNOFAB.js`.
- `chunk-BOQNOFAB.js`: consulta categorías y boletines; abre `publications[].fileUrl` y muestra `publications[].date`. El visor del portal distingue PDF y capas `shapeFileUrl`.
- `chunk-6OJJZOEJ.js`: contiene `getBulletinCategories()` y `getBulletins(category)`.
- `chunk-KXKYZDRQ.js`: declara `apiUrl` como `https://servicios.senamhi.gob.pe/api`.

Servicios identificados en ese cliente:

```text
GET https://servicios.senamhi.gob.pe/api/researchers/bulletins/categories
GET https://servicios.senamhi.gob.pe/api/researchers/bulletins?category=<id de categoría>
```

La interfaz espera un sobre JSON con `data`; categorías con `id` y `label`; boletines con `title`, `frequency`, `unitCode`, `documentCode` y `publications`; publicaciones con `fileUrl`, `date` y, opcionalmente, `shapeFileUrl`. El conector solo usa la parte documental, no descarga capas GIS.

Se identificaron rutas usadas por el portal público, no una documentación o contrato de API con garantía de estabilidad. La llamada directa al servicio de categorías fue rechazada por el proxy de este entorno con `CONNECT tunnel failed, response 403`, antes de obtener una respuesta del servidor de SENAMHI. No se interpreta ese resultado como una exigencia de clave del proveedor ni como confirmación del formato real de la cuenta de producción. Render debe verificar la respuesta y el conector valida el esquema antes de usarla.

## ANA / ONRH

Fuentes solicitadas:

- https://snirh.ana.gob.pe/onrh/
- https://snirh.ana.gob.pe/onrh/Reportes.aspx?R=PRIOS

La consulta también fue bloqueada por el proxy del entorno. No se pudo inspeccionar el mecanismo del reporte, confirmar una API pública ni determinar si cada descarga es estática, generada con formulario o vinculada a sesión.

El conector revisa páginas públicas para localizar enlaces PDF explícitos, iframes/objetos con rutas PDF y enlaces de handlers rotulados como PDF. Si una respuesta ASPX es realmente un PDF se identifica por su firma, no por la extensión. No se ejecutan postbacks, JavaScript, formularios privados ni se inventan URLs de descarga. Si no hay enlaces públicos extraíbles, la conexión queda parcial y se ofrece abrir la fuente oficial o pegar un enlace documental público de ejemplo. Una página ASPX no se presenta como PDF únicamente por ser un reporte.

## Validación y visor

- Solo HTTPS en hosts oficiales expresamente autorizados; las URLs antiguas de documentos HTTP de esos mismos hosts se prueban mediante HTTPS con verificación TLS normal.
- Redirecciones verificadas, límites de tiempo y tamaño; PDF de hasta 25 MiB.
- Se comprueba la firma `%PDF-` para no mostrar HTML de acceso/error como PDF. Esto no valida la exactitud científica de su contenido ni sustituye a un analizador completo de estructura PDF.
- Vista dentro de Vigía mediante un Blob del PDF recibido, sin enviar el documento a Google Docs ni a Gemini.
- Fechas de edición separadas de fechas de consulta. Ante una caída se pueden conservar documentos anteriores, identificados como tales.
- Las pruebas de integración usan respuestas y un PDF de prueba; no constituyen validación contra las fuentes de producción.
