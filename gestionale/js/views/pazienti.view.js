/**
 * Vista Cartella Clinica Pazienti (Split-Screen 2 Colonne & Bivio Decisionale)
 * Studio Podologico Dott. Federico Grassi — UnghiaIncarnitaStop
 */

import { api } from '../api.js';
import { state, showToast } from '../state.js';
import { registraVisitaStudio, parseImporto } from '../visite.js';
import { CartellaView } from './cartella.view.js';

export const PazientiView = {
  pazientiList: [],
  selectedPatient: null,
  pazientiDitaCache: {},

  init() {
    this.renderContainer();
    this.bindEvents();
    this.loadPazienti();

    state.on('patientSelected', (p) => {
      this.caricaSchedaPaziente(p);
    });
  },

  renderContainer() {
    const container = document.getElementById('view-pazienti');
    if (!container) return;

    container.innerHTML = `
      <div class="split-view-container">
        
        <!-- Colonna Sinistra: Elenco Anagrafico D1 -->
        <div class="split-sidebar">
          <div style="padding:12px; border-bottom:1px solid var(--border-subtle); background-color:var(--bg-subtle);">
            <input type="text" id="pazienti-search-input" class="form-input" placeholder="Cerca cognome, nome, tel..." style="padding:6px 10px; font-size:12px;">
          </div>
          <div id="pazienti-list-container" style="flex:1; overflow-y:auto;">
            <div style="padding:20px; text-align:center; font-size:12px; color:var(--text-muted);">
              Caricamento archivio D1...
            </div>
          </div>
          <div style="padding:10px; border-top:1px solid var(--border-subtle); background:var(--bg-subtle); text-align:center;">
            <button onclick="window.app.openNuovoPazienteModal()" class="btn btn-secondary btn-sm" style="width:100%;">
              <span>+ Registra Paziente in Studio</span>
            </button>
          </div>
        </div>

        <!-- Colonna Destra: Cartella Clinica Paziente Selezionato -->
        <div class="split-main" id="paziente-dettaglio-container">
          <div style="padding:60px; text-align:center; color:var(--text-muted); font-size:13px;">
            Seleziona un paziente dall'elenco a sinistra oppure dall'Agenda giornaliera.
          </div>
        </div>

      </div>
    `;
  },

  bindEvents() {
    const searchInput = document.getElementById('pazienti-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        this.filtraPazienti(q);
      });
    }
  },

  async loadPazienti(soloLista = false) {
    try {
      const data = await api.getPazienti();
      this.pazientiList = data.pazienti || [];
      this.renderPazientiList(this.pazientiList);
      if (soloLista) return;

      if (state.activePatient) {
        this.caricaSchedaPaziente(state.activePatient);
      } else if (this.pazientiList.length > 0) {
        this.caricaSchedaPaziente(this.pazientiList[0]);
      }
    } catch (err) {
      console.error(err);
      const container = document.getElementById('pazienti-list-container');
      if (container) {
        container.innerHTML = `<div style="padding:16px; color:var(--status-danger-text); font-size:12px;">Errore caricamento D1: ${err.message}</div>`;
      }
    }
  },

  filtraPazienti(q) {
    if (!q) {
      this.renderPazientiList(this.pazientiList);
      return;
    }
    const filtered = this.pazientiList.filter(p => {
      const full = `${p.cognome || ''} ${p.nome || ''} ${p.telefono || ''} ${p.codice_fiscale || ''}`.toLowerCase();
      return full.includes(q);
    });
    this.renderPazientiList(filtered);
  },

  renderPazientiList(list) {
    const container = document.getElementById('pazienti-list-container');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `<div style="padding:24px; text-align:center; font-size:12px; color:var(--text-muted);">Nessun paziente trovato.</div>`;
      return;
    }

    container.innerHTML = list.map(p => {
      const isSelected = this.selectedPatient && this.selectedPatient.id === p.id;
      const borderStyle = isSelected ? 'border-left: 3px solid var(--text-primary); background-color: var(--bg-subtle);' : 'border-left: 3px solid transparent;';
      
      return `
        <div onclick="window.PazientiView.selezionaPazienteById(${p.id})" style="padding:12px 14px; border-bottom:1px solid var(--border-subtle); cursor:pointer; transition:background 0.15s; ${borderStyle}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:13px; color:var(--text-primary);">${p.cognome ? p.cognome + ' ' : ''}${p.nome || ''}</strong>
            <span style="font-size:11px; color:var(--text-muted);" class="font-mono-code">${p.n_visite || 0} vis.</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            ${p.telefono ? `<span class="font-mono-code">${p.telefono}</span>` : 'Nessun telefono'}
          </div>
        </div>
      `;
    }).join('');
  },

  async selezionaPazienteById(id, extra = null) {
    try {
      const data = await api.getPazienteDettaglio(id);
      this.selectedPatient = data.paziente;
      if (extra) Object.assign(this.selectedPatient, extra);
      this.selectedPatient.visite = data.visite || [];
      this.selectedPatient.crm = data.crm || null;
      this.selectedPatient.foto = data.foto || [];
      
      // Ripristina dita da cache sessione se presenti
      if (!this.selectedPatient.dita && this.pazientiDitaCache[id]) {
        this.selectedPatient.dita = [...this.pazientiDitaCache[id]];
      }

      this.renderDettaglioPaziente(this.selectedPatient);
      this.renderPazientiList(this.pazientiList);
    } catch (e) {
      showToast('Errore lettura paziente: ' + e.message, 'error');
    }
  },

  caricaSchedaPaziente(p) {
    this.selectedPatient = p;
    if (p && p.id && !p.dita && this.pazientiDitaCache[p.id]) {
      this.selectedPatient.dita = [...this.pazientiDitaCache[p.id]];
    }
    this.renderDettaglioPaziente(p);
  },

  renderDettaglioPaziente(p) {
    const container = document.getElementById('paziente-dettaglio-container');
    if (!container) return;

    p.dita = p.dita || [];
    const nomeCompleto = `${p.cognome ? p.cognome + ' ' : ''}${p.nome || 'Paziente'}`;
    const phoneClean = (p.telefono || '').replace(/\s+/g, '').replace(/^\+/, '');
    const isAureaPatient = Boolean((p.tipo || '').toLowerCase().includes('aurea') || (p.tipo || '').toLowerCase().includes('fenolizzazione'));

    container.innerHTML = `
      <!-- Header Anagrafica -->
      <div style="padding:20px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <h2 style="font-size:18px; font-weight:700; color:var(--text-primary); letter-spacing:-0.3px;">${nomeCompleto}</h2>
            ${p.id ? `<span class="badge badge-neutral font-mono-code">ID: ${p.id}</span>` : ''}
            ${isAureaPatient ? `<span class="badge badge-teal">Prenotato Clinica Aurea</span>` : ''}
          </div>
          
          <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:12px; color:var(--text-secondary); margin-top:6px;">
            <span>Email: <strong>${p.email || '—'}</strong></span>
            <span>Tel: <strong class="font-mono-code">${p.telefono || '—'}</strong></span>
            <span>Codice Fiscale: <strong class="font-mono-code" id="scheda-cf-display">${p.codice_fiscale || 'Non ancora inserito'}</strong></span>
            <span>Città: <strong>${p.citta || p.indirizzo || 'Torino'}</strong></span>
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          ${phoneClean ? `
            <a href="https://wa.me/${phoneClean}" target="_blank" class="btn btn-whatsapp btn-sm">
              WhatsApp
            </a>
          ` : ''}
          <button onclick="window.PazientiView.modificaDatiAnagrafici()" class="btn btn-secondary btn-sm">
            Modifica Dati
          </button>
        </div>
      </div>

      <!-- Corpo Cartella Clinica -->
      <div style="padding:20px; display:flex; flex-direction:column; gap:20px;">
        
        ${isAureaPatient ? `
          <!-- Banner Notifica Paziente Clinica Aurea -->
          <div style="background:var(--teal-subtle); border:1px solid var(--teal-border); border-radius:var(--radius-md); padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:12px; font-weight:700; color:var(--teal-text); text-transform:uppercase; letter-spacing:0.3px;">
                Paziente Prenotato per Intervento alla Clinica Aurea
              </span>
              <span style="font-size:11.5px; color:var(--text-secondary); display:block; margin-top:2px;">
                Sede: Via Pietro Palmieri 50, Torino ${p.ora ? `· Orario Calendly: <strong>${p.ora}</strong>` : ''}. Completa le foto e procedi con la Lettera di Dimissioni e i documenti post-operatori.
              </span>
            </div>
            <button onclick="document.getElementById('sec-seduta-aurea-card').scrollIntoView({behavior:'smooth'})" class="btn btn-primary btn-sm">
              Vai a Documenti Aurea ↓
            </button>
          </div>
        ` : ''}

        <!-- 1. Cartella Clinica Onicocriptosi (gestita da CartellaView) -->
        <div id="sec-cartella-clinica" class="card">
          <div class="card-header">
            <div>
              <span class="card-title">1. Cartella Clinica Onicocriptosi</span>
              <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">
                Valutazione della visita: una cartella per ogni data, salvata nello storico del paziente e stampabile in PDF.
              </span>
            </div>
          </div>

          <div id="cartella-top"></div>

          <!-- Selettore Sede & Tipologia Onicocriptosi -->
          <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <span style="font-size:12px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.3px;">
                  Sede Anatomica &amp; Tipologia Onicocriptosi
                </span>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:1px;">
                  Specifica piede, dito e bordo interessato (mediale, laterale o bilaterale). Supporta più dita.
                </span>
              </div>
              <span id="dita-count-badge" class="badge badge-neutral font-mono-code">
                0 dita impostate
              </span>
            </div>

            <!-- Controlli Selettore Rapido -->
            <div style="display:grid; grid-template-columns: 1fr 1fr 1.2fr auto; gap:8px; align-items:center;">
              <div>
                <label style="font-size:10px; font-weight:600; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:3px;">Piede</label>
                <select id="sel-dito-piede" class="form-select" style="font-size:12px; height:34px;">
                  <option value="Piede Destro (DX)">Piede Destro (DX)</option>
                  <option value="Piede Sinistro (SX)">Piede Sinistro (SX)</option>
                </select>
              </div>

              <div>
                <label style="font-size:10px; font-weight:600; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:3px;">Dito</label>
                <select id="sel-dito-nome" class="form-select" style="font-size:12px; height:34px;">
                  <option value="I Dito (Alluce)">I Dito (Alluce)</option>
                  <option value="II Dito">II Dito</option>
                  <option value="III Dito">III Dito</option>
                  <option value="IV Dito">IV Dito</option>
                  <option value="V Dito">V Dito</option>
                </select>
              </div>

              <div>
                <label style="font-size:10px; font-weight:600; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:3px;">Bordo / Coinvolgimento</label>
                <select id="sel-dito-tipo" class="form-select" style="font-size:12px; height:34px;">
                  <option value="Monolaterale – bordo mediale">Monolaterale – bordo mediale</option>
                  <option value="Monolaterale – bordo laterale">Monolaterale – bordo laterale</option>
                  <option value="Bilaterale">Bilaterale (entrambi i bordi)</option>
                </select>
              </div>

              <div style="align-self:flex-end;">
                <button onclick="window.PazientiView.aggiungiDito()" class="btn btn-secondary" style="height:34px; white-space:nowrap;">
                  + Aggiungi Dito
                </button>
              </div>
            </div>

            <!-- Elenco Chips Dita Registrate -->
            <div id="dita-chips-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
              <!-- Renderizzato da PazientiView.renderDitaChips() -->
            </div>

            <!-- Avviso Clinico Casi Bilaterali Multi-dito -->
            <div id="alert-due-sedute-clinica" style="display:none; margin-top:12px; padding:10px 12px; background:var(--status-warning-bg); border:1px solid var(--status-warning-border); border-radius:var(--radius-sm); font-size:11.5px; color:var(--status-warning-text); line-height:1.45;">
              <strong>Regola Clinica Casi Bilaterali (2 Sedute Separate):</strong><br>
              Rilevato caso bilaterale su due dita distinte. In accordo con il protocollo clinico, i trattamenti devono essere programmati normalmente in <strong>due sedute differenti</strong> (non contemporaneamente entrambi i bordi di entrambe le dita), salvo diversa indicazione esplicita del Dott. Federico Grassi.<br>
              <em>Questa indicazione è impostata e verrà riportata automaticamente nel preventivo e nei documenti.</em>
            </div>
          </div>

          <div id="cartella-form"></div>
        </div>

        <!-- 2. Percorso Clinico & Decisione Visita -->
        <div class="card" style="background-color:var(--bg-subtle);">
          <div class="card-header">
            <span class="card-title">2. Decisione Percorso Clinico</span>
            <span class="badge badge-teal">Studio Via Filadelfia 200</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            
            <!-- Opzione A: Trattamento Conservativo (NON da operare) -->
            <div class="card" style="background:var(--bg-surface); border-left:3px solid var(--teal-primary);">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">Trattamento Conservativo (NON da operare)</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 12px; line-height:1.4;">
                L'unghia guarisce con cure in studio. Federico inserisce l'importo concordato ed emette subito la quietanza o la fattura.
              </p>
              <div style="display:flex; gap:8px;">
                <button onclick="window.PazientiView.apriModaleConservativo('ricevuta')" class="btn btn-primary btn-sm" style="flex:1;">
                  Ricevuta (€)
                </button>
                <button onclick="window.PazientiView.apriModaleConservativo('fattura')" class="btn btn-secondary btn-sm" style="flex:1;">
                  Fattura FIC (€)
                </button>
              </div>
            </div>

            <!-- Opzione B: Indicazione Chirurgica (DA OPERARE) -->
            <div class="card" style="background:var(--bg-surface); border-left:3px solid #0284C7;">
              <strong style="font-size:13px; color:var(--text-primary); display:block;">Indicazione a Fenolizzazione (DA OPERARE)</strong>
              <p style="font-size:11px; color:var(--text-secondary); margin:6px 0 12px; line-height:1.4;">
                Richiede matricectomia chimica alla Clinica Aurea. Passa alla documentazione fotografica e alla generazione del preventivo con deduzione 30gg.
              </p>
              <button onclick="document.getElementById('sec-fenolizzazione-flow').scrollIntoView({behavior:'smooth'})" class="btn btn-secondary btn-sm" style="width:100%;">
                Avvia Protocollo Fenolizzazione ↓
              </button>
            </div>

          </div>
        </div>

        <!-- Sezione Flusso Fenolizzazione (Foto prima, poi Preventivo e Clinica Aurea) -->
        <div id="sec-fenolizzazione-flow" style="display:flex; flex-direction:column; gap:20px;">
          
          <!-- Step 3: Fotografie Cliniche (R2) — la sede si imposta nella Cartella Clinica -->
          <div class="card">
            <div class="card-header">
              <div>
                <span class="card-title">3. Fotografie Cliniche (R2)</span>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">
                  Archiviazione immagini con ID paziente, sede anatomica e data di scatto prima dell'intervento.
                </span>
              </div>
              
              <button onclick="document.getElementById('paziente-file-input').click()" class="btn btn-secondary btn-sm">
                Carica / Scatta Foto
              </button>
              <input type="file" id="paziente-file-input" accept="image/*" style="display:none;" onchange="window.PazientiView.caricaNuovaFoto(event)">
            </div>

            <!-- Griglia Galleria Immagini R2 -->
            <div id="paziente-gallery-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:12px;">
              ${(p.foto && p.foto.length) ? p.foto.map(f => `
                <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); overflow:hidden; background:var(--bg-subtle);">
                  <img src="${api.fotoUrl(f.r2_key)}" alt="Foto clinica" style="width:100%; height:110px; object-fit:cover;">
                  <div style="padding:6px; font-size:10px; color:var(--text-muted); text-align:center;" class="font-mono-code">
                    ${f.created_at ? f.created_at.slice(0,10) : ''}
                  </div>
                </div>
              `).join('') : `
                <div style="grid-column: 1/-1; padding:20px; text-align:center; font-size:11px; color:var(--text-muted); background:var(--bg-subtle); border-radius:var(--radius-md);">
                  Nessuna fotografia clinica ancora archiviata per questo paziente.
                </div>
              `}
            </div>
          </div>

          <!-- Step 2: Preventivo Fenolizzazione (Clinica Aurea) -->
          <div class="card" style="background-color:var(--bg-subtle);">
            <div class="card-header">
              <div>
                <span class="card-title">4. Preventivo Fenolizzazione (Clinica Aurea)</span>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">
                  Scomputo automatico del costo prima visita entro 30 giorni e dettaglio separato delle voci.
                </span>
              </div>
              <button id="btn-procedi-preventivo" onclick="window.PazientiView.procediVersoPreventivo()" class="btn btn-primary btn-sm">
                Apri Configuratore Preventivo (850€ - 1.500€)
              </button>
            </div>
          </div>

          <!-- Step 3: Protocollo Seduta Operatoria Clinica Aurea (Giorno dell'Intervento) -->
          <div id="sec-seduta-aurea-card" class="card">
            <div class="card-header">
              <div>
                <span class="card-title">5. Seduta di Fenolizzazione Clinica Aurea (Giorno Intervento)</span>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">
                  Per pazienti prenotati dal link Calendly Aurea o che hanno accettato il preventivo.
                </span>
              </div>
              <span class="badge badge-teal">Via Pietro Palmieri 50</span>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
              
              <!-- Lettera Dimissioni -->
              <div class="card" style="background:var(--bg-subtle);">
                <strong style="font-size:12px; display:block;">Lettera di Dimissioni</strong>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin:4px 0 10px;">Post-operatorio e medicazioni</span>
                <button onclick="window.DocumentiView.apriDocumentoPrecompilato('dimissioni', window.PazientiView.selectedPatient)" class="btn btn-primary btn-sm" style="width:100%;">
                  Emetti Dimissioni (Aurea)
                </button>
              </div>

              <!-- Attestato di Presenza -->
              <div class="card" style="background:var(--bg-subtle);">
                <strong style="font-size:12px; display:block;">Attestato Presenza</strong>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin:4px 0 10px;">Giustificativo lavoro con orario uscita</span>
                <button onclick="window.DocumentiView.apriDocumentoPrecompilato('presenza', window.PazientiView.selectedPatient)" class="btn btn-secondary btn-sm" style="width:100%;">
                  Attestato Presenza
                </button>
              </div>

              <!-- Esenzione Sport -->
              <div class="card" style="background:var(--bg-subtle);">
                <strong style="font-size:12px; display:block;">Esenzione Sport</strong>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin:4px 0 10px;">Attività motoria scolastica</span>
                <button onclick="window.DocumentiView.apriDocumentoPrecompilato('sport', window.PazientiView.selectedPatient)" class="btn btn-secondary btn-sm" style="width:100%;">
                  Esenzione Sport
                </button>
              </div>

              <!-- Fattura Saldo -->
              <div class="card" style="background:var(--bg-subtle);">
                <strong style="font-size:12px; display:block;">Fattura Saldo FIC</strong>
                <span style="font-size:11px; color:var(--text-muted); display:block; margin:4px 0 10px;">Bozza regime forfettario L. 190/2014</span>
                <button onclick="window.DocumentiView.apriModaleFatturaFIC(window.PazientiView.selectedPatient)" class="btn btn-dark btn-sm" style="width:100%;">
                  Fattura Saldo
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>
    `;

    // Renderizza subito le chips delle dita e la diagnosi
    this.renderDitaChips();

    // Cartella Clinica: dati automatici, storico visite e valutazione
    CartellaView.mount(p);
  },

  calcolaDiagnosiDita(dita) {
    if (!dita || dita.length === 0) {
      return {
        trattamento: 'mono',
        dueSeduteSeparate: false,
        descrizioneSede: '',
        nDita: 0,
        nBilaterali: 0
      };
    }

    const nDita = dita.length;
    const bilaterali = dita.filter(d => (d.tipo || '').toLowerCase().includes('bilaterale'));
    const nBilaterali = bilaterali.length;

    let trattamento = 'mono';
    let dueSeduteSeparate = false;

    if (nDita === 1) {
      trattamento = nBilaterali === 1 ? 'bi' : 'mono';
      dueSeduteSeparate = false;
    } else {
      // Se due o più dita
      if (nBilaterali >= 2) {
        // Entrambe o tutte bilaterali: programma 2 sedute separate
        trattamento = '2dita_bi';
        dueSeduteSeparate = true;
      } else {
        // Almeno un dito monolaterale
        trattamento = '2dita_mono';
        dueSeduteSeparate = false;
      }
    }

    const descrizioneSede = dita.map(d => `${d.piede}: ${d.dito} (${d.tipo})`).join('; ');

    return {
      trattamento,
      dueSeduteSeparate,
      descrizioneSede,
      nDita,
      nBilaterali
    };
  },

  renderDitaChips() {
    const container = document.getElementById('dita-chips-container');
    const badge = document.getElementById('dita-count-badge');
    const alertSedute = document.getElementById('alert-due-sedute-clinica');
    const p = this.selectedPatient;
    if (!p || !container) return;

    p.dita = p.dita || [];
    const diag = this.calcolaDiagnosiDita(p.dita);
    p.trattamentoConsigliato = diag.trattamento;
    p.dueSeduteSeparate = diag.dueSeduteSeparate;
    p.descrizioneDita = diag.descrizioneSede;

    // Salva in cache paziente
    if (p.id) {
      this.pazientiDitaCache[p.id] = [...p.dita];
    }

    if (badge) {
      badge.textContent = p.dita.length === 1 ? '1 dito impostato' : `${p.dita.length} dita impostate`;
    }

    if (!p.dita.length) {
      container.innerHTML = `<span style="font-size:11px; color:var(--text-muted); font-style:italic;">Nessuna sede specificata. Seleziona i campi sopra e premi "+ Aggiungi Dito".</span>`;
      if (alertSedute) alertSedute.style.display = 'none';
      return;
    }

    container.innerHTML = p.dita.map((d, idx) => {
      const isBi = d.tipo.toLowerCase().includes('bilaterale');
      const badgeStyle = isBi ? 'color:var(--status-warning-text); font-weight:600;' : 'color:var(--teal-primary); font-weight:600;';
      return `
        <div style="display:inline-flex; align-items:center; gap:8px; padding:5px 11px; background:var(--bg-surface); border:1px solid var(--border-strong); border-radius:var(--radius-md); font-size:12px; color:var(--text-primary);">
          <span><strong>${d.piede}</strong> — ${d.dito} <span style="${badgeStyle}">(${d.tipo})</span></span>
          <button onclick="window.PazientiView.rimuoviDito(${idx})" style="background:none; border:none; color:var(--text-muted); font-size:15px; font-weight:700; cursor:pointer; line-height:1; padding:0 2px;" title="Rimuovi">&times;</button>
        </div>
      `;
    }).join('');

    if (alertSedute) {
      alertSedute.style.display = diag.dueSeduteSeparate ? 'block' : 'none';
    }

    // Aggiorna etichetta pulsante preventivo
    const btnPrev = document.getElementById('btn-procedi-preventivo');
    if (btnPrev) {
      const labels = {
        mono: 'Fenolizzazione Monolaterale (€ 850)',
        bi: 'Fenolizzazione Bilaterale (€ 950)',
        '2dita_mono': 'Fenolizzazione 2 Dita Mono (€ 1.200)',
        '2dita_bi': 'Fenolizzazione 2 Dita Bi (€ 1.500)'
      };
      btnPrev.textContent = `Apri Preventivo: ${labels[diag.trattamento] || '850€ - 1.500€'} →`;
    }
  },

  aggiungiDito() {
    const p = this.selectedPatient;
    if (!p) {
      showToast('Seleziona prima un paziente', 'error');
      return;
    }

    const selPiede = document.getElementById('sel-dito-piede');
    const selNome = document.getElementById('sel-dito-nome');
    const selTipo = document.getElementById('sel-dito-tipo');

    if (!selPiede || !selNome || !selTipo) return;

    p.dita = p.dita || [];
    const piede = selPiede.value;
    const dito = selNome.value;
    const tipo = selTipo.value;

    const existingIdx = p.dita.findIndex(d => d.piede === piede && d.dito === dito);
    if (existingIdx >= 0) {
      p.dita[existingIdx].tipo = tipo;
      showToast(`Aggiornato ${dito} (${piede}) a ${tipo}`);
    } else {
      p.dita.push({ piede, dito, tipo });
      showToast(`Aggiunto ${dito} (${piede}) · ${tipo}`);
    }

    this.renderDitaChips();
    CartellaView.onSedeChanged();
  },

  rimuoviDito(idx) {
    const p = this.selectedPatient;
    if (!p || !p.dita) return;
    p.dita.splice(idx, 1);
    this.renderDitaChips();
    CartellaView.onSedeChanged();
  },

  apriModaleConservativo(tipo = 'ricevuta') {
    const p = this.selectedPatient || { nome: 'Paziente' };
    const importoLibero = prompt('Inserisci l\'importo concordato per la visita / trattamento conservativo (€):', p.ultimaVisitaImporto || '100');
    if (importoLibero !== null && importoLibero.trim()) {
      const imp = parseImporto(importoLibero);
      if (!Number.isFinite(imp) || imp < 0) {
        showToast('Importo non valido: scrivi solo la cifra, es. 80 oppure 80,50', 'error');
        return;
      }
      p.ultimaVisitaImporto = imp;
      p.importo = imp;
      this._salvaVisitaStudio(p, imp);

      if (tipo === 'ricevuta') {
        window.DocumentiView.apriDocumentoPrecompilato('ricevuta', { ...p, importo: imp });
      } else {
        window.DocumentiView.apriModaleFatturaFIC({ ...p, importo: imp });
      }
    }
  },

  procediVersoPreventivo() {
    const p = this.selectedPatient || { nome: 'Paziente' };
    const diag = this.calcolaDiagnosiDita(p.dita || []);
    p.trattamentoConsigliato = diag.trattamento;
    p.dueSeduteSeparate = diag.dueSeduteSeparate;
    p.descrizioneDita = diag.descrizioneSede;

    const importoPrimaVisita = prompt(
      "Inserisci l'importo versato dal paziente per la prima visita odierna (€) da scomputare dal preventivo entro 30gg:",
      p.primaVisitaVersata || "100"
    );

    if (importoPrimaVisita !== null) {
      const imp = parseImporto(importoPrimaVisita);
      if (!Number.isFinite(imp) || imp < 0) {
        showToast('Importo non valido: scrivi solo la cifra, es. 100 oppure 100,50', 'error');
        return;
      }
      p.primaVisitaVersata = imp;
      this._salvaVisitaStudio(p, imp);
      state.setActivePatient(p);
      window.app.navigate('preventivo');
    }
  },

  // Salva la visita di oggi su D1 (base delle Statistiche Studio)
  async _salvaVisitaStudio(p, importo) {
    if (!p || !p.id) {
      showToast('Visita NON salvata nelle statistiche: registra prima il paziente (+ Nuovo Paziente).', 'error');
      return;
    }
    try {
      const r = await registraVisitaStudio(p.id, importo);
      const etichetta = r.tipo === 'prima_visita' ? 'Prima visita' : 'Visita';
      showToast(r.aggiornata
        ? `${etichetta} di oggi aggiornata: € ${importo.toFixed(2)}`
        : `${etichetta} registrata: € ${importo.toFixed(2)}`);
      window.StatisticheView?.load();
    } catch (e) {
      showToast('Errore salvataggio visita: ' + e.message, 'error');
    }
  },

  modificaDatiAnagrafici() {
    const p = this.selectedPatient;
    const cf = prompt('Codice Fiscale del paziente:', p.codice_fiscale || '');
    if (cf !== null) {
      p.codice_fiscale = cf.trim().toUpperCase();
      const el = document.getElementById('scheda-cf-display');
      if (el) el.textContent = p.codice_fiscale || 'Non ancora inserito';

      if (p.id) {
        api.aggiornaPaziente(p.id, { codice_fiscale: p.codice_fiscale }).catch(console.error);
        showToast('Codice fiscale salvato su D1');
      }
    }
  },

  async caricaNuovaFoto(event) {
    const file = event.target.files[0];
    if (!file || !this.selectedPatient) return;

    showToast('Caricamento foto clinica su Cloudflare R2 in corso...');
    try {
      if (this.selectedPatient.id) {
        const p = this.selectedPatient;
        const desc = (p.dita && p.dita.length)
          ? p.dita.map(d => `${d.piede} ${d.dito} (${d.tipo})`).join(', ')
          : 'Foto Clinica Pre-Intervento';

        await api.uploadFoto(this.selectedPatient.id, file, desc);
        showToast('Foto archiviata con successo su R2');
        this.selezionaPazienteById(this.selectedPatient.id);
      } else {
        showToast('Registra prima il paziente per archiviare la foto sul server.', 'error');
      }
    } catch (e) {
      showToast('Errore upload foto: ' + e.message, 'error');
    }
  }
};

window.PazientiView = PazientiView;
