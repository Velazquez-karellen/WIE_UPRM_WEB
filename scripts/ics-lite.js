// scripts/ics-lite.js
// Parser muy simple para VEVENT en archivos .ics (Google Calendar público)

function unfold(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[++i].slice(1);
    }
    out.push(line);
  }
  return out;
}

function parseICS(text) {
  const lines = unfold(text.split(/\r?\n/));
  const stack = [];
  const events = [];
  let current = null;

  for (const raw of lines) {
    if (!raw) continue;

    if (raw === 'BEGIN:VEVENT') {
      current = { type: 'VEVENT', fields: {} };
      stack.push(current);
      continue;
    }
    if (raw === 'END:VEVENT') {
      const obj = stack.pop();
      if (obj && obj.type === 'VEVENT') events.push(obj);
      current = null;
      continue;
    }
    if (!current) continue;

    // KEY;PARAMS:VALUE  o  KEY:VALUE
    const idx = raw.indexOf(':');
    if (idx === -1) continue;
    const left = raw.slice(0, idx);
    const val  = raw.slice(idx + 1);

    const key = left.split(';')[0]; // ignoramos params
    current.fields[key] = val;
  }

  return events;
}

module.exports = { parseICS };