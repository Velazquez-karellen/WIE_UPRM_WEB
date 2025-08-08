// main.js

// Espera a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Toggling mobile menu
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks   = document.getElementById('nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // Resaltar automáticamente el link activo en el header
  document.querySelectorAll('.nav-links a').forEach(link => {
    // Obtiene la última parte del path (por ejemplo: about.html)
    const href    = link.getAttribute('href');
    let current   = window.location.pathname.split('/').pop();
    // Si es el home y la url termina en /, se considera index.html
    if (!current || current === '/') current = 'index.html';
    if (href === current) {
      link.classList.add('active');
    }
  });
});