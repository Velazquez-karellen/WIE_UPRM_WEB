/* js/events.js
   - Fetches Google Calendar events
   - Renders Timeline (events.html)
   - Renders Upcoming (index.html)
*/

const API_KEY = "AIzaSyDv97mF_YJTLbH-g6mnO58qTJnkDmz8yEI";  // your key
const CALENDAR_ID = "wie@uprm.edu";                          // your calendar (email, not the embed URL)

/* ------------------------ Google Calendar ------------------------ */
async function fetchEvents() {
  const now = new Date().toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}` +
    `/events?key=${API_KEY}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=50`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return (data.items || []).filter(e => e.status !== "cancelled");
}

/* ------------------------ Helpers ------------------------ */
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}

function formatDateRange(ev, locale = "en-US") {
  // Show a nice single date/time for start (en-US)
  const optsDate = { year: "numeric", month: "long", day: "numeric" };
  const optsDT   = { ...optsDate, hour: "numeric", minute: "2-digit" };

  if (ev.start?.dateTime) {
    const d = new Date(ev.start.dateTime);
    return new Intl.DateTimeFormat(locale, optsDT).format(d);
  }
  if (ev.start?.date) {
    const d = new Date(ev.start.date + "T00:00:00");
    return new Intl.DateTimeFormat(locale, optsDate).format(d);
  }
  return "";
}

function toISO8601(s) {
  if (!s) return "";
  return new Date(s).toISOString();
}

/* ---------- ICS helpers (robust: handles all‑day vs timed) ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }

function toICSDateTimeUTC(date) {
  const d = new Date(date);
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) + "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) + "Z"
  );
}

function toICSDateValue(d) {
  // VALUE=DATE format: YYYYMMDD
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}${m}${day}`;
}

function buildICS(ev) {
  // Returns { href, filename } for a data: URL ICS (works on Apple/iOS, macOS, Outlook, etc.)
  const title = (ev.summary || "Event").trim();
  const description = ev.description ? ev.description.replace(/\r?\n/g, "\\n") : "";
  const location = ev.location ? ev.location.replace(/\r?\n/g, " ") : "";

  let vevent = "";
  const uid = (ev.id || (Date.now() + "-" + Math.random())).toString().replace(/[^\w-]/g, "");
  const dtstamp = toICSDateTimeUTC(new Date());

  // All‑day?
  const isAllDay = !!(ev.start && ev.start.date && !ev.start.dateTime);

  if (isAllDay) {
    const start = new Date(ev.start.date + "T00:00:00");
    const end = ev.end?.date
      ? new Date(ev.end.date + "T00:00:00")
      : new Date(start.getTime() + 24 * 60 * 60 * 1000); // add 1 day (exclusive)

    vevent += "BEGIN:VEVENT\r\n";
    vevent += `UID:${uid}@wieuprm\r\n`;
    vevent += `DTSTAMP:${dtstamp}\r\n`;
    vevent += `DTSTART;VALUE=DATE:${toICSDateValue(start)}\r\n`;
    vevent += `DTEND;VALUE=DATE:${toICSDateValue(end)}\r\n`;
    vevent += `SUMMARY:${title}\r\n`;
    if (location) vevent += `LOCATION:${location}\r\n`;
    if (description) vevent += `DESCRIPTION:${description}\r\n`;
    vevent += "END:VEVENT\r\n";
  } else {
    // Timed
    const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : new Date();
    const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(start.getTime() + 60 * 60 * 1000);

    vevent += "BEGIN:VEVENT\r\n";
    vevent += `UID:${uid}@wieuprm\r\n`;
    vevent += `DTSTAMP:${dtstamp}\r\n`;
    vevent += `DTSTART:${toICSDateTimeUTC(start)}\r\n`;
    vevent += `DTEND:${toICSDateTimeUTC(end)}\r\n`;
    vevent += `SUMMARY:${title}\r\n`;
    if (location) vevent += `LOCATION:${location}\r\n`;
    if (description) vevent += `DESCRIPTION:${description}\r\n`;
    vevent += "END:VEVENT\r\n";
  }

  const vcal =
    "BEGIN:VCALENDAR\r\n" +
    "VERSION:2.0\r\n" +
    "PRODID:-//WIE UPRM//Events//EN\r\n" +
    "CALSCALE:GREGORIAN\r\n" +
    vevent +
    "END:VCALENDAR\r\n";

  const href = "data:text/calendar;charset=utf-8," + encodeURIComponent(vcal);
  const filename = (title.replace(/[^\w\-]+/g, "_") || "event") + ".ics";
  return { href, filename };
}

