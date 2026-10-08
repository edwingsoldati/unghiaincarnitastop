/**
 * Mobile UI — UnghiaIncarnitaStop
 * Tab bar in basso, foglio "Altro", schede pazienti in modalità lista → dettaglio
 * con tasto Indietro (anche quello del telefono) e scorciatoie alle sezioni.
 * Su desktop non cambia nulla: gli elementi aggiunti sono nascosti da css/mobile.css.
 */

import { state } from './state.js';

const MQ = window.matchMedia('(max-width: 820px)');
const isMobile = () => MQ.matches;

const ICONE = {
  agenda: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  pazienti: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  documenti: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  crm: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  altro: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  preventivo: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  admin: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  nuovo: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
  indietro: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>'
};

const TAB = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'pazienti', label: 'Pazienti' },
  { key: 'documenti', label: 'Documenti' },
  { key: 'crm', label: 'Follow-up' },
  { key: 'altro', label: 'Altro' }
];

const SEZIONI = [
  { n: '1', label: 'Cartella' },
  { n: '2', label: 'Percorso' },
  { n: '3', label: 'Foto' },
  { n: '4', label: 'Preventivo' },
  { n: '5', label: 'Aurea' }
];

export const MobileUI = {
  app: null,

  init(app) {
    this.app = app;
    this.creaHeaderLogo();
    this.creaTabBar();
    this.creaSheet();
    this.agganciaNavigazione();
    this.agganciaPazienti();
    this.sincronizzaBadgeCRM();
    this.evidenziaTab(state.activeTab || 'agenda');
    // Se si ruota/ridimensiona e si torna desktop, la scheda torna visibile normalmente
    MQ.addEventListener?.('change', () => { if (!isMobile()) this.esciDettaglio(true); });
  },

  // ── Header: logo compatto ────────────────────────────────────────────
  creaHeaderLogo() {
    const box = document.querySelector('.top-header > div:first-child');
    if (!box || box.querySelector('.m-header-logo')) return;
    const img = document.createElement('img');
    img.src = 'assets/img/uis_logo_scritto.webp';
    img.alt = 'UnghiaIncarnitaStop';
    img.className = 'm-only m-header-logo';
    box.prepend(img);
  },

  // ── Tab bar ──────────────────────────────────────────────────────────
  creaTabBar() {
    if (document.getElementById('m-tabbar')) return;
    const nav = document.createElement('nav');
    nav.id = 'm-tabbar';
    nav.setAttribute('aria-label', 'Navigazione principale');
    nav.innerHTML = TAB.map(t => `
      <button type="button" data-tab="${t.key}" aria-label="${t.label}">
        ${ICONE[t.key]}<span>${t.label}</span>
        ${t.key === 'crm' ? '<span class="m-tab-badge" id="m-crm-badge" style="display:none">0</span>' : ''}
      </button>`).join('');
    nav.addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      const key = b.dataset.tab;
      if (key === 'altro') return this.apriSheet();
      // Toccare "Pazienti" mentre si è nella scheda riporta all'elenco (come nelle app iOS)
      if (key === 'pazienti' && state.activeTab === 'pazienti') {
        this.esciDettaglio();
        this.scrollTop();
        return;
      }
      if (key === 'pazienti') this.esciDettaglio(true);
      this.app.navigate(key);
      this.scrollTop(true);
    });
    document.body.appendChild(nav);
  },

  evidenziaTab(key) {
    const k = ['preventivo', 'admin'].includes(key) ? 'altro' : key;
    document.querySelectorAll('#m-tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === k));
  },

  // ── Foglio "Altro" ───────────────────────────────────────────────────
  creaSheet() {
    if (document.getElementById('m-sheet')) return;
    const s = document.createElement('div');
    s.id = 'm-sheet';
    s.innerHTML = `
      <div class="m-sheet-card" role="dialog" aria-label="Altre funzioni">
        <div class="m-sheet-grip"></div>
        <button type="button" class="m-sheet-item" data-go="preventivo">${ICONE.preventivo}<span>Preventivo Intervento<small>Fenolizzazione Clinica Aurea · sconto 30 gg</small></span></button>
        <button type="button" class="m-sheet-item" data-go="admin">${ICONE.admin}<span>Statistiche Studio<small>Fatturato, visite e conversioni del mese</small></span></button>
        <button type="button" class="m-sheet-item" data-go="nuovo">${ICONE.nuovo}<span>Registra Nuovo Paziente<small>Paziente arrivato senza prenotazione</small></span></button>
        <button type="button" class="m-sheet-item" data-go="account"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>Account e sicurezza<small>Face ID, password, utenti, esci</small></span></button>
      </div>`;
    s.addEventListener('click', e => {
      const item = e.target.closest('[data-go]');
      if (item) {
        const go = item.dataset.go;
        this.chiudiSheet();
        if (go === 'nuovo') return this.app.openNuovoPazienteModal();
        if (go === 'account') return window.Auth?.apriAccount();
        this.app.navigate(go);
        this.scrollTop(true);
        return;
      }
      if (!e.target.closest('.m-sheet-card')) this.chiudiSheet();
    });
    document.body.appendChild(s);
  },
  apriSheet() { document.getElementById('m-sheet')?.classList.add('open'); },
  chiudiSheet() { document.getElementById('m-sheet')?.classList.remove('open'); },

  // ── Navigazione: tab attiva + reset scroll ───────────────────────────
  agganciaNavigazione() {
    const orig = this.app.navigate.bind(this.app);
    this.app.navigate = (tabKey) => {
      orig(tabKey);
      this.evidenziaTab(tabKey);
      this.chiudiSheet();
    };
  },

  scrollTop(immediato = false) {
    const vp = document.querySelector('.view-viewport');
    if (vp) vp.scrollTo({ top: 0, behavior: immediato ? 'auto' : 'smooth' });
  },

  sincronizzaBadgeCRM() {
    const src = document.getElementById('nav-crm-badge');
    const dst = document.getElementById('m-crm-badge');
    if (!src || !dst) return;
    const copia = () => {
      dst.textContent = src.textContent;
      dst.style.display = (src.style.display === 'none' || !src.textContent.trim() || src.textContent.trim() === '0') ? 'none' : 'flex';
    };
    copia();
    new MutationObserver(copia).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
  },

  // ── Pazienti: elenco → scheda ────────────────────────────────────────
  agganciaPazienti() {
    const PV = window.PazientiView;
    if (!PV) return;

    const render = PV.renderDettaglioPaziente.bind(PV);
    PV.renderDettaglioPaziente = (p) => {
      render(p);
      this.iniettaBarraDettaglio(p);
    };

    const seleziona = PV.selezionaPazienteById.bind(PV);
    PV.selezionaPazienteById = async (id, extra) => {
      const giaAperto = this.inDettaglio() && PV.selectedPatient && PV.selectedPatient.id === id;
      const r = await seleziona(id, extra);
      if (!giaAperto) this.entraDettaglio();
      return r;
    };

    // Pazienti aperti dall'agenda senza scheda in archivio
    state.on('patientSelected', () => this.entraDettaglio());

    // Tasto Indietro del telefono / gesto: torna all'elenco
    window.addEventListener('popstate', () => {
      if (this.inDettaglio()) this.esciDettaglio(true);
    });
  },

  inDettaglio() {
    return document.getElementById('view-pazienti')?.classList.contains('m-detail');
  },

  entraDettaglio() {
    if (!isMobile()) return;
    const v = document.getElementById('view-pazienti');
    if (!v) return;
    if (!v.classList.contains('m-detail')) {
      v.classList.add('m-detail');
      try { history.pushState({ mDetail: true }, ''); } catch { /* ignore */ }
    }
    this.scrollTop(true);
  },

  esciDettaglio(daPopstate = false) {
    const v = document.getElementById('view-pazienti');
    if (!v || !v.classList.contains('m-detail')) return;
    v.classList.remove('m-detail');
    if (!daPopstate && history.state && history.state.mDetail) {
      try { history.back(); } catch { /* ignore */ }
    }
    this.scrollTop(true);
  },

  iniettaBarraDettaglio(p) {
    const c = document.getElementById('paziente-dettaglio-container');
    if (!c || !p) return;
    const nome = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || 'Paziente'}`;
    const bar = document.createElement('div');
    bar.className = 'm-detail-bar';
    bar.innerHTML = `
      <div class="m-detail-top">
        <button type="button" class="m-back">${ICONE.indietro}<span>Pazienti</span></button>
        <div class="m-detail-name"></div>
      </div>
      <div class="m-chips">${SEZIONI.map(s => `<button type="button" class="m-chip" data-n="${s.n}">${s.label}</button>`).join('')}</div>`;
    bar.querySelector('.m-detail-name').textContent = nome;
    bar.querySelector('.m-back').addEventListener('click', () => this.esciDettaglio());
    bar.querySelectorAll('.m-chip').forEach(ch => ch.addEventListener('click', () => {
      const card = this.cardSezione(ch.dataset.n);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    c.prepend(bar);
    this.osservaSezioni(bar);
  },

  cardSezione(n) {
    const t = [...document.querySelectorAll('#paziente-dettaglio-container .card-title')]
      .find(el => el.textContent.trim().startsWith(n + '.'));
    return t ? t.closest('.card') : null;
  },

  // Evidenzia la scorciatoia della sezione che si sta guardando
  osservaSezioni(bar) {
    if (this._obs) this._obs.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const vp = document.querySelector('.view-viewport');
    const visibili = new Map();
    this._obs = new IntersectionObserver(entries => {
      entries.forEach(e => visibili.set(e.target.dataset.mSez, e.isIntersecting ? e.boundingClientRect.top : null));
      const attiva = [...visibili.entries()].filter(([, v]) => v !== null).sort((a, b) => a[0] - b[0])[0];
      if (attiva) bar.querySelectorAll('.m-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.n === attiva[0]));
    }, { root: vp, rootMargin: '-120px 0px -55% 0px' });
    SEZIONI.forEach(s => {
      const card = this.cardSezione(s.n);
      if (card) { card.dataset.mSez = s.n; this._obs.observe(card); }
    });
  }
};

window.MobileUI = MobileUI;
