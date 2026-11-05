# 🗺️ Geografía · práctica de examen de mapas

App web interactiva (sin instalación, sin servidor) para preparar un examen de:

- **España**: las 52 provincias y sus capitales.
- **Europa**: 45 países y sus capitales.

## Qué se puede hacer

| Modo | Descripción |
|------|-------------|
| 🌱 **Practicar** | Corrección al momento, pistas (💡) y repaso de fallos. |
| 📝 **Examen** | Sin pistas ni correcciones hasta el final, cronómetro y **nota sobre 10**. |
| 👀 **Estudiar** | Explora el mapa: nombre, capital y zona al pasar el ratón o tocar. |

Tipos de pregunta: situar en el mapa (clic), escribir el nombre, escribir la capital, encontrar la zona a partir de su capital, o todo mezclado.
Se puede filtrar por zona (comunidad autónoma / zona de Europa), exigir tildes, hacer zoom (rueda, pellizco o botones) y arrastrar el mapa.
Los fallos y las mejores notas se guardan en el navegador (`localStorage`).

## Usarla

Abre `index.html` en el navegador, o publícala con **GitHub Pages** (Settings → Pages → rama `main`, carpeta `/`).

Para probar en local con un servidor: `node tools/serve.mjs` → http://localhost:8123

## Regenerar los mapas

`data.js` se genera con `node tools/build-data.mjs` (descarga los GeoJSON y proyecta los mapas a SVG).
Las capitales, alias y zonas se editan en ese mismo script.

## Créditos

Mapas: [Natural Earth](https://www.naturalearthdata.com/) (dominio público) y
[click_that_hood](https://github.com/codeforamerica/click_that_hood) (provincias de España).
