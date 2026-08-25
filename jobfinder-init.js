
// Close controls for the on-screen panel.
(function wireHealthClose(){
  const x = document.getElementById('healthClose');
  if(x) x.addEventListener('click', closeHealthPanel);
  const overlay = document.getElementById('healthPanel');
  if(overlay) overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeHealthPanel(); });
})();



window.addEventListener('error', (event) => {
  const s = document.getElementById('status');
  const r = document.getElementById('results');
  const b = document.getElementById('go');
  if (b) b.disabled = false;
  if (s) s.innerHTML = '<span class="src-fail">Script error</span>';
  if (r) r.innerHTML = '<div class="empty">A page script error occurred: ' + esc(event.message || 'unknown error') + '</div>';
});


goBtn.addEventListener('click', search);
document.addEventListener('keydown', e=>{ if(e.key==='Enter') search(); });


window.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('status');
  if (s && (s.textContent.includes('Ready') || s.textContent.includes('script loaded'))) s.textContent = '';
});

// PWA service worker — registered after load so it never delays first paint or
// blocks search. Wrapped so that if sw.js is absent or registration fails, the
// page behaves exactly as it did before (no offline cache, no install prompt),
// with no visible error. The SW only caches the app shell; it never touches the
// /.netlify/functions/* job API calls, which must always hit the network.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Install-to-home-screen banner. The browser fires 'beforeinstallprompt' only
// when the PWA is installable (valid manifest + SW, not already installed).
// We capture that event, show our own banner (unless the user dismissed it
// before), and trigger the native install dialog from the Add button. If the
// event never fires — unsupported browser, already installed, iOS Safari — the
// banner simply never appears, so nothing looks broken.
(function(){
  var DISMISS_KEY = 'coachJeffInstallDismissed';
  var deferred = null;
  var banner = document.getElementById('installBanner');
  if(!banner) return;

  function dismissed(){
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch(e){ return false; }
  }
  function hide(){ banner.style.display = 'none'; }

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();        // stop Chrome's mini-infobar; we show our own
    deferred = e;
    if(!dismissed()) banner.style.display = '';
  });

  var addBtn = document.getElementById('installBtn');
  if(addBtn) addBtn.addEventListener('click', async function(){
    hide();
    if(!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch(e){}
    deferred = null;           // a prompt can only be used once
  });

  var dismissBtn = document.getElementById('installDismiss');
  if(dismissBtn) dismissBtn.addEventListener('click', function(){
    hide();
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch(e){}
  });

  // If the app gets installed (via our button or the browser's own UI), make
  // sure the banner is gone and stays gone.
  window.addEventListener('appinstalled', function(){
    hide();
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch(e){}
  });
})();
