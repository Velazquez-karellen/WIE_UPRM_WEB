// scripts/build-events.js
// Convierte un .ics público a docs/data/events.json (compatible con tus index/events)

const fs = require('fs');
const https = require('https');

const ICS_URL = process.env.ICS_URL || 'https://calendar.google.com/calendar/ical/wie%40uprm.edu/public/basic.ics';
const PAST_DAYS   = parseInt(process.env.PAST_DAYS  || '30', 10);   // 30 días hacia atrás
const FUTURE_DAYS = parseInt(process.env.FUTURE_DAYS || '400', 10);  // ~13 meses hacia adelante

const since = new Date(); since.setDate(since.getDate() - PAST_DAYS);
const until = new Date(); until.setDate(until.getDate() + FUTURE_DAYS);

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

// parseo .ics simple con soporte a all-day y con hora (Z)
function parseICal(ics) {
  const lines = ics.replace(/\r\n/g, '\n').split('\n').reduce((acc, l) => {
    if (l.startsWith(' ') || l.startsWith('\t')) acc[acc.length - 1] += l.slice(1);
    else acc.push(l);
    return acc;
  }, []);
  const events = [];
  let cur = null;

  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = {};
    else if (l === 'END:VEVENT') { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const [rawKey, ...rest] = l.split(':');
      if (!rawKey || rest.length === 0) continue;
      const value = rest.join(':').trim();
      const [key, ...params] = rawKey.split(';');

      if (key === 'SUMMARY') cur.summary = value;
      if (key === 'DESCRIPTION') cur.description = value;
      if (key === 'LOCATION') cur.location = value;
      if (key === 'URL') cur.url = value;

      if (key === 'DTSTART' || key === 'DTEND') {
        const allDay = params.some(p => p.toUpperCase().includes('VALUE=DATE'));
        const dt = parseDate(value, allDay);
        if (key === 'DTSTART') { cur.start = dt.toISOString(); cur.allDay = allDay; }
        else cur.end = dt.toISOString();
      }
    }
  }
  return events;
}

function parseDate(v, allDay) {
  if (allDay || /^\d{8}$/.test(v)) {
    const y = +v.slice(0,4), m = +v.slice(4,6)-1, d = +v.slice(6,8);
    // all-day → a medianoche UTC
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (m) {
    const [,Y,Mo,D,h,mi,s,z] = m;
    if (z === 'Z') return new Date(Date.UTC(+Y, +Mo-1, +D, +h, +mi, +s));
    return new Date(+Y, +Mo-1, +D, +h, +mi, +s);
  }
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
    let events = parseICal(ics).filter(inWindow).sort((a,b) => new Date(a.start) - new Date(b.start));
    events = events.slice(0, 150);

    const outDir = 'docs/data';
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/events.json`, JSON.stringify(events, null, 2));
    console.log(`✅ docs/data/events.json generado con ${events.length} eventos`);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
