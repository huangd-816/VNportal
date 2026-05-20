// ============================================
// VNportal — In-Page Notification System
// Replaces console errors with visible toasts
// ============================================
const Notify = (() => {
  let container = null;

  function ensureContainer() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'notifyContainer';
    container.style.cssText = `
      position:fixed;top:1.25rem;right:1.25rem;z-index:9000;
      display:flex;flex-direction:column;gap:.5rem;pointer-events:none;
      max-width:320px;
    `;
    document.body.appendChild(container);
  }

  function show(msg, type='info', duration=3800) {
    ensureContainer();
    const colors = {
      info:    { bg:'#1e2a3a', border:'#4a90d9', icon:'ℹ' },
      success: { bg:'#1a2e1a', border:'#27ae60', icon:'✓' },
      error:   { bg:'#2e1a1a', border:'#e74c3c', icon:'✕' },
      warn:    { bg:'#2e2a10', border:'#f5c518', icon:'⚠' },
      loading: { bg:'#1a1a2e', border:'#8e44ad', icon:'◎' },
    };
    const c = colors[type] || colors.info;
    const el = document.createElement('div');
    el.style.cssText = `
      background:${c.bg};border:1px solid ${c.border};
      padding:.65rem 1rem;font-family:'DM Mono',monospace;font-size:.72rem;
      color:#e8e0d5;letter-spacing:.04em;line-height:1.5;
      display:flex;align-items:flex-start;gap:.5rem;
      pointer-events:all;
      animation:notifyIn .2s ease;
      border-radius:2px;
      box-shadow:0 4px 20px rgba(0,0,0,.4);
    `;
    el.innerHTML = `
      <span style="color:${c.border};flex-shrink:0;margin-top:1px">${c.icon}</span>
      <span>${msg}</span>
    `;
    container.appendChild(el);

    if (duration > 0) {
      setTimeout(() => {
        el.style.animation = 'notifyOut .2s ease forwards';
        setTimeout(() => el.remove(), 200);
      }, duration);
    }
    return el; // return for update-able notifications (loading)
  }

  function loading(msg) { return show(msg, 'loading', 0); }
  function dismiss(el)  { el?.remove(); }
  function success(msg) { show(msg, 'success'); }
  function error(msg)   { show(msg, 'error', 5000); }
  function warn(msg)    { show(msg, 'warn'); }
  function info(msg)    { show(msg, 'info'); }

  // Inject keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes notifyIn  { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:none} }
    @keyframes notifyOut { from{opacity:1;transform:none} to{opacity:0;transform:translateX(12px)} }
  `;
  document.head.appendChild(style);

  return { show, loading, dismiss, success, error, warn, info };
})();
