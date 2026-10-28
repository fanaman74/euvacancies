'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { geoMercator, geoPath } = require('d3-geo');
const topojson = require('topojson-client');
const world = require('world-atlas/countries-110m.json');

const WIDTH = 760;
const HEIGHT = 560;
const projection = geoMercator()
  .scale(560)
  .center([10, 52])
  .translate([380, 300]);

const pathGenerator = geoPath(projection).digits(1);

const COUNTRY_CODES = {
  Albania: 'AL',
  Austria: 'AT',
  Belgium: 'BE',
  'Bosnia and Herz.': 'BA',
  Bulgaria: 'BG',
  Croatia: 'HR',
  Czechia: 'CZ',
  Denmark: 'DK',
  Estonia: 'EE',
  Finland: 'FI',
  France: 'FR',
  Germany: 'DE',
  Greece: 'GR',
  Hungary: 'HU',
  Iceland: 'IS',
  Ireland: 'IE',
  Italy: 'IT',
  Kosovo: 'XK',
  Latvia: 'LV',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Macedonia: 'MK',
  Malta: 'MT',
  Montenegro: 'ME',
  Netherlands: 'NL',
  Norway: 'NO',
  Poland: 'PL',
  Portugal: 'PT',
  Romania: 'RO',
  Serbia: 'RS',
  Slovakia: 'SK',
  Slovenia: 'SI',
  Spain: 'ES',
  Sweden: 'SE',
  Switzerland: 'CH',
  'United Kingdom': 'GB',
};

const COUNTRY_POINTS = {
  AT: ['Austria', 16.3738, 48.2082],
  BE: ['Belgium', 4.3517, 50.8503],
  BG: ['Bulgaria', 23.3219, 42.6977],
  CZ: ['Czechia', 14.4378, 50.0755],
  DE: ['Germany', 13.405, 52.52],
  DK: ['Denmark', 12.5683, 55.6761],
  EE: ['Estonia', 24.7536, 59.437],
  ES: ['Spain', -3.7038, 40.4168],
  FI: ['Finland', 24.9384, 60.1699],
  FR: ['France', 2.3522, 48.8566],
  GR: ['Greece', 23.7275, 37.9838],
  HU: ['Hungary', 19.0402, 47.4979],
  IE: ['Ireland', -6.2603, 53.3498],
  IT: ['Italy', 12.4964, 41.9028],
  LU: ['Luxembourg', 6.1296, 49.8153],
  MT: ['Malta', 14.5146, 35.8989],
  NL: ['Netherlands', 4.9041, 52.3676],
  PL: ['Poland', 21.0122, 52.2297],
  PT: ['Portugal', -9.1393, 38.7223],
  SE: ['Sweden', 18.0686, 59.3293],
  SI: ['Slovenia', 14.5058, 46.0569],
  SK: ['Slovakia', 17.1077, 48.1486],
};

const CITY_POINTS = {
  alicante: [-0.4907, 38.3452],
  amsterdam: [4.9041, 52.3676],
  athens: [23.7275, 37.9838],
  barcelona: [2.1734, 41.3851],
  bilbao: [-2.935, 43.263],
  bratislava: [17.1077, 48.1486],
  brussels: [4.3517, 50.8503],
  budapest: [19.0402, 47.4979],
  cologne: [6.9603, 50.9375],
  copenhagen: [12.5683, 55.6761],
  dublin: [-6.2603, 53.3498],
  florence: [11.2558, 43.7696],
  frankfurt: [8.6821, 50.1109],
  helsinki: [24.9384, 60.1699],
  lisbon: [-9.1393, 38.7223],
  ljubljana: [14.5058, 46.0569],
  luxembourg: [6.1296, 49.8153],
  prague: [14.4378, 50.0755],
  stockholm: [18.0686, 59.3293],
  tallinn: [24.7536, 59.437],
  'the hague': [4.3007, 52.0705],
  turin: [7.6869, 45.0703],
  valencia: [-0.3763, 39.4699],
  valenciennes: [3.5183, 50.3573],
  valletta: [14.5146, 35.8989],
  warsaw: [21.0122, 52.2297],
};

const features = topojson.feature(world, world.objects.countries).features;
const countries = [];
for (const feature of features) {
  const name = feature.properties.name;
  const code = COUNTRY_CODES[name];
  if (!code) continue;
  const path = pathGenerator(feature);
  if (!path) continue;
  countries.push({ code, name, path });
}
countries.sort((a, b) => a.name.localeCompare(b.name));

const countryPoints = {};
for (const [code, [name, lon, lat]] of Object.entries(COUNTRY_POINTS)) {
  const [x, y] = projection([lon, lat]);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    countryPoints[code] = { name, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
}

const cityPoints = {};
for (const [name, [lon, lat]] of Object.entries(CITY_POINTS)) {
  const [x, y] = projection([lon, lat]);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    cityPoints[name] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
}

const output = {
  viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
  width: WIDTH,
  height: HEIGHT,
  countries,
  countryPoints,
  cityPoints,
};

const target = path.join(__dirname, '..', 'src', 'europe-map.json');
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${target}: ${countries.length} countries, ${Object.keys(countryPoints).length} country points, ${Object.keys(cityPoints).length} city points`);
