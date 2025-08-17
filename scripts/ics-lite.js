// scripts/ics-to-json.js
// Lee un .ics público y escribe docs/data/events.json con una ventana configurable.

const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const ICS_URL = process.env.ICS_URL; // pásalo desde el workflow
if (!ICS_URL) {
  console.error('❌ Falta variable ICS_URL');
  process.exit(1);
}

// Ventana por defecto: desde 60 días en el pasado hasta 400 días al futuro
const PAST_DAYS  = parseInt(process.env.PAST_DAYS  || '60', 10);
const FUTURE_DAYS = parseInt(process.env.FUTURE_DAYS || '400', 10);

const since = new Date();
since.setDate(since.getDate() - PAST_DAYS);
const until = new Date();
until.setDate(until.getDate() + FUTURE_DAYS);

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), (res) => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let data = '';
      res.on('data', d => data += d.toString('utf8'));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Parse simple del .ics (sin dependencias) soportando:
// - DTSTART;VALUE=DATE:20250301
// - DTSTART:20250301T143000Z
// - DTEND análogo
function parseICal(icsText) {
  // desdobla líneas plegadas
  const lines = icsText.replace(/\r\n/g, '\n').split('\n').reduce((acc, line) => {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      acc[acc.length - 1] += line.slice(1);
    } else {
      acc.push(line);
    }
    return acc;
  }, []);

  const events = [];
  let cur = null;

  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') {
      cur = {};
    } else if (ln === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const [rawKey, ...rest] = ln.split(':');
      if (!rawKey || rest.length === 0) continue;
      const value = rest.join(':'); // por si hay más ':'
      const [key, ...params] = rawKey.split(';');

      if (key === 'SUMMARY') cur.summary = value.trim();
      if (key === 'DESCRIPTION') cur.description = value.trim();
      if (key === 'LOCATION') cur.location = value.trim();
      if (key === 'URL' || key === 'X-ALT-DESC;FMTTYPE=text/html') cur.url = (cur.url || value.trim());

      if (key === 'DTSTART' || key === 'DTEND') {
        const isAllDay = params.some(p => p.toUpperCase().includes('VALUE=DATE'));
        const dt = parseICalDate(value, isAllDay);
        if (key === 'DTSTART') { cur.start = dt.toISOString(); cur.allDay = !!isAllDay; }
        else { cur.end = dt.toISOString(); }
      }
    }
  }
  return events;
}

function parseICalDate(v, isAllDay) {
  // YYYYMMDD o YYYYMMDDTHHMMSSZ
  if (isAllDay || /^\d{8}$/.test(v)) {
    const y = Number(v.slice(0,4)), m = Number(v.slice(4,6))-1, d = Number(v.slice(6,8));
    // Trátalo como fecha local al inicio del día
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }
  // con hora (posible Z)
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (m) {
    const [,Y,Mo,D,h,mi,s,z] = m;
    if (z === 'Z') return new Date(Date.UTC(+Y, +Mo-1, +D, +h, +mi, +s));
    return new Date(+Y, +Mo-1, +D, +h, +mi, +s);
  }
  // fallback
  return new Date(v);
}

function inWindow(ev) {
  const start = new Date(ev.start);
  return start >= since && start <= until;
}

(async () => {
  try {
    console.log('⬇️  Descargando ICS…');
    const ics = await fetch(ICS_URL);
    console.log('🧩 Parseando…');
    let events = parseICal(ics)
      .filter(inWindow)
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    // Limita a 100 eventos para el JSON
    events = events.slice(0, 100);

    const outDir = 'docs/data';
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/events.json`, JSON.stringify(events, null, 2));
    console.log(`✅ Generado ${outDir}/events.json con ${events.length} eventos.`);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();