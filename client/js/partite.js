/* ============================================================
   PARTITE.JS — render elenco partite con filtri per girone
   ============================================================ */

// ─── STATO LOCALE ─────────────────────────────────────────────
let _partiteAll   = [];
let _gironiAll    = [];
let _filtroFase   = 1;
let _filtroGirone = 'tutti';

// ─── INIT ─────────────────────────────────────────────────────
async function partiteInit() {
  await partiteCaricaDati();
  partiteRenderFiltri();
  partiteRender();
}

async function partiteCaricaDati() {
  [_partiteAll, _gironiAll] = await Promise.all([
    PartiteAPI.lista(),
    GironiAPI.lista()
  ]);
}

// ─── FILTRI ───────────────────────────────────────────────────
function partiteSetFase(fase) {
  _filtroFase   = fase;
  _filtroGirone = 'tutti';
  partiteRenderFiltri();
  partiteRender();
}

function partiteSetGirone(gironeId) {
  _filtroGirone = gironeId;
  partiteRenderFiltri();
  partiteRender();
}

function partiteFiltra() {
  return _partiteAll.filter(p => {
    if (p.fase !== _filtroFase) return false;
    if (_filtroGirone !== 'tutti' && p.gironeId !== _filtroGirone) return false;
    return true;
  });
}

