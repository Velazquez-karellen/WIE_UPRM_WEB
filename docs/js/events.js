// ====== Config ======
const API_KEY = "AIzaSyDv97mF_YJTLbH-g6mnO58qTJnkDmz8yEI";
const CALENDAR_ID = "wie@uprm.edu";
const TIME_ZONE = "America/Puerto_Rico";

// ====== Elements ======
const listEl    = document.getElementById("timeline-list");
const loadingEl = document.getElementById("timeline-loading");
const emptyEl   = document.getElementById("timeline-empty");

// ====== Helpers ======
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}
function linkify(text = "") {
  const urlRE = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;
  return text.replace(urlRE, (match) => {
    const href = match.startsWith("http") ? match : "http://" + match;
    return `<a href="${href}" target="_blank" rel="noopener">${match}</a>`;
  });
}
function capitalize(str = "") {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// ====== Main ======
async function loadEvents() {
  try {
    // Mostrar loader
    loadingEl.style.display = "block";
    emptyEl.style.display = "none";
    listEl.innerHTML = "";

    const timeMin = new Date().toISOString();
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
    const params = new URLSearchParams({
      key: API_KEY,
      timeMin,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
      timeZone: TIME_ZONE,
    });
    const url = `${base}?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    const events = Array.isArray(data.items) ? data.items : [];

    // Ocultar loader
    loadingEl.style.display = "none";

    if (events.length === 0) {
      emptyEl.style.display = "block";
      return;
    }

    const fmtDateTime = new Intl.DateTimeFormat("es-PR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIME_ZONE,
    });
    const fmtDate = new Intl.DateTimeFormat("es-PR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: TIME_ZONE,
    });

    const frag = document.createDocumentFragment();
    const modalFrag = document.createDocumentFragment();

    events.forEach((ev, idx) => {
      const id = "ev_" + (ev.id || idx);
      const title = ev.summary || "Evento";
      const location = ev.location || "";
      const description = ev.description || "";

      // Manejo fechas (all-day vs con hora)
      let startDate, when;
      if (ev.start?.dateTime) {
        startDate = new Date(ev.start.dateTime);
        when = fmtDateTime.format(startDate);
      } else if (ev.start?.date) {
        startDate = new Date(ev.start.date + "T00:00:00");
        when = fmtDate.format(startDate);
      } else {
        when = "Por confirmar";
        startDate = new Date();
      }

      // Item timeline
      const item = document.createElement("div");
      item.className = "timeline-event";
      item.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <time datetime="${startDate.toISOString()}">${capitalize(when)}</time>
        ${location ? `<p class="muted">${escapeHtml(location)}</p>` : ""}
        ${(description || ev.htmlLink) ? `<button class="btn small" data-modal="${id}">Más detalles →</button>` : ""}
      `;
      frag.appendChild(item);

      // Modal
      if (description || ev.htmlLink) {
        const modal = document.createElement("div");
        modal.className = "modal";
        modal.id = id;
        modal.innerHTML = `
          <div class="modal-content">
            <button class="modal-close" aria-label="Cerrar">&times;</button>
            <h2>${escapeHtml(title)}</h2>
            <p><strong>Cuándo:</strong> ${capitalize(when)}</p>
            ${location ? `<p><strong>Dónde:</strong> ${escapeHtml(location)}</p>` : ""}
            ${description ? `<p>${linkify(escapeHtml(description)).replace(/\n/g,'<br>')}</p>` : ""}
            ${ev.htmlLink ? `<p><a href="${ev.htmlLink}" target="_blank" rel="noopener">Ver en Google Calendar →</a></p>` : ""}
          </div>
        `;
        modalFrag.appendChild(modal);
      }
    });

    listEl.appendChild(frag);
    document.body.appendChild(modalFrag);

    // Wire modals
    document.querySelectorAll("[data-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = document.getElementById(btn.dataset.modal);
        if (m) m.classList.add("active");
      });
    });
    document.querySelectorAll(".modal-close").forEach((x) => {
      x.addEventListener("click", () => {
        x.closest(".modal").classList.remove("active");
      });
    });
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
      });
    });
  } catch (err) {
    console.error("Error cargando eventos:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display = "none";
    listEl.innerHTML = `
      <div class="timeline-event">
        <h3>No se pudieron cargar los eventos</h3>
        <p class="muted">Verifica tu API Key y que el calendario sea público. Detalle: ${escapeHtml(String(err.message || err))}</p>
      </div>
    `;
  }
}

// Iniciar cuando el DOM esté listo (por si acaso)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadEvents);
} else {
  loadEvents();
}
