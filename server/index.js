// server/index.js
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');

const multer = require('multer');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'client', 'img', 'loghi'),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const nome = Date.now() + ext;
    cb(null, nome);
  }
});
const upload = multer({ storage });

const app       = express();
const PORT      = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, 'data.json');

const ADMIN_PASSWORD_PLAIN = 'savigliano2026';
let adminPasswordHash = null;

async function inizializza() {
  adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD_PLAIN, 10);
  console.log('✓ Password admin pronta.');
}

function leggiDati() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function salvaDati(dati) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dati, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

// ─── AUTH ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  const ok = await bcrypt.compare(password, adminPasswordHash);
  if (ok) return res.json({ success: true, token: 'ok-admin' });
  res.status(401).json({ success: false });
});

// ─── TORNEO ──────────────────────────────────────────────────
app.get('/api/torneo', (req, res) => {
  res.json(leggiDati().torneo);
});

app.put('/api/torneo', (req, res) => {
  const dati = leggiDati();
  dati.torneo = { ...dati.torneo, ...req.body };
  salvaDati(dati);
  res.json(dati.torneo);
});

// ─── GIRONI ──────────────────────────────────────────────────
app.get('/api/gironi', (req, res) => {
  res.json(leggiDati().gironi);
});

app.post('/api/gironi', (req, res) => {
  const dati = leggiDati();
  const nuovo = {
    id:      Date.now(),
    nome:    req.body.nome  || 'Girone A',
    fase:    req.body.fase  || 1,
    campo:   req.body.campo || '',
    squadre: []
  };
  dati.gironi.push(nuovo);
  salvaDati(dati);
  res.json(nuovo);
});

app.put('/api/gironi/:id', (req, res) => {
  const dati   = leggiDati();
  const girone = dati.gironi.find(g => g.id === parseInt(req.params.id));
  if (!girone) return res.status(404).json({ errore: 'Girone non trovato' });

  if (req.body.nome    !== undefined) girone.nome    = req.body.nome;
  if (req.body.fase    !== undefined) girone.fase    = req.body.fase;
  if (req.body.squadre !== undefined) girone.squadre = req.body.squadre;
  if (req.body.campo !== undefined) girone.campo = req.body.campo;

  salvaDati(dati);
  res.json(girone);
});

app.delete('/api/gironi/:id', (req, res) => {
  const dati = leggiDati();
  const id   = parseInt(req.params.id);

  // Elimina anche le partite associate al girone
  dati.partite = dati.partite.filter(p => p.gironeId !== id);
  dati.gironi  = dati.gironi.filter(g => g.id !== id);

  salvaDati(dati);
  res.json({ ok: true });
});

// ─── SQUADRE ─────────────────────────────────────────────────
app.post('/api/gironi/:id/squadre', (req, res) => {
  const dati   = leggiDati();
  const girone = dati.gironi.find(g => g.id === parseInt(req.params.id));
  if (!girone) return res.status(404).json({ errore: 'Girone non trovato' });

  const squadra = {
    id:   Date.now(),
    nome: req.body.nome  || 'Squadra',
    logo: req.body.logo  || ''
  };
  girone.squadre.push(squadra);
  salvaDati(dati);
  res.json(squadra);
});

app.delete('/api/gironi/:gId/squadre/:sId', (req, res) => {
  const dati   = leggiDati();
  const girone = dati.gironi.find(g => g.id === parseInt(req.params.gId));
  if (!girone) return res.status(404).json({ errore: 'Girone non trovato' });

  girone.squadre = girone.squadre.filter(s => s.id !== parseInt(req.params.sId));
  salvaDati(dati);
  res.json({ ok: true });
});

// ─── PARTITE ─────────────────────────────────────────────────
app.get('/api/partite', (req, res) => {
  res.json(leggiDati().partite);
});

app.post('/api/partite', (req, res) => {
  const dati  = leggiDati();
  const nuova = {
    id:              Date.now(),
    gironeId:        req.body.gironeId        || null,
    fase:            req.body.fase            || 1,
    squadraCasaId:   req.body.squadraCasaId   || null,
    squadraOspiteId: req.body.squadraOspiteId || null,
    data:            req.body.data            || null,
    ora:             req.body.ora             || null,
    campo:           req.body.campo           || null,
    puntiCasa:       null,
    puntiOspite:     null,
    quarti: {
      casa:   [null, null, null, null, null, null],
      ospite: [null, null, null, null, null, null]
    },
    overtime: { casa: [], ospite: [] },
    giocata:  false
  };
  dati.partite.push(nuova);
  salvaDati(dati);
  res.json(nuova);
});

app.put('/api/partite/:id', (req, res) => {
  const dati    = leggiDati();
  const id      = parseInt(req.params.id);
  const partita = dati.partite.find(p => p.id === id);
  if (!partita) return res.status(404).json({ errore: 'Partita non trovata' });

  const campi = [
    'gironeId', 'fase',
    'squadraCasaId', 'squadraOspiteId',
    'data', 'ora', 'campo',
    'puntiCasa', 'puntiOspite',
    'canestriCasa', 'canestriOspite',
    'quarti', 'overtime',
    'giocata'
  ];
  campi.forEach(c => {
    if (req.body[c] !== undefined) partita[c] = req.body[c];
  });

  salvaDati(dati);
  res.json(partita);
});

app.delete('/api/partite/:id', (req, res) => {
  const dati = leggiDati();
  dati.partite = dati.partite.filter(p => p.id !== parseInt(req.params.id));
  salvaDati(dati);
  res.json({ ok: true });
});

// ─── RESET RISULTATI ─────────────────────────────────────────
app.post('/api/reset', (req, res) => {
  const dati = leggiDati();
  dati.partite.forEach(p => {
    p.puntiCasa   = null;
    p.puntiOspite = null;
    p.quarti      = { casa: [null,null,null,null,null,null], ospite: [null,null,null,null,null,null] };
    p.overtime    = { casa: [], ospite: [] };
    p.giocata     = false;
  });
  salvaDati(dati);
  res.json({ ok: true });
});

// ─── FALLBACK SPA ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ─── UPLOAD LOGO ─────────────────────────────────────────────
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file ricevuto' });
  const url = `/img/loghi/${req.file.filename}`;
  res.json({ url });
});

// ─── AVVIO ───────────────────────────────────────────────────
inizializza().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server avviato su http://localhost:${PORT}`);
    console.log(`  Pubblica:  http://localhost:${PORT}/`);
    console.log(`  Admin:     http://localhost:${PORT}/admin.html`);
  });
});