/**
 * Accesso al gestionale — UnghiaIncarnitaStop
 * - Account personali (amministratore / segreteria)
 * - Password + Face ID / Touch ID / impronta (passkey) su ogni dispositivo
 * - Sessione di 12 ore; alla scadenza si rientra con un tocco senza perdere il lavoro aperto
 */

import { api } from './api.js';
import { showToast } from './state.js';

const K_SESSIONE = 'gs_sessione';
const K_FACEID = 'gs_faceid_attivo';
const K_NONORA = 'gs_faceid_non_ora';

const b64u = {
  enc(buf) {
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  },
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomeRuolo = r => r === 'admin' ? 'Amministratore' : 'Segreteria';

function nomeDispositivo() {
  const ua = navigator.userAgent;
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Macintosh/.test(ua) ? (navigator.maxTouchPoints > 1 ? 'iPad' : 'Mac') : /Windows/.test(ua) ? 'PC Windows' : 'Dispositivo';
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${dev} · ${br}` : dev;
}
// Nome adatto al dispositivo per i pulsanti
function nomeSblocco() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'impronta';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'Face ID / impronta';
}

const LUCCHETTO = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const IMPRONTA = '<svg fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" viewBox="0 0 24 24"><path d="M12 11v3a8 8 0 0 1-1.5 4.7"/><path d="M8.5 9.5a4 4 0 0 1 7 2.5v1.5a12 12 0 0 1-.6 3.8"/><path d="M5.5 15a12 12 0 0 0 .5-3 6 6 0 0 1 11.3-2.8"/><path d="M18 13.5c0 2-.3 3.9-.9 5.6"/><path d="M3.6 10A9 9 0 0 1 19.8 7.5"/></svg>';

export const Auth = {
  sessione: null,
  faceIdDisponibile: false,
  _risolviLogin: null,
  _timerScadenza: null,

  utente() { return this.sessione?.utente || null; },
  isAdmin() { return this.utente()?.ruolo === 'admin'; },

  // ── Avvio: risolve solo quando l'utente è dentro ─────────────────────
  async start() {
    window.Auth = this;
    api.onNonAutorizzato = () => this.scaduta();
    try {
      this.faceIdDisponibile = !!(window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch { this.faceIdDisponibile = false; }

    const s = this.leggiSessione();
    if (s) {
      this.usaSessione(s);
      if (s.utente.deve_cambiare_password) await this.mostra('cambio');
    } else {
      await this.mostraAccesso();
    }
    this.applicaUtente();
  },

  leggiSessione() {
    try {
      const s = JSON.parse(localStorage.getItem(K_SESSIONE) || 'null');
      if (s && s.token && s.utente && s.scade > Date.now() + 60000) return s;
    } catch { /* sessione illeggibile */ }
    localStorage.removeItem(K_SESSIONE);
    return null;
  },

  usaSessione(s) {
    this.sessione = s;
    localStorage.setItem(K_SESSIONE, JSON.stringify(s));
    api.setToken(s.token);
    clearTimeout(this._timerScadenza);
    // Allo scadere delle 12 ore chiede di nuovo l'accesso (il lavoro aperto resta sotto)
    this._timerScadenza = setTimeout(() => this.scaduta(), Math.max(0, Math.min(s.scade - Date.now(), 2 ** 31 - 1)));
  },

  applicaUtente() {
    const u = this.utente();
    if (!u) return;
    document.body.classList.toggle('ruolo-segreteria', u.ruolo !== 'admin');
    const n = document.getElementById('operatore-nome');
    const r = document.getElementById('operatore-ruolo');
    if (n) n.textContent = u.nome;
    if (r) r.textContent = nomeRuolo(u.ruolo);
  },

  esci() {
    localStorage.removeItem(K_SESSIONE);
    api.setToken(null);
    location.reload();
  },

  scaduta() {
    if (document.getElementById('auth-screen')?.classList.contains('open')) return;
    localStorage.removeItem(K_SESSIONE);
    api.setToken(null);
    document.getElementById('modal-account')?.classList.remove('open');
    this.mostraAccesso('Per sicurezza la sessione è scaduta: entra di nuovo.').then(() => this.applicaUtente());
  },

  // ── Schermata di accesso ──────────────────────────────────────────
  async mostraAccesso(avviso = '') {
    let configurato = true;
    for (let i = 0; i < 3; i++) {
      try { configurato = (await api.request('/api/auth/stato')).configurato; break; }
      catch (e) { if (i === 2) avviso = 'Server non raggiungibile: controlla la connessione e riprova.'; await new Promise(r => setTimeout(r, 800)); }
    }
    return this.mostra(configurato ? 'login' : 'setup', avviso);
  },

  mostra(vista, avviso = '') {
    let el = document.getElementById('auth-screen');
    if (!el) {
      el = document.createElement('div');
      el.id = 'auth-screen';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
    }
    el.classList.add('open');
    document.body.classList.add('auth-aperto');
    this.render(vista, avviso);
    return new Promise(res => { this._risolviLogin = res; });
  },

  chiudi() {
    document.getElementById('auth-screen')?.classList.remove('open');
    document.body.classList.remove('auth-aperto');
    const r = this._risolviLogin;
    this._risolviLogin = null;
    r?.();
  },

  render(vista, avviso = '') {
    const el = document.getElementById('auth-screen');
    const sblocco = nomeSblocco();
    const faceIdPrima = this.faceIdDisponibile && localStorage.getItem(K_FACEID) === '1';
    const testa = `
      <img src="assets/img/uis_logo_scritto.webp" alt="UnghiaIncarnitaStop" class="auth-logo">
      <div class="auth-sotto">Gestionale Studio · Dott. Federico Grassi</div>`;
    const msg = avviso ? `<div class="auth-avviso">${esc(avviso)}</div>` : '';
    let corpo = '';

    if (vista === 'login') {
      corpo = `
        ${msg}
        ${this.faceIdDisponibile ? `
          <button type="button" id="auth-faceid" class="auth-btn ${faceIdPrima ? 'auth-btn-primario' : 'auth-btn-secondario'}">
            ${IMPRONTA}<span>Entra con ${sblocco}</span>
          </button>
          <div class="auth-oppure"><span>oppure con la password</span></div>` : ''}
        <form id="auth-form" autocomplete="on" novalidate>
          <label class="auth-label" for="auth-email">Email</label>
          <input id="auth-email" class="auth-input" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" required>
          <label class="auth-label" for="auth-password">Password</label>
          <input id="auth-password" class="auth-input" type="password" autocomplete="current-password" required>
          <div id="auth-errore" class="auth-errore" role="alert"></div>
          <button type="submit" class="auth-btn ${faceIdPrima ? 'auth-btn-secondario' : 'auth-btn-primario'}">${LUCCHETTO}<span>Entra</span></button>
        </form>
        <div class="auth-nota">Password dimenticata? Chiedi a un amministratore di reimpostarla.</div>`;
    } else if (vista === 'setup') {
      corpo = `
        ${msg}
        <div class="auth-titolo">Prima configurazione</div>
        <p class="auth-testo">Crea l'account dell'amministratore. Il <strong>codice di configurazione</strong> è quello inserito su Cloudflare (SETUP_CODE).</p>
        <form id="auth-form" novalidate>
          <label class="auth-label" for="auth-codice">Codice di configurazione</label>
          <input id="auth-codice" class="auth-input" type="text" autocapitalize="off" spellcheck="false" required>
          <label class="auth-label" for="auth-nome">Il tuo nome</label>
          <input id="auth-nome" class="auth-input" type="text" autocomplete="name" required>
          <label class="auth-label" for="auth-email">Email</label>
          <input id="auth-email" class="auth-input" type="email" autocomplete="username" autocapitalize="off" required>
          <label class="auth-label" for="auth-password">Password (almeno 8 caratteri)</label>
          <input id="auth-password" class="auth-input" type="password" autocomplete="new-password" required>
          <label class="auth-label" for="auth-password2">Ripeti la password</label>
          <input id="auth-password2" class="auth-input" type="password" autocomplete="new-password" required>
          <div id="auth-errore" class="auth-errore" role="alert"></div>
          <button type="submit" class="auth-btn auth-btn-primario">${LUCCHETTO}<span>Crea account ed entra</span></button>
        </form>`;
    } else if (vista === 'cambio') {
      corpo = `
        <div class="auth-titolo">Scegli la tua password</div>
        <p class="auth-testo">Ciao <strong>${esc(this.utente()?.nome)}</strong>, è il tuo primo accesso: sostituisci la password provvisoria con una tua.</p>
        <form id="auth-form" novalidate>
          <label class="auth-label" for="auth-attuale">Password provvisoria</label>
          <input id="auth-attuale" class="auth-input" type="password" autocomplete="current-password" required>
          <label class="auth-label" for="auth-password">Nuova password (almeno 8 caratteri)</label>
          <input id="auth-password" class="auth-input" type="password" autocomplete="new-password" required>
          <label class="auth-label" for="auth-password2">Ripeti la nuova password</label>
          <input id="auth-password2" class="auth-input" type="password" autocomplete="new-password" required>
          <div id="auth-errore" class="auth-errore" role="alert"></div>
          <button type="submit" class="auth-btn auth-btn-primario"><span>Salva ed entra</span></button>
        </form>`;
    } else if (vista === 'offerta') {
      corpo = `
        <div class="auth-icona-grande">${IMPRONTA}</div>
        <div class="auth-titolo">Entra con ${sblocco} la prossima volta?</div>
        <p class="auth-testo">Su questo dispositivo potrai entrare con un tocco, senza scrivere la password. Puoi attivarlo anche su altri telefoni o computer.</p>
        <div id="auth-errore" class="auth-errore" role="alert"></div>
        <button type="button" id="auth-attiva" class="auth-btn auth-btn-primario">${IMPRONTA}<span>Attiva ${sblocco}</span></button>
        <button type="button" id="auth-nonora" class="auth-btn auth-btn-link">Non ora</button>`;
    }

    el.innerHTML = `<div class="auth-card">${testa}${corpo}</div>`;
    this.collega(vista);
  },

  collega(vista) {
    const $ = id => document.getElementById(id);
    const errore = t => { const e = $('auth-errore'); if (e) e.textContent = t || ''; };
    const occupato = (btn, si, testo) => {
      if (!btn) return;
      if (si) { btn.dataset.testo = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span>${testo}</span>`; }
      else { btn.disabled = false; if (btn.dataset.testo) btn.innerHTML = btn.dataset.testo; }
    };
    const form = $('auth-form');

    $('auth-faceid')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      errore('');
      occupato(btn, true, 'Verifica in corso…');
      try { await this.dopoAccesso(await this.loginFaceId()); }
      catch (err) { errore(this.messaggioErrore(err)); }
      finally { occupato(btn, false); }
    });

    if (vista === 'login') {
      setTimeout(() => $(this.faceIdDisponibile && localStorage.getItem(K_FACEID) === '1' ? 'auth-faceid' : 'auth-email')?.focus(), 50);
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        const email = $('auth-email').value.trim(), password = $('auth-password').value;
        if (!email || !password) return errore('Inserisci email e password.');
        errore('');
        occupato(btn, true, 'Accesso in corso…');
        try {
          const s = await api.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
          this._passwordAppenaUsata = password;
          await this.dopoAccesso(s);
        } catch (err) { errore(err.message); $('auth-password').value = ''; $('auth-password').focus(); }
        finally { occupato(btn, false); }
      });
    }

    if (vista === 'setup') {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        if ($('auth-password').value !== $('auth-password2').value) return errore('Le due password non coincidono.');
        errore('');
        occupato(btn, true, 'Creazione account…');
        try {
          const s = await api.request('/api/auth/setup', { method: 'POST', body: JSON.stringify({
            codice: $('auth-codice').value, nome: $('auth-nome').value, email: $('auth-email').value, password: $('auth-password').value }) });
          await this.dopoAccesso(s);
        } catch (err) { errore(err.message); }
        finally { occupato(btn, false); }
      });
    }

    if (vista === 'cambio') {
      if (this._passwordAppenaUsata) $('auth-attuale').value = this._passwordAppenaUsata;
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        if ($('auth-password').value !== $('auth-password2').value) return errore('Le due password non coincidono.');
        errore('');
        occupato(btn, true, 'Salvataggio…');
        try {
          const s = await api.request('/api/auth/password', { method: 'POST', body: JSON.stringify({ attuale: $('auth-attuale').value, nuova: $('auth-password').value }) });
          this._passwordAppenaUsata = null;
          this.usaSessione(s);
          showToast('Password salvata');
          this.offriFaceIdOppureEntra();
        } catch (err) { errore(err.message); }
        finally { occupato(btn, false); }
      });
    }

    if (vista === 'offerta') {
      $('auth-attiva').addEventListener('click', async e => {
        const btn = e.currentTarget;
        errore('');
        occupato(btn, true, 'Attivazione…');
        try {
          await this.attivaFaceId();
          showToast(`${nomeSblocco()} attivato su questo dispositivo`, 'success');
          this.chiudi();
        } catch (err) { errore(this.messaggioErrore(err)); occupato(btn, false); }
      });
      $('auth-nonora').addEventListener('click', () => {
        localStorage.setItem(K_NONORA, String(Date.now()));
        this.chiudi();
      });
    }
  },

  async dopoAccesso(s) {
    this.usaSessione(s);
    if (s.utente.deve_cambiare_password) return this.render('cambio');
    this.offriFaceIdOppureEntra();
  },

  // Dopo un accesso con password propone Face ID (al massimo una volta ogni 30 giorni se si sceglie "Non ora")
  offriFaceIdOppureEntra() {
    const nonOra = Number(localStorage.getItem(K_NONORA) || 0);
    const uid = this.utente()?.id;
    if (this.faceIdDisponibile && localStorage.getItem(K_FACEID + '_' + uid) !== '1' && Date.now() - nonOra > 30 * 86400000) {
      return this.render('offerta');
    }
    this.chiudi();
  },

  messaggioErrore(err) {
    if (err && err.name === 'NotAllowedError') return 'Operazione annullata o tempo scaduto. Riprova.';
    if (err && err.name === 'InvalidStateError') { localStorage.setItem(K_FACEID, '1'); localStorage.setItem(K_FACEID + '_' + this.utente()?.id, '1'); return `${nomeSblocco()} è già attivo su questo dispositivo.`; }
    if (err && err.name === 'SecurityError') return 'Questo indirizzo non permette Face ID: usa la password.';
    return (err && err.message) || 'Operazione non riuscita';
  },

  // ── Passkey (Face ID / impronta) ─────────────────────────────────
  async loginFaceId() {
    const o = await api.request('/api/auth/passkey/login-opzioni', { method: 'POST', body: '{}' });
    const cred = await navigator.credentials.get({
      publicKey: { challenge: b64u.dec(o.challenge), rpId: o.rpId, userVerification: 'required', timeout: 60000, allowCredentials: [] },
    });
    const r = cred.response;
    const s = await api.request('/api/auth/passkey/login', { method: 'POST', body: JSON.stringify({
      challengeToken: o.challengeToken,
      credential: {
        id: cred.id,
        response: {
          clientDataJSON: b64u.enc(r.clientDataJSON),
          authenticatorData: b64u.enc(r.authenticatorData),
          signature: b64u.enc(r.signature),
          userHandle: r.userHandle ? b64u.enc(r.userHandle) : null,
        },
      },
    }) });
    localStorage.setItem(K_FACEID, '1');
    localStorage.setItem(K_FACEID + '_' + s.utente.id, '1');
    return s;
  },

  async attivaFaceId() {
    const o = await api.request('/api/auth/passkey/registra-opzioni', { method: 'POST', body: '{}' });
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: b64u.dec(o.challenge),
        rp: o.rp,
        user: { id: b64u.dec(o.user.id), name: o.user.name, displayName: o.user.displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
        attestation: 'none',
        timeout: 60000,
        excludeCredentials: (o.escludi || []).map(id => ({ type: 'public-key', id: b64u.dec(id) })),
      },
    });
    await api.request('/api/auth/passkey/registra', { method: 'POST', body: JSON.stringify({
      challengeToken: o.challengeToken,
      nome_dispositivo: nomeDispositivo(),
      credential: {
        id: cred.id,
        response: { clientDataJSON: b64u.enc(cred.response.clientDataJSON), attestationObject: b64u.enc(cred.response.attestationObject) },
      },
    }) });
    localStorage.setItem(K_FACEID, '1');
    localStorage.setItem(K_FACEID + '_' + this.utente()?.id, '1');
  },

  // ── Finestra "Account e sicurezza" ────────────────────────────────
  async apriAccount() {
    let m = document.getElementById('modal-account');
    if (!m) {
      m = document.createElement('div');
      m.id = 'modal-account';
      m.className = 'modal-overlay';
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
      document.body.appendChild(m);
    }
    m.innerHTML = `<div class="modal-card"><div class="modal-body" style="padding:24px; text-align:center; color:var(--text-muted);">Caricamento…</div></div>`;
    m.classList.add('open');
    try {
      const io = await api.request('/api/auth/io');
      const utenti = this.isAdmin() ? (await api.request('/api/utenti')).utenti : [];
      this.renderAccount(m, io, utenti);
    } catch (err) {
      m.innerHTML = `<div class="modal-card"><div class="modal-body" style="padding:24px;">${esc(err.message)}</div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal-account').classList.remove('open')">Chiudi</button></div></div>`;
    }
  },

  renderAccount(m, io, utenti) {
    const u = io.utente;
    const sblocco = nomeSblocco();
    const data = s => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const dispositivi = (io.dispositivi || []).map(d => `
      <div class="acc-riga">
        <div><strong>${esc(d.nome_dispositivo || 'Dispositivo')}</strong><small>Attivato ${data(d.creato_il)} · ultimo uso ${data(d.ultimo_uso)}</small></div>
        <button class="btn btn-secondary btn-sm" data-az="rimuovi-pk" data-id="${d.id}">Rimuovi</button>
      </div>`).join('') || `<div class="acc-vuoto">Nessun dispositivo con ${esc(sblocco)} attivo.</div>`;

    const listaUtenti = utenti.map(x => `
      <div class="acc-riga ${x.attivo ? '' : 'acc-disattivo'}">
        <div>
          <strong>${esc(x.nome)}</strong> <span class="badge ${x.ruolo === 'admin' ? 'badge-teal' : 'badge-neutral'}" style="font-size:10px;">${nomeRuolo(x.ruolo)}</span>
          ${x.attivo ? '' : '<span class="badge badge-danger" style="font-size:10px;">Disattivato</span>'}
          <small>${esc(x.email)} · ${x.dispositivi} dispositivi · ultimo accesso ${data(x.ultimo_accesso)}${x.deve_cambiare_password ? ' · password provvisoria' : ''}</small>
        </div>
        ${x.id === u.id ? '<span class="acc-tu">Tu</span>' : `
        <div class="acc-azioni">
          <button class="btn btn-secondary btn-sm" data-az="reset" data-id="${x.id}" data-nome="${esc(x.nome)}">Nuova password</button>
          ${x.dispositivi ? `<button class="btn btn-secondary btn-sm" data-az="via-pk" data-id="${x.id}" data-nome="${esc(x.nome)}">Togli Face ID</button>` : ''}
          <button class="btn btn-secondary btn-sm" data-az="${x.attivo ? 'disattiva' : 'riattiva'}" data-id="${x.id}" data-nome="${esc(x.nome)}">${x.attivo ? 'Disattiva' : 'Riattiva'}</button>
        </div>`}
      </div>`).join('');

    m.innerHTML = `
      <div class="modal-card" style="max-width:620px;">
        <div class="modal-header">
          <span style="font-weight:600; font-size:13px;">Account e sicurezza</span>
          <button class="btn btn-secondary btn-sm" data-az="chiudi">✕</button>
        </div>
        <div class="modal-body acc">
          <div class="acc-io">
            <div><strong>${esc(u.nome)}</strong><small>${esc(u.email)} · ${nomeRuolo(u.ruolo)}</small></div>
            <button class="btn btn-secondary btn-sm" data-az="esci">Esci</button>
          </div>

          <div class="acc-sez">${esc(sblocco)} e impronta</div>
          ${this.faceIdDisponibile
            ? `<button class="btn btn-primary" data-az="attiva-pk" style="width:100%; justify-content:center; margin-bottom:8px;">Attiva ${esc(sblocco)} su questo dispositivo</button>`
            : `<div class="acc-vuoto">Questo browser non supporta ${esc(sblocco)}: usa la password.</div>`}
          ${dispositivi}

          <div class="acc-sez">Cambia password</div>
          <form id="acc-form-pw" class="acc-form">
            <input type="password" id="acc-pw-attuale" class="form-input" placeholder="Password attuale" autocomplete="current-password" required>
            <input type="password" id="acc-pw-nuova" class="form-input" placeholder="Nuova password (min. 8 caratteri)" autocomplete="new-password" required>
            <button type="submit" class="btn btn-secondary">Salva nuova password</button>
          </form>

          ${this.isAdmin() ? `
          <div class="acc-sez">Utenti del gestionale</div>
          ${listaUtenti}
          <form id="acc-form-utente" class="acc-form acc-form-griglia">
            <input type="text" id="acc-nu-nome" class="form-input" placeholder="Nome (es. Cristina)" required>
            <input type="email" id="acc-nu-email" class="form-input" placeholder="Email" autocapitalize="off" required>
            <select id="acc-nu-ruolo" class="form-select">
              <option value="segreteria">Segreteria (senza Statistiche)</option>
              <option value="admin">Amministratore (vede tutto)</option>
            </select>
            <input type="text" id="acc-nu-pw" class="form-input" placeholder="Password provvisoria (min. 8)" autocomplete="off" required>
            <button type="submit" class="btn btn-primary">Aggiungi utente</button>
          </form>
          <div class="acc-nota">Al primo accesso il nuovo utente sceglierà la sua password e potrà attivare ${esc(sblocco)}.</div>` : ''}
        </div>
      </div>`;

    m.onclick = async e => {
      if (e.target === m) return m.classList.remove('open');
      const b = e.target.closest('[data-az]');
      if (!b) return;
      const az = b.dataset.az, id = b.dataset.id, nome = b.dataset.nome;
      try {
        if (az === 'chiudi') return m.classList.remove('open');
        if (az === 'esci') return this.esci();
        if (az === 'attiva-pk') {
          b.disabled = true;
          await this.attivaFaceId();
          showToast(`${sblocco} attivato su questo dispositivo`, 'success');
        } else if (az === 'rimuovi-pk') {
          if (!confirm('Rimuovere questo dispositivo? Per entrare servirà di nuovo la password.')) return;
          await api.request(`/api/auth/passkey/${id}`, { method: 'DELETE' });
          showToast('Dispositivo rimosso');
        } else if (az === 'reset') {
          const pw = prompt(`Nuova password provvisoria per ${nome} (almeno 8 caratteri).\nAl prossimo accesso dovrà sceglierne una sua:`);
          if (pw === null) return;
          await api.request(`/api/utenti/${id}`, { method: 'PUT', body: JSON.stringify({ nuova_password: pw }) });
          showToast(`Password provvisoria impostata per ${nome}`, 'success');
        } else if (az === 'via-pk') {
          if (!confirm(`Togliere Face ID / impronta da tutti i dispositivi di ${nome}? (es. telefono perso)`)) return;
          await api.request(`/api/utenti/${id}`, { method: 'PUT', body: JSON.stringify({ rimuovi_dispositivi: true }) });
          showToast(`Dispositivi di ${nome} rimossi`, 'success');
        } else if (az === 'disattiva' || az === 'riattiva') {
          if (az === 'disattiva' && !confirm(`Disattivare ${nome}? Non potrà più entrare finché non lo riattivi.`)) return;
          await api.request(`/api/utenti/${id}`, { method: 'PUT', body: JSON.stringify({ attivo: az === 'riattiva' }) });
          showToast(az === 'disattiva' ? `${nome} disattivato` : `${nome} riattivato`, 'success');
        }
        this.apriAccount();
      } catch (err) {
        b.disabled = false;
        showToast(this.messaggioErrore(err), 'error');
      }
    };

    m.querySelector('#acc-form-pw').onsubmit = async e => {
      e.preventDefault();
      try {
        const s = await api.request('/api/auth/password', { method: 'POST', body: JSON.stringify({
          attuale: m.querySelector('#acc-pw-attuale').value, nuova: m.querySelector('#acc-pw-nuova').value }) });
        this.usaSessione(s);
        showToast('Password cambiata. Gli altri dispositivi dovranno rientrare.', 'success');
        this.apriAccount();
      } catch (err) { showToast(err.message, 'error'); }
    };

    const fu = m.querySelector('#acc-form-utente');
    if (fu) fu.onsubmit = async e => {
      e.preventDefault();
      try {
        await api.request('/api/utenti', { method: 'POST', body: JSON.stringify({
          nome: m.querySelector('#acc-nu-nome').value, email: m.querySelector('#acc-nu-email').value,
          ruolo: m.querySelector('#acc-nu-ruolo').value, password: m.querySelector('#acc-nu-pw').value }) });
        showToast('Utente aggiunto', 'success');
        this.apriAccount();
      } catch (err) { showToast(err.message, 'error'); }
    };
  },
};
