/* ============================================================
   MAIN.JS — entry point, navigazione tab, init globale
   ============================================================ */

// ─── STATO GLOBALE ────────────────────────────────────────────
let _tabAttiva = 'partite';   // 'partite' | 'classifica'
let _faseAttiva = 1;          // 1 | 2 | 3

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await caricaHeaderTorneo();
  renderFaseBanner();
  switchTab(_tabAttiva);
});

// ─── HEADER TORNEO ────────────────────────────────────────────
async function caricaHeaderTorneo() {
  try {
    const torneo = await TorneoAPI.get();
    const nomeEl = document.getElementById('header-nome');
    const subEl  = document.getElementById('header-sottotitolo');
    if (nomeEl) nomeEl.textContent = torneo.nome     ?? 'Torneo';
    if (subEl)  subEl.textContent  = torneo.edizione ?? '';
  } catch {
    // fallback silenzioso
  }
}

// ─── NAVIGAZIONE TAB ──────────────────────────────────────────
function switchTab(tab) {
  _tabAttiva = tab;

  document.querySelectorAll('.nav-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  document.querySelectorAll('.tab-section').forEach(el => {
    el.style.display = el.dataset.section === tab ? 'block' : 'none';
  });

  aggiornaBannerFase();

  if (tab === 'partite')    partiteInit();
  if (tab === 'classifica') classificaInit();
}

// ─── SELETTORE FASE ───────────────────────────────────────────
function renderFaseBanner() {
  const container = document.getElementById('fase-selector');
  if (!container) return;

  const fasi = [
    { id: 1, label: 'Fase 1' },
    { id: 2, label: 'Fase 2' },
    { id: 3, label: 'Fase 3' }
  ];

  container.innerHTML = fasi.map(f => `
    <button class="fase-btn ${_faseAttiva === f.id ? 'active' : ''}"
            onclick="setFase(${f.id})">
      ${f.label}
    </button>
  `).join('');
}

function aggiornaBannerFase() {
  const nomiTab = {
    'partite':    'Partite',
    'classifica': 'Classifica'
  };
  const nomiFase = {
    1: 'Fase 1',
    2: 'Fase 2',
    3: 'Fase 3'
  };
  const bannerNome = document.querySelector('.fase-banner-nome');
  if (bannerNome) {
    bannerNome.textContent = `${nomiFase[_faseAttiva]} — ${nomiTab[_tabAttiva]}`;
  }
}

function setFase(fase) {
  _faseAttiva = fase;

  document.querySelectorAll('.fase-btn').forEach(el => {
    el.classList.toggle('active', el.textContent.trim() === `Fase ${fase}`);
  });

  aggiornaBannerFase();

  if (_tabAttiva === 'partite')    partiteSetFase(fase);
  if (_tabAttiva === 'classifica') classificaSetFase(fase);
}