function partiteRenderFiltri() {
  const container = document.getElementById('partite-filtri');
  if (!container) return;

  const gironiFase = _gironiAll.filter(g => g.fase === _filtroFase);

  // Mostra filtro gironi solo se ce n'è più di uno
  if (gironiFase.length <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="filtri-gruppo">
      <div class="filtri-riga">
        <span class="filtri-label">Girone</span>
        <div class="filtri-btn-group">
          <button class="filtro-btn ${_filtroGirone === 'tutti' ? 'active' : ''}"
                  onclick="partiteSetGirone('tutti')">
            Tutti
          </button>
          ${gironiFase.map(g => `
            <button class="filtro-btn ${_filtroGirone === g.id ? 'active' : ''}"
                    onclick="partiteSetGirone(${g.id})">
              ${g.nome}
            </button>
          `).join('')}
        </div>
      </div>
    </div>`;
}

// ─── RENDER PRINCIPALE ────────────────────────────────────────
function partiteRender() {
  const container = document.getElementById('partite-container');
  if (!container) return;

  const partite = partiteFiltra();

  if (partite.length === 0) {
    container.innerHTML = `
      <div class="partite-empty empty-state">
        <p>Partite da definire...</p>
      </div>`;
    return;
  }

  const gruppi = raggruppaPerGirone(partite);

  container.innerHTML = gruppi
    .map(gruppo => renderGruppoPartite(gruppo))
    .join('');
}

// ─── RAGGRUPPA PER GIRONE ─────────────────────────────────────
function raggruppaPerGirone(partite) {
  const mappa = new Map();

  partite.forEach(p => {
    const key = p.gironeId ?? 'finale';
    if (!mappa.has(key)) {
      const girone = _gironiAll.find(g => g.id === p.gironeId);
      mappa.set(key, {
        girone,
        titolo: girone ? girone.nome : faseTitolo(p.fase),
        partite: []
      });
    }
    mappa.get(key).partite.push(p);
  });

  return Array.from(mappa.values()).sort((a, b) => {
    const faseA = a.girone?.fase ?? 99;
    const faseB = b.girone?.fase ?? 99;
    return faseA - faseB;
  });
}

// ─── RENDER GRUPPO ────────────────────────────────────────────
function renderGruppoPartite(gruppo) {
  const giocate   = gruppo.partite.filter(p => p.giocata)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  const daGiocare = gruppo.partite.filter(p => !p.giocata)
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const ordinate = [...daGiocare, ...giocate];
  const fase = gruppo.girone?.fase ?? 3;

  return `
    <div class="partite-gruppo">
      <div class="partite-gruppo-header">
        <span class="partite-gruppo-titolo">${gruppo.titolo}</span>
        <span class="badge badge-fase${fase}">Fase ${fase}</span>
      </div>
      ${ordinate.map(p => renderPartitaCard(p)).join('')}
    </div>`;
}

// ─── RENDER CARD PARTITA ──────────────────────────────────────
function renderPartitaCard(p) {
  const girone        = _gironiAll.find(g => g.id === p.gironeId);
  const squadraCasa   = trovaSquadra(p.squadraCasaId,   girone);
  const squadraOspite = trovaSquadra(p.squadraOspiteId, girone);

  const nomeCasa   = squadraCasa?.nome   ?? '—';
  const nomeOspite = squadraOspite?.nome ?? '—';
  const logoCasa   = squadraCasa?.logo   ?? '';
  const logoOspite = squadraOspite?.logo ?? '';

  const vincitriceCasa   = p.giocata && p.puntiCasa   > p.puntiOspite;
  const vincitriceOspite = p.giocata && p.puntiOspite > p.puntiCasa;

  const campo = p.campo || _gironiAll.find(g => g.id === p.gironeId)?.campo || null;

  return `
    <div class="partita-card ${p.giocata ? 'giocata' : 'da-giocare'}">

      <div class="partita-main">

        <div class="partita-squadra ${vincitriceCasa ? 'vincitrice' : ''}">
          ${logoHtml(logoCasa, nomeCasa, 'lg')}
          <span class="partita-squadra-nome">${nomeCasa}</span>
        </div>

        <div class="partita-centro">
          ${p.giocata
            ? `<div class="partita-punteggio">
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                  <span class="partita-score ${vincitriceCasa ? 'vincitore' : ''}">${p.puntiCasa}</span>
                  ${p.canestriCasa != null
                    ? `<span style="font-size:0.75rem;color:var(--c-text-muted)">${p.canestriCasa}</span>`
                    : ''}
                </div>
                <span class="partita-score-sep">–</span>
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                  <span class="partita-score ${vincitriceOspite ? 'vincitore' : ''}">${p.puntiOspite}</span>
                  ${p.canestriOspite != null
                    ? `<span style="font-size:0.75rem;color:var(--c-text-muted)">${p.canestriOspite}</span>`
                    : ''}
                </div>
               </div>`
            : `<div class="partita-orario">${p.ora ?? '—:—'}</div>`
          }
          ${p.data
            ? `<div class="partita-data-label">${formatData(p.data)}</div>`
            : ''
          }
          ${campo
            ? `<div class="partita-campo">${campo}</div>`
            : ''
          }
        </div>

        <div class="partita-squadra ospite ${vincitriceOspite ? 'vincitrice' : ''}">
          ${logoHtml(logoOspite, nomeOspite, 'lg')}
          <span class="partita-squadra-nome">${nomeOspite}</span>
        </div>

      </div>

      ${p.giocata ? renderQuarti(p) : ''}

    </div>`;
}

// ─── RENDER QUARTI ────────────────────────────────────────────
function renderQuarti(p) {
  const quarti = [1, 2, 3, 4, 5, 6];
  const ot     = p.overtime?.casa ?? [];

  const quartiHtml = quarti.map(i => {
    const c = p.quarti.casa[i - 1]   ?? '—';
    const o = p.quarti.ospite[i - 1] ?? '—';
    const cVince = typeof c === 'number' && typeof o === 'number' && c > o;
    const oVince = typeof c === 'number' && typeof o === 'number' && o > c;

    return `
      <div class="quarto-item">
        <span class="quarto-num">T${i}</span>
        <div class="quarto-scores">
          <span class="quarto-score ${cVince ? 'vince' : ''}">${c}</span>
          <div class="quarto-sep"></div>
          <span class="quarto-score ${oVince ? 'vince' : ''}">${o}</span>
        </div>
      </div>`;
  }).join('');

  const otHtml = ot.map((c, i) => {
    const o = p.overtime.ospite[i] ?? 0;
    const cVince = c > o;
    const oVince = o > c;
    return `
      <div class="quarto-item overtime">
        <span class="quarto-num">OT${i + 1}</span>
        <div class="quarto-scores">
          <span class="quarto-score ${cVince ? 'vince' : ''}">${c}</span>
          <div class="quarto-sep"></div>
          <span class="quarto-score ${oVince ? 'vince' : ''}">${o}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="partita-quarti">
      <span class="quarti-label">Quarti</span>
      <div class="quarti-grid">
        ${quartiHtml}
        ${otHtml}
      </div>
    </div>`;
}

// ─── UTILITY ──────────────────────────────────────────────────
function trovaSquadra(id, girone) {
  if (!id) return null;
  if (girone) {
    const s = girone.squadre.find(s => s.id === id);
    if (s) return s;
  }
  for (const g of _gironiAll) {
    const s = g.squadre.find(s => s.id === id);
    if (s) return s;
  }
  return null;
}

function logoHtml(logo, nome, size = '') {
  if (!logo) return '';
  return `<img class="squadra-logo ${size === 'lg' ? 'squadra-logo-lg' : ''}"
               src="${logo}" alt="${nome}"
               onerror="this.style.display='none'">`;
}

function formatData(dataStr) {
  if (!dataStr) return '';
  const d = new Date(dataStr);
  return d.toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function faseTitolo(fase) {
  const map = {
    1: 'Fase 1 — Gironi',
    2: 'Fase 2',
    3: 'Fase 3 — Finale'
  };
  return map[fase] ?? `Fase ${fase}`;
}