import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) throw new Error('Pass the saved Zooniverse HTML file as the first argument.');

const source = readFileSync(input, 'utf8');
const assets = fileURLToPath(new URL('../assets/', import.meta.url));
mkdirSync(`${assets}/map`, { recursive: true });
mkdirSync(`${assets}/fonts`, { recursive: true });

const tiles = [...source.matchAll(/<img[^>]*class="leaflet-tile leaflet-tile-loaded"[^>]*>/g)];
if (tiles.length !== 24) throw new Error(`Expected 24 saved map tiles, found ${tiles.length}.`);

for (const [tag] of tiles) {
  const encoded = tag.match(/src=(?:"data:image\/jpeg;base64,([^"]+)"|data:image\/jpeg;base64,([^ >]+))/);
  const position = tag.match(/translate3d\((-?\d+)px,(-?\d+)px,0px\)/);
  if (!encoded || !position) throw new Error('Could not decode a saved map tile.');
  const column = (Number(position[1]) - 528) / 256;
  const row = (Number(position[2]) + 22) / 256;
  if (!Number.isInteger(column) || !Number.isInteger(row)) throw new Error('Unexpected map tile position.');
  writeFileSync(`${assets}/map/tile-${column}-${row}.jpg`, Buffer.from(encoded[1] || encoded[2], 'base64'));
}

let fonts = 0;
for (const [, rule] of source.matchAll(/@font-face\{([^}]+)\}/g)) {
  const name = rule.match(/font-family:"(Karla|Roboto Mono)"/)?.[1];
  const weight = rule.match(/font-weight:(\d+)/)?.[1];
  const encoded = rule.match(/data:font\/woff2;base64,([^)]*)/)?.[1];
  if (!name || !weight || !encoded) continue;
  writeFileSync(`${assets}/fonts/${name.toLowerCase().replace(' ', '-')}-${weight}.woff2`, Buffer.from(encoded, 'base64'));
  fonts += 1;
}

if (fonts !== 4) throw new Error(`Expected 4 saved font faces, found ${fonts}.`);
console.log(`Extracted ${tiles.length} original map tiles and ${fonts} font faces.`);
