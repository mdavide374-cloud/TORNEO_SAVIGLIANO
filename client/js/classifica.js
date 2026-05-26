/* ============================================================
   CLASSIFICA.JS — render classifiche per fase e girone
   ============================================================ */

// ─── STATO LOCALE ─────────────────────────────────────────────
let _gironi   = [];
let _partite  = [];
let _classificaFaseAttiva = 1;

// ─── INIT ─────────────────────────────────────────────────────
async function classificaInit() {
  await classificaCaricaDati();
  classificaRender();
}

async function classificaCaricaDati() {
  [_gironi, _partite] = await Promise.all([
    GironiAPI.lista(),
    PartiteAPI.lista()
  ]);
}

function classificaSetFase(fase) {
  _classificaFaseAttiva = fase;
  classificaRender();
}

// ─── RENDER PRINCIPALE ────────────────────────────────────────
function classificaRender() {
  const container = document.getElementById('classifica-container');
  if (!container) return;

  const girioniFase = _gironi.filter(g => g.fase === _classificaFaseAttiva);

  if (girioniFase.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Gironi da definire...</p>
      </div>`;
    return;
  }

  container.innerHTML = girioniFase
    .map(g => renderGirone(g))
    .join('<div style="height:48px"></div>');
}

// ─── RENDER SINGOLO GIRONE ────────────────────────────────────
function renderGirone(girone) {
  const partiteGirone = _partite.filter(p =>
  p.gironeId === girone.id && p.fase === _classificaFaseAttiva
);

  // Calcola punti carry per fase 2 e 3
  const puntiCarry = calcolaPuntiCarry(girone, _faseAttiva);

  const classifica = costruisciClassifica(
    girone.squadre,
    partiteGirone,
    puntiCarry
  );

  const tutteGiocate = partiteGirone.length > 0 &&
    partiteGirone.every(p => p.giocata);

  return `
    <div class="girone-card">
      <div class="girone-header">
        <h3 class="girone-titolo">${girone.nome}</h3>
        ${girone.fase > 1 ? `<span class="badge badge-fase${girone.fase}">Fase ${girone.fase}</span>` : ''}
      </div>

      ${classifica.length === 0
        ? `<div class="classifica-empty">Nessuna squadra nel girone.</div>`
        : `
        <table class="classifica-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Squadra</th>
              <th title="Partite giocate">G</th>
              <th title="Vittorie">V</th>
              <th title="Pareggi" class="col-hide-mobile">P</th>
              <th title="Sconfitte" class="col-hide-mobile">S</th>
              <th title="Punti tempini" class="col-hide-mobile">PT</th>
              <th title="Punti fatti / subiti" class="col-hide-mobile">+/-</th>
              <th title="Punti classifica">Cl</th>
            </tr>
          </thead>
          <tbody>
            ${classifica.map((r, i) => renderRiga(r, i, girone, tutteGiocate)).join('')}
          </tbody>
        </table>
        ${renderLegenda(girone, tutteGiocate)}
      `}
    </div>`;
}

// ─── RENDER RIGA CLASSIFICA ───────────────────────────────────
function renderRiga(r, i, girone, tutteGiocate) {
  const pos = i + 1;

  // In fase 1 e 2: prime 2 si qualificano, ultime 2 no
  // In fase 3: tutti sono già in finale, nessuna marcatura
  const qualificata = _classificaFaseAttiva < 3 && pos <= 2;
  const eliminata   = _classificaFaseAttiva < 3 && pos > 2;

  const diff = r.pf - r.ps;
  const diffClass = diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'diff-zero';
  const diffStr   = diff > 0 ? `+${diff}` : `${diff}`;

  const logoHtml = r.squadra.logo
    ? `<img class="squadra-logo squadra-logo-sm"
            src="${r.squadra.logo}"
            alt="${r.squadra.nome}"
            onerror="this.style.display='none'">`
    : '';

  // Punti carry: mostra solo in fase 2+
  const ptCarryHtml = r.ptCarry > 0
    ? `<div class="col-pt-carry carry-tooltip"
            data-tooltip="Di cui ${r.ptCarry} pt portati dalla fase precedente">
          (<span>${r.ptCarry}</span>)
       </div>`
    : '';

  return `
    <tr class="pos-${pos} ${qualificata ? 'qualificata' : ''} ${eliminata ? 'eliminata' : ''}">
      <td class="col-pos">${pos}</td>
      <td class="col-squadra">
        <div class="squadra-nome">
          ${logoHtml}
          ${r.squadra.nome}
        </div>
      </td>
      <td class="col-stat">${r.g}</td>
      <td class="col-stat">${r.v}</td>
      <td class="col-stat col-hide-mobile">${r.p}</td>
      <td class="col-stat col-hide-mobile">${r.s}</td>
      <td class="col-stat col-hide-mobile">${r.ptTempini}</td>
      <td class="col-stat col-hide-mobile ${diffClass}">${r.g > 0 ? diffStr : '—'}</td>
      <td class="col-pt">
        ${r.pt}
        ${ptCarryHtml}
      </td>
    </tr>`;
}

// ─── LEGENDA ──────────────────────────────────────────────────
function renderLegenda(girone, tutteGiocate) {
  return '';
}

// ─── CALCOLO PUNTI CARRY ──────────────────────────────────────
// Recupera i punti che ogni squadra porta dalla fase precedente
// Usato in fase 2 (porta punti da fase 1) e fase 3 (porta punti da fase 2)
function calcolaPuntiCarry(girone, faseAttiva) {
  if (faseAttiva === 1) return {};

  const fasePrec = faseAttiva - 1;

  // Trova il girone di provenienza per ogni squadra
  // I gironi di fase precedente hanno le stesse squadre
  const puntiCarry = {};

  girone.squadre.forEach(squadra => {
    // Cerca il girone della fase precedente che conteneva questa squadra
    const gironePrec = _gironi.find(g =>
      g.fase === fasePrec &&
      g.squadre.some(s => s.id === squadra.id)
    );

    if (!gironePrec) return;

    // Prende solo le partite tra questa squadra e le squadre
    // che sono ora nello stesso girone (per non contare partite
    // contro squadre finite in altri gironi)
    const idSquadreFaseAtt = girone.squadre.map(s => s.id);

    const partiteRilevanti = _partite.filter(p =>
      p.fase === fasePrec &&
      p.giocata &&
      (
        (p.squadraCasaId === squadra.id   && idSquadreFaseAtt.includes(p.squadraOspiteId)) ||
        (p.squadraOspiteId === squadra.id && idSquadreFaseAtt.includes(p.squadraCasaId))
      )
    );

    let pt = 0;
    partiteRilevanti.forEach(p => {
      const { ptCasa, ptOspite } = calcolaPuntiPartita(p);
      if (p.squadraCasaId === squadra.id)   pt += ptCasa;
      if (p.squadraOspiteId === squadra.id) pt += ptOspite;
    });

    puntiCarry[squadra.id] = pt;
  });

  return puntiCarry;
}