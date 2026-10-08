/**
 * Vista Preventivo Fenolizzazione (Sconto 30gg & Clinica Aurea)
 * Studio Podologico Dott. Federico Grassi — UnghiaIncarnitaStop
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';
import { generatePreventivoHTML, convertHtmlToPdfBase64 } from '../pdf-templates.js';
import { parseImporto } from '../visite.js';

export const PreventivoView = {
  // Listino Ufficiale di Default (modificabile liberamente da Federico)
  LISTINO_DEFAULT: {
    mono: 850,
    bi: 950,
    '2dita_mono': 1200,
    '2dita_bi': 1500
  },

  ditaSede: '',
  dueSeduteSeparate: false,
  pazientiDB: [],

  init() {
    this.renderContainer();
    this.bindEvents();
    this.caricaDatalistPazienti();

    state.on('patientSelected', (p) => {
      this.precompilaDaPaziente(p);
    });
  },

  async caricaDatalistPazienti() {
    try {
      const data = await api.getPazienti();
      this.pazientiDB = data.pazienti || [];
      const dl = document.getElementById('prev-pazienti-datalist');
      if (dl) {
        dl.innerHTML = this.pazientiDB.map(p => {
          const nomeCompl = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`.trim();
          return `<option value="${nomeCompl}">${p.telefono ? 'Tel: ' + p.telefono : ''} ${p.email ? '· ' + p.email : ''}</option>`;
        }).join('');
      }
    } catch (_) {}
  },

  renderContainer() {
    const container = document.getElementById('view-preventivo');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width:880px; margin:0 auto; display:flex; flex-direction:column; gap:20px;">
        
        <div class="card">
          <div class="card-header">
            <div>
              <span class="card-title">Configuratore Preventivo Intervento di Fenolizzazione</span>
              <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">
                Intervento eseguito presso <strong>Clinica Aurea — Via Pietro Palmieri, 50, Torino</strong>
              </span>
            </div>
            <span class="badge badge-teal">Deduzione Prima Visita entro 30gg</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
            
            <!-- Configurazione Parametri a Sinistra -->
            <div style="display:flex; flex-direction:column; gap:14px;">
              
              <div class="form-group">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <label class="form-label" style="margin-bottom:0;">Paziente</label>
                  <span style="font-size:10.5px; color:var(--text-muted);">Digita libero o seleziona da D1</span>
                </div>
                <input type="text" id="prev-nome" list="prev-pazienti-datalist" class="form-input" placeholder="Nome e Cognome Paziente">
                <datalist id="prev-pazienti-datalist"></datalist>
              </div>

              <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:10px;">
                <div class="form-group">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label class="form-label" style="margin-bottom:0;">Email Destinatario</label>
                    <button type="button" onclick="window.PreventivoView.impostaEmailTest()" class="btn btn-ghost" style="padding:0; font-size:11px; color:#0f766e; text-decoration:underline; cursor:pointer; border:none; background:none;">
                      Usa mia email di test
                    </button>
                  </div>
                  <input type="email" id="prev-email" class="form-input" placeholder="paziente@email.com o tua per test" style="margin-top:4px;">
                </div>
                <div class="form-group">
                  <label class="form-label">Telefono (WhatsApp)</label>
                  <input type="tel" id="prev-telefono" class="form-input form-input-mono" placeholder="+39 338 1234567">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Tipologia Trattamento</label>
                <select id="prev-tipo-select" class="form-select">
                  <option value="mono">Fenolizzazione Monolaterale Lamina (Default: € 850,00)</option>
                  <option value="bi">Fenolizzazione Bilaterale Lamina (Default: € 950,00)</option>
                  <option value="2dita_mono">Fenolizzazione 2 Dita — Monolaterale (Default: € 1.200,00)</option>
                  <option value="2dita_bi">Fenolizzazione 2 Dita — Bilaterale (Default: € 1.500,00)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Sede Anatomica & Dita Coinvolte</label>
                <input type="text" id="prev-sede-input" class="form-input" placeholder="Es. Piede DX - I Dito (Bilaterale); Piede SX - I Dito (Bilaterale)">
                <span style="font-size:10px; color:var(--text-muted);">Acquisita dal selettore clinico o digitabile liberamente</span>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label">Prezzo Totale Trattamento (€)</label>
                  <input type="number" id="prev-prezzo-operazione" class="form-input form-input-mono" value="850" min="0" step="10">
                  <span style="font-size:10px; color:var(--text-muted);">Modificabile liberamente</span>
                </div>

                <div class="form-group">
                  <label class="form-label">Deduzione Visita (€)</label>
                  <input type="number" id="prev-sconto-visita" class="form-input form-input-mono" value="100" min="0" step="10">
                  <span style="font-size:10px; color:var(--text-muted);">Valido se prenota entro 30gg</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Note Cliniche Speciali (Opzionale)</label>
                <textarea id="prev-note" rows="2" class="form-textarea" placeholder="Indicazioni post-visita o accordi con il paziente..."></textarea>
              </div>

            </div>

            <!-- Prospetto di Anteprima Modificabile a Destra -->
            <div style="background-color:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:18px; display:flex; flex-direction:column; justify-content:space-between;">
              
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:8px; margin-bottom:12px;">
                  <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-primary);">Prospetto Economico Ufficiale</span>
                  <span class="font-mono-code" style="font-size:11px; color:var(--text-muted);">Clinica Aurea</span>
                </div>

                <div style="font-size:12px; line-height:1.7; color:var(--text-secondary);">
                  <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span>Trattamento previsto:</span>
                    <strong id="prev-disp-trattamento" style="color:var(--text-primary);">Fenolizzazione Monolaterale</strong>
                  </div>
                  <div id="prev-disp-dita-sede" style="font-size:11px; color:var(--teal-primary); font-weight:600; margin-bottom:8px; display:none;"></div>

                  <!-- Conteggio e Voci Separatamente (Regola Obbligatoria) -->
                  <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:10px 12px; margin:8px 0 10px; display:flex; flex-direction:column; gap:5px;">
                    <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-secondary);">
                      <span>• Anestesista dedicato:</span>
                      <span class="font-mono-code" style="font-weight:600; color:var(--text-primary);">€ 150,00</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-secondary);">
                      <span>• Sala chirurgica (Clinica Aurea):</span>
                      <span class="font-mono-code" style="font-weight:600; color:var(--text-primary);">€ 100,00</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:600; color:var(--text-primary); border-top:1px dashed var(--border-subtle); padding-top:6px;">
                      <span>• Trattamento di fenolizzazione:</span>
                      <span class="font-mono-code" id="prev-disp-quota-fenolizzazione" style="color:var(--teal-primary);">€ 600,00</span>
                    </div>
                  </div>

                  <div style="display:flex; justify-content:space-between; font-weight:600; color:var(--text-primary);">
                    <span>Totale complessivo trattamento:</span>
                    <span class="font-mono-code" id="prev-disp-lordo">€ 850,00</span>
                  </div>

                  <div style="display:flex; justify-content:space-between; color:var(--status-success-text); font-weight:600; margin-top:4px;">
                    <span>Deduzione prima visita (entro 30gg):</span>
                    <span class="font-mono-code" id="prev-disp-sconto">− € 100,00</span>
                  </div>

                  <hr style="border:none; border-top:1px solid var(--border-subtle); margin:10px 0;">

                  <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--text-primary);">
                    <span>Saldo Netto Effettivo:</span>
                    <span class="font-mono-code" id="prev-disp-netto" style="color:var(--teal-primary);">€ 750,00</span>
                  </div>

                  <!-- Alert Bilaterale 2 Dita: 2 Sedute Separate -->
                  <div id="prev-disp-alert-sedute" style="display:none; margin-top:12px; padding:10px 12px; background:var(--status-warning-bg); border:1px solid var(--status-warning-border); border-radius:var(--radius-sm); font-size:11.5px; color:var(--status-warning-text); line-height:1.4;">
                    <strong>Programmazione in 2 Sedute Separate:</strong> Rilevato caso bilaterale su due dita distinte.
                    I trattamenti sono normalmente programmati in due sedute differenti (non contemporaneamente), salvo diversa indicazione del professionista.
                  </div>

                  <p style="font-size:10px; color:var(--text-muted); margin-top:10px; line-height:1.4;">
                    * Regime forfettario - esente IVA (art. 1 c. 54-89 L. 190/2014).<br>
                    Include anestesia locale specialistica, matricectomia chimica mediante fenolo, medicazioni e controlli post-operatori.
                  </p>
                </div>
              </div>

              <!-- Azioni Invio & Stampa con Editor Anteprima -->
              <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">
                <button onclick="window.PreventivoView.apriEditorAnteprimaInvio()" class="btn btn-primary" style="width:100%;">
                  <span>Verifica Testo & Invia via Email (Resend)</span>
                </button>
                <button onclick="window.PreventivoView.stampaPreventivoPDF()" class="btn btn-secondary" style="width:100%;">
                  <span>Stampa Copia Cartacea Ufficiale</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    `;
  },

  bindEvents() {
    const sel = document.getElementById('prev-tipo-select');
    const inputLordo = document.getElementById('prev-prezzo-operazione');
    const inputSconto = document.getElementById('prev-sconto-visita');
    const inputSede = document.getElementById('prev-sede-input');
    const inputNome = document.getElementById('prev-nome');

    if (sel) {
      sel.addEventListener('change', (e) => {
        const val = e.target.value;
        const defaultPrezzo = this.LISTINO_DEFAULT[val] || 850;
        inputLordo.value = defaultPrezzo;
        this.ricalcolaTotali();
      });
    }

    if (inputLordo) inputLordo.addEventListener('input', () => this.ricalcolaTotali());
    if (inputSconto) inputSconto.addEventListener('input', () => this.ricalcolaTotali());
    
    if (inputSede) {
      inputSede.addEventListener('input', (e) => {
        this.ditaSede = e.target.value.trim();
        const dispSede = document.getElementById('prev-disp-dita-sede');
        if (dispSede) {
          dispSede.textContent = this.ditaSede ? `Sede: ${this.ditaSede}` : '';
          dispSede.style.display = this.ditaSede ? 'block' : 'none';
        }
      });
    }

    if (inputNome) {
      inputNome.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (this.pazientiDB && this.pazientiDB.length) {
          const found = this.pazientiDB.find(p => {
            const full = `${p.cognome || ''} ${p.nome || ''}`.trim().toLowerCase();
            return full === val;
          });
          if (found) {
            state.setActivePatient(found);
            this.precompilaDaPaziente(found);
          }
        }
      });
    }
  },

  precompilaDaPaziente(p) {
    if (!p) return;
    const nomeEl = document.getElementById('prev-nome');
    const emailEl = document.getElementById('prev-email');
    const telEl = document.getElementById('prev-telefono');
    const scontoEl = document.getElementById('prev-sconto-visita');
    const selEl = document.getElementById('prev-tipo-select');
    const inputLordo = document.getElementById('prev-prezzo-operazione');
    const sedeInput = document.getElementById('prev-sede-input');

    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`.trim();
    if (nomeEl) nomeEl.value = nomeCompleto;
    if (emailEl) emailEl.value = p.email || '';
    if (telEl) telEl.value = p.telefono || '';
    if (scontoEl && p.primaVisitaVersata) {
      scontoEl.value = p.primaVisitaVersata;
    }

    // Configurazione automatica da diagnosi / dita selezionate
    if (p.trattamentoConsigliato && selEl) {
      selEl.value = p.trattamentoConsigliato;
      if (inputLordo) {
        inputLordo.value = this.LISTINO_DEFAULT[p.trattamentoConsigliato] || 850;
      }
    }

    if (p.descrizioneDita) {
      this.ditaSede = p.descrizioneDita;
      if (sedeInput) sedeInput.value = this.ditaSede;
      const dispSede = document.getElementById('prev-disp-dita-sede');
      if (dispSede) {
        dispSede.textContent = `Sede: ${this.ditaSede}`;
        dispSede.style.display = 'block';
      }
    }

    this.dueSeduteSeparate = Boolean(p.dueSeduteSeparate);
    this.ricalcolaTotali();
  },

  ricalcolaTotali() {
    const sel = document.getElementById('prev-tipo-select');
    const lordo = parseFloat(document.getElementById('prev-prezzo-operazione').value) || 850;
    const sconto = parseFloat(document.getElementById('prev-sconto-visita').value) || 0;
    const netto = Math.max(0, lordo - sconto);

    // Scorporo 3 voci obbligatorie: Anestesista (150€), Sala (100€), Trattamento fenolizzazione (restante)
    const costoAnestesista = 150;
    const costoSala = 100;
    const quotaFenolizzazione = Math.max(0, lordo - (costoAnestesista + costoSala));

    const labelMap = {
      mono: 'Fenolizzazione Monolaterale',
      bi: 'Fenolizzazione Bilaterale',
      '2dita_mono': 'Fenolizzazione 2 Dita — Monolaterale',
      '2dita_bi': 'Fenolizzazione 2 Dita — Bilaterale'
    };

    const dispTratt = document.getElementById('prev-disp-trattamento');
    const dispQuotaFenolo = document.getElementById('prev-disp-quota-fenolizzazione');
    const dispLordo = document.getElementById('prev-disp-lordo');
    const dispSconto = document.getElementById('prev-disp-sconto');
    const dispNetto = document.getElementById('prev-disp-netto');
    const alertSedute = document.getElementById('prev-disp-alert-sedute');

    if (dispTratt && sel) dispTratt.textContent = labelMap[sel.value] || 'Fenolizzazione';
    if (dispQuotaFenolo) dispQuotaFenolo.textContent = `€ ${quotaFenolizzazione.toFixed(2)}`;
    if (dispLordo) dispLordo.textContent = `€ ${lordo.toFixed(2)}`;
    if (dispSconto) dispSconto.textContent = `− € ${sconto.toFixed(2)}`;
    if (dispNetto) dispNetto.textContent = `€ ${netto.toFixed(2)}`;

    // Se 2 dita bilaterale o flag attivo, mostra alert 2 sedute separate
    const isDueSedute = sel && (sel.value === '2dita_bi' || this.dueSeduteSeparate);
    if (alertSedute) {
      alertSedute.style.display = isDueSedute ? 'block' : 'none';
    }
  },

  async assicuratiPazienteRegistrato() {
    if (state.activePatient && state.activePatient.id) {
      return state.activePatient;
    }
    const nomeInput = document.getElementById('prev-nome')?.value.trim();
    if (!nomeInput) return null;

    const email = document.getElementById('prev-email')?.value.trim() || '';
    const telefono = document.getElementById('prev-telefono')?.value.trim() || '';

    // Se esiste già per nome nel database, collegalo
    if (this.pazientiDB && this.pazientiDB.length) {
      const match = this.pazientiDB.find(p => {
        const full = `${p.cognome || ''} ${p.nome || ''}`.trim().toLowerCase();
        return full === nomeInput.toLowerCase() || (email && p.email && p.email.toLowerCase() === email.toLowerCase());
      });
      if (match) {
        state.setActivePatient(match);
        return match;
      }
    }

    // Altrimenti salvalo su D1 al volo
    const parti = nomeInput.split(' ');
    const cognome = parti.length > 1 ? parti.slice(1).join(' ') : parti[0];
    const nome = parti.length > 1 ? parti[0] : '';

    try {
      const res = await api.creaPaziente({
        nome: nome || cognome,
        cognome: nome ? cognome : 'Paziente',
        email: email || null,
        telefono: telefono || null
      });
      const newP = { id: res.id, nome: nome || cognome, cognome: nome ? cognome : 'Paziente', email, telefono };
      state.setActivePatient(newP);
      this.caricaDatalistPazienti();
      return newP;
    } catch (e) {
      console.warn('Auto-registrazione paziente D1:', e);
      return null;
    }
  },

  apriEditorAnteprimaInvio() {
    const nome = document.getElementById('prev-nome').value.trim() || 'Gentile Paziente';
    const lordo = parseFloat(document.getElementById('prev-prezzo-operazione').value) || 850;
    const sconto = parseFloat(document.getElementById('prev-sconto-visita').value) || 0;
    const netto = Math.max(0, lordo - sconto);
    const sel = document.getElementById('prev-tipo-select').value;
    const desc = document.getElementById('prev-disp-trattamento').textContent;
    const sede = document.getElementById('prev-sede-input')?.value.trim() || this.ditaSede || '';

    const costoAnestesista = 150;
    const costoSala = 100;
    const quotaFenolizzazione = Math.max(0, lordo - (costoAnestesista + costoSala));
    const isDueSedute = sel === '2dita_bi' || this.dueSeduteSeparate;

    const subject = `Preventivo Trattamento di Fenolizzazione — Dott. Federico Grassi`;
    const notaDueSedute = isDueSedute ? `\nPROGRAMMAZIONE CLINICA:\nTrattandosi di onicocriptosi bilaterale interessante due dita distinte, i trattamenti sono normalmente programmati in due sedute operatorie differenti (non contemporaneamente), salvo diversa indicazione esplicita del Dott. Federico Grassi.\n` : '';

    const sedeDitaStr = sede ? `\nSede anatomica valutata: ${sede}\n` : '';

    const body = `Gentile ${nome},\n\nfacendo seguito alla valutazione clinica svolta in studio, le rimettiamo il prospetto economico per il trattamento di fenolizzazione (${desc}).${sedeDitaStr}\nL'intervento verrà eseguito presso la Clinica Aurea, sita in Via Pietro Palmieri 50, Torino.\n\nCOMPOSIZIONE ECONOMICA DEL PREVENTIVO:\n• Trattamento di fenolizzazione: € ${quotaFenolizzazione.toFixed(2)}\n• Anestesista dedicato in sala: € ${costoAnestesista.toFixed(2)}\n• Sala chirurgica (Clinica Aurea): € ${costoSala.toFixed(2)}\n--------------------------------------------------\nTotale complessivo trattamento: € ${lordo.toFixed(2)}\n• Deduzione prima visita (entro 30 giorni): − € ${sconto.toFixed(2)}\nSALDO NETTO EFFETTIVO: € ${netto.toFixed(2)}\n${notaDueSedute}\nISTRUZIONI PER LA PRENOTAZIONE E CONSENSI:\nPer confermare l'intervento e scegliere la data, utilizzi il seguente link dedicato:\nhttps://calendly.com/federico-grassi-unghiaincarnitastop/trattamento-per-unghia-incarnita-aurea\n\nPrima dell'intervento è obbligatorio compilare il modulo di consenso informato all'indirizzo:\nhttps://www.unghiaincarnitastop.com/consensi/\n\nRestiamo a sua completa disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nDott. Federico Grassi — Podologo\nVia Filadelfia 200, Torino · Tel. +39 333 421 7550`;

    document.getElementById('prev-edit-subject').value = subject;
    document.getElementById('prev-edit-body').value = body;

    const emailPaziente = document.getElementById('prev-email')?.value.trim() || state.activePatient?.email || '';
    const modalEmail = document.getElementById('prev-modal-email');
    if (modalEmail) modalEmail.value = emailPaziente;
    const modalSender = document.getElementById('prev-modal-sender');
    if (modalSender) modalSender.value = 'preventivi@unghiaincarnitastop.com';

    document.getElementById('modal-editor-preventivo').classList.add('open');
  },

  async confermaInvioEmail() {
    const modalEmail = document.getElementById('prev-modal-email');
    const email = (modalEmail ? modalEmail.value.trim() : '') || document.getElementById('prev-email')?.value.trim();
    if (!email || !email.includes('@')) {
      showToast('Inserisci un indirizzo email valido (del paziente o la tua per il test)', 'error');
      if (modalEmail) modalEmail.focus();
      return;
    }

    const sender = document.getElementById('prev-modal-sender')?.value || 'preventivi@unghiaincarnitastop.com';

    const btn = document.getElementById('btn-conferma-invio-prev');
    if (btn) {
      btn.disabled = true;
      btn.textContent = `Generazione PDF e invio (${sender})...`;
    }

    const subject = document.getElementById('prev-edit-subject').value;
    const body = document.getElementById('prev-edit-body').value;

    let attachments = [];
    try {
      showToast('Generazione PDF preventivo con timbro e firma...');
      const nomePaziente = document.getElementById('prev-nome')?.value.trim() || 'Paziente';
      const lordo = parseFloat(document.getElementById('prev-prezzo-operazione')?.value) || 850;
      const sconto = parseFloat(document.getElementById('prev-sconto-visita')?.value) || 0;
      const sel = document.getElementById('prev-tipo-select')?.value || 'mono';
      const sede = document.getElementById('prev-sede-input')?.value.trim() || this.ditaSede || '';
      const htmlPrev = generatePreventivoHTML({
        paziente: nomePaziente,
        trattamento: sel,
        importo: lordo,
        visitaPagata: sconto,
        scontoVisita: sconto > 0,
        ditaSede: sede,
        dueSeduteSeparate: sel === '2dita_bi' || this.dueSeduteSeparate
      });
      const filename = `Preventivo_Fenolizzazione_${nomePaziente.replace(/[^\w.-]/g, '_')}.pdf`;
      const base64Pdf = await convertHtmlToPdfBase64(htmlPrev, filename);
      attachments.push({ filename, content: base64Pdf });
    } catch (errPdf) {
      console.warn('PDF preventivo non generato, invio solo corpo messaggio:', errPdf);
    }

    try {
      showToast(`Invio email preventivo in corso (${sender})...`);
      await api.inviaEmailDocumento({
        to: email,
        from: sender,
        subject,
        html: `<div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; white-space:pre-wrap; line-height:1.65; font-size:13.5px; color:#1e293b; max-width:620px; margin:0 auto; padding:22px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff;">${body}</div>`,
        attachments
      });

      // Assicurati che il paziente esista su D1 e aggiorna CRM
      const p = await this.assicuratiPazienteRegistrato();
      if (p && p.id) {
        const oggi = new Date();
        const dataInvio = oggi.toISOString().split('T')[0];
        const d30 = new Date(oggi);
        d30.setDate(d30.getDate() + 30);
        const dataScadenza30gg = d30.toISOString().split('T')[0];
        const d7 = new Date(oggi);
        d7.setDate(d7.getDate() + 7);
        const dataFollowup7gg = d7.toISOString().split('T')[0];
        const nettoVal = parseImporto(document.getElementById('prev-disp-netto').textContent) || 0;

        await api.aggiornaCRM(p.id, {
          stato: 'preventivo_inviato',
          priorita: 'alta',
          preventivo_inviato: 1,
          importo_preventivo: nettoVal,
          data_ultimo_contatto: dataInvio,
          data_prossimo_followup: dataFollowup7gg,
          note_crm: `Preventivo inviato via email (saldo € ${nettoVal.toFixed(2)}). Sconto 30gg valido fino al ${dataScadenza30gg}.`
        }).catch(console.error);

        window.CRMView?.loadCRMData();
      }

      showToast(`Preventivo inviato con successo a ${email} con PDF allegato!`, 'success');
      document.getElementById('modal-editor-preventivo').classList.remove('open');
    } catch (e) {
      showToast('Errore durante l\'invio: ' + e.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Conferma e Invia Email al Paziente';
      }
    }
  },

  impostaEmailTest() {
    const testEmail = localStorage.getItem('test_owner_email') || 'ilmiocoachonline@gmail.com';
    const emailInp = document.getElementById('prev-email');
    if (emailInp) {
      emailInp.value = testEmail;
      emailInp.focus();
    }
    showToast(`Email di test impostata: ${testEmail}`);
  },

  impostaEmailTestModal() {
    const testEmail = localStorage.getItem('test_owner_email') || 'ilmiocoachonline@gmail.com';
    const emailInp = document.getElementById('prev-modal-email');
    if (emailInp) {
      emailInp.value = testEmail;
      emailInp.focus();
    }
    showToast(`Email di test impostata: ${testEmail}`);
  },

  async stampaPreventivoPDF() {
    const nome = document.getElementById('prev-nome').value.trim() || 'Paziente';
    const email = document.getElementById('prev-email').value.trim();
    const lordo = parseFloat(document.getElementById('prev-prezzo-operazione').value) || 850;
    const sconto = parseFloat(document.getElementById('prev-sconto-visita').value) || 0;
    const sel = document.getElementById('prev-tipo-select').value;
    const desc = document.getElementById('prev-note')?.value || '';
    const sede = document.getElementById('prev-sede-input')?.value.trim() || this.ditaSede || '';
    const isDueSedute = sel === '2dita_bi' || this.dueSeduteSeparate;

    showToast('Apertura stampa preventivo con timbro e logo...');
    try {
      // Assicurati che il paziente esista su D1 e aggiorna CRM
      const p = await this.assicuratiPazienteRegistrato();
      if (p && p.id) {
        const oggi = new Date();
        const dataInvio = oggi.toISOString().split('T')[0];
        const d30 = new Date(oggi);
        d30.setDate(d30.getDate() + 30);
        const dataScadenza30gg = d30.toISOString().split('T')[0];
        const d7 = new Date(oggi);
        d7.setDate(d7.getDate() + 7);
        const dataFollowup7gg = d7.toISOString().split('T')[0];
        const nettoVal = Math.max(0, lordo - sconto);

        api.aggiornaCRM(p.id, {
          stato: 'preventivo_inviato',
          priorita: 'alta',
          preventivo_inviato: 1,
          importo_preventivo: nettoVal,
          data_ultimo_contatto: dataInvio,
          data_prossimo_followup: dataFollowup7gg,
          note_crm: `Preventivo consegnato cartaceo in studio (saldo € ${nettoVal.toFixed(2)}). Sconto 30gg valido fino al ${dataScadenza30gg}.`
        }).catch(console.error);

        window.CRMView?.loadCRMData();
      }

      const html = generatePreventivoHTML({
        paziente: { nome, email },
        trattamento: sel,
        importo: lordo,
        visitaPagata: sconto,
        scontoVisita: sconto > 0,
        descrizione: desc,
        ditaSede: sede,
        dueSeduteSeparate: isDueSedute
      });

      if (html) {
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 350);
      }
    } catch (e) {
      showToast('Errore generazione preventivo: ' + e.message, 'error');
    }
  }
};

window.PreventivoView = PreventivoView;
