/* ============================================================
   API.JS — tutte le chiamate al server in un unico posto
   ============================================================ */

const BASE = '';  // stesso host, nessun prefisso necessario

// ─── UTILITY ─────────────────────────────────────────────────
async function http(method, url, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errore || `Errore ${res.status}`);
  }
  return res.json();
}

// ─── AUTH ─────────────────────────────────────────────────────
const Auth = {
  async login(password) {
    return http('POST', '/api/login', { password });
  },

  salvaToken(token) {
    sessionStorage.setItem('admin_token', token);
  },

  getToken() {
    return sessionStorage.getItem('admin_token');
  },

  isLogged() {
    return !!sessionStorage.getItem('admin_token');
  },

  logout() {
    sessionStorage.removeItem('admin_token');
  }
};

// ─── TORNEO ───────────────────────────────────────────────────
const TorneoAPI = {
  async get() {
    return http('GET', '/api/torneo');
  },

  async aggiorna(dati) {
    return http('PUT', '/api/torneo', dati);
  }
};

// ─── GIRONI ───────────────────────────────────────────────────
const GironiAPI = {
  async lista() {
    return http('GET', '/api/gironi');
  },

  async crea(nome, fase, campo = '') {
    return http('POST', '/api/gironi', { nome, fase, campo });
  },

  async aggiorna(id, dati) {
    return http('PUT', `/api/gironi/${id}`, dati);
  },

  async elimina(id) {
    return http('DELETE', `/api/gironi/${id}`);
  },

  // ─── SQUADRE ────────────────────────────────────────────
  async aggiungiSquadra(gironeId, nome, logo = '') {
    return http('POST', `/api/gironi/${gironeId}/squadre`, { nome, logo });
  },

  async eliminaSquadra(gironeId, squadraId) {
    return http('DELETE', `/api/gironi/${gironeId}/squadre/${squadraId}`);
  }
};

// ─── PARTITE ──────────────────────────────────────────────────
const PartiteAPI = {
  async lista() {
    return http('GET', '/api/partite');
  },

  async crea(dati) {
    return http('POST', '/api/partite', dati);
  },

  async aggiorna(id, dati) {
    return http('PUT', `/api/partite/${id}`, dati);
  },

  async elimina(id) {
    return http('DELETE', `/api/partite/${id}`);
  },

  async reset() {
    return http('POST', '/api/reset');
  }
};

// ─── HELPER CALCOLO CLASSIFICA ────────────────────────────────
// Calcola i punti di una partita secondo le regole:
// vittoria per quarti vinti → 3pt, pareggio → 2pt ciascuno, sconfitta → 1pt
// Restituisce { ptCasa, ptOspite }
function calcolaPuntiPartita(partita) {
  if (!partita.giocata) return { ptCasa: 0, ptOspite: 0 };

  const tempiniCasa   = partita.quarti.casa;
  const tempiniOspite = partita.quarti.ospite;

  let puntiTempiniCasa   = 0;
  let puntiTempiniOspite = 0;

  for (let i = 0; i < 6; i++) {
    const c = tempiniCasa[i]   ?? 0;
    const o = tempiniOspite[i] ?? 0;
    if (c > o)      { puntiTempiniCasa += 3; puntiTempiniOspite += 1; }
    else if (o > c) { puntiTempiniCasa += 1; puntiTempiniOspite += 3; }
    else            { puntiTempiniCasa += 2; puntiTempiniOspite += 2; }
  }

  // Determina vincitore partita
  if (puntiTempiniCasa > puntiTempiniOspite) return { ptCasa: 3, ptOspite: 1 };
  if (puntiTempiniOspite > puntiTempiniCasa) return { ptCasa: 1, ptOspite: 3 };

  // Pareggio punti tempini → si guardano i canestri totali
  const canestriCasa   = partita.canestriCasa   ?? 0;
  const canestriOspite = partita.canestriOspite ?? 0;

  if (canestriCasa > canestriOspite) return { ptCasa: 3, ptOspite: 1 };
  if (canestriOspite > canestriCasa) return { ptCasa: 1, ptOspite: 3 };

  // Pareggio assoluto
  return { ptCasa: 2, ptOspite: 2 };
}

// ─── HELPER COSTRUZIONE CLASSIFICA ───────────────────────────
// Costruisce la classifica di un girone dato l'elenco partite
// e un eventuale oggetto puntiCarry { squadraId: punti }
function costruisciClassifica(squadre, partite, puntiCarry = {}) {
  const mappa = {};

  squadre.forEach(s => {
    mappa[s.id] = {
      squadra:  s,
      g:        0,
      v:        0,
      p:        0,
      s:        0,
      pf:       0,   // canestri fatti
      ps:       0,   // canestri subiti
      ptTempini: 0,  // somma punti tempini fatti
      pt:       puntiCarry[s.id] ?? 0,
      ptCarry:  puntiCarry[s.id] ?? 0
    };
  });

  partite.forEach(partita => {
    if (!partita.giocata) return;

    const casa   = mappa[partita.squadraCasaId];
    const ospite = mappa[partita.squadraOspiteId];
    if (!casa || !ospite) return;

    const { ptCasa, ptOspite } = calcolaPuntiPartita(partita);

    // Canestri totali
    const canestriCasa   = partita.canestriCasa   ?? 0;
    const canestriOspite = partita.canestriOspite ?? 0;

    // Punti tempini accumulati da questa partita
    let ptTempiniCasa = 0, ptTempiniOspite = 0;
    for (let i = 0; i < 6; i++) {
      const c = partita.quarti.casa[i]   ?? 0;
      const o = partita.quarti.ospite[i] ?? 0;
      if (c > o)      { ptTempiniCasa += 3; ptTempiniOspite += 1; }
      else if (o > c) { ptTempiniCasa += 1; ptTempiniOspite += 3; }
      else            { ptTempiniCasa += 2; ptTempiniOspite += 2; }
    }

    // Casa
    casa.g++;
    casa.pf        += canestriCasa;
    casa.ps        += canestriOspite;
    casa.ptTempini += ptTempiniCasa;
    casa.pt        += ptCasa;
    if (ptCasa === 3)      casa.v++;
    else if (ptCasa === 2) casa.p++;
    else                   casa.s++;

    // Ospite
    ospite.g++;
    ospite.pf        += canestriOspite;
    ospite.ps        += canestriCasa;
    ospite.ptTempini += ptTempiniOspite;
    ospite.pt        += ptOspite;
    if (ptOspite === 3)      ospite.v++;
    else if (ptOspite === 2) ospite.p++;
    else                     ospite.s++;
  });

  // Ordina: pt classifica → pt tempini → differenza canestri → canestri fatti
  return Object.values(mappa).sort((a, b) => {
    if (b.pt !== a.pt)               return b.pt - a.pt;
    if (b.ptTempini !== a.ptTempini) return b.ptTempini - a.ptTempini;
    const diffA = a.pf - a.ps;
    const diffB = b.pf - b.ps;
    if (diffB !== diffA)             return diffB - diffA;
    return b.pf - a.pf;
  });
}