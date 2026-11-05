// Genera data.js (mapas SVG + datos) a partir de GeoJSON públicos.
// Uso: node tools/build-data.mjs
// Fuentes: Natural Earth (dominio público) y click_that_hood (provincias de España).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
fs.mkdirSync(CACHE, { recursive: true });

async function load(name, url) {
  const f = path.join(CACHE, name);
  if (!fs.existsSync(f)) {
    console.log('Descargando', url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' -> ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const spainGeo = await load('spain-provinces.geojson',
  'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-provinces.geojson');
const neGeo = await load('ne_50m_admin_0_countries.geojson',
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson');

// ---------- utilidades ----------
const rad = d => d * Math.PI / 180;
const r1 = v => Math.round(v * 10) / 10;

function polygonsOf(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}
// Anillos exteriores (los huecos se ignoran: no hay lagos relevantes a esta escala)
const ringsOf = geom => polygonsOf(geom).map(p => p[0]);

function ringCentroid(ring) {
  let x = 0, y = 0;
  for (const [lo, la] of ring) { x += lo; y += la; }
  return [x / ring.length, y / ring.length];
}

function projectRing(ring, proj, minDist) {
  const out = [];
  let last = null;
  for (const [lo, la] of ring) {
    const p = proj(lo, la);
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) { out.push(p); last = p; }
  }
  return out;
}
const area = pts => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};
const bboxOf = rings => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};
function ringsToPath(rings, dx, dy) {
  return rings.map(r => 'M' + r.map(([x, y]) => r1(x - dx) + ' ' + r1(y - dy)).join('L') + 'Z').join('');
}

