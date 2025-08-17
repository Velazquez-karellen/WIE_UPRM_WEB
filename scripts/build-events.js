// scripts/build-events.js
// Lee un .ics público y genera data/events.json con próximos eventos.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseICS } = require('./ics-lite');

// === CONFIG ===
const ICS_URL  = process.env.ICS_URL;     // viene del Action
const OUT_FILE = path.join(process.cwd(), 'data', 'events.json');
const MAX_EVENTS = 30;

// Convierte YYYYMMDD o YYYYMMDDTHHMMSSZ a ISO Z
function toISO(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{8}$/.test(s)) { // all-day
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    return { iso: `${y}-${m}-${d}T00:00:00Z`, allDay: true };
  }
  if (/^\d{8}T\d{6}Z$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const hh = s.slice(9, 11);
    const mm = s.slice(11, 13);
    const ss = s.slice(13, 15);
    return { iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`, allDay: false };
  }
  return { iso: s, allDay: false }; // fallback
}

function fetchICS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk.toString('utf8')));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  try {
    if (!ICS_URL) {
      console.error('❌ Falta ICS_URL (variable de entorno).');
      process.exit(1);
    }

    const icsText = await fetchICS(ICS_URL);
    const items = parseICS(icsText)
      .filter(e => e.type === 'VEVENT')
      .map(e => {
        const dtStart = toISO(e.fields['DTSTART']);
        const dtEnd   = toISO(e.fields['DTEND']);
        return {
          uid: e.fields['UID'] || null,
          title: e.fields['SUMMARY'] || 'Untitled',
          description: e.fields['DESCRIPTION'] || '',
          location: e.fields['LOCATION'] || '',
          start: dtStart ? dtStart.iso : null,
          end: dtEnd ? dtEnd.iso : null,
          allDay: dtStart ? dtStart.allDay : false
        };
      })
      // solo futuros (o de hoy)
      .filter(ev => !ev.start || new Date(ev.start) >= new Date(new Date().toDateString()))
      // ordena por fecha
      .sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0))
      .slice(0, MAX_EVENTS);

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(items, null, 2));

    console.log(`✅ Generado ${OUT_FILE} con ${items.length} eventos`);
  } catch (err) {
    console.error('❌ Error generando events.json:', err);
    process.exit(1);
  }
})();