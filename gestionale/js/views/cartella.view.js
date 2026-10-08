/**
 * Cartella Clinica Onicocriptosi — integrata nella scheda paziente
 * Studio Podologico Dott. Federico Grassi — UnghiaIncarnitaStop
 *
 * - Dati anagrafici/percorso/appuntamento: letti dalle fonti esistenti (nessuna copia).
 * - Una cartella per data di visita (storico): compila → salva → riapri → modifica → stampa PDF.
 * - La sede anatomica usa il selettore dita già esistente (PazientiView.selectedPatient.dita).
 */

import { api } from '../api.js';
import { showToast } from '../state.js';
import { oggiLocale } from '../visite.js';
import { generateCartellaClinicaHTML, generatePdfDocument } from '../pdf-templates.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const fmtData = iso => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// Timestamp D1 (UTC "AAAA-MM-GG HH:MM:SS") → ora locale italiana
const fmtTs = ts => {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T') + 'Z');
  return isNaN(d) ? String(ts) : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Data di nascita ricavata dal codice fiscale (gestisce omocodia). '' se non ricavabile.
export function dataNascitaDaCF(cf) {
  cf = String(cf || '').toUpperCase().trim();
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return '';
  const omo = 'LMNPQRSTUV';
  const num = s => Number(s.split('').map(c => (/\d/.test(c) ? c : String(omo.indexOf(c)))).join(''));
  const yy = num(cf.slice(6, 8));
  const mese = 'ABCDEHLMPRST'.indexOf(cf[8]) + 1;
  let giorno = num(cf.slice(9, 11));
  if (giorno > 40) giorno -= 40;
  if (giorno < 1 || giorno > 31 || mese < 1) return '';
  const annoCorrente = new Date().getFullYear() % 100;
  const anno = yy > annoCorrente ? 1900 + yy : 2000 + yy;
  const dt = new Date(anno, mese - 1, giorno);
  if (dt.getMonth() !== mese - 1) return '';
  return `${String(giorno).padStart(2, '0')}/${String(mese).padStart(2, '0')}/${anno}`;
}

const TIPI_VISITA = { prima_visita: 'Prima visita', conservativo: 'Trattamento conservativo', fenolizzazione: 'Fenolizzazione (Clinica Aurea)' };
const STATI_CRM = {
  preventivo_inviato: 'Preventivo inviato', da_richiamare: 'Da richiamare', in_attesa: 'In attesa risposta',
  operazione_pianificata: 'Operazione pianificata', completato: 'Completato / Dimesso'
};

function parseSede(s) {
  if (!s) return null;
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : null; } catch { return null; }
}

const sedeTesto = dita => (dita || []).map(d => `${d.piede} — ${d.dito} (${d.tipo})`).join('; ');

function formVuoto(data) {
  return {
    id: null, data_visita: data || '', granuloma: null, infiammazione: null, infezione: null, secrezione: null,
    dolore: null, stadio: null, anamnesi: '', trattamento: '', note: '', motivo_paziente: '', calendly_event_id: '',
    versione: 0, modificato_il: '', modificato_da: '', sede: null
  };
}

function formDaCartella(c) {
  return { ...formVuoto(c.data_visita), ...c, anamnesi: c.anamnesi || '', trattamento: c.trattamento || '', note: c.note || '', motivo_paziente: c.motivo_paziente || '' };
}

