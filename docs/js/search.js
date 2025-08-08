document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const query  = params.get('q')?.trim().toLowerCase() || '';
  const resultsContainer = document.getElementById('results');

  if (!query) {
    resultsContainer.innerHTML = '<p>Por favor, ingresa un término de búsqueda.</p>';
    return;
  }

  const pages = [
    { name: 'Home',    url: 'index.html'   },
    { name: 'About Us',  url: 'about.html'   },
    { name: 'Events',   url: 'events.html'  },
    { name: 'Sponsors',  url: 'sponsors.html'},
    { name: 'Contact',  url: 'contact.html' }
  ];

  // Utilidad para dividir en oraciones (simple)
  function splitSentences(text) {
    return text
      .replace(/\s+/g, ' ')
      .split(/(?<=[\.!\?])\s+/);
  }

  // Procesa cada página
  Promise.all(pages.map(page =>
    fetch(page.url)
      .then(resp => resp.text())
      .then(html => {
        // Parsear HTML y extraer solo texto
        const parser = new DOMParser();
        const doc    = parser.parseFromString(html, 'text/html');
        const text   = doc.body.innerText || '';
        const sentences = splitSentences(text);
        // Filtrar oraciones que contienen el término
        const matches = sentences.filter(s =>
          s.toLowerCase().includes(query)
        );
        return { ...page, matches };
      })
  ))
  .then(results => {
    let anyFound = false;
    results.forEach(({ name, url, matches }) => {
      if (matches.length) {
        anyFound = true;
        // Crear sección de resultados para esta página
        const section = document.createElement('section');
        section.innerHTML = `
          <h2><a href="${url}">${name}</a></h2>
          <ul>
            ${matches.map(s => `<li>${s}</li>`).join('')}
          </ul>
        `;
        resultsContainer.appendChild(section);
      }
    });
    if (!anyFound) {
      resultsContainer.innerHTML = `<p>No results found for "<strong>${query}</strong>".</p>`;
    }
  })
  .catch(err => {
    console.error(err);
    resultsContainer.innerHTML = '<p>Error 404.</p>';
  });
});