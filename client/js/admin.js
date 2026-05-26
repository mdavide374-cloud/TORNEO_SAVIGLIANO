/* ============================================================
   ADMIN.JS — logica pannello amministrazione
   ============================================================ */

// ─── STATO ────────────────────────────────────────────────────
let _gironiAdmin  = [];
let _partiteAdmin = [];
let _torneoInfo   = {};

// ─── INIT ─────────────────────────────────────────────────────
async function adminInit() {
  if (!Auth.isLogged()) {
    mostraLogin();
    return;
  }
  mostraAdmin();
  await adminCaricaDati();
  adminRender();
}

async function adminCaricaDati() {
  [_gironiAdmin, _partiteAdmin, _torneoInfo] = await Promise.all([
    GironiAPI.lista(),
    PartiteAPI.lista(),
    TorneoAPI.get()
  ]);
}

// ─── LOGIN ────────────────────────────────────────────────────
function mostraLogin() {
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('admin-content').style.display = 'none';
}

function mostraAdmin() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('admin-content').style.display = 'block';
}

async function adminLogin() {
  const input  = document.getElementById('login-password');
  const errore = document.getElementById('login-errore');
  const password = input.value.trim();
  if (!password) return;

  try {
    const res = await Auth.login(password);
    if (res.success) {
      Auth.salvaToken(res.token);
      input.classList.remove('errore');
      errore.textContent = '';
      mostraAdmin();
      await adminCaricaDati();
      adminRender();
    }
  } catch {
    input.classList.add('errore');
    errore.textContent = 'Password errata.';
    input.value = '';
    input.focus();
  }
}

function adminLogout() {
  Auth.logout();
  mostraLogin();
}

// ─── RENDER PRINCIPALE ────────────────────────────────────────
function adminRender() {
  renderInfoTorneo();
  [1, 2, 3].forEach(f => {
    renderGironiAdminFase(f);
    renderPartiteAdminFase(f);
    renderFormNuovaPartitaFase(f);
  });
}

// ─── INFO TORNEO ──────────────────────────────────────────────
function renderInfoTorneo() {
  const el  = document.getElementById('torneo-nome-input');
  const el2 = document.getElementById('torneo-edizione-input');
  const el3 = document.getElementById('torneo-luogo-input');
  if (el)  el.value  = _torneoInfo.nome     ?? '';
  if (el2) el2.value = _torneoInfo.edizione ?? '';
  if (el3) el3.value = _torneoInfo.luogo    ?? '';
}

