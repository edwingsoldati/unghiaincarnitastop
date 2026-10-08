/**
 * App State & Event Emitter
 */

export const state = {
  activeTab: 'agenda',
  activePatient: null,
  agendaDate: new Date().toISOString().split('T')[0],
  appointments: [],
  patientsCache: [],
  crmCache: [],

  // Sottoscrittori eventi
  listeners: {},

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  },

  setActivePatient(patient) {
    this.activePatient = patient;
    this.emit('patientSelected', patient);
  },

  setAgendaDate(dateISO) {
    this.agendaDate = dateISO;
    this.emit('agendaDateChanged', dateISO);
  },
};

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const iconSvg = type === 'error'
    ? '<svg style="width:16px;height:16px;color:#ef4444;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
    : '<svg style="width:16px;height:16px;color:#10b981;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}
