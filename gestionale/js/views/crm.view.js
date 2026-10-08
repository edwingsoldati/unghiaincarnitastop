/**
 * Vista CRM Pipeline & WhatsApp Follow-up (Tracciamento 30gg Preventivi Clinica Aurea)
 * Studio Podologico Dott. Federico Grassi — UnghiaIncarnitaStop
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';

export const CRMView = {
  filtroCorrente: 'tutti',
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
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-subtle); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div>
            <strong style="font-size:13px; color:var(--text-primary); display:block;">Pipeline Pazienti & Tracciamento Sconto 30gg</strong>
            <span style="font-size:11px; color:var(--text-muted);">
              Monitoraggio automatico dei preventivi emessi per la Clinica Aurea e promemoria WhatsApp prima della scadenza.
            </span>
          </div>
          <button onclick="window.CRMView.loadCRMData()" class="btn btn-secondary btn-sm">
            Aggiorna Pipeline
          </button>
        </div>

        <!-- Filtri Pipeline -->
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button onclick="window.CRMView.setFiltro('tutti')" id="crm-flt-tutti" class="btn btn-dark btn-sm">Tutti</button>
          <button onclick="window.CRMView.setFiltro('preventivo_inviato')" id="crm-flt-preventivo_inviato" class="btn btn-secondary btn-sm">Preventivi Aperti (30gg)</button>
          <button onclick="window.CRMView.setFiltro('da_richiamare')" id="crm-flt-da_richiamare" class="btn btn-secondary btn-sm">Da Richiamare</button>
          <button onclick="window.CRMView.setFiltro('in_attesa')" id="crm-flt-in_attesa" class="btn btn-secondary btn-sm">In Attesa Risposta</button>
          <button onclick="window.CRMView.setFiltro('operazione_pianificata')" id="crm-flt-operazione_pianificata" class="btn btn-secondary btn-sm">Chirurgia Pianificata (Aurea)</button>
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
    const buttons = ['tutti', 'preventivo_inviato', 'da_richiamare', 'in_attesa', 'operazione_pianificata', 'completato'];
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

    let filtered = this.crmList;
    if (this.filtroCorrente !== 'tutti') {
      filtered = this.crmList.filter(p => (p.stato || 'da_richiamare') === this.filtroCorrente);
    }

    if (!filtered.length) {
      container.innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-muted); font-size:12px;">Nessun paziente in questa categoria di follow-up.</div>`;
      return;
    }

    const statoLabels = {
      da_richiamare: { label: 'Da Richiamare', cls: 'badge-danger' },
      in_attesa: { label: 'In Attesa Risposta', cls: 'badge-warning' },
      preventivo_inviato: { label: 'Preventivo Inviato', cls: 'badge-teal' },
      operazione_pianificata: { label: 'Chirurgia Pianificata', cls: 'badge-neutral' },
      completato: { label: 'Completato', cls: 'badge-success' }
    };

    container.innerHTML = filtered.map(p => {
      const st = statoLabels[p.stato] || { label: p.stato || 'Da richiamare', cls: 'badge-neutral' };
      const phoneClean = (p.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
      const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || 'Paziente'}`;

      let scadenzaHtml = '';
      let giorniRimanentiSconto = null;
      let badgeLabel = st.label;
      let badgeCls = st.cls;

      // Logica avanzata per preventivi inviati (validità 30 giorni)
      if (p.stato === 'preventivo_inviato') {
        const dataRif = p.data_ultimo_contatto || p.ultima_visita;
        if (dataRif) {
          const dt = new Date(dataRif + 'T12:00:00');
          const giorniPassati = Math.floor((new Date() - dt) / 86400000);
          giorniRimanentiSconto = 30 - giorniPassati;

          if (giorniRimanentiSconto > 7) {
            badgeLabel = `Preventivo Inviato (${giorniRimanentiSconto} gg rimasti)`;
            badgeCls = 'badge-teal';
            scadenzaHtml = `<span style="color:var(--status-success-text); font-weight:600; font-size:11px;">Sconto 30gg attivo (ancora ${giorniRimanentiSconto} giorni)</span>`;
          } else if (giorniRimanentiSconto >= 0) {
            badgeLabel = `In Scadenza: ${giorniRimanentiSconto} gg rimasti!`;
            badgeCls = 'badge-warning';
            scadenzaHtml = `<span style="color:var(--status-warning-text); font-weight:700; font-size:11px;">Attenzione: mancano solo ${giorniRimanentiSconto} giorni alla scadenza dello sconto prima visita</span>`;
          } else {
            badgeLabel = `Sconto 30gg Scaduto (-${Math.abs(giorniRimanentiSconto)} gg)`;
            badgeCls = 'badge-danger';
            scadenzaHtml = `<span style="color:var(--status-danger-text); font-weight:700; font-size:11px;">Sconto 30gg SCADUTO da ${Math.abs(giorniRimanentiSconto)} giorni</span>`;
          }
        }
      } else if (p.data_prossimo_followup) {
        const diff = Math.round((new Date(p.data_prossimo_followup) - new Date()) / 86400000);
        if (diff < 0) scadenzaHtml = `<span style="color:var(--status-danger-text); font-weight:600; font-size:11px;">Scaduto da ${Math.abs(diff)} giorni</span>`;
        else if (diff === 0) scadenzaHtml = `<span style="color:var(--status-warning-text); font-weight:600; font-size:11px;">Scadenza Oggi</span>`;
        else scadenzaHtml = `<span style="color:var(--text-muted); font-size:11px;">Richiamo tra ${diff} giorni</span>`;
      }

      return `
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:13px; color:var(--text-primary);">${nomeCompleto}</strong>
              <span class="badge ${badgeCls}">${badgeLabel}</span>
              ${p.importo_preventivo ? `<span class="badge badge-neutral font-mono-code">Saldo: € ${p.importo_preventivo}</span>` : ''}
            </div>

            <div style="font-size:11px; color:var(--text-secondary); margin-top:4px; line-height:1.5;">
              <span>Tel: <strong class="font-mono-code">${p.telefono || '—'}</strong></span> · 
              <span>Data riferimento: ${p.data_ultimo_contatto ? p.data_ultimo_contatto.slice(0,10) : (p.ultima_visita ? p.ultima_visita.slice(0,10) : '—')}</span>
              ${scadenzaHtml ? ` · ${scadenzaHtml}` : ''}
            </div>

            ${p.note_crm ? `
              <div style="font-size:11px; color:var(--text-primary); background:var(--bg-subtle); padding:6px 10px; border-radius:var(--radius-sm); margin-top:6px; max-width:600px;">
                ${p.note_crm}
              </div>
            ` : ''}
          </div>

          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            ${phoneClean ? `
              <button onclick="window.CRMView.apriWhatsAppDialog('${encodeURIComponent(nomeCompleto)}', '${phoneClean}', '${p.stato || ''}', ${giorniRimanentiSconto})" class="btn btn-whatsapp btn-sm">
                WhatsApp
              </button>
            ` : ''}
            ${p.stato === 'operazione_pianificata' ? `
              <button onclick="window.CRMView.apriDimissioni(${p.id})" class="btn btn-primary btn-sm" title="Lettera di dimissioni per il medico curante">
                Dimissioni
              </button>
            ` : ''}
            <button onclick="window.CRMView.apriModaleAggiornamento(${p.id})" class="btn btn-secondary btn-sm">
              Aggiorna Stato
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Lettera di dimissioni direttamente dal Follow-up (paziente in "Operazione pianificata")
  apriDimissioni(id) {
    const p = (this.crmList || []).find(x => x.id === id);
    if (!p || !window.DocumentiView) return;
    window.DocumentiView.apriDocumentoPrecompilato('dimissioni', p);
  },

  apriWhatsAppDialog(nomeEnc, phone, stato, giorniRimanentiSconto = null) {
    const nome = decodeURIComponent(nomeEnc);
    let defaultMsg = `Buongiorno ${nome}, la contatto dallo Studio Podologico del Dott. Federico Grassi riguardo al suo percorso per l'unghia incarnita. Volevo sapere come procede la situazione clinica. Cordiali saluti.`;
    
    if (stato === 'preventivo_inviato') {
      if (giorniRimanentiSconto !== null && giorniRimanentiSconto <= 7 && giorniRimanentiSconto >= 0) {
        defaultMsg = `Buongiorno ${nome}, le scrivo dallo Studio del Dott. Federico Grassi per ricordarle che il preventivo per l'intervento di fenolizzazione con la deduzione della prima visita scade tra ${giorniRimanentiSconto} giorni. Se desidera confermare la data dell'intervento presso la Clinica Aurea, può accedere direttamente al calendario qui: https://calendly.com/federico-grassi-unghiaincarnitastop/trattamento-per-unghia-incarnita-aurea. Restiamo a disposizione per qualsiasi chiarimento.`;
      } else if (giorniRimanentiSconto !== null && giorniRimanentiSconto < 0) {
        defaultMsg = `Buongiorno ${nome}, le scrivo dallo Studio del Dott. Federico Grassi. Il termine dei 30 giorni per la deduzione della prima visita è terminato, ma se desidera comunque programmare l'intervento di fenolizzazione alla Clinica Aurea restiamo a sua completa disposizione. Cordiali saluti.`;
      } else {
        const ggStr = (giorniRimanentiSconto !== null) ? ` (validità residua della deduzione: ${giorniRimanentiSconto} giorni)` : '';
        defaultMsg = `Buongiorno ${nome}, le scrivo dallo Studio del Dott. Federico Grassi riguardo al preventivo rilasciato per l'intervento di fenolizzazione alla Clinica Aurea. Volevo verificare come procede il dolore e se avesse dubbi sul percorso${ggStr}. Può scegliere la data su Calendly da qui: https://calendly.com/federico-grassi-unghiaincarnitastop/trattamento-per-unghia-incarnita-aurea. Cordiali saluti.`;
      }
    }

    const msg = prompt(`Messaggio WhatsApp per ${nome} (modificabile prima dell'invio):`, defaultMsg);
    if (msg !== null && msg.trim()) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg.trim())}`, '_blank');
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
