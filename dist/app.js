const groups = [
  { id: 'species', index: 8, host: 'speciesFilters', count: 'speciesCount' },
  { id: 'habitat', index: 7, host: 'habitatFilters', count: 'habitatCount' },
  { id: 'season', index: 5, host: 'seasonFilters', count: 'seasonCount' },
  { id: 'time', index: 6, host: 'timeFilters', count: 'timeCount' }
];
const selected = Object.fromEntries(groups.map(({ id }) => [id, new Set()]));
let rows = [];

const $ = (id) => document.getElementById(id);
const plural = (number, noun) => `${number.toLocaleString()} ${noun}${number === 1 ? '' : 's'}`;

function valuesFor(index) {
  return [...new Map(rows.map((row) => [row[index], 0])).keys()].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function renderOptions() {
  const query = $('speciesSearch').value.trim().toLowerCase();
  groups.forEach((group) => {
    const host = $(group.host); host.replaceChildren();
    const values = valuesFor(group.index).filter((value) => group.id !== 'species' || value.toLowerCase().includes(query));
    values.forEach((value) => {
      const label = $('optionTemplate').content.firstElementChild.cloneNode(true);
      const input = label.querySelector('input');
      input.checked = selected[group.id].has(value);
      input.dataset.group = group.id; input.value = value;
      label.querySelector('span').textContent = value;
      label.querySelector('small').textContent = rows.filter((row) => row[group.index] === value).length.toLocaleString();
      host.append(label);
    });
    $(group.count).textContent = selected[group.id].size ? selected[group.id].size : '';
  });
}

function filteredRows() {
  return rows.filter((row) => groups.every(({ id, index }) => selected[id].size === 0 || selected[id].has(row[index])));
}

function drawMap(matches) {
  const canvas = $('map'); const context = canvas.getContext('2d');
  const width = canvas.width; const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#dce7d7'; context.fillRect(0, 0, width, height);
  context.strokeStyle = '#c4d6be'; context.lineWidth = 2;
  for (let x = -100; x < width + 150; x += 155) { context.beginPath(); context.moveTo(x, 0); context.bezierCurveTo(x + 80, height * .25, x - 45, height * .75, x + 95, height); context.stroke(); }
  context.fillStyle = '#92b68d'; context.globalAlpha = .55; context.beginPath(); context.ellipse(width * .48, height * .52, width * .38, height * .24, -.2, 0, Math.PI * 2); context.fill();
  const limit = 2200; const step = Math.max(1, Math.ceil(matches.length / limit));
  context.fillStyle = '#c35335'; context.globalAlpha = .48;
  for (let i = 0; i < matches.length; i += step) {
    const row = matches[i], lng = Number(row[2]), lat = Number(row[3]);
    const x = ((lng - 34.15) / .55) * width, y = ((-lat - 18.65) / .48) * height;
    if (x >= 0 && x <= width && y >= 0 && y <= height) { context.beginPath(); context.arc(x, y, 2.1, 0, Math.PI * 2); context.fill(); }
  }
  context.globalAlpha = 1; $('pointCount').textContent = `sampled ${Math.min(matches.length, limit).toLocaleString()}`;
}

function renderTable(matches) {
  const body = $('tableRows'); body.replaceChildren();
  matches.slice(0, 80).forEach((row) => {
    const tr = document.createElement('tr');
    [row[8], row[1], row[7], row[5], row[6]].forEach((value) => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
    const photo = document.createElement('td'); const link = document.createElement('a'); link.href = row[10]; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'View photo'; photo.append(link); tr.append(photo); body.append(tr);
  });
  $('recordNote').textContent = matches.length > 80 ? 'Showing the first 80 matches' : `Showing all ${matches.length.toLocaleString()} matches`;
}

function render() {
  const matches = filteredRows();
  $('resultCount').textContent = plural(matches.length, 'photo');
  const active = groups.flatMap(({ id }) => [...selected[id]]);
  $('activeSummary').textContent = active.length ? active.join(' · ') : 'All observations';
  drawMap(matches); renderTable(matches); $('download').disabled = false;
}

function download() {
  const head = ['image_id', 'camera', 'longitude', 'latitude', 'date', 'season', 'time_period', 'veg_type', 'species', 'species_count', 'image_url'];
  const csv = [head, ...filteredRows()].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'wildcam-gorongosa-filtered.csv'; a.click(); URL.revokeObjectURL(url);
}

document.addEventListener('change', (event) => { if (!event.target.matches('.option input')) return; const { group } = event.target.dataset; event.target.checked ? selected[group].add(event.target.value) : selected[group].delete(event.target.value); renderOptions(); render(); });
$('speciesSearch').addEventListener('input', renderOptions);
$('clearFilters').addEventListener('click', () => { groups.forEach(({ id }) => selected[id].clear()); $('speciesSearch').value = ''; renderOptions(); render(); });
$('download').addEventListener('click', download);

fetch('data.json').then((response) => response.json()).then((data) => { rows = data.rows; $('totalCount').textContent = rows.length.toLocaleString(); renderOptions(); render(); }).catch(() => { $('resultCount').textContent = 'Could not load observations'; $('activeSummary').textContent = 'Check that data.json is available.'; });
