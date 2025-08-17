// server.js
import express from 'express';
const path    = require('path');
const fs      = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware para parsear application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para manejar el envío del formulario de contacto
app.post('/contact_submission', (req, res) => {
  const dataDir = path.join(__dirname, 'submissions');
  // Crear carpeta 'submissions' si no existe
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  // Crear archivo con timestamp seguro
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename  = path.join(dataDir, `${timestamp}.json`);

  // Objeto a guardar
  const submission = {
    name:      req.body.name || '',
    email:     req.body.email || '',
    telephone: req.body.telephone || '',
    message:   req.body.message || '',
    privacy:   !!req.body.privacy,
    submittedAt: new Date().toISOString()
  };

  // Guardar como JSON
  fs.writeFileSync(filename, JSON.stringify(submission, null, 2));

  // Redirigir a página de agradecimiento
  res.redirect('/thank-you.html');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});