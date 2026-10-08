/**
 * Registrazione visite su D1 — base dei calcoli in "Statistiche Studio".
 * Evita i doppioni: se esiste già una visita dello stesso genere nella stessa
 * giornata per lo stesso paziente, ne aggiorna l'importo invece di crearne un'altra.
 */

import { api } from './api.js';

// Data locale YYYY-MM-DD (non UTC: evita errori vicino alla mezzanotte)
export function oggiLocale() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Converte importi scritti in italiano o inglese: "1.200,50" · "80,5" · "80.5" · "€ 750,00"
export function parseImporto(valore) {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : NaN;
  let s = String(valore ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Registra (o aggiorna) la visita in studio di oggi.
 * tipo: 'prima_visita' se il paziente non ha ancora una prima visita, altrimenti 'conservativo'.
 */
export async function registraVisitaStudio(pazienteId, importo) {
  if (!pazienteId) return { ok: false, motivo: 'paziente_non_registrato' };
  const oggi = oggiLocale();
  const { visite = [] } = await api.getPazienteDettaglio(pazienteId);

  const esistente = visite.find(v => v.data_visita === oggi && v.tipo !== 'fenolizzazione');
  if (esistente) {
    if (Number(esistente.importo) !== Number(importo)) {
      await api.aggiornaImportoVisita(esistente.id, importo);
    }
    return { ok: true, aggiornata: true, tipo: esistente.tipo };
  }

  const haPrimaVisita = visite.some(v => v.tipo === 'prima_visita');
  const tipo = haPrimaVisita ? 'conservativo' : 'prima_visita';
  await api.registraVisita(pazienteId, {
    data_visita: oggi,
    tipo,
    importo,
    sede: 'Studio Filadelfia'
  });
  return { ok: true, aggiornata: false, tipo };
}

/**
 * Registra l'intervento di fenolizzazione di oggi (Clinica Aurea).
 * Se è già registrato oggi non chiede nulla e non duplica.
 * importoProposto: valore precompilato nella richiesta (es. saldo del preventivo).
 */
export async function registraFenolizzazione(pazienteId, importoProposto, dataIntervento) {
  if (!pazienteId) return { ok: false, motivo: 'paziente_non_registrato' };
  // Data dell'intervento (es. lettera inviata il giorno dopo); di default oggi
  const oggi = /^\d{4}-\d{2}-\d{2}$/.test(dataIntervento || '') ? dataIntervento : oggiLocale();
  const { visite = [] } = await api.getPazienteDettaglio(pazienteId);
  if (visite.some(v => v.data_visita === oggi && v.tipo === 'fenolizzazione')) {
    return { ok: true, giaPresente: true };
  }

  const risposta = prompt(
    "Importo incassato per l'intervento di fenolizzazione (€) — serve per il fatturato in Statistiche:",
    importoProposto ? String(importoProposto) : ''
  );
  if (risposta === null) return { ok: false, motivo: 'annullato' };
  const importo = parseImporto(risposta);
  if (!Number.isFinite(importo) || importo < 0) return { ok: false, motivo: 'importo_non_valido' };

  await api.registraVisita(pazienteId, {
    data_visita: oggi,
    tipo: 'fenolizzazione',
    importo,
    sede: 'Clinica Aurea'
  });
  return { ok: true, giaPresente: false, importo };
}