// ---------- ESPAÑA ----------
const SPAIN = [
  // cod, nombre, alias, capital, alias capital, CCAA, [lon,lat] capital
  ['01', 'Álava', ['Araba', 'Araba/Álava'], 'Vitoria', ['Vitoria-Gasteiz', 'Gasteiz'], 'País Vasco', [-2.67, 42.85]],
  ['02', 'Albacete', [], 'Albacete', [], 'Castilla-La Mancha', [-1.86, 38.99]],
  ['03', 'Alicante', ['Alacant'], 'Alicante', ['Alacant'], 'Comunidad Valenciana', [-0.48, 38.35]],
  ['04', 'Almería', [], 'Almería', [], 'Andalucía', [-2.46, 36.84]],
  ['05', 'Ávila', [], 'Ávila', [], 'Castilla y León', [-4.70, 40.66]],
  ['06', 'Badajoz', [], 'Badajoz', [], 'Extremadura', [-6.97, 38.88]],
  ['07', 'Baleares', ['Islas Baleares', 'Illes Balears'], 'Palma de Mallorca', ['Palma'], 'Islas Baleares', [2.65, 39.57]],
  ['08', 'Barcelona', [], 'Barcelona', [], 'Cataluña', [2.17, 41.39]],
  ['09', 'Burgos', [], 'Burgos', [], 'Castilla y León', [-3.70, 42.34]],
  ['10', 'Cáceres', [], 'Cáceres', [], 'Extremadura', [-6.37, 39.47]],
  ['11', 'Cádiz', [], 'Cádiz', [], 'Andalucía', [-6.29, 36.53]],
  ['12', 'Castellón', ['Castelló'], 'Castellón de la Plana', ['Castellón', 'Castelló de la Plana'], 'Comunidad Valenciana', [-0.04, 39.99]],
  ['13', 'Ciudad Real', [], 'Ciudad Real', [], 'Castilla-La Mancha', [-3.93, 38.99]],
  ['14', 'Córdoba', [], 'Córdoba', [], 'Andalucía', [-4.78, 37.89]],
  ['15', 'A Coruña', ['La Coruña', 'Coruña'], 'A Coruña', ['La Coruña', 'Coruña'], 'Galicia', [-8.41, 43.37]],
  ['16', 'Cuenca', [], 'Cuenca', [], 'Castilla-La Mancha', [-2.13, 40.07]],
  ['17', 'Girona', ['Gerona'], 'Girona', ['Gerona'], 'Cataluña', [2.82, 41.98]],
  ['18', 'Granada', [], 'Granada', [], 'Andalucía', [-3.60, 37.18]],
  ['19', 'Guadalajara', [], 'Guadalajara', [], 'Castilla-La Mancha', [-3.17, 40.63]],
  ['20', 'Guipúzcoa', ['Gipuzkoa'], 'San Sebastián', ['Donostia', 'Donosti', 'Donostia-San Sebastián'], 'País Vasco', [-1.98, 43.32]],
  ['21', 'Huelva', [], 'Huelva', [], 'Andalucía', [-6.95, 37.26]],
  ['22', 'Huesca', [], 'Huesca', [], 'Aragón', [-0.41, 42.14]],
  ['23', 'Jaén', [], 'Jaén', [], 'Andalucía', [-3.79, 37.77]],
  ['24', 'León', [], 'León', [], 'Castilla y León', [-5.57, 42.60]],
  ['25', 'Lleida', ['Lérida'], 'Lleida', ['Lérida'], 'Cataluña', [0.63, 41.62]],
  ['26', 'La Rioja', ['Rioja'], 'Logroño', [], 'La Rioja', [-2.45, 42.47]],
  ['27', 'Lugo', [], 'Lugo', [], 'Galicia', [-7.56, 43.01]],
  ['28', 'Madrid', [], 'Madrid', [], 'Comunidad de Madrid', [-3.70, 40.42]],
  ['29', 'Málaga', [], 'Málaga', [], 'Andalucía', [-4.42, 36.72]],
  ['30', 'Murcia', [], 'Murcia', [], 'Región de Murcia', [-1.13, 37.99]],
  ['31', 'Navarra', [], 'Pamplona', ['Iruña'], 'Navarra', [-1.64, 42.82]],
  ['32', 'Ourense', ['Orense'], 'Ourense', ['Orense'], 'Galicia', [-7.86, 42.34]],
  ['33', 'Asturias', [], 'Oviedo', [], 'Asturias', [-5.85, 43.36]],
  ['34', 'Palencia', [], 'Palencia', [], 'Castilla y León', [-4.53, 42.01]],
  ['35', 'Las Palmas', [], 'Las Palmas de Gran Canaria', ['Las Palmas'], 'Canarias', [-15.41, 28.12]],
  ['36', 'Pontevedra', [], 'Pontevedra', [], 'Galicia', [-8.65, 42.43]],
  ['37', 'Salamanca', [], 'Salamanca', [], 'Castilla y León', [-5.66, 40.97]],
  ['38', 'Santa Cruz de Tenerife', ['Tenerife'], 'Santa Cruz de Tenerife', ['Santa Cruz'], 'Canarias', [-16.25, 28.47]],
  ['39', 'Cantabria', [], 'Santander', [], 'Cantabria', [-3.80, 43.46]],
  ['40', 'Segovia', [], 'Segovia', [], 'Castilla y León', [-4.12, 40.95]],
  ['41', 'Sevilla', [], 'Sevilla', [], 'Andalucía', [-5.98, 37.39]],
  ['42', 'Soria', [], 'Soria', [], 'Castilla y León', [-2.47, 41.76]],
  ['43', 'Tarragona', [], 'Tarragona', [], 'Cataluña', [1.25, 41.12]],
  ['44', 'Teruel', [], 'Teruel', [], 'Aragón', [-1.11, 40.34]],
  ['45', 'Toledo', [], 'Toledo', [], 'Castilla-La Mancha', [-4.03, 39.86]],
  ['46', 'Valencia', ['València'], 'Valencia', ['València'], 'Comunidad Valenciana', [-0.38, 39.47]],
  ['47', 'Valladolid', [], 'Valladolid', [], 'Castilla y León', [-4.72, 41.65]],
  ['48', 'Vizcaya', ['Bizkaia'], 'Bilbao', [], 'País Vasco', [-2.93, 43.26]],
  ['49', 'Zamora', [], 'Zamora', [], 'Castilla y León', [-5.75, 41.50]],
  ['50', 'Zaragoza', [], 'Zaragoza', [], 'Aragón', [-0.88, 41.65]],
  ['51', 'Ceuta', [], 'Ceuta', [], 'Ceuta y Melilla', [-5.32, 35.89]],
  ['52', 'Melilla', [], 'Melilla', [], 'Ceuta y Melilla', [-2.94, 35.29]],
];

const CANARIAS = new Set(['35', '38']);
const CAN_SHIFT = [6.6, 6.2]; // Canarias se dibuja en un recuadro bajo el suroeste peninsular
const S_ES = 88;              // px por grado de latitud
const LON0 = -10.6, LAT1 = 44.2; // esquina superior izquierda
const shiftFor = cod => CANARIAS.has(cod) ? CAN_SHIFT : [0, 0];
const projES = (lo, la, sh = [0, 0]) => [
  (lo + sh[0] - LON0) * Math.cos(rad(40)) * S_ES,
  (LAT1 - (la + sh[1])) * S_ES,
];

