async function loadEvents() {
  const listEl = document.getElementById('timeline-list');
  const loadingEl = document.getElementById('timeline-loading');
  const emptyEl = document.getElementById('timeline-empty');

  const apiKey = "AIzaSyDv97mF_YJTLbH-g6mnO58qTJnkDmz8yEI";
  const calendarId = "https://calendar.google.com/calendar/embed?src=wie%40uprm.edu&ctz=America%2FPuerto_Rico";
  const timeMin = new Date().toISOString();

  // ====== Selección de elementos ======
  const listEl = document.getElementById("timeline-list");
  const loadingEl = document.getElementById("timeline-loading");
  const emptyEl = document.getElementById("timeline-empty");

  // ====== Cargar eventos ======
  async function loadEvents() {
    try {
      const now = new Date().toISOString();

      const url =
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          CALENDAR_ID
        )}/events?key=${API_KEY}&timeMin=${now}&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Error HTTP " + res.status);

      const data = await res.json();
      const events = data.items || [];

      // Quita el loader
      loadingEl.style.display = "none";

      if (events.length === 0) {
        emptyEl.style.display = "block";
        return;
      }

      const fmt = new Intl.DateTimeFormat("es-PR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const frag = document.createDocumentFragment();
      const modalFrag = document.createDocumentFragment();

      events.forEach((ev, idx) => {
        const id = "ev_" + (ev.id || idx);
        const title = ev.summary || "Evento";
        const location = ev.location || "";
        const description = ev.description || "";

        // Manejo de fechas
        let startDate, when;
        if (ev.start.dateTime) {
          startDate = new Date(ev.start.dateTime);
          when = fmt.format(startDate);
        } else if (ev.start.date) {
          startDate = new Date(ev.start.date);
          when = new Intl.DateTimeFormat("es-PR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(startDate);
        }

        // Evento en timeline
        const item = document.createElement("div");
        item.className = "timeline-event";
        item.innerHTML = `
          <h3>${escapeHtml(title)}</h3>
          <time datetime="${startDate.toISOString()}">${capitalize(when)}</time>
          ${location ? `<p class="muted">${escapeHtml(location)}</p>` : ""}
          ${description || ev.htmlLink ? `
            <button class="btn small" data-modal="${id}">Más detalles →</button>
          ` : ""}
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
      listEl.innerHTML = `
        <div class="timeline-event">
          <h3>No se pudieron cargar los eventos</h3>
          <p class="muted">Verifica tu API Key de Google Calendar.</p>
        </div>
      `;
    }
  }

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
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ====== Iniciar ======
  loadEvents();