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

## ANA PRIOS: XLS aportado el 5 de noviembre de 2026

El archivo binario BIFF `2026_11_05_13_05_02_276.xls` contiene el reporte 652-2026-ANA, consulta del 05/11/2026 e impresión a las 13:05 (Perú). Se incorporó una copia normalizada de 135 registros (137 filas, dos duplicados exactos), 23 departamentos y nueve registros de Piura. Se conserva la trazabilidad de las filas originales. El archivo XLS original no se publica en el repositorio.

La vista «ANA · Ríos (XLS)» filtra por AAA, ALA, departamento y búsqueda de estación/río. Permite importar nuevas copias localmente (hasta 20) y exportar JSON. La fecha consultada se elige mediante la copia; no se puede pedir todavía otra fecha al portal desde Vigía. Las copias se ordenan por impresión y fecha de consulta, nunca por la hora de importación. No se envían a Gemini. Los datos guardados dependen del almacenamiento del navegador; conviene exportarlos.

No se ha verificado la descarga automática: el nombre del adjunto no revela la URL ni el mecanismo del botón XLS. El acceso a la página de ANA desde este entorno está bloqueado por la política de red. No se inventó una API ni se implementó un postback a ciegas. Hasta identificar el enlace público o la solicitud de exportación, la carga es manual y no se presenta como actualización horaria.

Los colores naranja/rojo son los del archivo, no una alerta calculada. Ausencia de resalte no significa seguridad. Se conservan unidades y valores originales; no se suman caudales y niveles. Seis registros tienen umbral rojo numéricamente menor que el naranja y se señalan para interpretación del operador. No hay fecha individual de observación, solo hora. La impresión no prueba la fecha de publicación ni la vigencia de todos los registros. Se conserva el aviso ANA de datos primarios sin control de calidad.

Lectura XLS: SheetJS CE 0.20.3, distribución npm `@e965/xlsx` fijada en el lockfile; es una redistribución, no el paquete oficial del CDN. El módulo navegador se copia en `public/vendor/xlsx.mjs` con licencia Apache-2.0. Se comprueba firma CFB, tamaño máximo 5 MB y límite de filas. No se ejecutan macros ni fórmulas: solo se leen valores almacenados. Reimportación: `node scripts/import_ana_report.mjs archivo.xls`.
