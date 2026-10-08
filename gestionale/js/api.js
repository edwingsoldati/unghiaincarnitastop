/**
 * API Client — UnghiaIncarnitaStop
 * Gestione centralizzata chiamate al Cloudflare Worker v3.0
 */

const WORKER_URL = 'https://gestionale-worker.eracle-soldati.workers.dev';

// Sessione di login (impostata da auth.js)
let _token = null;

export const api = {
  setToken(t) { _token = t || null; },
  onNonAutorizzato: null, // richiamata quando il server risponde 401 (sessione scaduta)

  // Indirizzo foto per <img>: il browser non può inviare l'header, quindi passa la sessione
  fotoUrl(key) {
    return `${WORKER_URL}/api/foto/${encodeURIComponent(key)}?t=${encodeURIComponent(_token || '')}`;
  },

  // Config & Base Fetch
  async request(endpoint, options = {}) {
    const url = `${WORKER_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 && _token && !endpoint.startsWith('/api/auth/')) {
        this.onNonAutorizzato?.();
      }
      if (!res.ok) {
        const err = new Error(data.error || `Errore HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  // Health Check
  getHealth() {
    return this.request('/api/health');
  },

  // Agenda Calendly (Data libera YYYY-MM-DD)
  getAgenda(dateISO) {
    const param = dateISO ? `?date=${encodeURIComponent(dateISO)}` : '';
    return this.request(`/api/agenda/today${param}`);
  },

  // Anagrafica Pazienti (Cloudflare D1)
  getPazienti(query = '') {
    const param = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request(`/api/pazienti${param}`);
  },

  getPazienteDettaglio(id) {
    return this.request(`/api/pazienti/${id}`);
  },

  creaPaziente(pazienteData) {
    return this.request('/api/pazienti', {
      method: 'POST',
      body: JSON.stringify(pazienteData),
    });
  },

  aggiornaPaziente(id, pazienteData) {
    return this.request(`/api/pazienti/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pazienteData),
    });
  },

  // Visite Cliniche
  registraVisita(pazienteId, visitaData) {
    return this.request(`/api/pazienti/${pazienteId}/visite`, {
      method: 'POST',
      body: JSON.stringify(visitaData),
    });
  },

  // CRM & Follow-up
  getCRM() {
    return this.request('/api/crm/followup');
  },

  // Allinea la pipeline con gli interventi prenotati su Calendly (prossimi 90 giorni)
  syncInterventiCalendly() {
    return this.request('/api/calendly/sync-interventi', { method: 'POST' });
  },

  aggiornaImportoVisita(visitaId, importo) {
    return this.request(`/api/visite/${visitaId}`, {
      method: 'PUT',
      body: JSON.stringify({ importo }),
    });
  },

  // Statistiche Studio (mese = 'YYYY-MM')
  getStatistiche(mese) {
    const param = mese ? `?mese=${encodeURIComponent(mese)}` : '';
    return this.request(`/api/statistiche${param}`);
  },

  // Cartella Clinica Onicocriptosi
  getCartelle(pazienteId) {
    return this.request(`/api/pazienti/${pazienteId}/cartelle`);
  },

  creaCartella(pazienteId, dati) {
    return this.request(`/api/pazienti/${pazienteId}/cartelle`, {
      method: 'POST',
      body: JSON.stringify(dati),
    });
  },

  aggiornaCartella(cartellaId, dati) {
    return this.request(`/api/cartelle/${cartellaId}`, {
      method: 'PUT',
      body: JSON.stringify(dati),
    });
  },

  aggiornaCRM(pazienteId, crmData) {
    return this.request(`/api/pazienti/${pazienteId}/crm`, {
      method: 'PUT',
      body: JSON.stringify(crmData),
    });
  },

  // Upload Foto R2
  async uploadFoto(pazienteId, fileBlob, descrizione = '') {
    const descParam = encodeURIComponent(descrizione);
    const url = `${WORKER_URL}/api/pazienti/${pazienteId}/foto?desc=${descParam}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': fileBlob.type || 'image/jpeg',
        ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      },
      body: fileBlob,
    });
    if (res.status === 401) this.onNonAutorizzato?.();
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Documenti Sanitari Ufficiali
  generaPreventivo(payload) {
    return this.request('/api/preventivo/genera', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generaRicevuta(payload) {
    return this.request('/api/ricevuta/genera', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generaAttestatoPresenza(payload) {
    return this.request('/api/attestato-presenza/genera', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generaAttestatoSport(payload) {
    return this.request('/api/attestato-sport/genera', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generaLetteraDimissioni(payload) {
    return this.request('/api/lettera-dimissioni/genera', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getFatturaInfo() {
    return this.request('/api/fattura/info');
  },

  creaFatturaInCloud(payload) {
    return this.request('/api/fattura/crea', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  eliminaFatturaInCloud(docId) {
    return this.request(`/api/fattura/${docId}`, {
      method: 'DELETE',
    });
  },

  inviaFatturaFicEmail(docId, payload) {
    return this.request(`/api/fattura/${docId}/invia-email`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  inviaEmailDocumento(payload) {
    return this.request('/api/email/invia-documento', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Integrazione Stripe
  creaStripeCheckout(payload) {
    return this.request('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
