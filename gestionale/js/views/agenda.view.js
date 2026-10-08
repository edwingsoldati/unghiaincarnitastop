/**
 * Vista Agenda Giornaliera (Calendly Live Sync & Datepicker Libero)
 * Include visualizzazione oraria dinamica: evidenziazione paziente attuale / prossimo,
 * compattazione appuntamenti passati e toggle "Mostra tutti".
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';

export const AgendaView = {
  currentDateISO: new Date().toISOString().split('T')[0],
  mostraTutti: false,
  lastAppointments: [],
  _timerInterval: null,

  init() {
    this.currentDateISO = this.getTodayISORoma();
    this.renderContainer();
    this.bindEvents();
    this.startAutoRefreshTimer();
    this.loadAgenda(this.currentDateISO);
  },

  getTodayISORoma() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  },

  getNowMinutiRoma() {
    const d = new Date();
    const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
    return this.parseMinuti(timeStr);
  },

  parseMinuti(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  },

  startAutoRefreshTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      // Aggiorna la vista dinamica solo se siamo nella data di oggi e abbiamo appuntamenti caricati
      if (this.currentDateISO === this.getTodayISORoma() && this.lastAppointments && this.lastAppointments.length) {
        this.renderTableAppointments(this.lastAppointments);
      }
    }, 30000); // Ricalcola ogni 30 secondi a costo zero (senza chiamate di rete)
  },

  toggleMostraTutti() {
    this.mostraTutti = !this.mostraTutti;
    this.renderTableAppointments(this.lastAppointments);
  },

  renderContainer() {
    const container = document.getElementById('view-agenda');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        
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

            <!-- Indicatori Veloci e Controlli Vista -->
            <div style="display:flex; align-items:center; gap:12px; font-size:12px;">
              <div>
                <span style="color:var(--text-muted);">Pazienti: </span>
                <strong id="agenda-count-pazienti" class="font-mono-code">0</strong>
              </div>

              <!-- Pulsante Mostra tutti / Vista compatta -->
              <button id="agenda-toggle-filtro-btn" class="btn btn-secondary btn-sm" style="display:none;" onclick="window.AgendaView.toggleMostraTutti()">
                Mostra tutti
              </button>

              <button id="agenda-refresh-btn" class="btn btn-secondary btn-sm" title="Ricarica da Calendly">
                <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span>Sincronizza</span>
              </button>
            </div>

          </div>
        </div>

        <!-- Avviso appuntamenti precedenti nascosti (in vista compatta) -->
        <div id="agenda-passati-notice" style="display:none; padding:10px 14px; background:var(--bg-surface); border:1px dashed var(--border-light); border-radius:8px; font-size:12px; color:var(--text-secondary); align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--teal-primary); font-size:14px;">⏱</span>
            <span id="agenda-notice-text">Fascia oraria attiva · appuntamenti precedenti nascosti</span>
          </div>
          <button onclick="window.AgendaView.toggleMostraTutti()" class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 10px;">
            Mostra tutti
          </button>
        </div>

        <!-- Tabella Appuntamenti -->
        <div class="table-container">
          <table class="clinical-table">
            <thead>
              <tr>
                <th style="width:110px;">Orario</th>
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
        this.currentDateISO = this.getTodayISORoma();
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

  calcolaStatiAppuntamenti(appts, isToday) {
    if (!isToday || !appts || !appts.length) {
      return appts.map(a => ({ appt: a, status: 'normale' }));
    }

    const nowMin = this.getNowMinutiRoma();

    const parsed = appts.map(a => {
      const inizio = this.parseMinuti(a.ora);
      const fine = this.parseMinuti(a.oraFine) || (inizio !== null ? inizio + 30 : null);
      return { appt: a, inizio, fine };
    });

    // 1. Cerca il paziente nella fascia oraria corrente: inizio <= now < fine
    let idxCorrente = parsed.findIndex(p => p.inizio !== null && p.fine !== null && p.inizio <= nowMin && nowMin < p.fine);

    // 2. Se non c'è una fascia attuale, cerca il primo prossimo futuro: inizio > now
    let idxProssimo = -1;
    if (idxCorrente === -1) {
      idxProssimo = parsed.findIndex(p => p.inizio !== null && p.inizio > nowMin);
    }

    // Indice di riferimento (quello che separa passato da presente/futuro)
    const idxTarget = idxCorrente !== -1 ? idxCorrente : (idxProssimo !== -1 ? idxProssimo : parsed.length);

    // Indice dell'unico appuntamento precedente da mostrare (l'ultimo prima di idxTarget)
    const idxPrecedenteVisibile = idxTarget > 0 ? idxTarget - 1 : -1;

    return parsed.map((p, idx) => {
      let status = 'futuro';
      if (idx === idxCorrente) {
        status = 'corrente';
      } else if (idx === idxProssimo) {
        status = 'prossimo';
      } else if (idx < idxTarget) {
        if (idx === idxPrecedenteVisibile) {
          status = 'precedente';
        } else {
          status = 'passato_nascosto';
        }
      } else {
        status = 'futuro';
      }
      return { appt: p.appt, status };
    });
  },

  async loadAgenda(dateISO) {
    const tbody = document.getElementById('agenda-table-body');
    const countEl = document.getElementById('agenda-count-pazienti');
    const labelEl = document.getElementById('agenda-label-giorno');

    const isToday = (dateISO === this.getTodayISORoma());
    // Se passiamo a un giorno diverso da oggi, mostra sempre tutti gli appuntamenti
    if (!isToday) {
      this.mostraTutti = true;
    } else {
      // Per la giornata odierna parte in modalità compatta focalizzata
      this.mostraTutti = false;
    }

    if (labelEl) labelEl.textContent = this.formatDateLabel(dateISO);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">Sincronizzazione appuntamenti Calendly per il ${dateISO}...</td></tr>`;
    }

    try {
      const data = await api.getAgenda(dateISO);
      const appts = data.appointments || [];
      this.lastAppointments = appts;
      state.appointments = appts;
      if (appts.some(a => a.paziente_id)) window.PazientiView?.loadPazienti(true);
      if (countEl) countEl.textContent = appts.length;

      this.renderTableAppointments(appts);

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--status-danger-text);">Errore durante la lettura da Calendly: ${err.message}</td></tr>`;
      }
    }
  },

  renderTableAppointments(appts) {
    const tbody = document.getElementById('agenda-table-body');
    const toggleBtn = document.getElementById('agenda-toggle-filtro-btn');
    const noticeEl = document.getElementById('agenda-passati-notice');
    const noticeTxt = document.getElementById('agenda-notice-text');
    if (!tbody) return;

    if (!appts || !appts.length) {
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (noticeEl) noticeEl.style.display = 'none';
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
            Nessun appuntamento in programma per questa data su Calendly.
          </td>
        </tr>
      `;
      return;
    }

    const isToday = (this.currentDateISO === this.getTodayISORoma());
    const stati = this.calcolaStatiAppuntamenti(appts, isToday);

    const passatiNascostiCount = stati.filter(s => s.status === 'passato_nascosto').length;

    // Gestione pulsante e banner per appuntamenti passati nascosti
    if (isToday && passatiNascostiCount > 0) {
      if (toggleBtn) {
        toggleBtn.style.display = 'inline-flex';
        toggleBtn.className = this.mostraTutti ? 'btn btn-dark btn-sm' : 'btn btn-secondary btn-sm';
        toggleBtn.innerHTML = this.mostraTutti
          ? '<span>↩ Vista compatta</span>'
          : `<span>👁️ Mostra tutti (${appts.length})</span>`;
      }
      if (noticeEl) {
        if (!this.mostraTutti) {
          noticeEl.style.display = 'flex';
          const nTxt = passatiNascostiCount === 1 ? '1 appuntamento precedente nascosto' : `${passatiNascostiCount} appuntamenti precedenti nascosti`;
          if (noticeTxt) noticeTxt.textContent = `Fascia oraria attiva · ${nTxt}`;
        } else {
          noticeEl.style.display = 'none';
        }
      }
    } else {
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (noticeEl) noticeEl.style.display = 'none';
    }

    tbody.innerHTML = stati.map(({ appt: a, status }) => {
      const phoneClean = (a.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
      const isAurea = (a.tipo || '').toLowerCase().includes('fenolizzazione') || (a.tipo || '').toLowerCase().includes('aurea');
      const badgeClass = isAurea ? 'badge-teal' : 'badge-neutral';
      const badgeLabel = isAurea ? 'Clinica Aurea: Fenolizzazione' : (a.tipo || 'Prima Visita');

      // ── CASO A: FASCIA ORARIA ATTUALE (PAZIENTE ATTUALE) ───────────────────
      if (status === 'corrente') {
        return `
          <tr class="agenda-row-corrente" style="background:#f0fdfa; border:2px solid #0f766e; border-left:6px solid #0f766e; box-shadow:0 4px 14px rgba(15,118,110,0.14);">
            <td style="vertical-align:top;" class="font-mono-code">
              <div style="font-weight:800; font-size:16px; color:#0f766e; line-height:1.2;">${a.ora || '—'}</div>
              <span class="badge" style="background:#0f766e; color:#ffffff; font-weight:700; font-size:10px; margin-top:4px; display:inline-block; padding:2px 6px; border-radius:4px; letter-spacing:0.3px;">ORA</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-weight:700; font-size:16px; color:#0f172a;">${a.nome || 'Paziente'}</div>
              <div style="font-size:12px; color:#475569; margin-top:2px;">
                ${a.email ? `<span>${a.email}</span> · ` : ''}
                <span class="font-mono-code" style="color:#0f766e; font-weight:600;">${a.telefono || 'Tel non specificato'}</span>
              </div>
            </td>
            <td style="vertical-align:top;">
              <span class="badge ${badgeClass}">${badgeLabel}</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:12px; color:#1e293b; background:#ffffff; border:1px solid #ccfbf1; border-radius:8px; padding:6px 10px; max-width:320px; line-height:1.4;">
                ${a.note ? a.note : '<span style="color:#94a3b8;">Nessuna nota aggiuntiva</span>'}
              </div>
            </td>
            <td style="text-align:right; vertical-align:middle;">
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
      }

      // ── CASO B: PROSSIMO APPUNTAMENTO IN ARRIVO ─────────────────────────────
      if (status === 'prossimo') {
        return `
          <tr class="agenda-row-prossimo" style="background:#ffffff; border:1.5px solid #0f766e; border-left:5px solid #0f766e;">
            <td style="vertical-align:top;" class="font-mono-code">
              <div style="font-weight:700; font-size:15px; color:#0f766e;">${a.ora || '—'}</div>
              <span class="badge" style="background:#ccfbf1; color:#0f766e; font-weight:700; font-size:10px; margin-top:3px; display:inline-block; padding:2px 6px;">PROSSIMO</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-weight:600; font-size:15px; color:var(--text-primary);">${a.nome || 'Paziente'}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${a.email ? `<span>${a.email}</span> · ` : ''}
                <span class="font-mono-code">${a.telefono || 'Tel non specificato'}</span>
              </div>
            </td>
            <td style="vertical-align:top;">
              <span class="badge ${badgeClass}">${badgeLabel}</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:11px; color:var(--text-secondary); max-width:320px; line-height:1.4;">
                ${a.note ? a.note : '<span style="color:var(--border-strong);">Nessuna nota aggiuntiva</span>'}
              </div>
            </td>
            <td style="text-align:right; vertical-align:middle;">
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
      }

      // ── CASO C: APPUNTAMENTO PRECEDENTE IMMEDIATO (MENO EVIDENTE) ──────────
      if (status === 'precedente') {
        return `
          <tr class="agenda-row-precedente" style="opacity:0.62; background:var(--bg-main);">
            <td style="vertical-align:top;" class="font-mono-code">
              <div style="font-weight:600; font-size:14px; color:var(--text-muted);">${a.ora || '—'}</div>
              <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:2px;">(precedente)</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-weight:600; font-size:14px; color:var(--text-secondary);">${a.nome || 'Paziente'}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${a.email ? `<span>${a.email}</span> · ` : ''}
                <span class="font-mono-code">${a.telefono || 'Tel non specificato'}</span>
              </div>
            </td>
            <td style="vertical-align:top;">
              <span class="badge ${badgeClass}" style="opacity:0.8;">${badgeLabel}</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:11px; color:var(--text-muted); max-width:320px; line-height:1.4;">
                ${a.note ? a.note : '<span style="color:var(--border-strong);">Nessuna nota aggiuntiva</span>'}
              </div>
            </td>
            <td style="text-align:right; vertical-align:middle;">
              <div style="display:inline-flex; align-items:center; gap:6px;">
                ${phoneClean ? `
                  <button onclick="window.AgendaView.openWhatsAppModal('${encodeURIComponent(a.nome).replace(/'/g, '%27')}', '${phoneClean}', '${a.ora}', ${isAurea})" class="btn btn-whatsapp btn-sm" title="Invia messaggio WhatsApp">
                    WhatsApp
                  </button>
                ` : ''}
                <button onclick="window.AgendaView.apriPazienteDaAgenda('${encodeURIComponent(JSON.stringify(a)).replace(/'/g, '%27')}')" class="btn btn-secondary btn-sm">
                  Cartella Clinica
                </button>
              </div>
            </td>
          </tr>
        `;
      }

      // ── CASO D: APPUNTAMENTI PASSATI PIÙ VECCHI (NASCOSTI IN COMPATTA) ──────
      if (status === 'passato_nascosto') {
        const rowStyle = (!this.mostraTutti)
          ? 'display:none;'
          : 'opacity:0.55; background:var(--bg-main);';

        return `
          <tr class="agenda-row-passato" style="${rowStyle}">
            <td style="font-weight:500; font-size:13px; color:var(--text-muted); vertical-align:top;" class="font-mono-code">
              <div>${a.ora || '—'}</div>
              <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:2px;">(passato)</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-weight:600; font-size:13px; color:var(--text-secondary);">${a.nome || 'Paziente'}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${a.email ? `<span>${a.email}</span> · ` : ''}
                <span class="font-mono-code">${a.telefono || 'Tel non specificato'}</span>
              </div>
            </td>
            <td style="vertical-align:top;">
              <span class="badge ${badgeClass}" style="opacity:0.7;">${badgeLabel}</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:11px; color:var(--text-muted); max-width:320px; line-height:1.4;">
                ${a.note ? a.note : '<span style="color:var(--border-strong);">Nessuna nota aggiuntiva</span>'}
              </div>
            </td>
            <td style="text-align:right; vertical-align:middle;">
              <div style="display:inline-flex; align-items:center; gap:6px;">
                ${phoneClean ? `
                  <button onclick="window.AgendaView.openWhatsAppModal('${encodeURIComponent(a.nome).replace(/'/g, '%27')}', '${phoneClean}', '${a.ora}', ${isAurea})" class="btn btn-whatsapp btn-sm" title="Invia messaggio WhatsApp">
                    WhatsApp
                  </button>
                ` : ''}
                <button onclick="window.AgendaView.apriPazienteDaAgenda('${encodeURIComponent(JSON.stringify(a)).replace(/'/g, '%27')}')" class="btn btn-secondary btn-sm">
                  Cartella Clinica
                </button>
              </div>
            </td>
          </tr>
        `;
      }

      // ── CASO E: STANDARD (FUTURO O GIORNATA DIVERSA DA OGGI) ────────────────
      return `
        <tr>
          <td style="font-weight:600; font-size:14px; vertical-align:top;" class="font-mono-code">${a.ora || '—'}</td>
          <td style="vertical-align:top;">
            <div style="font-weight:600; font-size:14px; color:var(--text-primary);">${a.nome || 'Paziente'}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
              ${a.email ? `<span>${a.email}</span> · ` : ''}
              <span class="font-mono-code">${a.telefono || 'Tel non specificato'}</span>
            </div>
          </td>
          <td style="vertical-align:top;">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:11px; color:var(--text-secondary); max-width:320px; line-height:1.4;">
              ${a.note ? a.note : '<span style="color:var(--border-strong);">Nessuna nota aggiuntiva</span>'}
            </div>
          </td>
          <td style="text-align:right; vertical-align:middle;">
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