export const CartellaView = {
  store: {}, // per paziente: { cartelle, form, dirty, caricata, dataTarget }
  p: null,

  get st() { return this.p && this.p.id ? this.store[this.p.id] : null; },

  // Chiamato a fine renderDettaglioPaziente
  async mount(p) {
    this.p = p;
    const top = document.getElementById('cartella-top');
    const form = document.getElementById('cartella-form');
    if (!top || !form) return;

    if (!p || !p.id) {
      top.innerHTML = this.htmlDatiAutomatici(p || {});
      form.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--status-warning-text); background:var(--status-warning-bg); border:1px solid var(--status-warning-border); border-radius:var(--radius-sm);">
        Paziente non ancora registrato in archivio: registralo (+ Registra Paziente in Studio) per compilare e salvare la cartella clinica.</div>`;
      return;
    }

    let st = this.store[p.id];
    // Data visita: appuntamento Calendly da cui è stata aperta la scheda, altrimenti quella già in uso / oggi
    const dataTarget = p.calendly_data || (st && st.dataTarget) || oggiLocale();

    // Bozza già in memoria (es. ri-render dopo upload foto): la manteniamo
    if (st && st.caricata) {
      if (!st.dirty && st.dataTarget !== dataTarget) {
        st.dataTarget = dataTarget;
        this.apriDefault();
      }
      this.applicaSedeSeVuota();
      this.render();
      return;
    }

    top.innerHTML = this.htmlDatiAutomatici(p);
    form.innerHTML = `<div style="padding:16px; text-align:center; font-size:12px; color:var(--text-muted);">Caricamento cartella clinica…</div>`;
    try {
      const data = await api.getCartelle(p.id);
      if (this.p !== p) return; // nel frattempo è stato aperto un altro paziente
      st = this.store[p.id] = { cartelle: data.cartelle || [], form: null, dirty: false, caricata: true, dataTarget };
      this.apriDefault();
      this.render();
    } catch (e) {
      if (this.p !== p) return;
      form.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--status-danger-text);">Errore lettura cartella clinica: ${esc(e.message)}<br>
        <span style="color:var(--text-muted)">Se è il primo utilizzo, verifica di aver ripubblicato il Worker aggiornato.</span></div>`;
    }
  },

  // Apre la cartella della data visita (Calendly/oggi), altrimenti ne prepara una nuova per quella data
  apriDefault() {
    const st = this.st;
    const esistente = st.cartelle.find(c => c.data_visita === st.dataTarget);
    if (esistente) this.caricaForm(esistente);
    else this.nuovaForm(st.dataTarget);
  },

  caricaForm(c) {
    const st = this.st;
    st.form = formDaCartella(c);
    st.dirty = false;
    const sede = parseSede(c.sede);
    if (sede) this.impostaDita(sede);
  },

  nuovaForm(data) {
    const st = this.st;
    const p = this.p;
    const ultima = st.cartelle[0];
    const f = formVuoto(data);
    // Anamnesi: riprende il testo scritto da Federico nell'ultima cartella (modificabile)
    if (ultima && ultima.anamnesi) f.anamnesi = ultima.anamnesi;
    // Nota Calendly: solo se la scheda è stata aperta da quell'appuntamento, e resta separata
    if (p.calendly_data && p.calendly_data === data && p.note) {
      f.motivo_paziente = String(p.note);
      f.calendly_event_id = p.calendly_event_id || '';
    }
    st.form = f;
    st.dirty = false;
    // Sede: quella già impostata nel selettore, altrimenti quella dell'ultima cartella
    if ((!p.dita || !p.dita.length) && ultima) {
      const sede = parseSede(ultima.sede);
      if (sede && sede.length) this.impostaDita(sede);
    }
  },

  applicaSedeSeVuota() {
    const p = this.p, st = this.st;
    if (!st || !st.form || (p.dita && p.dita.length)) return;
    const sede = parseSede(st.form.sede) || parseSede(st.cartelle[0] && st.cartelle[0].sede);
    if (sede && sede.length) this.impostaDita(sede);
  },

  impostaDita(sede) {
    const PV = window.PazientiView;
    this.p.dita = sede.map(d => ({ piede: d.piede, dito: d.dito, tipo: d.tipo }));
    if (PV) PV.renderDitaChips();
  },

  // Hook dal selettore sede (aggiungi/rimuovi dito)
  onSedeChanged() {
    if (!this.st || !this.st.form) return;
    this.st.dirty = true;
    this.renderStato();
  },

  confermaAbbandono() {
    return !this.st || !this.st.dirty || confirm('Ci sono modifiche non salvate nella cartella clinica. Vuoi abbandonarle?');
  },

  apri(id) {
    const c = this.st.cartelle.find(x => String(x.id) === String(id));
    if (!c || !this.confermaAbbandono()) return;
    this.caricaForm(c);
    this.render();
  },

  nuova() {
    if (!this.confermaAbbandono()) return;
    const oggi = oggiLocale();
    const occupata = this.st.cartelle.some(c => c.data_visita === oggi);
    this.nuovaForm(occupata ? '' : oggi);
    this.render();
    if (occupata) showToast('Esiste già una cartella con la data di oggi: scegli la data della nuova visita.', 'error');
  },

  set(campo, valore) {
    const f = this.st.form;
    if (['granuloma', 'infiammazione', 'infezione', 'secrezione', 'dolore', 'stadio'].includes(campo)) {
      f[campo] = f[campo] === valore ? null : valore; // secondo click = deseleziona
      this.st.dirty = true;
      this.renderForm();
      return;
    }
    f[campo] = valore;
    this.st.dirty = true;
    this.renderStato();
  },

  // ── RENDER ──────────────────────────────────────────────────────────────
  render() {
    const top = document.getElementById('cartella-top');
    if (top) top.innerHTML = this.htmlStorico() + this.htmlDatiAutomatici(this.p) + this.htmlMotivo();
    this.renderForm();
  },

  renderForm() {
    const el = document.getElementById('cartella-form');
    if (el) el.innerHTML = this.htmlForm();
    this.renderStato();
  },

  renderStato() {
    const el = document.getElementById('cartella-stato');
    if (!el || !this.st || !this.st.form) return;
    const f = this.st.form;
    let html;
    if (this.st.dirty) html = `<span style="color:var(--status-warning-text); font-weight:600;">● Modifiche non salvate</span>`;
    else if (!f.id) html = `<span style="color:var(--text-muted);">Nuova cartella — non ancora salvata</span>`;
    else html = `<span style="color:var(--teal-text, var(--teal-primary)); font-weight:600;">✓ Salvata</span> · Versione ${esc(f.versione)} · ultima modifica ${esc(fmtTs(f.modificato_il))} · autore: ${esc(f.modificato_da || '—')}`;
    el.innerHTML = html;
  },

  htmlStorico() {
    const st = this.st;
    const f = st.form;
    const chip = (attivo, label, onclick) => `<button onclick="${onclick}" class="btn btn-sm ${attivo ? 'btn-dark' : 'btn-secondary'}" style="font-size:11px; padding:4px 10px;">${label}</button>`;
    const chips = st.cartelle.map(c => chip(f && f.id === c.id, `${esc(fmtData(c.data_visita))} · v${esc(c.versione)}`, `window.CartellaView.apri(${Number(c.id)})`));
    const nuovaAttiva = f && !f.id;
    chips.push(chip(nuovaAttiva, nuovaAttiva ? `Nuova · ${esc(fmtData(f.data_visita) || 'data da scegliere')}` : '+ Nuova cartella', 'window.CartellaView.nuova()'));
    return `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:12px;">
      <span style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; color:var(--text-muted); margin-right:4px;">Visite</span>
      ${chips.join('')}
    </div>`;
  },

  percorso(p) {
    const visite = [...(p.visite || [])].sort((a, b) => String(b.data_visita).localeCompare(String(a.data_visita)));
    const v = visite[0];
    if (!v) return '';
    return `${TIPI_VISITA[v.tipo] || v.tipo || 'Visita'} · ${fmtData(v.data_visita)}`;
  },

  htmlDatiAutomatici(p) {
    const nome = `${p.nome || ''} ${p.cognome || ''}`.trim() || 'Paziente';
    const indirizzo = [p.indirizzo, p.citta].filter(Boolean).join(', ');
    const nascita = p.data_nascita ? fmtData(p.data_nascita) : dataNascitaDaCF(p.codice_fiscale);
    const crm = p.crm && p.crm.stato ? (STATI_CRM[p.crm.stato] || p.crm.stato) : '';
    const appuntamento = p.calendly_data
      ? `${fmtData(p.calendly_data)}${p.ora ? ' ore ' + p.ora : ''}${p.tipo ? ' · ' + p.tipo : ''} (Calendly)`
      : '';
    const nFoto = (p.foto || []).length;
    const voce = (k, v) => `<div style="min-width:0;"><div style="font-size:10px; text-transform:uppercase; letter-spacing:0.3px; color:var(--text-muted);">${k}</div>
      <div style="font-size:12px; color:${v ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight:${v ? 600 : 400}; overflow-wrap:anywhere;">${v ? esc(v) : '—'}</div></div>`;
    return `<div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:12px 14px; margin-bottom:12px;">
      <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; color:var(--text-muted); margin-bottom:8px;">Dati recuperati automaticamente</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:10px 16px;">
        ${voce('Paziente', nome)}
        ${voce('Data di nascita', nascita)}
        ${voce('Codice fiscale', p.codice_fiscale)}
        ${voce('Telefono', p.telefono)}
        ${voce('Email', p.email)}
        ${voce('Indirizzo / Città', indirizzo)}
        ${voce('Appuntamento', appuntamento)}
        ${voce('Ultimo percorso registrato', this.percorso(p))}
        ${voce('Stato CRM', crm)}
        ${voce('Foto cliniche', nFoto ? `${nFoto} in archivio` : '')}
      </div>
    </div>`;
  },

  htmlMotivo() {
    const f = this.st && this.st.form;
    if (!f || !f.motivo_paziente) return '';
    return `<div style="border:1px dashed var(--border-strong); border-radius:var(--radius-md); padding:10px 14px; margin-bottom:12px;">
      <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; color:var(--text-muted);">Motivo / note riferite dal paziente <span style="font-weight:400; text-transform:none;">(da prenotazione online — non è una valutazione clinica)</span></div>
      <div style="font-size:12px; color:var(--text-secondary); font-style:italic; margin-top:4px; white-space:pre-wrap;">"${esc(f.motivo_paziente)}"</div>
    </div>`;
  },

  htmlForm() {
    const f = this.st.form;
    const lbl = t => `<div style="font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; color:var(--text-muted); margin-bottom:4px;">${t}</div>`;
    const btn = (campo, valore, testo, attivo) => `<button type="button" onclick="window.CartellaView.set('${campo}', ${typeof valore === 'string' ? `'${valore}'` : valore})"
      class="btn btn-sm ${attivo ? 'btn-primary' : 'btn-secondary'}" style="min-width:38px; padding:4px 10px; font-size:12px;">${testo}</button>`;
    const sn = (campo, titolo) => `<div>${lbl(titolo)}<div style="display:flex; gap:4px;">
      ${btn(campo, 1, 'Sì', f[campo] === 1)}${btn(campo, 0, 'No', f[campo] === 0)}</div></div>`;
    const dolore = Array.from({ length: 11 }, (_, i) => btn('dolore', i, String(i), f.dolore === i)).join('');
    const stadio = ['I', 'II', 'III', 'IV'].map(s => btn('stadio', s, s, f.stadio === s)).join('');
    const area = (campo, titolo, righe, ph) => `<div>${lbl(titolo)}
      <textarea class="form-input" rows="${righe}" placeholder="${ph}" oninput="window.CartellaView.set('${campo}', this.value)"
        style="width:100%; resize:vertical; font-size:12.5px; line-height:1.45; font-family:inherit;">${esc(f[campo])}</textarea></div>`;

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:12px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <span style="font-size:12px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.3px;">Valutazione clinica</span>
            <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-muted);">Data visita
              <input type="date" class="form-input form-input-mono" value="${esc(f.data_visita)}" onchange="window.CartellaView.set('data_visita', this.value)" style="width:150px; padding:4px 8px; font-size:12px;">
            </label>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:12px; margin-bottom:12px;">
            ${sn('granuloma', 'Granuloma')}${sn('infiammazione', 'Infiammazione')}${sn('infezione', 'Infezione')}${sn('secrezione', 'Secrezione')}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:16px;">
            <div>${lbl('Dolore (0–10)')}<div style="display:flex; flex-wrap:wrap; gap:3px;">${dolore}</div></div>
            <div>${lbl('Stadio onicocriptosi')}<div style="display:flex; gap:4px;">${stadio}</div></div>
          </div>
        </div>

        ${area('anamnesi', 'Anamnesi essenziale', 3, 'Compilata da Federico: patologie, farmaci, allergie, recidive, trattamenti precedenti…')}
        ${area('trattamento', 'Trattamento effettuato', 3, 'Trattamento eseguito oggi e indicazioni date al paziente…')}
        ${area('note', 'Note cliniche', 6, 'Osservazioni, diagnosi, evoluzione rispetto alle visite precedenti…')}

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-top:4px; border-top:1px solid var(--border-subtle);">
          <div id="cartella-stato" style="font-size:11.5px; color:var(--text-secondary);"></div>
          <div style="display:flex; gap:8px;">
            <button id="btn-cartella-salva" onclick="window.CartellaView.salva()" class="btn btn-primary btn-sm">Salva Cartella Clinica</button>
            <button id="btn-cartella-stampa" onclick="window.CartellaView.stampa()" class="btn btn-secondary btn-sm">Stampa Cartella Clinica (PDF)</button>
          </div>
        </div>
      </div>`;
  },

  // ── SALVATAGGIO ─────────────────────────────────────────────────────────
  async salva() {
    const p = this.p, st = this.st;
    if (!p || !p.id || !st || !st.form) { showToast('Registra prima il paziente per salvare la cartella.', 'error'); return false; }
    if (this._salvando) return false;
    const f = st.form;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data_visita || '')) { showToast('Inserisci la data della visita.', 'error'); return false; }
    const doppia = st.cartelle.find(c => c.data_visita === f.data_visita && c.id !== f.id);
    if (doppia) {
      showToast(`Esiste già una cartella del ${fmtData(f.data_visita)}: aprila dall'elenco Visite per modificarla.`, 'error');
      return false;
    }
    const payload = {
      data_visita: f.data_visita,
      sede: (p.dita || []).map(d => ({ piede: d.piede, dito: d.dito, tipo: d.tipo })),
      granuloma: f.granuloma, infiammazione: f.infiammazione, infezione: f.infezione, secrezione: f.secrezione,
      dolore: f.dolore, stadio: f.stadio,
      anamnesi: f.anamnesi, trattamento: f.trattamento, note: f.note,
      motivo_paziente: f.motivo_paziente || null, calendly_event_id: f.calendly_event_id || null
    };
    this._salvando = true;
    const b = document.getElementById('btn-cartella-salva');
    if (b) { b.disabled = true; b.textContent = 'Salvataggio…'; }
    try {
      const r = f.id ? await api.aggiornaCartella(f.id, payload) : await api.creaCartella(p.id, payload);
      const c = r.cartella;
      st.cartelle = st.cartelle.filter(x => x.id !== c.id).concat(c)
        .sort((a, b2) => String(b2.data_visita).localeCompare(String(a.data_visita)) || b2.id - a.id);
      if (this.p === p) {
        st.form = formDaCartella(c);
        st.dirty = false;
        this.render();
      }
      showToast(`Cartella clinica salvata (versione ${c.versione})`);
      return true;
    } catch (e) {
      showToast('Errore salvataggio cartella: ' + e.message, 'error');
      return false;
    } finally {
      this._salvando = false;
      const b2 = document.getElementById('btn-cartella-salva');
      if (b2) { b2.disabled = false; b2.textContent = 'Salva Cartella Clinica'; }
    }
  },

  // ── STAMPA PDF (sempre dei dati SALVATI) ────────────────────────────────
  async stampa() {
    const p = this.p, st = this.st;
    if (!p || !p.id || !st || !st.form) return;
    if (st.dirty || !st.form.id) {
      if (!confirm('La cartella ha modifiche non salvate. Salvare ora e stampare la versione salvata?')) return;
    }
    const win = window.open('', '_blank');
    if (win) win.document.write('<p style="font-family:sans-serif;padding:24px;color:#475569">Generazione PDF della cartella clinica in corso…</p>');
    const b = document.getElementById('btn-cartella-stampa');
    if (b) { b.disabled = true; b.textContent = 'Generazione PDF…'; }
    try {
      if (st.dirty || !st.form.id) {
        const ok = await this.salva();
        if (!ok) { if (win) win.close(); return; }
      }
      const c = st.cartelle.find(x => x.id === st.form.id) || st.form;
      const dataNascita = p.data_nascita ? fmtData(p.data_nascita) : dataNascitaDaCF(p.codice_fiscale);
      const html = generateCartellaClinicaHTML({
        paziente: p, cartella: c, dataNascita, percorso: this.percorso(p), sedeTesto: sedeTesto(parseSede(c.sede))
      });
      const nomeFile = `Cartella_Clinica_${(p.cognome || '')}_${(p.nome || '')}_${c.data_visita}.pdf`.replace(/[^\w.-]+/g, '_');
      const res = await generatePdfDocument(html, nomeFile);
      const url = URL.createObjectURL(res.blob);
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = nomeFile;
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (e) {
      if (win && !win.closed) win.close();
      showToast('Errore generazione PDF cartella: ' + e.message, 'error');
    } finally {
      const b2 = document.getElementById('btn-cartella-stampa');
      if (b2) { b2.disabled = false; b2.textContent = 'Stampa Cartella Clinica (PDF)'; }
    }
  }
};

window.CartellaView = CartellaView;
