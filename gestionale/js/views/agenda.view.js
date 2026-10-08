/**
 * Vista Agenda Giornaliera (Calendly Live Sync & Datepicker Libero)
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';

export const AgendaView = {
  currentDateISO: new Date().toISOString().split('T')[0],

  init() {
    this.renderContainer();
    this.bindEvents();
    this.loadAgenda(this.currentDateISO);
  },

  renderContainer() {
    const container = document.getElementById('view-agenda');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Header Controlli Data & Datepicker -->
        <div class="card" style="padding:16px;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px;">
            
            <div style="display:flex; align-items:center; gap:8px;">
              <button id="agenda-prev-day" class="btn btn-secondary btn-icon-only" title="Giorno precedente">
                <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              
              <button id="agenda-today-btn" class="btn btn-secondary btn-sm">Oggi</button>
              
              <button id="agenda-next-day" class="btn btn-secondary btn-icon-only" title="Giorno successivo">
                <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>

            <!-- Datepicker Libero per qualsiasi giorno -->
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-muted);">Data:</span>
              <input type="date" id="agenda-datepicker" class="form-input form-input-mono" style="width:160px; padding:6px 10px; font-size:12px;" value="${this.currentDateISO}">
              <div id="agenda-label-giorno" style="font-size:13px; font-weight:600; color:var(--text-primary);"></div>
            </div>

            <!-- Indicatori Veloci -->
            <div style="display:flex; align-items:center; gap:16px; font-size:12px;">
              <div>
                <span style="color:var(--text-muted);">Pazienti: </span>
                <strong id="agenda-count-pazienti" class="font-mono-code">0</strong>
              </div>
              <button id="agenda-refresh-btn" class="btn btn-secondary btn-sm" title="Ricarica da Calendly">
                <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span>Sincronizza</span>
              </button>
            </div>

          </div>
        </div>

        <!-- Tabella Appuntamenti -->
        <div class="table-container">
          <table class="clinical-table">
            <thead>
              <tr>
                <th style="width:90px;">Orario</th>
                <th>Paziente & Recapiti</th>
                <th>Tipo Prestazione</th>
                <th>Note Anamnestiche (Calendly)</th>
                <th style="text-align:right; width:220px;">Azioni Rapide</th>
              </tr>
            </thead>
            <tbody id="agenda-table-body">
              <tr>
                <td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted);">
                  Caricamento appuntamenti da Calendly in corso...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    `;
  },

  bindEvents() {
    const dateInput = document.getElementById('agenda-datepicker');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        this.currentDateISO = e.target.value;
        this.loadAgenda(this.currentDateISO);
      });
    }

    const prevBtn = document.getElementById('agenda-prev-day');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.shiftDay(-1));
    }

    const nextBtn = document.getElementById('agenda-next-day');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.shiftDay(1));
    }

    const todayBtn = document.getElementById('agenda-today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.currentDateISO = new Date().toISOString().split('T')[0];
        document.getElementById('agenda-datepicker').value = this.currentDateISO;
        this.loadAgenda(this.currentDateISO);
      });
    }

    const refreshBtn = document.getElementById('agenda-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadAgenda(this.currentDateISO));
    }
  },

  shiftDay(delta) {
    const d = new Date(this.currentDateISO + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    this.currentDateISO = d.toISOString().split('T')[0];
    document.getElementById('agenda-datepicker').value = this.currentDateISO;
    this.loadAgenda(this.currentDateISO);
  },

  formatDateLabel(iso) {
    const d = new Date(iso + 'T12:00:00');
    const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const str = d.toLocaleDateString('it-IT', opts);
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  async loadAgenda(dateISO) {
    const tbody = document.getElementById('agenda-table-body');
    const countEl = document.getElementById('agenda-count-pazienti');
    const labelEl = document.getElementById('agenda-label-giorno');

    if (labelEl) labelEl.textContent = this.formatDateLabel(dateISO);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">Sincronizzazione appuntamenti Calendly per il ${dateISO}...</td></tr>`;
    }

    try {
      const data = await api.getAgenda(dateISO);
      const appts = data.appointments || [];
      state.appointments = appts;
      if (appts.some(a => a.paziente_id)) window.PazientiView?.loadPazienti(true);
      if (countEl) countEl.textContent = appts.length;

      if (!appts.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
              Nessun appuntamento in programma per questa data su Calendly.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = appts.map(a => {
        const phoneClean = (a.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
        const isAurea = (a.tipo || '').toLowerCase().includes('fenolizzazione') || (a.tipo || '').toLowerCase().includes('aurea');
        const badgeClass = isAurea ? 'badge-teal' : 'badge-neutral';
        const badgeLabel = isAurea ? 'Clinica Aurea: Fenolizzazione' : (a.tipo || 'Prima Visita');

        return `
          <tr>
            <td style="font-weight:600; font-size:13px;" class="font-mono-code">${a.ora || '—'}</td>
            <td>
              <div style="font-weight:600; font-size:13px; color:var(--text-primary);">${a.nome || 'Paziente'}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${a.email ? `<span>${a.email}</span> · ` : ''}
                <span class="font-mono-code">${a.telefono || 'Tel non specificato'}</span>
              </div>
            </td>
            <td>
              <span class="badge ${badgeClass}">${badgeLabel}</span>
            </td>
            <td>
              <div style="font-size:11px; color:var(--text-secondary); max-width:320px; line-height:1.4;">
                ${a.note ? a.note : '<span style="color:var(--border-strong);">Nessuna nota aggiuntiva</span>'}
              </div>
            </td>
            <td style="text-align:right;">
              <div style="display:inline-flex; align-items:center; gap:6px;">
                ${phoneClean ? `
                  <button onclick="window.AgendaView.openWhatsAppModal('${encodeURIComponent(a.nome).replace(/'/g, '%27')}', '${phoneClean}', '${a.ora}', ${isAurea})" class="btn btn-whatsapp btn-sm" title="Invia messaggio WhatsApp">
                    WhatsApp
                  </button>
                ` : ''}
                <button onclick="window.AgendaView.apriPazienteDaAgenda('${encodeURIComponent(JSON.stringify(a)).replace(/'/g, '%27')}')" class="btn btn-primary btn-sm">
                  Cartella Clinica
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--status-danger-text);">Errore durante la lettura da Calendly: ${err.message}</td></tr>`;
      }
    }
  },

  openWhatsAppModal(nomeEnc, phone, ora, isAurea = false) {
    const nome = decodeURIComponent(nomeEnc);
    const defaultMsg = isAurea
      ? `Gentile ${nome}, le confermo l'intervento di fenolizzazione programmato per oggi alle ore ${ora} presso la Clinica Aurea (Via Pietro Palmieri 50, Torino). Le ricordiamo di aver compilato il modulo dei consensi informati prima dell'accesso (https://www.unghiaincarnitastop.com/consensi/). Cordiali saluti, Dott. Federico Grassi`
      : `Gentile ${nome}, le confermo il suo appuntamento per la visita podologica oggi alle ore ${ora} presso lo Studio del Dott. Federico Grassi (Via Filadelfia 200, Torino). Cordiali saluti.`;
    
    // Prompt o editor rapido modificabile prima dell'invio
    const msg = prompt(`Messaggio WhatsApp per ${nome} (puoi modificarlo prima dell'invio):`, defaultMsg);
    if (msg !== null && msg.trim()) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg.trim())}`, '_blank');
    }
  },

  async apriPazienteDaAgenda(rawJsonEnc) {
    const raw = JSON.parse(decodeURIComponent(rawJsonEnc));
    const extraCalendly = { note: raw.note, tipo: raw.tipo, ora: raw.ora, calendly_event_id: raw.id || '', calendly_data: this.currentDateISO };
    const isAurea = (raw.tipo || '').toLowerCase().includes('fenolizzazione') || (raw.tipo || '').toLowerCase().includes('aurea');

    // Paziente non collegato all'archivio (es. Calendly senza email/telefono): comportamento precedente
    if (!raw.paziente_id) {
      state.setActivePatient({
        nome: raw.nome,
        email: raw.email,
        telefono: raw.telefono,
        ...extraCalendly
      });
      window.app.navigate('pazienti');
      return;
    }

    // Paziente già in archivio (collegato/creato automaticamente dal Worker)
    window.app.navigate('pazienti');
    const PV = window.PazientiView;
    try {
      await PV.loadPazienti();
      await PV.selezionaPazienteById(raw.paziente_id, extraCalendly);
      if (PV.selectedPatient && PV.selectedPatient.id === raw.paziente_id) {
        state.activePatient = PV.selectedPatient;
      }
    } catch (e) {
      showToast('Errore apertura cartella: ' + e.message, 'error');
      return;
    }

    if (isAurea) {
      const crm = (PV.selectedPatient && PV.selectedPatient.crm) || {};
      if (crm.stato !== 'operazione_pianificata' && crm.stato !== 'completato') {
        api.aggiornaCRM(raw.paziente_id, {
          ...crm,
          stato: 'operazione_pianificata',
          operazione_pianificata: 1,
          note_crm: 'Paziente prenotato su Calendly per intervento Clinica Aurea.'
        }).then(() => window.CRMView?.loadCRMData()).catch(console.error);
      }
    }
  }
};

window.AgendaView = AgendaView;
