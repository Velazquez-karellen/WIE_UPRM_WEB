/* js/events.js
   - Lee Google Calendar
   - Dibuja Timeline (events.html)
   - Dibuja Upcoming (index.html)
*/

const API_KEY = "AIzaSyDv97mF_YJTLbH-g6mnO58qTJnkDmz8yEI"; // tu key
const CALENDAR_ID = "wie@uprm.edu";                         // TU calendar (email, no la URL embed)

async function fetchEvents() {
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    CALENDAR_ID
  )}/events?key=${API_KEY}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=25`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return (data.items || []).filter(e => e.status !== "cancelled");
}

function formatDateRange(ev, locale = "es-PR") {
  const optsDate = { year:"numeric", month:"long", day:"numeric" };
  const optsDT   = { ...optsDate, hour:"2-digit", minute:"2-digit" };

  if (ev.start?.dateTime) {
    const d = new Date(ev.start.dateTime);
    return new Intl.DateTimeFormat(locale, optsDT).format(d);
  }
  if (ev.start?.date) {
    const d = new Date(ev.start.date);
    return new Intl.DateTimeFormat(locale, optsDate).format(d);
  }
  return "";
}

function escapeHtml(s="") {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}

/* ---------- Upcoming (Home) ---------- */
function renderUpcoming(allEvents) {
  const upcomingContainer =
    document.querySelector("#upcoming-events .events-scroll");

  if (!upcomingContainer) return;

  const now = new Date();
  const upcoming = allEvents
    .map(ev => {
      const start = ev.start?.dateTime || ev.start?.date;
      return { ev, _start: start ? new Date(start) : null };
    })
    .filter(x => x._start && x._start >= new Date(now.toDateString()))
    .sort((a,b) => a._start - b._start)
    .slice(0, 4)
    .map(x => x.ev);

  // Limpia Fallback para mantener layout horizontal
  upcomingContainer.innerHTML = "";

  if (!upcoming.length) {
    // si no hay próximos, dejamos el contenedor vacío y listo (tu CSS mantiene el ancho)
    return;
  }

  const frag = document.createDocumentFragment();
  upcoming.forEach(ev => {
    const title = escapeHtml(ev.summary || "Event");
    const when  = escapeHtml(formatDateRange(ev, "en-US")); // en-US corto para Home
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

  upcomingContainer.appendChild(frag);
}

/* ---------- Timeline (Events) ---------- */
function renderTimeline(allEvents) {
  const listEl   = document.getElementById("timeline-list");
  const loading  = document.getElementById("timeline-loading");
  const emptyEl  = document.getElementById("timeline-empty");
  if (!listEl) return;

  loading && (loading.style.display = "none");

  const events = allEvents.slice(); // ya están futuros y ordenados por la API
  if (!events.length) {
    emptyEl && (emptyEl.style.display = "block");
    return;
  }

  listEl.innerHTML = "";
  const fmtISO = d => (d ? new Date(d).toISOString() : "");

  const frag = document.createDocumentFragment();
  const modals = document.createDocumentFragment();

  events.forEach((ev, i) => {
    const id = "ev_" + (ev.id || i);
    const title = escapeHtml(ev.summary || "Evento");
    const whenTxt = formatDateRange(ev);
    const location = ev.location ? `<p class="muted">${escapeHtml(ev.location)}</p>` : "";
    const desc  = ev.description ? `<p>${escapeHtml(ev.description).replace(/\n/g,'<br>')}</p>` : "";

    // ITEM (FORZADO EN COLUMNA)
    const item = document.createElement("div");
    item.className = "timeline-event";
    item.innerHTML = `
      <h3>${title}</h3>
      <time datetime="${fmtISO(ev.start?.dateTime || ev.start?.date)}">${whenTxt}</time>
      ${location}
      ${(ev.description || ev.htmlLink) ? `<button class="btn small" data-modal="${id}">Más detalles →</button>` : ""}
    `;
    frag.appendChild(item);

    // MODAL
    if (ev.description || ev.htmlLink) {
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = id;
      modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-close" aria-label="Cerrar">&times;</button>
          <h2>${title}</h2>
          <p><strong>Cuándo:</strong> ${whenTxt}</p>
          ${location}
          ${desc}
          ${makeAddToCalendarBlock(ev)}
        </div>
      `;
      modals.appendChild(modal);
    }
  });

  listEl.appendChild(frag);
  document.body.appendChild(modals);

  // wire modals
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

/* Bloque universal “Add to your calendar” (Google/ICS/Outlook/Apple/Yahoo) */
function makeAddToCalendarBlock(ev) {
  const title = encodeURIComponent(ev.summary || "Event");
  const details = encodeURIComponent(ev.description || "");
  const location = encodeURIComponent(ev.location || "");

  const start = ev.start?.dateTime || ev.start?.date;
  const end   = ev.end?.dateTime   || ev.end?.date || ev.start?.dateTime || ev.start?.date;
  const dtStart = toICSDate(start);
  const dtEnd   = toICSDate(end);

  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&location=${location}&details=${details}`;
  const yahoo = `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${dtStart}&et=${dtEnd}&desc=${details}&in_loc=${location}`;
  const outlookWeb = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&body=${details}&location=${location}&startdt=${encodeURIComponent(toISO8601(start))}&enddt=${encodeURIComponent(toISO8601(end))}`;
  const icsContent = buildICS(ev);
  const icsHref = makeDataHref("text/calendar", icsContent);

  return `
    <p><strong>Add a tu calendar:</strong></p>
    <p>
      <a target="_blank" rel="noopener" href="${gcal}">Google</a> ·
      <a target="_blank" rel="noopener" href="${outlookWeb}">Outlook.com</a> ·
      <a target="_blank" rel="noopener" href="${yahoo}">Yahoo</a> ·
      <a href="${icsHref}" download="${sanitizeFilename((ev.summary || "event") + ".ics")}">ICS (Apple/Outlook)</a>
    </p>
  `;
}

function toICSDate(s) {
  if (!s) return "";
  const d = new Date(s);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function toISO8601(s) {
  if (!s) return "";
  return new Date(s).toISOString();
}
function sanitizeFilename(s) {
  return s.replace(/[^\w\-\.]+/g, "_");
}
function makeDataHref(mime, content) {
  return `data:${mime};charset=utf-8,` + encodeURIComponent(content);
}
function buildICS(ev) {
  const uid = (ev.id || String(Math.random()).slice(2)) + "@wieuprm";
  const dtStart = toICSDate(ev.start?.dateTime || ev.start?.date);
  const dtEnd   = toICSDate(ev.end?.dateTime   || ev.end?.date || ev.start?.dateTime || ev.start?.date);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WIE UPRM//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${(ev.summary || "Event").replace(/\n/g," ")}`,
    ev.location ? `LOCATION:${ev.location.replace(/\n/g," ")}` : "",
    ev.description ? `DESCRIPTION:${ev.description.replace(/\n/g," ")}` : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean);
  return lines.join("\r\n");
}

/* ---------- Init ---------- */
(async () => {
  try {
    const events = await fetchEvents();
    renderUpcoming(events);
    renderTimeline(events);
  } catch (e) {
    console.warn("No se pudieron cargar eventos:", e);
    // En Home: mejor dejar el fallback
    // En Events: esconder loader si existe
    const loading = document.getElementById("timeline-loading");
    if (loading) loading.style.display = "none";
  }
})();
