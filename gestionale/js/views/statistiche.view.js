/**
 * Vista Statistiche Studio — dati reali da Cloudflare D1 (tabella visite + crm)
 */

import { api } from '../api.js';
import { oggiLocale } from '../visite.js';

const euro = n => '€ ' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const perc = n => Number(n).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

export const StatisticheView = {
  init() {
    const inp = document.getElementById('stat-mese');
    if (inp && !inp.value) inp.value = oggiLocale().slice(0, 7);
    inp?.addEventListener('change', () => this.load());
    document.getElementById('stat-aggiorna')?.addEventListener('click', () => this.load());
  },

  async load() {
    if (!window.Auth?.isAdmin()) return; // guadagni visibili solo agli amministratori
    const mese = document.getElementById('stat-mese')?.value || oggiLocale().slice(0, 7);
    setText('stat-stato', 'Caricamento…');
    try {
      const s = await api.getStatistiche(mese);

      setText('stat-fatturato', euro(s.fatturato));
      const sub = document.getElementById('stat-fatturato-sub');
      if (sub) {
        let riga = `Studio ${euro(s.fatturato_studio)} · Interventi ${euro(s.fatturato_fenolizzazione)}`;
        if (s.variazione_percentuale === null) {
          riga += ' · Nessun dato nel mese precedente';
          sub.style.color = 'var(--text-muted)';
        } else {
          const v = s.variazione_percentuale;
          riga += ` · ${v >= 0 ? '+' : ''}${perc(v).replace(' %', '%')} rispetto al mese precedente`;
          sub.style.color = v >= 0 ? 'var(--status-success-text)' : 'var(--status-error-text, #b91c1c)';
        }
        sub.textContent = riga;
      }

      const nInt = s.interventi_fenolizzazione;
      setText('stat-interventi', `${nInt} ${nInt === 1 ? 'Eseguito' : 'Eseguiti'}`);
      const nPrime = s.prime_visite;
      setText('stat-prime', `${nPrime} ${nPrime === 1 ? 'Visita' : 'Visite'}`);

      if (s.tasso_conversione === null) {
        setText('stat-conversione', '—');
        setText('stat-conversione-sub', 'Nessuna prima visita nel mese');
      } else {
        setText('stat-conversione', perc(s.tasso_conversione));
        setText('stat-conversione-sub', `${s.pazienti_convertiti} su ${nPrime} pazienti verso fenolizzazione`);
      }

      setText('stat-stato', `Aggiornato alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) {
      ['stat-fatturato', 'stat-interventi', 'stat-prime', 'stat-conversione'].forEach(id => setText(id, '—'));
      setText('stat-fatturato-sub', '');
      setText('stat-stato', 'Errore nel caricamento: ' + e.message);
    }
  }
};

window.StatisticheView = StatisticheView;
