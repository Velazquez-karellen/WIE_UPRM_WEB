// scripts/build-events.js
// Convierte un .ics público a docs/data/events.json

const fs = require('fs');
const https = require('https');

const ICS_URL = process.env.ICS_URL;

// ventana de tiempo (puedes ajustar también en el workflow)
const PAST_DAYS   = parseInt(process.env.PAST_DAYS  || '30', 10);
const FUTURE_DAYS = parseInt(process.env.FUTURE_DAYS || '400', 10);

const since = new Date(); since.setDate(since.getDate() - PAST_DAYS);
const until = new Date(); until.setDate(until.getDate() + FUTURE_DAYS);

// offsets fijos simples para TZID que suelen aparecer en Google Calendar
// (Puerto Rico usa UTC-4 todo el año)
const TZ_OFFSETS = {
  'America/Puerto_Rico': -4 * 60
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let data = '';
      res.on('data', d => data += d.toString('utf8'));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Unfold de líneas y parseo muy simple de VEVENT
function parseICal(ics) {
  const lines = ics.replace(/\r\n/g, '\n').split('\n').reduce((acc, l) => {
    if (l.startsWith(' ') || l.startsWith('\t')) acc[acc.length - 1] += l.slice(1);
    else acc.push(l);
    return acc;
  }, []);

  const events = [];
  let cur = null;

  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (l === 'END:VEVENT')   { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;

    const [rawKey, ...rest] = l.split(':');
    if (!rawKey || rest.length === 0) continue;
    const value = rest.join(':');
    const [key, ...params] = rawKey.split(';');

    if (key === 'SUMMARY')     cur.summary     = value.trim();
    if (key === 'DESCRIPTION') cur.description = value.trim();
    if (key === 'LOCATION')    cur.location    = value.trim();
    if (key === 'URL')         cur.url         = value.trim();
    if (key === 'UID')         cur.uid         = value.trim();

    if (key === 'DTSTART' || key === 'DTEND') {
      const isAllDay = params.some(p => p.toUpperCase().includes('VALUE=DATE'));
      let tzid = null;
      for (const p of params) {
        const [k,v] = p.split('=');
        if ((k||'').toUpperCase() === 'TZID') tzid = v;
      }
      const dt = parseDate(value.trim(), isAllDay, tzid);
      if (key === 'DTSTART') { cur.start = dt.toISOString(); cur.allDay = isAllDay; }
      else                   { cur.end   = dt.toISOString(); }
    }
  }
  return events;
}

function parseDate(v, isAllDay, tzid) {
  // Fecha "YYYYMMDD" (all-day)
  if (isAllDay || /^\d{8}$/.test(v)) {
    const y = +v.slice(0,4), m = +v.slice(4,6)-1, d = +v.slice(6,8);
    // los all-day los guardamos a medianoche UTC
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }

  // "YYYYMMDDTHHmmssZ"
  let m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (m) {
    const [,Y,Mo,D,h,mi,s] = m.map(Number);
    return new Date(Date.UTC(Y, Mo-1, D, h, mi, s));
  }

  // "YYYYMMDDTHHmmss" con TZID conocido
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const Y  = +m[1], Mo = +m[2]-1, D = +m[3];
    const h  = +m[4], mi = +m[5], s = +m[6];

    // Si nos dan TZID=America/Puerto_Rico, aplicamos -4:00
    const offsetMin = (tzid && TZ_OFFSETS[tzid] !== undefined) ? TZ_OFFSETS[tzid] : 0; // en minutos
    // Construimos fecha UTC restando el offset local
    return new Date(Date.UTC(Y, Mo, D, h - offsetMin/60, mi, s));
  }

  // Último recurso (dejar que JS lo intente)
  return new Date(v);
}

function inWindow(ev) {
  const start = new Date(ev.start);
  return start >= since && start <= until;
}

(async () => {
  try {
    console.log('⬇️  ICS:', ICS_URL);
    const ics = await fetch(ICS_URL);

    let events = parseICal(ics)
      .filter(inWindow)
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    // limita por si el calendario tiene muchísimos
    events = events.slice(0, 300);

    const outDir = 'docs/data';
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/events.json`, JSON.stringify(events, null, 2));

    console.log(`✅ docs/data/events.json generado con ${events.length} eventos`);
    if (events[0]) {
      console.log('Primer evento:', events[0].summary, events[0].start, events[0].location);
    }
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
