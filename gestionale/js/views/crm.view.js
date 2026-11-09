/**
 * Vista CRM Pipeline & WhatsApp Follow-up (Tracciamento 30gg Preventivi Clinica Aurea)
 * Studio Podologico Dott. Federico Grassi — UnghiaIncarnitaStop
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';

export const CRMView = {
  filtroCorrente: 'tutti_preventivi',
  crmList: [],

  init() {
    this.renderContainer();
    this.loadCRMData();
  },

  renderContainer() {
    const container = document.getElementById('view-crm');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px; max-width:960px; margin:0 auto;">
        
        <!-- Intestazione & Guida Pipeline -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-subtle); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); flex-wrap:wrap; gap:10px;">
          <div>
            <strong style="font-size:14px; color:var(--text-primary); display:block;">📋 Cruscotto Preventivi, Pagamenti & Follow-up Aurea</strong>
            <span style="font-size:11.5px; color:var(--text-muted);">
              Tracciamento stato preventivi (sconto 30gg), pagamenti incassati (Klarna/Stripe o Studio) e interventi prenotati su Calendly.
            </span>
          </div>
          <button onclick="window.CRMView.loadCRMData()" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:5px;">
            🔄 Aggiorna Dati
          </button>
        </div>

        <!-- Filtri Pipeline -->
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button onclick="window.CRMView.setFiltro('tutti_preventivi')" id="crm-flt-tutti_preventivi" class="btn btn-dark btn-sm">📋 Tutti i Preventivi</button>
          <button onclick="window.CRMView.setFiltro('tca')" id="crm-flt-tca" class="btn btn-secondary btn-sm" style="border-color:#fca5a5; color:#991b1b; font-weight:700;">🔴 TCA</button>
          <button onclick="window.CRMView.setFiltro('in_attesa_pagamento')" id="crm-flt-in_attesa_pagamento" class="btn btn-secondary btn-sm">⏳ In Attesa Pagamento</button>
          <button onclick="window.CRMView.setFiltro('pagati')" id="crm-flt-pagati" class="btn btn-secondary btn-sm">💳 Pagati (Stripe o Studio)</button>
          <button onclick="window.CRMView.setFiltro('operazione_pianificata')" id="crm-flt-operazione_pianificata" class="btn btn-secondary btn-sm">🏥 Intervento Prenotato (Aurea)</button>
          <button onclick="window.CRMView.setFiltro('tutti')" id="crm-flt-tutti" class="btn btn-secondary btn-sm">Tutti i Contatti</button>
          <button onclick="window.CRMView.setFiltro('da_richiamare')" id="crm-flt-da_richiamare" class="btn btn-secondary btn-sm">Da Richiamare</button>
          <button onclick="window.CRMView.setFiltro('completato')" id="crm-flt-completato" class="btn btn-secondary btn-sm">Completati</button>
        </div>

        <!-- Lista Contatti Follow-up -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div id="crm-list-container" style="display:flex; flex-direction:column;">
            <div style="padding:32px; text-align:center; color:var(--text-muted); font-size:12px;">
              Caricamento contatti follow-up in corso...
            </div>
          </div>
        </div>

      </div>

      <!-- Modale Aggiorna Stato CRM -->
      <div id="modal-update-crm" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <span style="font-weight:600; font-size:13px;">Aggiorna Stato Follow-up Paziente</span>
            <button onclick="document.getElementById('modal-update-crm').classList.remove('open')" class="btn btn-secondary btn-sm">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Paziente</label>
              <input type="text" id="crm-mod-nome" class="form-input" readonly style="background:var(--bg-subtle);">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group">
                <label class="form-label">Stato Pipeline</label>
                <select id="crm-mod-stato" class="form-select">
                  <option value="preventivo_inviato">Preventivo inviato (30gg)</option>
                  <option value="da_richiamare">Da richiamare</option>
                  <option value="in_attesa">In attesa risposta</option>
                  <option value="operazione_pianificata">Operazione pianificata (Aurea)</option>
                  <option value="completato">Completato / Dimesso</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Priorità</label>
                <select id="crm-mod-priorita" class="form-select">
                  <option value="normale">Normale</option>
                  <option value="alta">Alta</option>
                  <option value="bassa">Bassa</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Prossimo Ricontatto (Scadenza)</label>
              <input type="date" id="crm-mod-data-followup" class="form-input form-input-mono">
            </div>
            <div class="form-group">
              <label class="form-label">Note Operative CRM</label>
              <textarea id="crm-mod-note" rows="3" class="form-textarea" placeholder="Note sulla conversazione, disponibilità del paziente..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button onclick="document.getElementById('modal-update-crm').classList.remove('open')" class="btn btn-secondary">Annulla</button>
            <button onclick="window.CRMView.salvaStatoCRM()" class="btn btn-primary">Salva su D1</button>
          </div>
        </div>
      </div>

      <!-- Modale Rapida: Segna Pagato Preventivo -->
      <div id="modal-crm-pagato" class="modal-overlay">
        <div class="modal-card" style="max-width:440px;">
          <div class="modal-header" style="background:#f0fdf4; border-bottom:1px solid #bbf7d0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">💳</span>
              <strong style="font-size:13.5px; color:#166534;">Registra Pagamento Preventivo</strong>
            </div>
            <button onclick="document.getElementById('modal-crm-pagato').classList.remove('open')" class="btn btn-secondary btn-sm">✕</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; padding:16px;">
            <input type="hidden" id="crm-pag-paziente-id">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11px;">Paziente</label>
              <input type="text" id="crm-pag-nome" class="form-input" readonly style="background:var(--bg-subtle); font-weight:600;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:11px;">Importo Saldato (€) *</label>
                <input type="number" id="crm-pag-importo" class="form-input form-input-mono" step="0.01" style="font-weight:700; color:#166534;">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:11px;">Metodo di Pagamento *</label>
                <select id="crm-pag-metodo" class="form-select">
                  <option value="bonifico">Bonifico Bancario</option>
                  <option value="pos">POS in Studio</option>
                  <option value="contanti">Contanti</option>
                  <option value="stripe">Stripe / Klarna</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11px;">Data Pagamento</label>
              <input type="date" id="crm-pag-data" class="form-input form-input-mono">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11px;">Note (opzionale)</label>
              <input type="text" id="crm-pag-note" class="form-input" placeholder="Es. Bonifico confermato da Cristina">
            </div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:space-between;">
            <button onclick="document.getElementById('modal-crm-pagato').classList.remove('open')" class="btn btn-secondary">Annulla</button>
            <button onclick="window.CRMView.confermaRegistraPagamento()" id="btn-conferma-crm-pagamento" class="btn btn-primary" style="background:#16a34a; border-color:#16a34a; font-weight:600;">
              ✓ Conferma Pagamento
            </button>
          </div>
        </div>
      </div>

      <!-- Modale Rapida: Fissa Intervento Clinica Aurea -->
      <div id="modal-crm-fissa-aurea" class="modal-overlay">
        <div class="modal-card" style="max-width:440px;">
          <div class="modal-header" style="background:#f0fdfa; border-bottom:1px solid #99f6e4;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">🏥</span>
              <strong style="font-size:13.5px; color:#115e59;">Fissa Intervento Clinica Aurea</strong>
            </div>
            <button onclick="document.getElementById('modal-crm-fissa-aurea').classList.remove('open')" class="btn btn-secondary btn-sm">✕</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; padding:16px;">
            <input type="hidden" id="crm-aur-paziente-id">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11px;">Paziente</label>
              <input type="text" id="crm-aur-nome" class="form-input" readonly style="background:var(--bg-subtle); font-weight:600;">
            </div>
            <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:10px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:11px;">Data Intervento *</label>
                <input type="date" id="crm-aur-data" class="form-input form-input-mono" style="font-weight:700; color:#0f766e;">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:11px;">Orario (opzionale)</label>
                <input type="time" id="crm-aur-ora" class="form-input form-input-mono" value="09:00">
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11px;">Sede Intervento</label>
              <input type="text" id="crm-aur-sede" class="form-input" value="Clinica Aurea" readonly style="background:var(--bg-subtle);">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11px;">Note Intervento (opzionale)</label>
              <input type="text" id="crm-aur-note" class="form-input" placeholder="Es. Alluce destro (DX)">
            </div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:space-between;">
            <button onclick="document.getElementById('modal-crm-fissa-aurea').classList.remove('open')" class="btn btn-secondary">Annulla</button>
            <button onclick="window.CRMView.confermaFissaIntervento()" id="btn-conferma-crm-aurea" class="btn btn-primary" style="background:#0d9488; border-color:#0d9488; font-weight:600;">
              ✓ Salva Data Intervento
            </button>
          </div>
        </div>
      </div>
    `;
  },

  setFiltro(stato) {
    this.filtroCorrente = stato;
    const buttons = ['tutti_preventivi', 'tca', 'in_attesa_pagamento', 'pagati', 'operazione_pianificata', 'tutti', 'da_richiamare', 'completato'];
    buttons.forEach(b => {
      const btn = document.getElementById('crm-flt-' + b);
      if (btn) {
        if (b === 'tca') {
          btn.className = (b === stato) ? 'btn btn-sm' : 'btn btn-secondary btn-sm';
          btn.style.background = (b === stato) ? '#991b1b' : '';
          btn.style.color = (b === stato) ? '#ffffff' : '#991b1b';
          btn.style.borderColor = (b === stato) ? '#991b1b' : '#fca5a5';
          btn.style.fontWeight = '700';
        } else {
          btn.className = (b === stato) ? 'btn btn-dark btn-sm' : 'btn btn-secondary btn-sm';
        }
      }
    });
    this.renderList();
  },

  async loadCRMData() {
    try {
      // Rete di sicurezza Calendly (max una volta ogni 10 minuti): interventi prenotati → "Operazione pianificata"
      if (!this._ultimoSyncCalendly || Date.now() - this._ultimoSyncCalendly > 600000) {
        this._ultimoSyncCalendly = Date.now();
        await api.syncInterventiCalendly().catch(() => null);
      }
      const data = await api.getCRM();
      this.crmList = data.pazienti || [];
      this.aggiornaBadgeSidebar();
      this.renderList();
    } catch (e) {
      const container = document.getElementById('crm-list-container');
      if (container) {
        container.innerHTML = `<div style="padding:24px; color:var(--status-danger-text); font-size:12px;">Errore caricamento CRM: ${e.message}</div>`;
      }
    }
  },

  aggiornaBadgeSidebar() {
    const badge = document.getElementById('nav-crm-badge');
    if (!badge) return;

    let countAttenzione = 0;
    const now = new Date();

    this.crmList.forEach(p => {
      if (p.stato === 'preventivo_inviato') {
        countAttenzione++;
      } else if (p.stato === 'da_richiamare' || p.stato === 'in_attesa') {
        if (p.data_prossimo_followup) {
          const diff = Math.round((new Date(p.data_prossimo_followup) - now) / 86400000);
          if (diff <= 0) countAttenzione++;
        } else {
          countAttenzione++;
        }
      }
    });

    if (countAttenzione > 0) {
      badge.textContent = countAttenzione;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  },

  renderList() {
    const container = document.getElementById('crm-list-container');
    if (!container) return;

    // Normalizza campi per ogni paziente
    this.crmList.forEach(p => {
      p.ha_preventivo = Boolean(p.preventivo_inviato || (p.importo_preventivo != null && Number(p.importo_preventivo) > 0));
      p.ha_pagato_stripe = Boolean(p.stripe_pagamento_id);
      p.ha_pagato_studio = Boolean(p.studio_importo_pagato && Number(p.studio_importo_pagato) >= 300);
      p.ha_pagato = Boolean(p.ha_pagato_stripe || p.ha_pagato_studio);
      p.ha_prenotato = Boolean(p.operazione_pianificata || p.data_operazione || (p.note_crm && p.note_crm.includes('[Calendly]')));
    });

    let filtered = this.crmList;
    if (this.filtroCorrente === 'tutti_preventivi') {
      filtered = this.crmList.filter(p => p.ha_preventivo);
    } else if (this.filtroCorrente === 'tca') {
      filtered = this.crmList.filter(p => p.protocollo === 'tca');
    } else if (this.filtroCorrente === 'in_attesa_pagamento') {
      filtered = this.crmList.filter(p => p.ha_preventivo && !p.ha_pagato);
    } else if (this.filtroCorrente === 'pagati') {
      filtered = this.crmList.filter(p => p.ha_pagato);
    } else if (this.filtroCorrente === 'operazione_pianificata') {
      filtered = this.crmList.filter(p => p.ha_prenotato || p.stato === 'operazione_pianificata');
    } else if (this.filtroCorrente === 'da_richiamare') {
      filtered = this.crmList.filter(p => p.stato === 'da_richiamare');
    } else if (this.filtroCorrente === 'completato') {
      filtered = this.crmList.filter(p => p.stato === 'completato');
    } else if (this.filtroCorrente === 'tutti') {
      filtered = this.crmList;
    }

    if (!filtered.length) {
      container.innerHTML = `<div style="padding:36px; text-align:center; color:var(--text-muted); font-size:12.5px;">Nessun paziente trovato per questo filtro.</div>`;
      return;
    }

    container.innerHTML = filtered.map(p => {
      const phoneClean = (p.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
      const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || 'Paziente'}`.trim();

      // Calcolo scadenza sconto 30 giorni
      let scadenzaHtml = '';
      let giorniRimanentiSconto = null;
      const dataRif = p.data_ultimo_contatto || p.ultima_visita;
      if (p.ha_preventivo && dataRif) {
        const dt = new Date(dataRif + 'T12:00:00');
        const giorniPassati = Math.floor((new Date() - dt) / 86400000);
        giorniRimanentiSconto = 30 - giorniPassati;

        if (giorniRimanentiSconto > 7) {
          scadenzaHtml = `<span style="color:#0f766e; font-weight:600; font-size:11px;">🟢 Sconto 30gg attivo (ancora ${giorniRimanentiSconto} gg)</span>`;
        } else if (giorniRimanentiSconto >= 0) {
          scadenzaHtml = `<span style="color:#b45309; font-weight:700; font-size:11px; background:#fef3c7; padding:2px 6px; border-radius:4px;">⚠️ In scadenza: ${giorniRimanentiSconto} gg rimasti!</span>`;
        } else {
          scadenzaHtml = `<span style="color:#b91c1c; font-weight:700; font-size:11px; background:#fee2e2; padding:2px 6px; border-radius:4px;">🔴 Sconto 30gg scaduto da ${Math.abs(giorniRimanentiSconto)} gg</span>`;
        }
      }

      // Badge Pagamento (Stripe/Klarna o Studio)
      let badgePagamento = '';
      if (p.ha_pagato_stripe) {
        const impPagato = Number(p.stripe_importo_pagato || p.importo_preventivo || 0).toFixed(2);
        badgePagamento = `<span class="badge" style="background:#e0e7ff; color:#4338ca; font-weight:700; font-size:11px;">🟢 Pagato online Klarna/Stripe (€ ${impPagato})</span>`;
      } else if (p.ha_pagato_studio) {
        const impStudio = Number(p.studio_importo_pagato || p.importo_preventivo || 0).toFixed(2);
        const metodoStudio = (p.studio_pagamento_metodo || 'POS').toUpperCase();
        badgePagamento = `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700; font-size:11px;">🟢 Pagato in Studio (${metodoStudio} € ${impStudio})</span>`;
      } else if (p.ha_preventivo) {
        badgePagamento = `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700; font-size:11px;">🔴 In attesa di pagamento</span>`;
      }

      // Badge Prenotazione Intervento Clinica Aurea
      let badgeAurea = '';
      if (p.ha_prenotato) {
        const dataAureaStr = p.data_operazione ? p.data_operazione.slice(0, 10) : '';
        badgeAurea = `<span class="badge badge-teal" style="font-weight:700; font-size:11px;">🏥 Aurea: ${dataAureaStr ? 'Prenotato ' + dataAureaStr : 'Pianificato'}</span>`;
      } else {
        badgeAurea = `<span style="font-size:10.5px; color:var(--text-muted); background:var(--bg-subtle); padding:2px 6px; border-radius:4px;">⚪ Intervento non ancora prenotato</span>`;
      }

      return `
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:280px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
              <strong style="font-size:14px; color:var(--text-primary);">${nomeCompleto}</strong>
              ${p.protocollo === 'tca' ? '<span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #f87171; font-weight:700; font-size:11px;">🔴 TCA</span>' : ''}
              ${p.importo_preventivo ? `<span class="badge badge-neutral font-mono-code" style="font-size:12px; font-weight:700;">Preventivo: € ${Number(p.importo_preventivo).toFixed(2)}</span>` : ''}
              ${badgePagamento}
              ${badgeAurea}
            </div>

            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:6px; display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
              <span>Tel: <strong class="font-mono-code">${p.telefono || '—'}</strong></span>
              <span>Email: <strong>${p.email || '—'}</strong></span>
              ${dataRif ? `<span>Data preventivo: <strong>${dataRif.slice(0, 10)}</strong></span>` : ''}
              ${scadenzaHtml ? `<span>${scadenzaHtml}</span>` : ''}
            </div>

            ${p.note_crm ? `
              <div style="font-size:11.5px; color:var(--text-primary); background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 12px; margin-top:8px; line-height:1.45;">
                ${p.note_crm}
              </div>
            ` : ''}
          </div>

          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">
            <!-- Azione Rapida: Non Risponde (+3gg) -->
            <button onclick="window.CRMView.segnaNonRisponde(${p.id})" class="btn btn-sm btn-secondary" style="border-color:#fde047; background:#fefce8; color:#854d0e; font-weight:600; display:flex; align-items:center; gap:4px;" title="Rimanda il ricontatto di 3 giorni e aggiunge nota 'Non risponde'">
              📞 Non risponde (+3gg)
            </button>

            <!-- Azione Rapida: Segna Pagato (se non ancora saldato) -->
            ${!p.ha_pagato ? `
              <button onclick="window.CRMView.apriModalePagamentoStudio(${p.id})" class="btn btn-sm btn-secondary" style="border-color:#86efac; background:#f0fdf4; color:#166534; font-weight:600; display:flex; align-items:center; gap:4px;" title="Registra che il paziente ha saldato il preventivo (Bonifico, POS o Contanti)">
                💳 Segna Pagato
              </button>
            ` : ''}

            <!-- Azione Rapida: Fissa / Modifica Intervento Clinica Aurea -->
            <button onclick="window.CRMView.apriModaleFissaIntervento(${p.id})" class="btn btn-sm btn-secondary" style="border-color:#99f6e4; background:#f0fdfa; color:#115e59; font-weight:600; display:flex; align-items:center; gap:4px;" title="${p.ha_prenotato ? 'Modifica data intervento Clinica Aurea' : 'Fissa data intervento Clinica Aurea'}">
              🏥 ${p.ha_prenotato ? 'Modifica Data Aurea' : 'Fissa Data Aurea'}
            </button>

            ${(!p.ha_pagato && p.ha_preventivo) ? `
              <button onclick="window.CRMView.inviaLinkStripeCRM(${p.id}, ${p.importo_preventivo || 850})" class="btn btn-sm" style="background:#635bff; color:#fff; border:1px solid #635bff; font-weight:600; display:flex; align-items:center; gap:4px;" title="Crea o invia il link Stripe con 3 rate Klarna per € ${p.importo_preventivo || 850}">
                Link Klarna
              </button>
            ` : ''}
            ${phoneClean ? `
              <button onclick="window.CRMView.apriWhatsAppDialog(${p.id})" class="btn btn-whatsapp btn-sm" style="display:flex; align-items:center; gap:4px;">
                💬 WhatsApp
              </button>
            ` : ''}
            ${p.ha_prenotato ? `
              <button onclick="window.CRMView.apriDimissioni(${p.id})" class="btn btn-primary btn-sm" title="Lettera di dimissioni per il medico curante">
                Dimissioni
              </button>
            ` : ''}
            <button onclick="window.CRMView.apriModaleAggiornamento(${p.id})" class="btn btn-secondary btn-sm" title="Modifica note o stato personalizzato">
              ✏️ Note
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async inviaLinkStripeCRM(id, importo) {
    const p = (this.crmList || []).find(x => x.id === id);
    if (!p) return;

    showToast(`Generazione link Stripe per € ${Number(importo).toFixed(2)} (anche rate Klarna)...`);
    try {
      const res = await api.creaStripeCheckout({
        paziente_id: p.id,
        customer_email: p.email || undefined,
        customer_name: `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`.trim() || undefined,
        customer_phone: p.telefono || undefined,
        importo: Number(importo),
        descrizione: `Trattamento Fenolizzazione (Clinica Aurea) - Saldo Preventivo`,
        tipo: 'intervento',
        success_url: `${window.location.origin}/gestionale/?pagamento=completato&pid=${p.id}`,
        cancel_url: `${window.location.origin}/gestionale/?pagamento=annullato`
      });

      if (!res.url) throw new Error(res.error || 'Nessun URL restituito da Stripe');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(res.url);
      }

      const telClean = (p.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
      const msgWa = encodeURIComponent(
        `Gentile ${p.nome || ''}, ecco il link sicuro per completare il pagamento dell'intervento (€ ${Number(importo).toFixed(2)}) con carta o in 3 comode rate a tasso zero con Klarna:\n${res.url}\n\nClinica Aurea / Studio Dott. Federico Grassi`
      );
      const waUrl = telClean ? `https://wa.me/${telClean}?text=${msgWa}` : null;

      const ok = confirm(
        `✓ Link Stripe generato e COPIATO negli appunti!\n\nImporto: € ${Number(importo).toFixed(2)}\nLink: ${res.url}\n\nPremi OK per inviarlo subito a ${p.nome} su WhatsApp, oppure ANNULLA per chiudere.`
      );

      if (ok && waUrl) {
        window.open(waUrl, '_blank');
      }
    } catch (e) {
      showToast('Errore creazione link Stripe: ' + e.message, 'error');
    }
  },

  // Lettera di dimissioni direttamente dal Follow-up (paziente in "Operazione pianificata")
  apriDimissioni(id) {
    const p = (this.crmList || []).find(x => x.id === id);
    if (!p || !window.DocumentiView) return;
    window.DocumentiView.apriDocumentoPrecompilato('dimissioni', p);
  },

  apriWhatsAppDialog(id) {
    const p = (this.crmList || []).find(x => x.id === id);
    if (!p) return;

    const phoneClean = (p.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
    const nome = `${p.nome || 'Paziente'}`.trim();
    let defaultMsg = '';

    if (p.ha_pagato && p.ha_prenotato) {
      const dataStr = p.data_operazione ? `il ${p.data_operazione.slice(0, 10)}` : 'come concordato';
      defaultMsg = `Gentile ${nome}, confermiamo il suo intervento di fenolizzazione presso la Clinica Aurea (Via Pietro Palmieri 50, Torino) ${dataStr}.\n\nLe ricordiamo di compilare preventivamente il modulo obbligatorio di consenso informato al seguente link:\nhttps://www.unghiaincarnitastop.com/consensi/\n\nPer qualsiasi necessità siamo a sua completa disposizione. A presto!\n\nStudio Dott. Federico Grassi`;
    } else if (p.ha_pagato && !p.ha_prenotato) {
      defaultMsg = `Gentile ${nome}, le confermiamo con piacere la ricezione del pagamento per il trattamento di fenolizzazione.\n\nPer scegliere la data e l'orario dell'intervento presso la Clinica Aurea, può accedere direttamente al calendario qui:\nhttps://calendly.com/federico-grassi-unghiaincarnitastop/trattamento-per-unghia-incarnita-aurea\n\nRicordi inoltre di compilare il consenso informato prima della seduta su:\nhttps://www.unghiaincarnitastop.com/consensi/\n\nCordiali saluti,\nStudio Dott. Federico Grassi`;
    } else if (p.ha_preventivo) {
      const imp = p.importo_preventivo ? ` di € ${Number(p.importo_preventivo).toFixed(2)}` : '';
      defaultMsg = `Buongiorno ${nome}, le scrivo dallo Studio Podologico del Dott. Federico Grassi riguardo al preventivo${imp} per l'intervento di fenolizzazione alla Clinica Aurea.\n\nLe ricordiamo che è possibile completare il saldo anche in 3 comode rate a tasso zero con Klarna.\n\nSe desidera fissare la data dell'intervento può utilizzare il calendario qui: https://calendly.com/federico-grassi-unghiaincarnitastop/trattamento-per-unghia-incarnita-aurea\n\nRestiamo a disposizione per qualsiasi dubbio o chiarimento. Buona giornata!`;
    } else {
      defaultMsg = `Buongiorno ${nome}, la contatto dallo Studio Podologico del Dott. Federico Grassi riguardo al suo percorso per l'unghia incarnita. Volevo sapere come procede la situazione clinica. Cordiali saluti.`;
    }

    const msg = prompt(`Messaggio WhatsApp per ${nome} (modificabile prima dell'invio):`, defaultMsg);
    if (msg !== null && msg.trim()) {
      window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg.trim())}`, '_blank');
    }
  },

  selectedCRMId: null,
  selectedCRMPagamentoId: null,
  selectedCRMInterventoId: null,

  async segnaNonRisponde(pid) {
    const p = (this.crmList || []).find(x => x.id === pid);
    if (!p) return;

    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || 'questo paziente'}`.trim();
    if (!confirm(`Vuoi rimandare di 3 giorni il follow-up per ${nomeCompleto} con nota 'Non risponde'?`)) {
      return;
    }

    const now = new Date();
    const dd_today = String(now.getDate()).padStart(2, '0');
    const mm_today = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy_today = now.getFullYear();
    const oggiIso = `${yyyy_today}-${mm_today}-${dd_today}`;
    const oggiFormatted = `${dd_today}/${mm_today}/${yyyy_today}`;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const dd_target = String(targetDate.getDate()).padStart(2, '0');
    const mm_target = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy_target = targetDate.getFullYear();
    const targetIso = `${yyyy_target}-${mm_target}-${dd_target}`;
    const targetFormatted = `${dd_target}/${mm_target}/${yyyy_target}`;

    const nuovaNota = `[${oggiFormatted}] Chiamato: non risponde (ricontatto fissato per il ${targetFormatted})`;
    const noteAggiornate = p.note_crm ? `${p.note_crm}\n${nuovaNota}` : nuovaNota;

    try {
      await api.aggiornaCRM(pid, {
        stato: 'da_richiamare',
        priorita: p.priorita || 'normale',
        data_ultimo_contatto: oggiIso,
        data_prossimo_followup: targetIso,
        note_crm: noteAggiornate
      });
      showToast(`✓ Follow-up rimandato al ${targetFormatted} per ${nomeCompleto}`, 'success');
      await this.loadCRMData();
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    }
  },

  apriModalePagamentoStudio(pid) {
    const p = (this.crmList || []).find(x => x.id === pid);
    if (!p) return;
    this.selectedCRMPagamentoId = pid;

    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`.trim();
    document.getElementById('crm-pag-paziente-id').value = pid;
    document.getElementById('crm-pag-nome').value = nomeCompleto;
    document.getElementById('crm-pag-importo').value = p.importo_preventivo ? Number(p.importo_preventivo).toFixed(2) : '850.00';
    document.getElementById('crm-pag-metodo').value = 'bonifico';
    document.getElementById('crm-pag-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('crm-pag-note').value = 'Saldo preventivo intervento';

    const btn = document.getElementById('btn-conferma-crm-pagamento');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Conferma Pagamento';
    }

    document.getElementById('modal-crm-pagato').classList.add('open');
  },

  async confermaRegistraPagamento() {
    const pid = this.selectedCRMPagamentoId;
    const p = (this.crmList || []).find(x => x.id === pid);
    if (!p) return;

    const importo = parseFloat(document.getElementById('crm-pag-importo').value);
    const metodo = document.getElementById('crm-pag-metodo').value;
    const dataPag = document.getElementById('crm-pag-data').value || new Date().toISOString().split('T')[0];
    const note = document.getElementById('crm-pag-note').value.trim();

    if (!importo || importo <= 0) {
      alert('Inserisci un importo valido.');
      return;
    }

    const btn = document.getElementById('btn-conferma-crm-pagamento');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Registrazione in corso...';
    }

    const now = new Date();
    const dd_today = String(now.getDate()).padStart(2, '0');
    const mm_today = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy_today = now.getFullYear();
    const oggiFormatted = `${dd_today}/${mm_today}/${yyyy_today}`;

    try {
      // 1. Registra in visite per il calcolo fatturato e visualizzazione stato studio
      await api.registraVisita(pid, {
        data_visita: dataPag,
        tipo: 'fenolizzazione',
        importo: importo,
        sede: 'Studio Filadelfia',
        pagamento_metodo: metodo,
        pagamento_stato: 'saldato',
        note: note ? `Pagamento registrato da Follow-up CRM (${metodo.toUpperCase()}): ${note}` : `Pagamento registrato da Follow-up CRM (${metodo.toUpperCase()})`
      });

      // 2. Aggiorna CRM con nota e data contatto
      const metodoEtichetta = metodo === 'bonifico' ? 'Bonifico Bancario' : (metodo === 'pos' ? 'POS in Studio' : (metodo === 'contanti' ? 'Contanti' : 'Stripe Online'));
      const nuovaNota = `[${oggiFormatted}] Pagamento di € ${importo.toFixed(2)} saldato tramite ${metodoEtichetta}`;
      const noteAggiornate = p.note_crm ? `${p.note_crm}\n${nuovaNota}` : nuovaNota;

      await api.aggiornaCRM(pid, {
        stato: p.ha_prenotato ? 'operazione_pianificata' : 'in_attesa',
        priorita: p.priorita || 'normale',
        data_ultimo_contatto: dataPag,
        note_crm: noteAggiornate
      });

      document.getElementById('modal-crm-pagato').classList.remove('open');
      showToast(`✓ Pagamento di € ${importo.toFixed(2)} registrato con successo!`, 'success');
      await this.loadCRMData();
    } catch (e) {
      alert('Errore registrazione pagamento: ' + e.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Conferma Pagamento';
      }
    }
  },

  apriModaleFissaIntervento(pid) {
    const p = (this.crmList || []).find(x => x.id === pid);
    if (!p) return;
    this.selectedCRMInterventoId = pid;

    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`.trim();
    document.getElementById('crm-aur-paziente-id').value = pid;
    document.getElementById('crm-aur-nome').value = nomeCompleto;

    let dataDef = '';
    let oraDef = '09:00';
    if (p.data_operazione) {
      const parts = p.data_operazione.split(' ');
      dataDef = parts[0] || '';
      if (parts[1]) oraDef = parts[1].slice(0, 5);
    } else {
      // Default: prossima settimana
      const d = new Date();
      d.setDate(d.getDate() + 7);
      dataDef = d.toISOString().split('T')[0];
    }

    document.getElementById('crm-aur-data').value = dataDef;
    document.getElementById('crm-aur-ora').value = oraDef;
    document.getElementById('crm-aur-note').value = '';

    const btn = document.getElementById('btn-conferma-crm-aurea');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Salva Data Intervento';
    }

    document.getElementById('modal-crm-fissa-aurea').classList.add('open');
  },

  async confermaFissaIntervento() {
    const pid = this.selectedCRMInterventoId;
    const p = (this.crmList || []).find(x => x.id === pid);
    if (!p) return;

    const dataOp = document.getElementById('crm-aur-data').value;
    const oraOp = document.getElementById('crm-aur-ora').value;
    const noteOp = document.getElementById('crm-aur-note').value.trim();

    if (!dataOp) {
      alert('Seleziona la data dell\'intervento.');
      return;
    }

    const btn = document.getElementById('btn-conferma-crm-aurea');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvataggio in corso...';
    }

    const strDataOra = oraOp ? `${dataOp} ${oraOp}` : dataOp;
    const now = new Date();
    const dd_today = String(now.getDate()).padStart(2, '0');
    const mm_today = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy_today = now.getFullYear();
    const oggiFormatted = `${dd_today}/${mm_today}/${yyyy_today}`;

    const dataParts = dataOp.split('-');
    const dataOpFormatted = dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : dataOp;

    const nuovaNota = `[${oggiFormatted}] Fissato intervento Clinica Aurea per il ${dataOpFormatted}${oraOp ? ' ore ' + oraOp : ''}${noteOp ? ' (' + noteOp + ')' : ''}`;
    const noteAggiornate = p.note_crm ? `${p.note_crm}\n${nuovaNota}` : nuovaNota;

    try {
      await api.aggiornaCRM(pid, {
        stato: 'operazione_pianificata',
        priorita: 'alta',
        operazione_pianificata: 1,
        data_operazione: strDataOra,
        note_crm: noteAggiornate,
        data_ultimo_contatto: new Date().toISOString().split('T')[0]
      });

      document.getElementById('modal-crm-fissa-aurea').classList.remove('open');
      showToast(`✓ Intervento Clinica Aurea fissato per il ${dataOpFormatted}!`, 'success');
      await this.loadCRMData();
    } catch (e) {
      alert('Errore salvataggio intervento: ' + e.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Salva Data Intervento';
      }
    }
  },

  apriModaleAggiornamento(pid) {
    const p = this.crmList.find(x => x.id === pid);
    if (!p) return;
    this.selectedCRMId = pid;

    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`;
    document.getElementById('crm-mod-nome').value = nomeCompleto;
    document.getElementById('crm-mod-stato').value = p.stato || 'preventivo_inviato';
    document.getElementById('crm-mod-priorita').value = p.priorita || 'normale';
    document.getElementById('crm-mod-data-followup').value = p.data_prossimo_followup || '';
    document.getElementById('crm-mod-note').value = p.note_crm || '';

    document.getElementById('modal-update-crm').classList.add('open');
  },

  async salvaStatoCRM() {
    if (!this.selectedCRMId) return;

    const p = (this.crmList || []).find(x => x.id === this.selectedCRMId) || {};
    const stato = document.getElementById('crm-mod-stato').value;
    const priorita = document.getElementById('crm-mod-priorita').value;
    const dataFollowup = document.getElementById('crm-mod-data-followup').value || null;
    const note = document.getElementById('crm-mod-note').value.trim();

    try {
      await api.aggiornaCRM(this.selectedCRMId, {
        stato,
        priorita,
        data_prossimo_followup: dataFollowup,
        note_crm: note,
        data_ultimo_contatto: new Date().toISOString().split('T')[0],
        operazione_pianificata: p.operazione_pianificata,
        data_operazione: p.data_operazione,
        preventivo_inviato: p.preventivo_inviato,
        importo_preventivo: p.importo_preventivo
      });

      showToast('Stato CRM aggiornato su D1');
      document.getElementById('modal-update-crm').classList.remove('open');
      this.loadCRMData();
    } catch (e) {
      showToast('Errore salvataggio CRM: ' + e.message, 'error');
    }
  }
};

window.CRMView = CRMView;
