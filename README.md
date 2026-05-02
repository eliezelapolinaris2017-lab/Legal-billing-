# Legal Billing Mobile

App web móvil para facturas, cotizaciones, emplazamientos y cobros de dinero.

## Incluye

- Guardado local con `localStorage`
- Generación de PDF con jsPDF
- Compartir PDF desde iPhone/Android cuando el navegador lo permita
- Historial, búsqueda y filtro por estatus
- Marcar documentos como pagados
- Configuración del negocio sin datos prellenados
- Compatible con GitHub Pages

## Instalación en GitHub Pages

1. Sube estos archivos al root del repositorio.
2. En GitHub ve a `Settings > Pages`.
3. Selecciona `Deploy from branch`.
4. Branch: `main`, carpeta: `/root`.
5. Abre el enlace generado.

## Nota operacional

Los datos viven en el navegador donde se use la app. Para multi-dispositivo, el upgrade natural es Firebase Auth + Firestore.
