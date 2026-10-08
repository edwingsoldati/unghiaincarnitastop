/**
 * App Main Controller & Router — UnghiaIncarnitaStop
 */

import { api } from './api.js';
import { state, showToast } from './state.js';
import { AgendaView } from './views/agenda.view.js';
import { PazientiView } from './views/pazienti.view.js';
import { PreventivoView } from './views/preventivo.view.js';
import { DocumentiView } from './views/documenti.view.js';
import { CRMView } from './views/crm.view.js';
import { StatisticheView } from './views/statistiche.view.js';
import { MobileUI } from './mobile.js';
import { Auth } from './auth.js';

export const app = {
  views: {
    agenda: AgendaView,
    pazienti: PazientiView,
    preventivo: PreventivoView,
    documenti: DocumentiView,
    crm: CRMView,
  },

  init() {
    this.bindNavigation();
    this.bindGlobalEvents();

    // Inizializza viste
    AgendaView.init();
    PazientiView.init();
    PreventivoView.init();
    DocumentiView.init();
    CRMView.init();
    StatisticheView.init();

    // Mostra vista iniziale
    this.navigate('agenda');

    // Interfaccia mobile (tab bar, scheda paziente a schermo intero): inattiva su desktop
    MobileUI.init(this);
  },

  navigate(tabKey) {
    if (tabKey === 'admin' && !Auth.isAdmin()) tabKey = 'agenda'; // guadagni riservati agli amministratori
    state.activeTab = tabKey;
    if (tabKey === 'admin') StatisticheView.load();
    if (tabKey === 'crm') CRMView.loadCRMData();

    const tabs = ['agenda', 'pazienti', 'preventivo', 'documenti', 'crm', 'admin'];
    tabs.forEach(t => {
      const v = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`nav-${t}`);
      if (v) v.style.display = (t === tabKey) ? 'block' : 'none';
      if (btn) {
        if (t === tabKey) {
          btn.classList.add('active');
          btn.style.backgroundColor = 'var(--text-primary)';
          btn.style.color = 'var(--text-inverse)';
        } else {
          btn.classList.remove('active');
          btn.style.backgroundColor = 'transparent';
          btn.style.color = 'var(--text-secondary)';
        }
      }
    });

    const headings = {
      agenda: ['Agenda Giornaliera', 'Sincronizzazione orari e note da Calendly'],
      pazienti: ['Cartella Pazienti', 'Archivio clinico e storico visite (Cloudflare D1)'],
      preventivo: ['Preventivo Intervento', 'Prospetto economico per la Clinica Aurea (sconto 30gg)'],
      documenti: ['Documenti & Fatture', 'Certificati ufficiali con timbro e integrazione FattureInCloud'],
      crm: ['Follow-up & CRM', 'Monitoraggio del percorso del paziente e contatti WhatsApp'],
      admin: ['Statistiche Studio', 'Indicatori di performance e tassi di conversione chirurgica']
    };

    const h = headings[tabKey];
    if (h) {
      const titleEl = document.getElementById('view-title-text');
      const subEl = document.getElementById('view-subtitle-text');
      if (titleEl) titleEl.textContent = h[0];
      if (subEl) subEl.textContent = h[1];
    }
  },

  bindNavigation() {
    const tabs = ['agenda', 'pazienti', 'preventivo', 'documenti', 'crm', 'admin'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-${t}`);
      if (btn) {
        btn.addEventListener('click', () => this.navigate(t));
      }
    });
  },

  bindGlobalEvents() {
    // Gestione modale Nuovo Paziente
    const btnNuovo = document.getElementById('btn-nuovo-paziente-header');
    if (btnNuovo) {
      btnNuovo.addEventListener('click', () => this.openNuovoPazienteModal());
    }

    const formNuovo = document.getElementById('form-nuovo-paziente');
    if (formNuovo) {
      formNuovo.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.salvaNuovoPaziente();
      });
    }
  },

  openNuovoPazienteModal() {
    const m = document.getElementById('modal-nuovo-paziente');
    if (m) m.classList.add('open');
  },

  closeNuovoPazienteModal() {
    const m = document.getElementById('modal-nuovo-paziente');
    if (m) m.classList.remove('open');
  },

  async salvaNuovoPaziente() {
    const nome = document.getElementById('np-nome').value.trim();
    const cognome = document.getElementById('np-cognome').value.trim();
    const telefono = document.getElementById('np-telefono').value.trim();
    const email = document.getElementById('np-email').value.trim();

    if (!nome || !cognome) {
      showToast('Nome e Cognome sono obbligatori', 'error');
      return;
    }

    try {
      const res = await api.creaPaziente({
        nome,
        cognome,
        telefono: telefono || null,
        email: email || null
      });

      showToast(`Paziente ${cognome} ${nome} registrato su D1!`);
      this.closeNuovoPazienteModal();
      document.getElementById('form-nuovo-paziente').reset();

      // Ricarica la lista pazienti
      await PazientiView.loadPazienti();
      PazientiView.selezionaPazienteById(res.id);
      this.navigate('pazienti');
    } catch (e) {
      showToast('Errore registrazione: ' + e.message, 'error');
    }
  }
};

window.app = app;

// Avvio al caricamento del DOM
document.addEventListener('DOMContentLoaded', async () => {
  await Auth.start(); // schermata di accesso: il gestionale parte solo dopo il login
  app.init();
});
