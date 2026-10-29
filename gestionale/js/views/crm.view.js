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
    `;
  },

  setFiltro(stato) {
    this.filtroCorrente = stato;
    const buttons = ['tutti_preventivi', 'in_attesa_pagamento', 'pagati', 'operazione_pianificata', 'tutti', 'da_richiamare', 'completato'];
    buttons.forEach(b => {
      const btn = document.getElementById('crm-flt-' + b);
      if (btn) {
        btn.className = (b === stato) ? 'btn btn-dark btn-sm' : 'btn btn-secondary btn-sm';
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

          <div style="display:flex; align-items:center; gap:8px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">
            ${(!p.ha_pagato && p.ha_preventivo) ? `
              <button onclick="window.CRMView.inviaLinkStripeCRM(${p.id}, ${p.importo_preventivo || 850})" class="btn btn-sm" style="background:#635bff; color:#fff; border:1px solid #635bff; font-weight:600; display:flex; align-items:center; gap:4px;" title="Crea o invia il link Stripe con 3 rate Klarna per € ${p.importo_preventivo || 850}">
                💳 Invia Link Klarna (€ ${p.importo_preventivo || 850})
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
            <button onclick="window.CRMView.apriModaleAggiornamento(${p.id})" class="btn btn-secondary btn-sm">
              ✏️ Note / Stato
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
        data_ultimo_contatto: new Date().toISOString().split('T')[0]
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
