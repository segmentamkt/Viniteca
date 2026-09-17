/*
  LA VINITECA — CATÁLOGO OFICIAL
  Fuente única autorizada:
  https://www.canva.com/design/DAGt7m3_sq0/7pl-6A1Rh3Nho65Te0AdPg/view

  REGLA:
  - No agregar productos, países, bodegas, cepas, regiones, añadas ni imágenes
    que no estén confirmados en el Canva.
  - Si un producto está agotado en la fuente, usar status: "Agotado".
  - No inventar precios.
  - Mira solo recomienda elementos presentes en este arreglo.

  Esquema por producto:
  {
    id: "slug-unico",
    name: "Nombre exacto",
    category: "Tintos | Blancos | Rosados | Espumantes | Frizzantes | Licores/Destilados",
    winery: "Bodega exacta",
    grape: "Cepa exacta",
    region: "Región exacta",
    country: "País exacto",
    vintage: "Añada exacta o vacío",
    image: "Ruta o URL de la imagen oficial",
    status: "Disponible | Agotado"
  }
*/

window.VINITECA_CATALOG = [];