async function salvaTorneoInfo() {
  try {
    const nome     = document.getElementById('torneo-nome-input').value.trim();
    const edizione = document.getElementById('torneo-edizione-input').value.trim();
    const luogo    = document.getElementById('torneo-luogo-input').value.trim();
    await TorneoAPI.aggiorna({ nome, edizione, luogo });
    toast('Informazioni torneo salvate.', 'ok');
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── GIRONI PER FASE ──────────────────────────────────────────
function renderGironiAdminFase(fase) {
  const container = document.getElementById(`gironi-admin-container-${fase}`);
  if (!container) return;

  const gironi = _gironiAdmin.filter(g => g.fase === fase);

  if (gironi.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nessun girone creato.</p></div>`;
    return;
  }

  container.innerHTML = gironi.map(g => renderGironeAdmin(g)).join('');
}

function renderGironeAdmin(girone) {
  return `
    <div class="girone-admin-card" id="girone-card-${girone.id}">
      <div class="girone-admin-header">
        <span class="girone-admin-titolo">${girone.nome}</span>
        ${girone.campo ? `<span style="font-size:0.8rem;color:var(--c-text-muted)">📍 ${girone.campo}</span>` : ''}
        <div style="display:flex;gap:8px;margin-left:auto">
          <button class="btn btn-ghost btn-sm"
                  onclick="rinominaGirone(${girone.id})">✏️ Rinomina</button>
          <button class="btn btn-danger btn-sm"
                  onclick="eliminaGirone(${girone.id})">🗑 Elimina</button>
        </div>
      </div>

      <div class="girone-admin-body">
        <div class="squadre-list" id="squadre-list-${girone.id}">
          ${girone.squadre.length === 0
            ? `<div class="empty-state" style="padding:16px">Nessuna squadra.</div>`
            : girone.squadre.map(s => renderSquadraItem(s, girone.id)).join('')
          }
        </div>

        <div class="admin-form-row">
          <div class="admin-field">
            <label>Nome squadra</label>
            <input class="admin-input" id="squadra-nome-${girone.id}"
                   type="text" placeholder="Es. Basket Cuneo">
          </div>
          <div class="admin-field">
            <label>Logo squadra (PNG, JPG)</relative>
            <input class="admin-input" id="squadra-logo-file-${girone.id}"
                   type="file" accept="image/*,.pdf" style="padding:6px">
          </div>
          <button class="btn btn-primary btn-sm" style="align-self:flex-end"
                  onclick="aggiungiSquadra(${girone.id})">+ Squadra</button>
        </div>
      </div>
    </div>`;
}

function renderSquadraItem(squadra, gironeId) {
  const logo = squadra.logo
    ? `<img class="squadra-logo squadra-logo-sm" src="${squadra.logo}"
            alt="${squadra.nome}" onerror="this.style.display='none'">`
    : '<span style="width:20px"></span>';

  return `
    <div class="squadra-item" id="squadra-item-${squadra.id}">
      ${logo}
      <span class="squadra-item-nome">${squadra.nome}</span>
      <button class="btn btn-danger btn-sm"
              onclick="eliminaSquadra(${gironeId}, ${squadra.id})">🗑</button>
    </div>`;
}

// ─── AZIONI GIRONI ────────────────────────────────────────────
async function creaGironeFase(fase) {
  const nomeEl  = document.getElementById(`nuovo-girone-nome-${fase}`);
  const campoEl = document.getElementById(`nuovo-girone-campo-${fase}`);
  const nome    = nomeEl?.value.trim();
  const campo   = campoEl?.value.trim() ?? '';

  if (!nome) { toast('Inserisci un nome per il girone.', 'errore'); return; }

  try {
    await GironiAPI.crea(nome, fase, campo);
    nomeEl.value = '';
    if (campoEl) campoEl.value = '';
    toast(`Girone "${nome}" creato.`, 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

async function rinominaGirone(id) {
  const girone = _gironiAdmin.find(g => g.id === id);
  const nuovo  = prompt('Nuovo nome:', girone?.nome ?? '');
  if (!nuovo || !nuovo.trim()) return;

  try {
    await GironiAPI.aggiorna(id, { nome: nuovo.trim() });
    toast('Girone rinominato.', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

async function eliminaGirone(id) {
  const girone = _gironiAdmin.find(g => g.id === id);
  if (!confirm(`Eliminare il girone "${girone?.nome}"? Verranno eliminate anche le partite associate.`)) return;

  try {
    await GironiAPI.elimina(id);
    toast('Girone eliminato.', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── AZIONI SQUADRE ───────────────────────────────────────────
async function aggiungiSquadra(gironeId) {
  const nomeEl = document.getElementById(`squadra-nome-${gironeId}`);
  const fileEl = document.getElementById(`squadra-logo-file-${gironeId}`);
  const nome   = nomeEl?.value.trim();

  if (!nome) { toast('Inserisci il nome della squadra.', 'errore'); return; }

  let logo = '';

  if (fileEl?.files?.length > 0) {
    try {
      const formData = new FormData();
      formData.append('logo', fileEl.files[0]);
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload fallito');
      const data = await res.json();
      logo = data.url;
    } catch (e) {
      toast('Errore nel caricamento del logo.', 'errore');
      return;
    }
  }

  try {
    await GironiAPI.aggiungiSquadra(gironeId, nome, logo);
    nomeEl.value = '';
    if (fileEl) fileEl.value = '';
    toast(`Squadra "${nome}" aggiunta.`, 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

async function eliminaSquadra(gironeId, squadraId) {
  if (!confirm('Eliminare questa squadra?')) return;

  try {
    await GironiAPI.eliminaSquadra(gironeId, squadraId);
    toast('Squadra eliminata.', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── PARTITE PER FASE ─────────────────────────────────────────
function renderPartiteAdminFase(fase) {
  const container = document.getElementById(`partite-admin-container-${fase}`);
  if (!container) return;

  const partite = _partiteAdmin.filter(p => p.fase === fase);
  const gironi  = _gironiAdmin.filter(g => g.fase === fase);

  if (partite.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nessuna partita creata.</p></div>`;
    return;
  }

  // Leggi filtro attivo (salvato sul container)
  const filtroGirone = container.dataset.filtroGirone ?? 'tutti';

  const partiteFiltrate = filtroGirone === 'tutti'
    ? partite
    : partite.filter(p => p.gironeId === parseInt(filtroGirone));

  const filtriHtml = gironi.length > 1 ? `
    <div class="filtri-gruppo" style="margin-bottom:16px">
      <div class="filtri-riga">
        <span class="filtri-label">Girone</span>
        <div class="filtri-btn-group">
          <button class="filtro-btn ${filtroGirone === 'tutti' ? 'active' : ''}"
                  onclick="adminFiltraPartite(${fase}, 'tutti')">Tutti</button>
          ${gironi.map(g => `
            <button class="filtro-btn ${filtroGirone === String(g.id) ? 'active' : ''}"
                    onclick="adminFiltraPartite(${fase}, '${g.id}')">
              ${g.nome}
            </button>`).join('')}
        </div>
      </div>
    </div>` : '';

  const partiteHtml = gironi.map(girone => {
    const pg = partiteFiltrate.filter(p => p.gironeId === girone.id);
    if (pg.length === 0) return '';
    return `
      <div style="margin-bottom:24px">
        <div class="label" style="margin-bottom:10px">${girone.nome}</div>
        ${pg.map(p => renderPartitaAdmin(p)).join('')}
      </div>`;
  }).join('');

  container.innerHTML = filtriHtml + (partiteHtml || `<div class="empty-state"><p>Nessuna partita in questo girone.</p></div>`);
}

function adminFiltraPartite(fase, gironeId) {
  const container = document.getElementById(`partite-admin-container-${fase}`);
  if (!container) return;
  container.dataset.filtroGirone = gironeId;
  renderPartiteAdminFase(fase);
}

function renderPartitaAdmin(p) {
  const girone      = _gironiAdmin.find(g => g.id === p.gironeId);
  const tutte       = girone ? girone.squadre : _gironiAdmin.flatMap(g => g.squadre);
  const squadraCasa   = tutte.find(s => s.id === p.squadraCasaId);
  const squadraOspite = tutte.find(s => s.id === p.squadraOspiteId);
  const nomeCasa      = squadraCasa?.nome   ?? '—';
  const nomeOspite    = squadraOspite?.nome ?? '—';

  return `
    <div class="partita-admin-card" id="partita-admin-${p.id}">
      <div class="partita-admin-header">
        <span class="partita-admin-titolo">${nomeCasa} vs ${nomeOspite}</span>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${p.giocata
            ? `<span class="badge badge-fase${p.fase}">Risultato inserito</span>`
            : `<span class="label">Da giocare</span>`
          }
          <button class="btn btn-danger btn-sm"
                  onclick="eliminaPartita(${p.id})">🗑</button>
        </div>
      </div>

      <div class="partita-admin-body">

        <div class="admin-form-row">
          <div class="admin-field">
            <label>Data</label>
            <input class="admin-input" type="date"
                   id="p-data-${p.id}" value="${p.data ?? ''}"
                   onchange="salvaInfoPartita(${p.id})">
          </div>
          <div class="admin-field">
            <label>Ora</label>
            <input class="admin-input" type="time"
                   id="p-ora-${p.id}" value="${p.ora ?? ''}"
                   onchange="salvaInfoPartita(${p.id})">
          </div>
          <div class="admin-field">
            <label>Campo (opzionale)</label>
            <input class="admin-input" type="text"
                   id="p-campo-${p.id}" value="${p.campo ?? ''}"
                   placeholder="Lascia vuoto per usare quello del girone"
                   onchange="salvaInfoPartita(${p.id})">
          </div>
        </div>

        <div class="risultato-form">
          <div class="label">Punteggi per tempino</div>

          <div class="quarti-form">
            <div class="quarti-form-header">
              <span class="quarti-form-label"></span>
              <span>T1</span>
              <span>T2</span>
              <span>T3</span>
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>Tot</span>
            </div>

            <span class="quarti-form-label">${nomeCasa}</span>
            ${[0,1,2,3,4,5].map(i => `
              <input class="quarto-input"
                     id="q-casa-${p.id}-${i}"
                     type="number" min="0"
                     value="${p.quarti.casa[i] ?? ''}"
                     oninput="aggiornaTotale(${p.id})">`
            ).join('')}
            <span class="totale-display" id="tot-casa-${p.id}">
              ${p.puntiCasa ?? '—'}
            </span>

            <span class="quarti-form-label">${nomeOspite}</span>
            ${[0,1,2,3,4,5].map(i => `
              <input class="quarto-input"
                     id="q-ospite-${p.id}-${i}"
                     type="number" min="0"
                     value="${p.quarti.ospite[i] ?? ''}"
                     oninput="aggiornaTotale(${p.id})">`
            ).join('')}
            <span class="totale-display" id="tot-ospite-${p.id}">
              ${p.puntiOspite ?? '—'}
            </span>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
            <button class="btn btn-primary"
                    onclick="salvaRisultato(${p.id})">💾 Salva risultato</button>
            ${p.giocata
              ? `<button class="btn btn-ghost btn-sm"
                         onclick="annullaRisultato(${p.id})">↩ Annulla risultato</button>`
              : ''
            }
          </div>
        </div>

      </div>
    </div>`;
}

// ─── FORM NUOVA PARTITA PER FASE ──────────────────────────────
function renderFormNuovaPartitaFase(fase) {
  const container = document.getElementById(`nuova-partita-form-${fase}`);
  if (!container) return;

  const gironi     = _gironiAdmin.filter(g => g.fase === fase);
  const gironiOpts = gironi.map(g =>
    `<option value="${g.id}">${g.nome}</option>`
  ).join('');

  container.innerHTML = `
    <div class="admin-form-row">
      <div class="admin-field">
        <label>Girone</label>
        <select class="admin-select" id="nuova-partita-girone-${fase}"
                onchange="aggiornaSelezionePartitaFase(${fase})">
          <option value="">— Seleziona girone —</option>
          ${gironiOpts}
        </select>
      </div>
      <div class="admin-field">
        <label>Squadra casa</label>
        <select class="admin-select" id="nuova-partita-casa-${fase}">
          <option value="">— Prima seleziona girone —</option>
        </select>
      </div>
      <div class="admin-field">
        <label>Squadra ospite</label>
        <select class="admin-select" id="nuova-partita-ospite-${fase}">
          <option value="">— Prima seleziona girone —</option>
        </select>
      </div>
      <button class="btn btn-primary btn-sm" style="align-self:flex-end"
              onclick="creaPartitaFase(${fase})">+ Crea partita</button>
    </div>`;
}

function aggiornaSelezionePartitaFase(fase) {
  const gironeEl = document.getElementById(`nuova-partita-girone-${fase}`);
  const casaEl   = document.getElementById(`nuova-partita-casa-${fase}`);
  const ospiteEl = document.getElementById(`nuova-partita-ospite-${fase}`);
  if (!gironeEl || !casaEl || !ospiteEl) return;

  const gironeId = parseInt(gironeEl.value);
  const girone   = _gironiAdmin.find(g => g.id === gironeId);
  const squadre  = girone?.squadre ?? [];

  const opzioni = squadre.map(s =>
    `<option value="${s.id}">${s.nome}</option>`
  ).join('');

  casaEl.innerHTML   = `<option value="">— Squadra casa —</option>${opzioni}`;
  ospiteEl.innerHTML = `<option value="">— Squadra ospite —</option>${opzioni}`;
}

async function creaPartitaFase(fase) {
  const gironeEl = document.getElementById(`nuova-partita-girone-${fase}`);
  const casaEl   = document.getElementById(`nuova-partita-casa-${fase}`);
  const ospiteEl = document.getElementById(`nuova-partita-ospite-${fase}`);

  const gironeId = parseInt(gironeEl?.value);
  const casaId   = parseInt(casaEl?.value);
  const ospiteId = parseInt(ospiteEl?.value);

  if (!gironeId || !casaId || !ospiteId) {
    toast('Seleziona girone e le due squadre.', 'errore'); return;
  }
  if (casaId === ospiteId) {
    toast('Le due squadre non possono essere uguali.', 'errore'); return;
  }

  try {
    await PartiteAPI.crea({ gironeId, fase, squadraCasaId: casaId, squadraOspiteId: ospiteId });
    toast('Partita creata.', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── AGGIORNA TOTALE IN TEMPO REALE ───────────────────────────
function aggiornaTotale(partitaId) {
  let ptCasa = 0, ptOspite = 0;
  let canestriCasa = 0, canestriOspite = 0;

  for (let i = 0; i < 6; i++) {
    const c = parseInt(document.getElementById(`q-casa-${partitaId}-${i}`)?.value   || 0);
    const o = parseInt(document.getElementById(`q-ospite-${partitaId}-${i}`)?.value || 0);
    canestriCasa   += c;
    canestriOspite += o;
    if (c > o)      { ptCasa += 3; ptOspite += 1; }
    else if (o > c) { ptCasa += 1; ptOspite += 3; }
    else            { ptCasa += 2; ptOspite += 2; }
  }

  const elC = document.getElementById(`tot-casa-${partitaId}`);
  const elO = document.getElementById(`tot-ospite-${partitaId}`);
  if (elC) elC.innerHTML = `${ptCasa} <small style="color:var(--c-text-muted);font-size:0.65em">(${canestriCasa})</small>`;
  if (elO) elO.innerHTML = `${ptOspite} <small style="color:var(--c-text-muted);font-size:0.65em">(${canestriOspite})</small>`;
}

// ─── SALVA RISULTATO ──────────────────────────────────────────
async function salvaRisultato(partitaId) {
  const p = _partiteAdmin.find(x => x.id === partitaId);
  if (!p) return;

  const quartiCasa   = [];
  const quartiOspite = [];

  for (let i = 0; i < 6; i++) {
    const c = document.getElementById(`q-casa-${partitaId}-${i}`)?.value;
    const o = document.getElementById(`q-ospite-${partitaId}-${i}`)?.value;
    quartiCasa.push(c !== '' && c != null ? parseInt(c) : null);
    quartiOspite.push(o !== '' && o != null ? parseInt(o) : null);
  }

  if (quartiCasa.some(v => v === null) || quartiOspite.some(v => v === null)) {
    toast('Compila tutti e 6 i tempini prima di salvare.', 'errore');
    return;
  }

  const canestriCasa   = quartiCasa.reduce((a, b)   => a + b, 0);
  const canestriOspite = quartiOspite.reduce((a, b) => a + b, 0);

  let puntiTempiniCasa = 0, puntiTempiniOspite = 0;
  for (let i = 0; i < 6; i++) {
    const c = quartiCasa[i];
    const o = quartiOspite[i];
    if (c > o)      { puntiTempiniCasa += 3; puntiTempiniOspite += 1; }
    else if (o > c) { puntiTempiniCasa += 1; puntiTempiniOspite += 3; }
    else            { puntiTempiniCasa += 2; puntiTempiniOspite += 2; }
  }

  try {
    await PartiteAPI.aggiorna(partitaId, {
      quarti:        { casa: quartiCasa, ospite: quartiOspite },
      overtime:      { casa: [], ospite: [] },
      puntiCasa:     puntiTempiniCasa,
      puntiOspite:   puntiTempiniOspite,
      canestriCasa,
      canestriOspite,
      giocata:       true
    });
    toast('Risultato salvato!', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── ANNULLA RISULTATO ────────────────────────────────────────
async function annullaRisultato(partitaId) {
  if (!confirm('Annullare il risultato di questa partita?')) return;

  try {
    await PartiteAPI.aggiorna(partitaId, {
      puntiCasa:     null,
      puntiOspite:   null,
      canestriCasa:  null,
      canestriOspite: null,
      quarti:        { casa: [null,null,null,null,null,null], ospite: [null,null,null,null,null,null] },
      overtime:      { casa: [], ospite: [] },
      giocata:       false
    });
    toast('Risultato annullato.', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── SALVA INFO PARTITA ───────────────────────────────────────
async function salvaInfoPartita(partitaId) {
  const data  = document.getElementById(`p-data-${partitaId}`)?.value  ?? null;
  const ora   = document.getElementById(`p-ora-${partitaId}`)?.value   ?? null;
  const campo = document.getElementById(`p-campo-${partitaId}`)?.value ?? null;

  try {
    await PartiteAPI.aggiorna(partitaId, { data, ora, campo });
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── ELIMINA PARTITA ──────────────────────────────────────────
async function eliminaPartita(id) {
  if (!confirm('Eliminare questa partita?')) return;

  try {
    await PartiteAPI.elimina(id);
    toast('Partita eliminata.', 'ok');
    await adminCaricaDati();
    adminRender();
  } catch (e) {
    toast(e.message, 'errore');
  }
}

// ─── TOAST ────────────────────────────────────────────────────
function toast(messaggio, tipo = 'ok') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = messaggio;
  container.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}