/* ---------- Web calendar links: Google / Outlook / Yahoo ---------- */
function buildWebCalendarLinks(ev) {
  const title = encodeURIComponent(ev.summary || "Event");
  const details = encodeURIComponent(ev.description || "");
  const location = encodeURIComponent(ev.location || "");

  const isAllDay = !!(ev.start && ev.start.date && !ev.start.dateTime);

  let startISO, endISO;

  if (isAllDay) {
    // All‑day: Google/Yahoo expect DATE only, end exclusive (next day)
    const s = new Date(ev.start.date + "T00:00:00Z");
    const e = ev.end?.date ? new Date(ev.end.date + "T00:00:00Z") : new Date(s.getTime() + 24*60*60*1000);
    const fmtYMD = d => d.toISOString().slice(0,10).replace(/-/g,"");
    startISO = fmtYMD(s);
    endISO   = fmtYMD(e);
  } else {
    const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : new Date();
    const end   = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(start.getTime() + 60*60*1000);
    const fmt = d => d.toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
    startISO = fmt(start);
    endISO   = fmt(end);
  }

  // Google
  const google =
    `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}` +
    `&dates=${startISO}/${endISO}&details=${details}&location=${location}&sf=true&output=xml`;

  // Outlook web (consumer)
  const outlook =
    `https://outlook.live.com/owa/?rru=addevent&subject=${title}&body=${details}` +
    `&location=${location}&allday=${isAllDay ? "true" : "false"}` +
    `&startdt=${isAllDay ? startISO : encodeURIComponent(toISO8601(ev.start?.dateTime))}` +
    `&enddt=${isAllDay ? endISO   : encodeURIComponent(toISO8601(ev.end?.dateTime || new Date()))}`;

  // Yahoo
  const yahoo =
    `https://calendar.yahoo.com/?v=60&title=${title}&st=${startISO}&et=${endISO}` +
    `&desc=${details}&in_loc=${location}${isAllDay ? "&allday=1" : ""}`;

  return { google, outlook, yahoo };
}

/* ------------------------ Home: Upcoming ------------------------ */
function renderUpcoming(allEvents) {
  const container = document.querySelector("#upcoming-events .events-scroll");
  if (!container) return;

  const now = new Date();
  const items = allEvents
    .map(ev => {
      const start = ev.start?.dateTime || ev.start?.date;
      return { ev, _start: start ? new Date(start) : null };
    })
    .filter(x => x._start && x._start >= new Date(now.toDateString()))
    .sort((a, b) => a._start - b._start)
    .slice(0, 4)
    .map(x => x.ev);

  container.innerHTML = ""; // clear fallback

  const frag = document.createDocumentFragment();
  items.forEach(ev => {
    const title = escapeHtml(ev.summary || "Event");
    const when  = escapeHtml(formatDateRange(ev, "en-US"));
    const loc   = ev.location ? `<p class="event-meta">${escapeHtml(ev.location)}</p>` : "";

    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      <h4>${title}</h4>
      <p class="event-meta"><strong>${when || ""}</strong></p>
      ${loc}
      <a href="events.html">Details →</a>
    `;
    frag.appendChild(card);
  });

  container.appendChild(frag);
}

/* ------------------------ Events: Timeline ------------------------ */
function renderTimeline(allEvents) {
  const listEl  = document.getElementById("timeline-list");
  const loading = document.getElementById("timeline-loading");
  const emptyEl = document.getElementById("timeline-empty");
  if (!listEl) return;

  if (loading) loading.style.display = "none";

  const events = allEvents.slice(); // already time-ordered by API
  if (!events.length) {
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }

  listEl.innerHTML = "";
  const fmtISO = d => (d ? new Date(d).toISOString() : "");

  const frag = document.createDocumentFragment();
  const modals = document.createDocumentFragment();

  events.forEach((ev, i) => {
    const modalId = "ev_" + (ev.id || i);
    const title   = escapeHtml(ev.summary || "Event");
    const whenTxt = escapeHtml(formatDateRange(ev, "en-US"));
    const locationHTML = ev.location ? `<p class="muted">${escapeHtml(ev.location)}</p>` : "";
    const descHTML = ev.description ? `<p>${escapeHtml(ev.description).replace(/\n/g, "<br>")}</p>` : "";

    // Item (stacked so the button is below)
    const item = document.createElement("div");
    item.className = "timeline-event";
    item.innerHTML = `
      <h3>${title}</h3>
      <time datetime="${fmtISO(ev.start?.dateTime || ev.start?.date)}">${whenTxt}</time>
      ${locationHTML}
      ${(ev.description || ev.htmlLink) ? `<button class="btn small" data-modal="${modalId}">More details →</button>` : ""}
    `;
    frag.appendChild(item);

    // Modal
    if (ev.description || ev.htmlLink) {
      const { google, outlook, yahoo } = buildWebCalendarLinks(ev);
      const { href: icsHref, filename: icsName } = buildICS(ev);

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = modalId;
      modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-close" aria-label="Close">&times;</button>
          <h2>${title}</h2>
          <p><strong>When:</strong> ${whenTxt}</p>
          ${locationHTML}
          ${descHTML}
          <p><strong>Add to your calendar:</strong></p>
          <p>
            <a href="${google}" target="_blank" rel="noopener">Google</a> ·
            <a href="${outlook}" target="_blank" rel="noopener">Outlook</a> ·
            <a href="${yahoo}" target="_blank" rel="noopener">Yahoo</a> ·
            <a href="${icsHref}" download="${icsName}">Apple / iOS (.ics)</a>
          </p>
        </div>
      `;
      modals.appendChild(modal);
    }
  });

  listEl.appendChild(frag);
  document.body.appendChild(modals);

  // Wire modals
  document.querySelectorAll("[data-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = document.getElementById(btn.dataset.modal);
      if (m) m.classList.add("active");
    });
  });
  document.querySelectorAll(".modal-close").forEach(x => {
    x.addEventListener("click", () => x.closest(".modal").classList.remove("active"));
  });
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("active"); });
  });
}

/* ------------------------ Boot ------------------------ */
(async () => {
  try {
    const events = await fetchEvents();
    renderUpcoming(events);  // Home
    renderTimeline(events);  // Events page
  } catch (err) {
    console.warn("Events could not be loaded:", err);
    const loading = document.getElementById("timeline-loading");
    if (loading) loading.style.display = "none";
  }
})();
