/**
 * Vista Documenti Sanitari Ufficiali (Anteprima Modificabile & FattureInCloud)
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';
import { registraFenolizzazione, oggiLocale } from '../visite.js';
import {
  generateRicevutaHTML,
  generateAttestoPresenzaHTML,
  generateAttestoSportHTML,
  generateLetteraDimissioniHTML,
  TERAPIA_DIMISSIONI_DEFAULT,
  generateBozzaFatturaHTML,
  convertHtmlToPdfBase64,
  generatePdfDocument,
  generateEmailCoverHTML
} from '../pdf-templates.js';

// "I Dito (Alluce)" + "Piede Destro (DX)" + "Monolaterale – bordo laterale" → "alluce destro, bordo laterale"
function descriviDito(d) {
  const m = String(d.dito || '').match(/\(([^)]+)\)/);
  const dito = m ? m[1].toLowerCase() : String(d.dito || '').trim();
  const lato = /sinistr/i.test(d.piede) ? 'sinistro' : /destr/i.test(d.piede) ? 'destro' : String(d.piede || '').toLowerCase();
  const tipo = String(d.tipo || '').split(/\s[–-]\s/).pop().trim().toLowerCase();
  return [dito + (lato ? ' ' + lato : ''), tipo].filter(Boolean).join(', ');
}

export const DocumentiView = {
  currentDocType: null,

  init() {
    this.renderContainer();
  },

  renderContainer() {
    const container = document.getElementById('view-documenti');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px; max-width:960px; margin:0 auto;">
        
        <div class="card">
          <div class="card-header">
            <div>
              <span class="card-title">Emissione Documenti Sanitari Ufficiali</span>
              <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">
                Tutti i documenti includono intestazione, logo UnghiaIncarnitaStop e timbro professionale Dott. Federico Grassi.
              </span>
            </div>
            <span class="badge badge-neutral">Anteprima Modificabile Pre-Stampa</span>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
            
            <!-- 1. Ricevuta Visita -->
            <div class="card" style="background:var(--bg-subtle);">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">1. Ricevuta Sanitaria Visita</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 14px; line-height:1.4;">
                Attestazione di pagamento per prima visita podologica o trattamento conservativo con dicitura regime forfettario L. 190/2014.
              </p>
              <button onclick="window.DocumentiView.apriDocumentoPrecompilato('ricevuta')" class="btn btn-primary btn-sm" style="width:100%;">
                Compila Ricevuta
              </button>
            </div>

            <!-- 2. Attestato Presenza -->
            <div class="card" style="background:var(--bg-subtle);">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">2. Attestato di Presenza (Lavoro/Scuola)</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 14px; line-height:1.4;">
                Giustificativo di presenza con orario di ingresso Calendly e orario di uscita inserito liberamente da Federico.
              </p>
              <button onclick="window.DocumentiView.apriDocumentoPrecompilato('presenza')" class="btn btn-primary btn-sm" style="width:100%;">
                Compila Attestato Presenza
              </button>
            </div>

            <!-- 3. Esenzione Sport -->
            <div class="card" style="background:var(--bg-subtle);">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">3. Esenzione Attività Motoria Scolastica</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 14px; line-height:1.4;">
                Certificato per scuola con indicazione alluce (dx/sx/bilat) ed esenzione sportiva (15 giorni o date personalizzate).
              </p>
              <button onclick="window.DocumentiView.apriDocumentoPrecompilato('sport')" class="btn btn-primary btn-sm" style="width:100%;">
                Compila Esenzione Sport
              </button>
            </div>

            <!-- 4. Lettera Dimissioni Aurea (Predisposizione) -->
            <div class="card" style="background:var(--bg-subtle);">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">4. Lettera di Dimissioni (Clinica Aurea)</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 14px; line-height:1.4;">
                Per il medico curante, dopo l'intervento: diagnosi, trattamento in équipe con il Dott. Lazzari e terapia post trattamento.
              </p>
              <button onclick="window.DocumentiView.apriDocumentoPrecompilato('dimissioni')" class="btn btn-primary btn-sm" style="width:100%;">
                Compila Lettera Dimissioni
              </button>
            </div>

            <!-- 5. FattureInCloud -->
            <div class="card" style="background:var(--bg-subtle);">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">5. Fatturazione Elettronica (FIC)</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 14px; line-height:1.4;">
                Crea bozza di fattura elettronica su FattureInCloud al momento dell'effettivo pagamento della visita o dell'intervento.
              </p>
              <button onclick="window.DocumentiView.apriModaleFatturaFIC()" class="btn btn-dark btn-sm" style="width:100%;">
                Crea Bozza su FattureInCloud
              </button>
            </div>

          </div>
        </div>

      </div>
    `;
  },

  apriDocumentoPrecompilato(tipo, patient) {
    this.currentDocType = tipo;
    const p = patient || state.activePatient || { nome: 'Paziente', ora: '15:00' };
    this.currentDocPatient = p;
    const modal = document.getElementById('modal-editor-documento');
    const title = document.getElementById('doc-modal-title');
    const body = document.getElementById('doc-modal-body');

    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`;
    const todayISO = new Date().toISOString().split('T')[0];

    const headerCampiHTML = `
      <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:10px; margin-bottom:12px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Paziente (Intestatario)</label>
          <input type="text" id="doc-inp-nome" class="form-input" value="${nomeCompleto}">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="form-label" style="margin-bottom:0;">Email Destinatario</label>
            <button type="button" onclick="window.DocumentiView.impostaEmailTest()" class="btn btn-ghost" style="padding:0; font-size:11px; color:#0f766e; text-decoration:underline; cursor:pointer; border:none; background:none;">
              Usa mia email di test
            </button>
          </div>
          <input type="email" id="doc-inp-email" class="form-input" value="${p.email || ''}" placeholder="paziente@email.com o tua per test" style="margin-top:4px;">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Mittente Email (Resend)</label>
        <select id="doc-inp-sender" class="form-select">
          <option value="segreteria@unghiaincarnitastop.com" selected>
            Segreteria — segreteria@unghiaincarnitastop.com (Attestati, Ricevute, Dimissioni)
          </option>
          <option value="preventivi@unghiaincarnitastop.com">
            Preventivi — preventivi@unghiaincarnitastop.com (Preventivo Intervento)
          </option>
        </select>
      </div>
    `;

    if (tipo === 'ricevuta') {
      title.textContent = 'Emissione Ricevuta Sanitaria';
      body.innerHTML = `
        ${headerCampiHTML}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Importo Quietanzato (€)</label>
            <input type="number" id="doc-inp-importo" class="form-input form-input-mono" value="${p.importo || p.ultimaVisitaImporto || 100}">
          </div>
          <div class="form-group">
            <label class="form-label">Data Ricevuta</label>
            <input type="date" id="doc-inp-data" class="form-input form-input-mono" value="${todayISO}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descrizione Prestazione (modificabile)</label>
          <input type="text" id="doc-inp-desc" class="form-input" value="Visita podologica e trattamento diagnostico per onicocriptosi">
        </div>
      `;
    } else if (tipo === 'presenza') {
      title.textContent = 'Emissione Attestato di Presenza';
      body.innerHTML = `
        ${headerCampiHTML}
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Data Visita</label>
            <input type="date" id="doc-inp-data" class="form-input form-input-mono" value="${todayISO}">
          </div>
          <div class="form-group">
            <label class="form-label">Dalle Ore (Calendly)</label>
            <input type="time" id="doc-inp-ora-in" class="form-input form-input-mono" value="${p.ora || '15:00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Alle Ore (uscita libera)</label>
            <input type="time" id="doc-inp-ora-out" class="form-input form-input-mono" value="15:45">
          </div>
        </div>
      `;
    } else if (tipo === 'sport') {
      title.textContent = 'Emissione Attestato Esenzione Sportiva Scolastica';
      body.innerHTML = `
        ${headerCampiHTML}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Alluce Interessato</label>
            <select id="doc-inp-lato" class="form-select">
              <option value="destro">Alluce destro</option>
              <option value="sinistro">Alluce sinistro</option>
              <option value="bilateralmente">Bilateralmente</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data Inizio Esenzione</label>
            <input type="date" id="doc-inp-data-inizio" class="form-input form-input-mono" value="${todayISO}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Periodo di Astensione Consigliato</label>
          <input type="text" id="doc-inp-durata" class="form-input" value="15 giorni a decorrere dalla data odierna">
        </div>
      `;
    } else if (tipo === 'dimissioni') {
      title.textContent = 'Lettera di Dimissioni — Clinica Aurea';
      body.innerHTML = `
        ${headerCampiHTML}
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Data intervento</label>
            <input type="date" id="doc-inp-dim-data" class="form-input form-input-mono" value="${oggiLocale()}">
          </div>
          <div class="form-group">
            <label class="form-label">Diagnosi <span id="doc-dim-diagnosi-hint" style="font-weight:400; color:var(--text-muted);"></span></label>
            <input type="text" id="doc-inp-dim-diagnosi" class="form-input" placeholder="Es. Onicocriptosi alluce destro, bordo laterale — stadio II">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Eventuale prognosi <span style="font-weight:400; color:var(--text-muted);">(se vuota non compare nel PDF)</span></label>
          <input type="text" id="doc-inp-dim-prognosi" class="form-input" placeholder="Es. 7 giorni salvo complicazioni">
        </div>
        <div class="form-group">
          <label class="form-label">Terapia post trattamento, si suggerisce: <span style="font-weight:400; color:var(--text-muted);">(una voce per riga)</span></label>
          <textarea id="doc-inp-dim-terapia" rows="4" class="form-textarea" style="font-size:12px; line-height:1.5;">${TERAPIA_DIMISSIONI_DEFAULT}</textarea>
        </div>
        <div style="font-size:11px; color:var(--text-muted); line-height:1.5;">
          Testo fisso: visita anestesiologica e trattamento in équipe con il Dott. Antonio Lazzari, onicectomia parziale in anestesia tronculare,
          prima medicazione da concordare con il Dr. Grassi, numero urgenze. Firme: Dott. Lazzari + timbro Dott. Grassi.
        </div>
      `;
      this._precompilaDiagnosi(p);
    }

    modal.classList.add('open');
  },

  // ─── PIPELINE PDF UNICA: stesso binario per anteprima, download, stampa ed email ───

  // Raccoglie i dati del form e costruisce l'HTML del documento dai template di pdf-templates.js
  _buildDocumentoCorrente() {
    const nome = document.getElementById('doc-inp-nome')?.value.trim() || 'Paziente';
    const oggi = new Date().toISOString().split('T')[0];
    const doc = {
      nome,
      htmlDoc: null,
      subject: 'Documento Sanitario — Dott. Federico Grassi',
      filename: `Documento_Sanitario_${nome.replace(/[^\w.-]/g, '_')}.pdf`,
      dataDocumento: oggi,
      dettagliExtra: []
    };

    if (this.currentDocType === 'ricevuta') {
      const importo = parseFloat(document.getElementById('doc-inp-importo')?.value) || 100;
      const desc = document.getElementById('doc-inp-desc')?.value || 'Visita podologica e trattamento diagnostico';
      const dataDoc = document.getElementById('doc-inp-data')?.value || oggi;
      doc.dataDocumento = dataDoc;
      doc.htmlDoc = generateRicevutaHTML({ paziente: nome, importo, descrizione: desc, data: dataDoc });
      doc.subject = `Ricevuta Sanitaria Visita — ${nome}`;
      doc.filename = `Ricevuta_Sanitaria_${nome.replace(/[^\w.-]/g, '_')}.pdf`;
      doc.dettagliExtra = [
        { label: 'Importo Quietanzato', value: `€ ${importo.toFixed(2)}` },
        { label: 'Descrizione Prestazione', value: desc }
      ];
    } else if (this.currentDocType === 'presenza') {
      const dataVisita = document.getElementById('doc-inp-data')?.value || oggi;
      const oraInizio = document.getElementById('doc-inp-ora-in')?.value || '15:00';
      const oraFine = document.getElementById('doc-inp-ora-out')?.value || '15:45';
      doc.dataDocumento = dataVisita;
      doc.htmlDoc = generateAttestoPresenzaHTML({ paziente: nome, dataVisita, oraInizio, oraFine });
      doc.subject = `Attestato di Presenza Visita — ${nome}`;
      doc.filename = `Attestato_Presenza_${nome.replace(/[^\w.-]/g, '_')}.pdf`;
      doc.dettagliExtra = [
        { label: 'Data Visita', value: dataVisita },
        { label: 'Fascia Oraria', value: `Dalle ore ${oraInizio} alle ore ${oraFine}` }
      ];
    } else if (this.currentDocType === 'sport') {
      const lato = document.getElementById('doc-inp-lato')?.value || 'destro';
      const dataInizio = document.getElementById('doc-inp-data-inizio')?.value || oggi;
      const durata = document.getElementById('doc-inp-durata')?.value || '15 giorni';
      doc.dataDocumento = dataInizio;
      doc.htmlDoc = generateAttestoSportHTML({ paziente: nome, lato, dataInizio, durata });
      doc.subject = `Certificato Esenzione Sport Scolastico — ${nome}`;
      doc.filename = `Esenzione_Sport_${nome.replace(/[^\w.-]/g, '_')}.pdf`;
      doc.dettagliExtra = [
        { label: 'Alluce Coinvolto', value: lato },
        { label: 'Decorrenza Esenzione', value: dataInizio },
        { label: 'Periodo di Astensione', value: durata }
      ];
    } else if (this.currentDocType === 'dimissioni') {
      const dataIntervento = document.getElementById('doc-inp-dim-data')?.value || oggi;
      const diagnosi = document.getElementById('doc-inp-dim-diagnosi')?.value.trim() || '';
      const prognosi = document.getElementById('doc-inp-dim-prognosi')?.value.trim() || '';
      const terapia = document.getElementById('doc-inp-dim-terapia')?.value || '';
      doc.dataDocumento = dataIntervento;
      doc.htmlDoc = generateLetteraDimissioniHTML({ paziente: nome, dataIntervento, diagnosi, prognosi, terapia });
      doc.subject = `Lettera di Dimissioni — ${nome}`;
      doc.filename = `Lettera_Dimissioni_${nome.replace(/[^\w.-]/g, '_')}.pdf`;
      doc.dettagliExtra = [
        { label: 'Trattamento', value: 'Onicectomia parziale in anestesia tronculare (Clinica Aurea, Torino)' },
        { label: 'Destinatario', value: 'Da consegnare al proprio medico curante' }
      ];
    }

    return doc;
  },

  // Diagnosi suggerita dall'ultima cartella clinica (sede + stadio): Fede la controlla e la corregge
  async _precompilaDiagnosi(p) {
    const inp = document.getElementById('doc-inp-dim-diagnosi');
    const hint = document.getElementById('doc-dim-diagnosi-hint');
    if (!inp) return;
    let diagnosi = '';
    try {
      if (p && p.id) {
        const r = await api.getCartelle(p.id);
        const c = (r && r.cartelle || [])[0];
        if (c) {
          let sede = [];
          try { sede = JSON.parse(c.sede || '[]') || []; } catch { sede = []; }
          const sedeTxt = sede.map(descriviDito).join('; ');
          diagnosi = 'Onicocriptosi' + (sedeTxt ? ' ' + sedeTxt : '') + (c.stadio ? ` — stadio ${c.stadio}` : '');
        }
      }
    } catch (e) { console.warn('Diagnosi da cartella non disponibile', e); }
    if (!diagnosi && p && Array.isArray(p.dita) && p.dita.length) {
      diagnosi = 'Onicocriptosi ' + p.dita.map(descriviDito).join('; ');
    }
    // Non sovrascrivere se Fede ha già iniziato a scrivere
    if (diagnosi && !inp.value.trim() && document.getElementById('doc-inp-dim-diagnosi') === inp) {
      inp.value = diagnosi;
      if (hint) hint.textContent = '(dalla cartella clinica — verifica)';
    }
  },

  // Genera il PDF una sola volta: se i dati non cambiano riusa ESATTAMENTE lo stesso binario
  async _getPdfDocumento(doc) {
    const key = doc.filename + '\n' + doc.htmlDoc;
    if (this._pdfCache && this._pdfCache.key === key) return this._pdfCache.pdf;
    const pdf = await generatePdfDocument(doc.htmlDoc, doc.filename);
    this._pdfCache = { key, pdf };
    return pdf;
  },

  async _completaDimissioniCRM(nota) {
    if (this.currentDocType !== 'dimissioni') return;
    const pid = (this.currentDocPatient || state.activePatient || {}).id;
    const dataIntervento = document.getElementById('doc-inp-dim-data')?.value || oggiLocale();
    if (!pid) {
      showToast('Intervento NON salvato nelle statistiche: il paziente non è registrato in archivio.', 'error');
      return;
    }

    // 1. Registra l'intervento (importo proposto = saldo del preventivo, letto PRIMA dell'aggiornamento CRM)
    try {
      const det = await api.getPazienteDettaglio(pid);
      const proposto = det?.crm?.importo_preventivo || '';
      const r = await registraFenolizzazione(pid, proposto, dataIntervento);
      if (r.ok && !r.giaPresente) {
        showToast(`Intervento di fenolizzazione registrato: € ${r.importo.toFixed(2)}`);
      } else if (r.motivo === 'importo_non_valido') {
        showToast('Importo non valido: intervento NON registrato nelle statistiche.', 'error');
      } else if (r.motivo === 'annullato') {
        showToast('Intervento NON registrato nelle statistiche (importo annullato).', 'error');
      }
    } catch (e) {
      showToast('Errore registrazione intervento: ' + e.message, 'error');
    }

    // 2. Aggiorna CRM come prima
    api.aggiornaCRM(pid, {
      stato: 'completato',
      operazione_pianificata: 1,
      data_operazione: dataIntervento,
      note_crm: nota
    }).then(() => {
      window.CRMView?.loadCRMData();
      window.StatisticheView?.load();
    }).catch(console.error);
  },

  // Mostra il PDF REALMENTE generato (stesso file dell'email) con Scarica / Stampa
  async stampaDocumentoDefinitivo() {
    const doc = this._buildDocumentoCorrente();
    if (!doc.htmlDoc) {
      showToast('Nessun documento valido selezionato', 'error');
      return;
    }

    // La finestra va aperta subito (dentro il click) per non essere bloccata dal browser
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<!DOCTYPE html><title>Generazione PDF…</title><body style="font-family:sans-serif;padding:40px;color:#334155">Generazione PDF con timbro e firma in corso…</body>');
    }
    showToast('Generazione PDF con timbro e firma in corso...');

    try {
      const pdf = await this._getPdfDocumento(doc);
      const url = URL.createObjectURL(pdf.blob);
      const safeName = doc.filename.replace(/[<>"&]/g, '_');

      if (win && !win.closed) {
        win.document.open();
        win.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>${safeName}</title>
<style>html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.bar{height:48px;display:flex;align-items:center;gap:10px;padding:0 16px;background:#004D40;color:#fff;font-size:13px}
.bar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar a,.bar button{background:#fff;color:#004D40;border:0;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none}
iframe{display:block;width:100%;height:calc(100% - 48px);border:0}</style></head>
<body><div class="bar"><span>${safeName} — ${pdf.pageCount} pag.</span>
<a href="${url}" download="${safeName}">Scarica PDF</a>
<button id="btn-print">Stampa</button></div>
<iframe id="pdf-frame" src="${url}" title="${safeName}"></iframe>
<script>document.getElementById('btn-print').onclick=function(){try{document.getElementById('pdf-frame').contentWindow.focus();document.getElementById('pdf-frame').contentWindow.print();}catch(e){window.open('${url}','_blank');}};<\/script>
</body></html>`);
        win.document.close();
      } else {
        // Popup bloccato: scarica direttamente lo stesso PDF
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Popup bloccato: il PDF è stato scaricato.', 'success');
      }

      this._completaDimissioniCRM('Intervento completato presso Clinica Aurea. Lettera di dimissioni rilasciata.');
    } catch (e) {
      console.error('[PDF Documento]', e);
      if (win && !win.closed) win.close();
      showToast('Impossibile generare il PDF: ' + e.message, 'error');
    }
  },

  async inviaCopiaEmail() {
    const email = document.getElementById('doc-inp-email')?.value.trim();
    if (!email || !email.includes('@')) {
      showToast('Inserisci un indirizzo email valido (del paziente o la tua per il test)', 'error');
      document.getElementById('doc-inp-email')?.focus();
      return;
    }

    const sender = document.getElementById('doc-inp-sender')?.value || 'segreteria@unghiaincarnitastop.com';
    const btn = document.getElementById('btn-invia-doc-email');
    const doc = this._buildDocumentoCorrente();

    if (!doc.htmlDoc) {
      showToast('Nessun documento valido selezionato per l\'invio', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generazione PDF in corso...';
    }

    try {
      showToast('Generazione PDF con timbro e firma in corso...');
      // Stesso PDF (stesso binario) mostrato in anteprima, se i dati non sono cambiati
      let pdf;
      try {
        pdf = await this._getPdfDocumento(doc);
      } catch (genErr) {
        throw new Error('PDF non generato correttamente, email NON inviata. ' + genErr.message);
      }
      if (!pdf || !pdf.base64 || !pdf.base64.startsWith('JVBERi') || pdf.size < 1024) {
        throw new Error('PDF non valido, email NON inviata.');
      }

      const presentationBody = generateEmailCoverHTML({
        tipo: this.currentDocType,
        nome: doc.nome,
        dataDocumento: doc.dataDocumento,
        dettagliExtra: doc.dettagliExtra,
        sender
      });

      if (btn) btn.textContent = `Invio email in corso (${sender})...`;
      showToast(`Invio email con PDF allegato da ${sender}...`);

      await api.inviaEmailDocumento({
        to: email,
        from: sender,
        subject: doc.subject,
        html: presentationBody,
        attachments: [
          {
            filename: doc.filename,
            content: pdf.base64
          }
        ]
      });

      this._completaDimissioniCRM('Intervento completato presso Clinica Aurea. Lettera di dimissioni inviata via email con PDF allegato.');

      showToast(`Documento inviato con successo a ${email} con PDF allegato!`, 'success');
    } catch (e) {
      console.error('[Invio Email Documento]', e);
      showToast('Errore generazione/invio: ' + e.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Invia Email con PDF Allegato';
      }
    }
  },

  impostaEmailTest() {
    const emailInp = document.getElementById('doc-inp-email');
    if (!emailInp) return;
    const testEmail = localStorage.getItem('test_owner_email') || 'ilmiocoachonline@gmail.com';
    emailInp.value = testEmail;
    showToast(`Email di test impostata: ${testEmail}`);
    emailInp.focus();
  },

  impostaEmailTestFic() {
    const emailInp = document.getElementById('fic-email');
    if (!emailInp) return;
    const testEmail = localStorage.getItem('test_owner_email') || 'ilmiocoachonline@gmail.com';
    emailInp.value = testEmail;
    showToast(`Email di test impostata: ${testEmail}`);
    emailInp.focus();
  },

  currentFicPaymentMethod: 'POS',
  currentFicResult: null,

  validaCodiceFiscale(cf) {
    if (!cf || typeof cf !== 'string') return false;
    cf = cf.trim().toUpperCase();
    if (cf.length !== 16) return false;
    const regex = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
    if (!regex.test(cf)) return false;

    const setDispari = {
      '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
      'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
      'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
      'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
    };
    const setPari = {
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
      'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
      'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
    };

    let somma = 0;
    for (let i = 0; i < 15; i++) {
      const c = cf[i];
      somma += (i % 2 === 0) ? setDispari[c] : setPari[c];
    }
    const checkChar = String.fromCharCode(65 + (somma % 26));
    return cf[15] === checkChar;
  },

  onFicCfChange(val) {
    const statusEl = document.getElementById('fic-cf-status');
    if (!statusEl) return;
    const cf = (val || '').trim().toUpperCase();
    if (!cf) {
      statusEl.innerHTML = '';
      return;
    }
    if (cf.length < 16) {
      statusEl.innerHTML = `<span style="color:#d97706; font-weight:600;">${cf.length}/16</span>`;
    } else if (this.validaCodiceFiscale(cf)) {
      statusEl.innerHTML = `<span style="color:#16a34a; font-weight:700;">✓ Valido</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">✗ Non valido</span>`;
    }
  },

  onFicPresetSelect(val) {
    const selectEl = document.getElementById('fic-preset-prestazione');
    const selectedOpt = selectEl ? selectEl.selectedOptions[0] : null;
    const descInp = document.getElementById('fic-desc');
    const impInp = document.getElementById('fic-importo');
    if (!descInp || !impInp) return;

    this.selectedFicVatId = null;

    if (val === 'custom') {
      descInp.focus();
      this.aggiornaRiepilogoFIC();
      return;
    }

    if (selectedOpt && selectedOpt.hasAttribute('data-name')) {
      const pName = selectedOpt.getAttribute('data-name');
      const pPrice = selectedOpt.getAttribute('data-price');
      const pVat = selectedOpt.getAttribute('data-vat-id');

      if (pName) descInp.value = pName;
      if (pPrice && Number(pPrice) > 0) {
        impInp.value = pPrice;
      } else {
        impInp.focus();
      }
      if (pVat) this.selectedFicVatId = Number(pVat);
    } else if (val === 'visita') {
      descInp.value = 'Visita Podologica';
      impInp.value = '80';
    } else if (val === 'unghia') {
      descInp.value = 'Trattamento di Unghia Incarnita';
      impInp.value = '100';
    } else if (val === 'podologico') {
      descInp.value = 'Trattamento Podologico';
      impInp.value = '80';
    } else if (val === 'fenolizzazione') {
      descInp.value = 'Trattamento di fenolizzazione';
      impInp.value = '350';
    }
    this.aggiornaRiepilogoFIC();
  },

  selezionaMetodoPagamento(metodo, btn) {
    this.currentFicPaymentMethod = metodo;
    document.querySelectorAll('.fic-pay-btn').forEach(b => {
      b.classList.remove('btn-dark');
      b.classList.add('btn-secondary');
    });
    if (btn) {
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-dark');
    }
  },

  aggiornaRiepilogoFIC() {
    const impInp = document.getElementById('fic-importo');
    const imp = parseFloat(impInp?.value) || 0;
    const haBollo = imp > 77.47;
    const bolloVal = haBollo ? 2.0 : 0.0;
    const tot = imp + bolloVal;

    const impEl = document.getElementById('fic-calc-imponibile');
    const totEl = document.getElementById('fic-calc-totale');
    const rowBollo = document.getElementById('fic-row-bollo');

    if (impEl) impEl.textContent = `€ ${imp.toFixed(2).replace('.', ',')}`;
    if (totEl) totEl.textContent = `€ ${tot.toFixed(2).replace('.', ',')}`;
    if (rowBollo) {
      rowBollo.style.display = haBollo ? 'flex' : 'none';
    }
  },

  apriModaleFatturaFIC(patient) {
    const p = patient || state.activePatient || {};
    this.currentFicPatient = p;
    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}`.trim();

    document.getElementById('fic-nome').value = nomeCompleto;
    document.getElementById('fic-cf').value = (p.codice_fiscale || p.cf || '').toUpperCase();
    document.getElementById('fic-email').value = p.email || '';

    // Indirizzo
    let via = p.indirizzo || '';
    let cap = p.cap || '';
    let citta = p.citta || 'Torino';
    let prov = p.provincia || 'TO';

    // Parsing euristico se l'indirizzo contiene virgole (es. "Via Roma 10, 10121 Torino (TO)")
    if (via && via.includes(',')) {
      const parts = via.split(',').map(s => s.trim());
      via = parts[0] || '';
      const tail = parts.slice(1).join(' ');
      const capMatch = tail.match(/\b\d{5}\b/);
      if (capMatch && !cap) cap = capMatch[0];
      const provMatch = tail.match(/\(([A-Z]{2})\)/i);
      if (provMatch && !prov) prov = provMatch[1].toUpperCase();
    }

    document.getElementById('fic-indirizzo').value = via;
    document.getElementById('fic-cap').value = cap;
    document.getElementById('fic-citta').value = citta;
    document.getElementById('fic-provincia').value = prov;

    // Data odierna
    document.getElementById('fic-data').value = new Date().toISOString().split('T')[0];

    // Reset prestazione
    const selectPreset = document.getElementById('fic-preset-prestazione');
    if (p.importo && Number(p.importo) > 0) {
      document.getElementById('fic-importo').value = p.importo;
      if (selectPreset) selectPreset.value = 'custom';
      document.getElementById('fic-desc').value = p.descrizione || (p.tipo === 'fenolizzazione' ? 'Trattamento di fenolizzazione' : 'Visita Podologica');
    } else {
      if (selectPreset) selectPreset.value = 'visita';
      document.getElementById('fic-desc').value = 'Visita Podologica';
      document.getElementById('fic-importo').value = '80';
    }

    // Reset metodo pagamento a POS
    this.currentFicPaymentMethod = 'POS';
    document.querySelectorAll('.fic-pay-btn').forEach(b => {
      if (b.getAttribute('data-pay') === 'POS') {
        b.classList.remove('btn-secondary');
        b.classList.add('btn-dark');
      } else {
        b.classList.remove('btn-dark');
        b.classList.add('btn-secondary');
      }
    });

    // Reset card risultato
    const resCard = document.getElementById('fic-result-card');
    if (resCard) resCard.style.display = 'none';
    this.currentFicResult = null;

    // Reset bottoni
    const btnBozza = document.getElementById('btn-bozza-fic');
    const btnEmetti = document.getElementById('btn-emetti-fic');
    if (btnBozza) { btnBozza.disabled = false; btnBozza.textContent = 'Anteprima Bozza FIC'; }
    if (btnEmetti) { btnEmetti.disabled = false; btnEmetti.textContent = 'Emetti Fattura Ufficiale'; }

    this.onFicCfChange(document.getElementById('fic-cf').value);
    this.aggiornaRiepilogoFIC();

    document.getElementById('modal-fic').classList.add('open');

    // Carica prodotti FIC se disponibili in background
    api.getFatturaInfo().then(info => {
      if (info && info.vat_id) {
        this.defaultFicVatId = info.vat_id;
      }
      if (info && info.products && info.products.length > 0 && selectPreset) {
        // Rimuovi eventuali opzioni dinamiche precedenti per evitare duplicati
        selectPreset.querySelectorAll('.fic-dynamic-opt').forEach(o => o.remove());
        const customOpt = selectPreset.querySelector('option[value="custom"]');
        info.products.forEach(prod => {
          const opt = document.createElement('option');
          opt.className = 'fic-dynamic-opt';
          opt.value = `fic_${prod.id}`;
          opt.setAttribute('data-fic-id', prod.id);

          const price = (prod.net_price != null && Number(prod.net_price) > 0)
            ? Number(prod.net_price)
            : ((prod.gross_price != null && Number(prod.gross_price) > 0) ? Number(prod.gross_price) : 0);

          opt.setAttribute('data-price', price > 0 ? price : '');
          opt.setAttribute('data-name', prod.name);
          if (prod.default_vat && prod.default_vat.id) {
            opt.setAttribute('data-vat-id', prod.default_vat.id);
          }

          const labelPrice = price > 0 ? `${price.toFixed(2).replace('.', ',')} €` : 'prezzo a scelta';
          opt.textContent = `${prod.name} (${labelPrice})`;
          selectPreset.insertBefore(opt, customOpt);
        });
      }
    }).catch(() => {});
  },

  async eseguiFatturaFIC(isBozza) {
    const nome = document.getElementById('fic-nome').value.trim();
    const cf = document.getElementById('fic-cf').value.trim().toUpperCase();
    const email = document.getElementById('fic-email').value.trim();
    const indirizzo = document.getElementById('fic-indirizzo').value.trim();
    const cap = document.getElementById('fic-cap').value.trim();
    const citta = document.getElementById('fic-citta').value.trim();
    const provincia = document.getElementById('fic-provincia').value.trim().toUpperCase();
    const desc = document.getElementById('fic-desc').value.trim();
    const data = document.getElementById('fic-data').value;
    const importo = parseFloat(document.getElementById('fic-importo').value) || 0;

    if (!nome) {
      showToast('Inserisci il nome e cognome del paziente', 'error');
      document.getElementById('fic-nome').focus();
      return;
    }
    if (!cf || cf.length < 16) {
      showToast('Inserisci un Codice Fiscale valido di 16 caratteri', 'error');
      document.getElementById('fic-cf').focus();
      return;
    }
    if (!this.validaCodiceFiscale(cf)) {
      const procedi = confirm(`Attenzione: il Codice Fiscale "${cf}" potrebbe contenere un errore di digitazione (carattere di controllo errato).\n\nVuoi procedere comunque?`);
      if (!procedi) return;
    }
    if (!indirizzo) {
      showToast('Inserisci la via e civico di residenza', 'error');
      document.getElementById('fic-indirizzo').focus();
      return;
    }
    if (!citta) {
      showToast('Inserisci la città di residenza', 'error');
      document.getElementById('fic-citta').focus();
      return;
    }
    if (importo <= 0) {
      showToast('Inserisci un importo valido', 'error');
      document.getElementById('fic-importo').focus();
      return;
    }

    // ── OPZIONE 2: ANTEPRIMA BOZZA INTERNA AL GESTIONALE ──────────────────────
    if (isBozza) {
      const bollo = importo > 77.47 ? 2.00 : 0.00;
      const payloadBozza = {
        paziente: {
          nome,
          cf,
          email,
          telefono: state.activePatient?.telefono || '',
          indirizzo,
          cap,
          citta,
          provincia: provincia || 'TO'
        },
        descrizione: desc || 'Visita Podologica',
        importo,
        bollo,
        data,
        metodo_pagamento: this.currentFicPaymentMethod
      };

      const htmlBozza = generateBozzaFatturaHTML(payloadBozza);
      this.lastBozzaHtml = htmlBozza;

      // Apertura immediata a schermo in nuova scheda
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(htmlBozza);
        win.document.close();
      }

      // Aggiorna scheda risultato nel modal
      const resCard = document.getElementById('fic-result-card');
      const resTitle = document.getElementById('fic-result-title');
      const resDesc = document.getElementById('fic-result-desc');
      const btnPdf = document.getElementById('fic-btn-open-pdf');
      const btnDelDraft = document.getElementById('fic-btn-del-draft');
      const btnEmail = document.getElementById('fic-btn-email');
      const btnWa = document.getElementById('fic-btn-whatsapp');

      if (resCard) resCard.style.display = 'block';
      if (resTitle) resTitle.textContent = 'Anteprima Bozza generata (Controllo interno)';
      if (resDesc) resDesc.textContent = 'Documento aperto in una nuova scheda. Controlla che dati paziente, IVA 0% forfettario e totali siano esatti. Quando hai verificato, clicca sul pulsante verde "Emetti Fattura Ufficiale" per registrarla su Fatture in Cloud.';

      if (btnPdf) {
        btnPdf.style.display = 'inline-block';
        btnPdf.textContent = 'Riapri Anteprima Bozza';
        btnPdf.onclick = (e) => {
          e.preventDefault();
          const w = window.open('', '_blank');
          if (w) {
            w.document.open();
            w.document.write(this.lastBozzaHtml || htmlBozza);
            w.document.close();
          }
        };
        btnPdf.removeAttribute('href');
      }

      if (btnDelDraft) btnDelDraft.style.display = 'none';
      if (btnEmail) btnEmail.style.display = 'none';
      if (btnWa) btnWa.style.display = 'none';

      showToast('Anteprima Bozza aperta a schermo! Controlla i dati prima dell\'emissione.');
      return;
    }

    // ── EMISSIONE FATTURA UFFICIALE SU FATTURE IN CLOUD ───────────────────────
    const btnBozza = document.getElementById('btn-bozza-fic');
    const btnEmetti = document.getElementById('btn-emetti-fic');
    btnBozza.disabled = true;
    btnEmetti.disabled = true;
    btnEmetti.textContent = 'Emissione in corso...';

    let successEmissione = false;
    try {
      showToast('Emissione fattura ufficiale in corso su Fatture in Cloud...');

      const pz = this.currentFicPatient || state.activePatient || {};
      const payload = {
        paziente: {
          id: pz.id,
          nome,
          cf,
          email,
          telefono: pz.telefono || '',
          indirizzo,
          cap,
          citta,
          provincia: provincia || 'TO'
        },
        descrizione: desc || 'Visita Podologica',
        importo,
        data,
        metodo_pagamento: this.currentFicPaymentMethod,
        bozza: false,
        vat_id: this.selectedFicVatId || this.defaultFicVatId || undefined
      };

      const res = await api.creaFatturaInCloud(payload);

      // Sincronizza indirizzo e CF nella cartella paziente D1 (paziente per cui è stata aperta la fattura)
      if (pz.id) {
        api.aggiornaPaziente(pz.id, {
          codice_fiscale: cf,
          indirizzo,
          citta
        }).catch(console.error);
        pz.codice_fiscale = cf;
        pz.indirizzo = indirizzo;
        pz.citta = citta;
        const sel = window.PazientiView?.selectedPatient;
        if (sel && sel.id === pz.id) {
          sel.codice_fiscale = cf;
          sel.indirizzo = indirizzo;
          sel.citta = citta;
          const cfDisplay = document.getElementById('scheda-cf-display');
          if (cfDisplay) cfDisplay.textContent = cf;
        }
      }

      this.currentFicResult = {
        ...(res.fattura || {}),
        pdf_url: res.pdf_url || res.fattura?.url || null,
        paziente_nome: nome,
        email,
        telefono: pz.telefono || ''
      };

      const resCard = document.getElementById('fic-result-card');
      const resTitle = document.getElementById('fic-result-title');
      const resDesc = document.getElementById('fic-result-desc');
      const btnPdf = document.getElementById('fic-btn-open-pdf');
      const btnDelDraft = document.getElementById('fic-btn-del-draft');
      const btnEmail = document.getElementById('fic-btn-email');
      const btnWa = document.getElementById('fic-btn-whatsapp');

      if (resCard) {
        resCard.style.display = 'block';
        resCard.style.border = '2px solid #86efac';
        resCard.style.background = '#f0fdf4';
        resCard.style.padding = '14px';
        resCard.style.marginTop = '14px';
        setTimeout(() => {
          resCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }

      const numDoc = res.fattura?.number ? `nr. ${res.fattura.number}${res.fattura.numeration || ''}` : '';
      if (resTitle) resTitle.textContent = `✓ Fattura ${numDoc} emessa con successo!`;
      if (resDesc) resDesc.textContent = 'Fattura registrata e SALDATA su Fatture in Cloud. Scegli come inviarla al paziente o apri il PDF:';
      showToast(`Fattura ${numDoc} emessa con successo!`);

      if (btnDelDraft) btnDelDraft.style.display = 'none';

      if (this.currentFicResult.pdf_url && btnPdf) {
        btnPdf.onclick = null;
        btnPdf.href = this.currentFicResult.pdf_url;
        btnPdf.textContent = '📄 Apri PDF Fattura';
        btnPdf.style.display = 'inline-flex';
        btnPdf.style.alignItems = 'center';
      } else if (btnPdf) {
        btnPdf.style.display = 'none';
      }

      if (btnEmail) {
        btnEmail.style.display = 'inline-flex';
        btnEmail.style.alignItems = 'center';
        btnEmail.style.background = '#0f766e';
        btnEmail.style.color = '#ffffff';
        btnEmail.style.fontWeight = '600';
        btnEmail.style.border = 'none';
        btnEmail.textContent = '✉️ Invia via Email (Fatture in Cloud)';
      }
      if (btnWa) {
        btnWa.style.display = 'inline-flex';
        btnWa.style.alignItems = 'center';
        btnWa.textContent = '💬 Invia su WhatsApp';
      }

      if (btnEmetti) {
        btnEmetti.disabled = true;
        btnEmetti.textContent = 'Fattura già emessa ✓';
      }
      if (btnBozza) {
        btnBozza.style.display = 'none';
      }

      successEmissione = true;

    } catch (e) {
      showToast('Errore Fatture in Cloud: ' + e.message, 'error');
    } finally {
      if (!successEmissione) {
        btnBozza.disabled = false;
        btnEmetti.disabled = false;
        btnBozza.textContent = 'Anteprima Bozza (Controllo)';
        btnEmetti.textContent = 'Emetti Fattura Ufficiale';
      }
    }
  },

  async eliminaBozzaCorrente() {
    if (!this.currentFicResult?.id) return;
    if (!confirm('Sei sicuro di voler eliminare questa fattura da Fatture in Cloud? Il documento verrà rimosso immediatamente da FIC.')) return;
    try {
      showToast('Eliminazione su Fatture in Cloud in corso...');
      await api.eliminaFatturaInCloud(this.currentFicResult.id);
      showToast('Documento eliminato definitivamente da Fatture in Cloud!', 'success');
      const resCard = document.getElementById('fic-result-card');
      if (resCard) resCard.style.display = 'none';
      this.currentFicResult = null;
    } catch (e) {
      showToast(e.message || 'Errore durante l\'eliminazione del documento', 'error');
    }
  },

  async inviaFatturaEmail() {
    if (!this.currentFicResult || !this.currentFicResult.id) {
      showToast('Nessuna fattura emessa disponibile per l\'invio', 'error');
      return;
    }
    const defaultEmail = this.currentFicResult.email || state.activePatient?.email || '';
    const email = prompt('Invia fattura ufficiale via email a:', defaultEmail);
    if (!email || !email.includes('@')) return;

    try {
      showToast('Invio fattura via email in corso...');
      const numDoc = this.currentFicResult.number ? `nr. ${this.currentFicResult.number}` : '';
      const res = await api.inviaFatturaFicEmail(this.currentFicResult.id, {
        email: email.trim(),
        subject: `Fattura Sanitaria ${numDoc} — Dott. Federico Grassi`,
        body: `Gentile ${this.currentFicResult.paziente_nome || 'Paziente'},\n\nLe trasmettiamo in allegato la fattura sanitaria relativa alla prestazione eseguita presso lo Studio Podologico del Dott. Federico Grassi.\n\nIl documento è valido ai fini della detrazione delle spese sanitarie (Mod. 730).\n\nCordiali saluti,\nDott. Federico Grassi — Podologo`,
        pdf_url: this.currentFicResult.pdf_url
      });

      const providerMsg = (res && res.provider === 'fatture_in_cloud')
        ? 'Fattura inviata via email con successo tramite i server di Fatture in Cloud!'
        : 'Fattura inviata via email con successo al paziente!';
      showToast(providerMsg, 'success');
    } catch (e) {
      showToast('Errore invio email: ' + e.message, 'error');
    }
  },

  inviaFatturaWhatsApp() {
    if (!this.currentFicResult || !this.currentFicResult.pdf_url) {
      showToast('Nessun link fattura disponibile', 'error');
      return;
    }
    const tel = (this.currentFicResult.telefono || state.activePatient?.telefono || '').replace(/\D/g, '');
    const nome = this.currentFicResult.paziente_nome || 'Paziente';
    const numDoc = this.currentFicResult.number ? `nr. ${this.currentFicResult.number}` : '';
    const testo = `Gentile ${nome}, ecco la fattura sanitaria ${numDoc} per la prestazione svolta presso lo Studio del Dott. Federico Grassi: ${this.currentFicResult.pdf_url}\n\nIl documento è valido per la detrazione fiscale 730. Cordiali saluti.`;

    const cleanTel = tel.startsWith('39') ? tel : (tel.length === 10 ? '39' + tel : tel);
    const url = cleanTel
      ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(testo)}`
      : `https://wa.me/?text=${encodeURIComponent(testo)}`;
    window.open(url, '_blank');
  }
};

window.DocumentiView = DocumentiView;
