import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const source = '/Users/asherheisman/Downloads/wildcam-14sep2026.csv';
const output = new URL('../dist/data.json', import.meta.url);
const header = ['image_id', 'camera', 'longitude', 'latitude', 'date', 'month', 'year', 'season', 'time_period', 'veg_type', 'human_structure', 'distance_human_m', 'water_type', 'distance_water_m', 'species', 'species_count', 'percentage_resting', 'percentage_standing', 'percentage_moving', 'percentage_eating', 'percentage_interacting', 'young_present', 'horns', 'image_url'];
const useful = [0, 1, 2, 3, 4, 7, 8, 9, 14, 15, 23];

function parseLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { fields.push(value); value = ''; }
    else value += char;
  }
  fields.push(value);
  return fields;
}

const rows = [];
const rl = createInterface({ input: createReadStream(source) });
let lineNumber = 0;
for await (const line of rl) {
  if (lineNumber++ === 0) continue;
  const values = parseLine(line);
  if (values.length === header.length) rows.push(useful.map((column) => values[column]));
}
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(output, JSON.stringify({ columns: ['id', 'camera', 'lng', 'lat', 'date', 'season', 'time', 'habitat', 'species', 'count', 'image'], rows }));
console.log(`Wrote ${rows.length.toLocaleString()} records to ${output.pathname}`);