function buildSpain() {
  const byCod = new Map(spainGeo.features.map(f => [f.properties.cod_prov, f]));
  const items = [];
  for (const [cod, name, aliases, capital, capAliases, zone, capLL] of SPAIN) {
    const f = byCod.get(cod);
    if (!f) throw new Error('Falta provincia ' + cod);
    const sh = shiftFor(cod);
    let rings = ringsOf(f.geometry).map(r => projectRing(r, (lo, la) => projES(lo, la, sh), 0.4));
    const big = rings.filter(r => r.length >= 3);
    const biggest = big.reduce((a, b) => area(a) >= area(b) ? a : b);
    rings = big.filter(r => r === biggest || area(r) > 3);
    const bb = bboxOf(rings);
    const tiny = Math.max(bb[2] - bb[0], bb[3] - bb[1]) < 16;
    items.push({
      id: cod, name, aliases, capital, capAliases, zone,
      path: ringsToPath(rings, 0, 0),
      dot: tiny ? [r1((bb[0] + bb[2]) / 2), r1((bb[1] + bb[3]) / 2)] : null,
      cap: projES(capLL[0], capLL[1], sh).map(r1),
      bb: bb.map(r1),
    });
  }
  // Fondo: países vecinos
  const bgRings = [];
  for (const f of neGeo.features) {
    if (f.properties.ADM0_A3 === 'ESP') continue;
    for (const ring of ringsOf(f.geometry)) {
      const [clo, cla] = ringCentroid(ring);
      if (clo < -18 || clo > 14 || cla < 27 || cla > 50) continue;
      const clamped = ring.map(([lo, la]) => [Math.max(-20, Math.min(14, lo)), Math.max(27, Math.min(50, la))]);
      const pr = projectRing(clamped, (lo, la) => projES(lo, la), 0.6);
      if (pr.length >= 3 && area(pr) > 4) bgRings.push(pr);
    }
  }
  const W = r1((5.4 - LON0) * Math.cos(rad(40)) * S_ES);
  const H = r1((LAT1 - 33.0) * S_ES);
  // recuadro de Canarias
  const can = items.filter(i => CANARIAS.has(i.id));
  const cb = bboxOf(can.map(i => [[i.bb[0], i.bb[1]], [i.bb[2], i.bb[3]]]));
  const pad = 10;
  return {
    viewBox: [0, 0, W, H], bg: ringsToPath(bgRings, 0, 0),
    inset: [r1(cb[0] - pad), r1(cb[1] - pad), r1(cb[2] - cb[0] + 2 * pad), r1(cb[3] - cb[1] + 2 * pad)],
    items: items.map(({ bb, ...rest }) => rest),
  };
}

