const groups = [
  { id: 'species', index: 8, host: 'speciesFilters', count: 'speciesCount' },
  { id: 'habitat', index: 7, host: 'habitatFilters', count: 'habitatCount' },
  { id: 'season', index: 5, host: 'seasonFilters', count: 'seasonCount' },
  { id: 'time', index: 6, host: 'timeFilters', count: 'timeCount' }
];
const selected = Object.fromEntries(groups.map(({ id }) => [id, new Set()]));
const optionCounts = {};
const tiles = [];
let rows = [];
let lastMatches = [];

const $ = (id) => document.getElementById(id);
const plural = (number, noun) => `${number.toLocaleString()} ${noun}${number === 1 ? '' : 's'}`;

function renderOptions() {
  const query = $('speciesSearch').value.trim().toLowerCase();
  groups.forEach(({ id, host, count }) => {
    const container = $(host);
    container.replaceChildren();
    for (const [value, total] of optionCounts[id]) {
      if (id === 'species' && !value.toLowerCase().includes(query)) continue;
      const label = $('optionTemplate').content.firstElementChild.cloneNode(true);
      const input = label.querySelector('input');
      input.checked = selected[id].has(value);
      input.dataset.group = id;
      input.value = value;
      label.querySelector('span').textContent = value;
      label.querySelector('small').textContent = total.toLocaleString();
      container.append(label);
    }
    $(count).textContent = selected[id].size || '';
  });
}

function filteredRows() {
  return rows.filter((row) => groups.every(({ id, index }) => selected[id].size === 0 || selected[id].has(row[index])));
}

function drawMap(matches) {
  const canvas = $('map');
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#edf3e6';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const { image, column, row } of tiles) {
    if (image.complete && image.naturalWidth) context.drawImage(image, column * 256 - 153, row * 256 - 391, 256, 256);
  }

  const locations = new Map();
  for (const row of matches) {
    const key = `${row[2]},${row[3]}`;
    locations.set(key, (locations.get(key) || 0) + 1);
  }
  const worldSize = 256 * 2 ** 11;
  context.lineWidth = 1.5;
  for (const [location, count] of locations) {
    const [longitude, latitude] = location.split(',').map(Number);
    const radians = latitude * Math.PI / 180;
    const x = ((longitude + 180) / 360) * worldSize - 1218 * 256 - 153;
    const y = ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * worldSize - 1131 * 256 - 391;
    if (x < -10 || x > canvas.width + 10 || y < -10 || y > canvas.height + 10) continue;
    context.beginPath();
    context.arc(x, y, Math.min(9, 3 + Math.log1p(count) * .7), 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 204, 51, .85)';
    context.fill();
    context.strokeStyle = '#fff';
    context.stroke();
  }
  $('pointCount').textContent = locations.size.toLocaleString();
}

function renderTable(matches) {
  const body = $('tableRows');
  body.replaceChildren();
  for (const row of matches.slice(0, 80)) {
    const tr = document.createElement('tr');
    for (const value of [row[8], row[1], row[7], row[5], row[6]]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      tr.append(cell);
    }
    const photo = document.createElement('td');
    const link = document.createElement('a');
    link.href = row[10];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View photo';
    photo.append(link);
    tr.append(photo);
    body.append(tr);
  }
  $('recordNote').textContent = matches.length > 80 ? 'Showing the first 80 matches' : `Showing all ${matches.length.toLocaleString()} matches`;
}

function render() {
  lastMatches = filteredRows();
  $('resultCount').textContent = plural(lastMatches.length, 'photo');
  const active = groups.flatMap(({ id }) => [...selected[id]]);
  $('activeSummary').textContent = active.length ? active.join(' · ') : 'All observations';
  drawMap(lastMatches);
  renderTable(lastMatches);
  $('download').disabled = false;
}

function download() {
  const header = ['image_id', 'camera', 'longitude', 'latitude', 'date', 'season', 'time_period', 'veg_type', 'species', 'species_count', 'image_url'];
  const csv = [header, ...lastMatches].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'wildcam-gorongosa-filtered.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadMapTiles() {
  const pending = [];
  for (let column = 0; column < 6; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      const image = new Image();
      tiles.push({ image, column, row });
      pending.push(new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      }));
      image.src = `assets/map/tile-${column}-${row}.jpg`;
    }
  }
  Promise.all(pending).then(() => drawMap(lastMatches));
}

document.addEventListener('change', (event) => {
  if (!event.target.matches('.option input')) return;
  const { group } = event.target.dataset;
  event.target.checked ? selected[group].add(event.target.value) : selected[group].delete(event.target.value);
  renderOptions();
  render();
});
$('speciesSearch').addEventListener('input', renderOptions);
$('clearFilters').addEventListener('click', () => {
  groups.forEach(({ id }) => selected[id].clear());
  $('speciesSearch').value = '';
  renderOptions();
  render();
});
$('download').addEventListener('click', download);

loadMapTiles();
async function loadObservations() {
  let data;
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.error('Could not load observations', error);
    $('resultCount').textContent = 'Could not load observations';
    $('activeSummary').textContent = 'The data request failed. Refresh the page to try again.';
    return;
  }

  try {
    rows = data.rows;
    for (const { id, index } of groups) {
      const counts = new Map();
      for (const row of rows) if (row[index]) counts.set(row[index], (counts.get(row[index]) || 0) + 1);
      optionCounts[id] = [...counts].sort(([a], [b]) => a.localeCompare(b));
    }
    renderOptions();
    render();
  } catch (error) {
    console.error('Could not display observations', error);
    $('resultCount').textContent = 'Could not display observations';
    $('activeSummary').textContent = error.message;
  }
}
loadObservations();
