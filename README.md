# Vigía Perú

Primera versión de un observatorio de eventos hidrometeorológicos, sin dependencias externas. Requiere Node.js 22 o superior.

## Ejecutar

Desde `/workspace/0011`: `npm start` (puerto 3000; configurable con `PORT`). Ejecutar pruebas con `npm test`. Salud del servidor: `GET /api/health`.

## Alcance actual

- Panel adaptable, registro estructurado, búsqueda, copia de fichas y exportación JSON.
- Persistencia local del navegador. No hay cuentas, almacenamiento compartido ni respaldo automático. Exportar para conservar los reportes; borrar datos del navegador los elimina.
- Ejemplo de Tumbes identificado como ejemplo, sin fecha ni verificación inventadas. No se incluye como reporte real.
- Carga de JPG, PNG y WebP de hasta 15 MB, vista previa y coordenadas manuales con enlace a OpenStreetMap. Las imágenes no se suben al servidor ni se guardan. No hay extracción EXIF, análisis visual ni geolocalización automática en esta versión.
- Enlaces a ENFEN y SENAMHI. Sin ingestión automática ni comunicados simulados. Los intentos de consulta de ambos portales desde el entorno devolvieron 403 del proxy; no se pudo inspeccionar su estructura ni validar una integración.
- ANA: enlaces al ONRH (`https://snirh.ana.gob.pe/onrh/`) y al reporte de ríos (`https://snirh.ana.gob.pe/onrh/Reportes.aspx?R=PRIOS`). Consulta externa, sin extracción automática ni autenticación integrada. El seguimiento de descolmatación queda pendiente.

## Pendientes de integración

Permitir en la red `enfen.imarpe.gob.pe` y `observatorio.senamhi.gob.pe`, revisar sus mecanismos públicos y condiciones, y validar un conector antes de anunciar sincronización. Para imágenes, integrar un servicio de análisis con credenciales del servidor y consentimiento para enviar imágenes; conservar evidencia, procedencia y nivel de confianza. No inferir población afectada contando personas visibles.

No es un sistema oficial de alertas. Las fichas distinguen cifras reportadas y estimadas; todos los registros quedan pendientes de contraste oficial. La ubicación de una imagen no se confirma con coordenadas ingresadas manualmente.


## Dashboard automático (v0.2)

El dashboard filtra por las 25 regiones y por fuente. Las noticias proceden de búsquedas temáticas en Google News RSS (26 consultas), se deduplican por URL y se filtran por fecha de publicación en una ventana móvil de 24 horas. Una mención de región no confirma que el evento haya ocurrido allí. Se puede excluir contenido sin región identificada.

`python scripts/collect.py` recopila las fuentes sin dependencias externas y escribe `data/dashboard.json`. `node scripts/build.mjs` genera el sitio estático en `dist/`. GitHub Actions ejecuta ambos pasos en cada publicación y cada hora (minuto 17); GitHub puede retrasar u omitir ejecuciones programadas. El botón de recarga descarga el último archivo publicado, no dispara una nueva recopilación.

SENAMHI se consulta mediante la API pública `https://servicios.senamhi.gob.pe/api/hydrology/warnings`, identificada en los módulos del portal; el esquema se valida antes de usarlo. La conectividad real está pendiente por los bloqueos del entorno. ENFEN y ANA utilizan por ahora extracción de enlaces documentales desde HTML; los paneles interactivos de ANA aún requieren un conector específico. Los documentos oficiales extraíbles se muestran separados de las noticias. Sin fecha verificada no se consideran publicaciones de las últimas 24 horas. Los errores, accesos limitados y hora de consulta se muestran por fuente. El extractor HTML no sustituye conectores para paneles interactivos de SENAMHI/ANA ni extrae caudales, niveles de riesgo o afectados de capturas. No se simulan datos. Las noticias vencidas desaparecen de la vista incluso si no se ha publicado una actualización.

Pruebas del recopilador: `python -m unittest discover -s test -p 'test_*.py'`. Los tests usan fixtures sintéticos identificados dentro del código de prueba; nunca se publican como noticias.