// ---------- EUROPA ----------
const EU = [
  // A3, nombre, alias, capital, alias capital, zona, [lon,lat]
  ['ALB', 'Albania', [], 'Tirana', [], 'Sur', [19.82, 41.33]],
  ['DEU', 'Alemania', [], 'Berlín', [], 'Centro', [13.40, 52.52]],
  ['AND', 'Andorra', [], 'Andorra la Vieja', ['Andorra la Vella', 'Andorra'], 'Sur', [1.52, 42.51]],
  ['AUT', 'Austria', [], 'Viena', [], 'Centro', [16.37, 48.21]],
  ['BEL', 'Bélgica', [], 'Bruselas', [], 'Oeste', [4.35, 50.85]],
  ['BLR', 'Bielorrusia', ['Belarús', 'Belarus'], 'Minsk', [], 'Este', [27.57, 53.90]],
  ['BIH', 'Bosnia y Herzegovina', ['Bosnia'], 'Sarajevo', [], 'Sur', [18.41, 43.86]],
  ['BGR', 'Bulgaria', [], 'Sofía', [], 'Sur', [23.32, 42.70]],
  ['HRV', 'Croacia', [], 'Zagreb', [], 'Sur', [15.98, 45.81]],
  ['DNK', 'Dinamarca', [], 'Copenhague', [], 'Norte', [12.57, 55.68]],
  ['SVK', 'Eslovaquia', [], 'Bratislava', [], 'Centro', [17.11, 48.15]],
  ['SVN', 'Eslovenia', [], 'Liubliana', ['Ljubljana'], 'Sur', [14.51, 46.06]],
  ['ESP', 'España', [], 'Madrid', [], 'Sur', [-3.70, 40.42]],
  ['EST', 'Estonia', [], 'Tallin', ['Tallinn'], 'Norte', [24.75, 59.44]],
  ['FIN', 'Finlandia', [], 'Helsinki', [], 'Norte', [24.94, 60.17]],
  ['FRA', 'Francia', [], 'París', [], 'Oeste', [2.35, 48.86]],
  ['GRC', 'Grecia', [], 'Atenas', [], 'Sur', [23.73, 37.98]],
  ['HUN', 'Hungría', [], 'Budapest', [], 'Centro', [19.04, 47.50]],
  ['IRL', 'Irlanda', [], 'Dublín', [], 'Norte', [-6.26, 53.35]],
  ['ISL', 'Islandia', [], 'Reikiavik', ['Reykjavik', 'Reikjavik'], 'Norte', [-21.94, 64.15]],
  ['ITA', 'Italia', [], 'Roma', [], 'Sur', [12.50, 41.90]],
  ['KOS', 'Kosovo', [], 'Pristina', ['Prishtina'], 'Sur', [21.17, 42.67]],
  ['LVA', 'Letonia', [], 'Riga', [], 'Norte', [24.11, 56.95]],
  ['LIE', 'Liechtenstein', [], 'Vaduz', [], 'Centro', [9.52, 47.14]],
  ['LTU', 'Lituania', [], 'Vilna', ['Vilnius'], 'Norte', [25.28, 54.69]],
  ['LUX', 'Luxemburgo', [], 'Luxemburgo', ['Luxemburgo ciudad'], 'Oeste', [6.13, 49.61]],
  ['MKD', 'Macedonia del Norte', ['Macedonia'], 'Skopie', ['Skopje'], 'Sur', [21.43, 42.00]],
  ['MLT', 'Malta', [], 'La Valeta', ['Valeta', 'La Valetta', 'Valetta', 'La Valleta'], 'Sur', [14.51, 35.90]],
  ['MDA', 'Moldavia', ['Moldova'], 'Chisináu', ['Chisinau', 'Kishinev'], 'Este', [28.86, 47.01]],
  ['MCO', 'Mónaco', ['Monaco'], 'Mónaco', ['Monaco'], 'Oeste', [7.42, 43.74]],
  ['MNE', 'Montenegro', [], 'Podgorica', [], 'Sur', [19.26, 42.44]],
  ['NOR', 'Noruega', [], 'Oslo', [], 'Norte', [10.75, 59.91]],
  ['NLD', 'Países Bajos', ['Holanda'], 'Ámsterdam', [], 'Oeste', [4.90, 52.37]],
  ['POL', 'Polonia', [], 'Varsovia', [], 'Centro', [21.01, 52.23]],
  ['PRT', 'Portugal', [], 'Lisboa', [], 'Sur', [-9.14, 38.72]],
  ['GBR', 'Reino Unido', ['Gran Bretaña', 'Inglaterra'], 'Londres', [], 'Oeste', [-0.13, 51.51]],
  ['CZE', 'República Checa', ['Chequia', 'Rep. Checa'], 'Praga', [], 'Centro', [14.42, 50.08]],
  ['ROU', 'Rumanía', ['Rumania'], 'Bucarest', [], 'Este', [26.10, 44.43]],
  ['RUS', 'Rusia', [], 'Moscú', [], 'Este', [37.62, 55.75]],
  ['SMR', 'San Marino', [], 'San Marino', [], 'Sur', [12.45, 43.94]],
  ['SRB', 'Serbia', [], 'Belgrado', [], 'Sur', [20.46, 44.82]],
  ['SWE', 'Suecia', [], 'Estocolmo', [], 'Norte', [18.07, 59.33]],
  ['CHE', 'Suiza', [], 'Berna', [], 'Centro', [7.45, 46.95]],
  ['UKR', 'Ucrania', [], 'Kiev', ['Kyiv'], 'Este', [30.52, 50.45]],
  ['VAT', 'Vaticano', ['Ciudad del Vaticano', 'Santa Sede'], 'Ciudad del Vaticano', ['Vaticano'], 'Sur', [12.45, 41.90]],
];
const ZONE_NAMES = { Norte: 'Europa del Norte', Oeste: 'Europa Occidental', Centro: 'Europa Central', Este: 'Europa del Este', Sur: 'Europa del Sur' };

// Lambert cónica conforme
const phi1 = rad(38), phi2 = rad(62), phi0 = rad(52), lam0 = rad(14);
const nL = Math.log(Math.cos(phi1) / Math.cos(phi2)) / Math.log(Math.tan(Math.PI / 4 + phi2 / 2) / Math.tan(Math.PI / 4 + phi1 / 2));
const FL = Math.cos(phi1) * Math.pow(Math.tan(Math.PI / 4 + phi1 / 2), nL) / nL;
const rho = phi => FL / Math.pow(Math.tan(Math.PI / 4 + phi / 2), nL);
const rho0 = rho(phi0);
const lamb = (lo, la) => {
  const r = rho(rad(la)), t = nL * (rad(lo) - lam0);
  return [r * Math.sin(t), rho0 - r * Math.cos(t)];
};
const S_EU = 1100 / (lamb(42, 50)[0] - lamb(-20, 50)[0]) ; // normaliza ~1100 px de ancho entre -20º y 42º
const rawEU = (lo, la) => { const [x, y] = lamb(lo, la); return [x * S_EU, -y * S_EU]; };

function buildEurope() {
  // Ventana visible: borde del dominio lon -24..46, lat 34..71.5
  const edge = [];
  for (let lo = -24; lo <= 46; lo += 2) { edge.push(rawEU(lo, 34), rawEU(lo, 71.5)); }
  for (let la = 34; la <= 71.5; la += 2) { edge.push(rawEU(-24, la), rawEU(46, la)); }
  const x0 = Math.min(...edge.map(p => p[0])), x1 = Math.max(...edge.map(p => p[0]));
  const y0 = Math.min(...edge.map(p => p[1])), y1 = Math.max(...edge.map(p => p[1]));
  const proj = (lo, la) => { const [x, y] = rawEU(lo, la); return [x - x0, y - y0]; };
  const W = r1(x1 - x0), H = r1(y1 - y0);

  const wanted = new Map(EU.map(e => [e[0], e]));
  const items = [];
  const found = new Set();
  const bgRings = [];
  for (const f of neGeo.features) {
    if (f.properties.ADM0_A3 === 'GRL') continue; // Groenlandia: solo estorba
    const a3 = f.properties.ADM0_A3 === 'KOS' || f.properties.NAME === 'Kosovo' ? 'KOS' : f.properties.ADM0_A3;
    const target = wanted.get(a3);
    const rings = [];
    for (const ring of ringsOf(f.geometry)) {
      // anillo relevante si algún punto cae dentro de la ventana (Rusia/Kazajistán son enormes)
      const inside = ring.some(([lo, la]) => lo >= -26 && lo <= 75 && la >= (target ? 33 : 20) && la <= 73);
      if (!inside) continue;
      const clamped = ring.map(([lo, la]) => [Math.max(-40, Math.min(80, lo)), Math.max(20, Math.min(80, la))]);
      let pr = projectRing(clamped, proj, target ? 0.5 : 0.8);
      if (pr.length < 3) pr = projectRing(clamped, proj, 0); // microestados (Vaticano...)
      if (pr.length >= 3) rings.push(pr);
    }
    if (!rings.length) continue;
    if (!target) { for (const r of rings) if (area(r) > 6) bgRings.push(r); continue; }
    found.add(a3);
    const biggest = rings.reduce((a, b) => area(a) >= area(b) ? a : b);
    const keep = rings.filter(r => r === biggest || area(r) > 4);
    const bb = bboxOf(keep);
    const tiny = Math.max(bb[2] - bb[0], bb[3] - bb[1]) < 13;
    const [, name, aliases, capital, capAliases, zone, capLL] = target;
    items.push({
      id: a3, name, aliases, capital, capAliases, zone: ZONE_NAMES[zone],
      path: ringsToPath(keep, 0, 0),
      dot: tiny ? [r1((bb[0] + bb[2]) / 2), r1((bb[1] + bb[3]) / 2)] : null,
      cap: proj(capLL[0], capLL[1]).map(r1),
    });
  }
  const missing = EU.filter(e => !found.has(e[0])).map(e => e[0]);
  if (missing.length) throw new Error('Países sin geometría: ' + missing.join(', '));
  items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { viewBox: [0, 0, W, H], bg: ringsToPath(bgRings, 0, 0), items };
}

const GEO = { spain: buildSpain(), europe: buildEurope() };
const out = '// Archivo generado por tools/build-data.mjs — no editar a mano.\nwindow.GEO = ' + JSON.stringify(GEO) + ';\n';
fs.writeFileSync(path.join(ROOT, 'data.js'), out);
console.log('data.js:', (out.length / 1024).toFixed(0), 'KB',
  '| España', GEO.spain.items.length, 'provincias, viewBox', GEO.spain.viewBox.join('x'),
  '| Europa', GEO.europe.items.length, 'países, viewBox', GEO.europe.viewBox.join('x'));
console.log('Con punto (diminutos):', [...GEO.spain.items, ...GEO.europe.items].filter(i => i.dot).map(i => i.name).join(', '));
