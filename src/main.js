import { S, reload, initAccess, startSyncLoop, syncNow, autoUpdate, loadAccounts } from './state.js';
import * as Nav from './nav.js';
import { renderApp, renderLogin, onState } from './ui.js';
import * as Presence from './presence.js';

const VER = typeof __VER__ !== 'undefined' ? __VER__ : 'dev';

async function boot() {
  Nav.init();
  S.on(onState);
  initAccess();
  const sp = document.getElementById('splash');
  const hideSplash = () => { sp.classList.add('off'); setTimeout(() => sp.remove(), 600); };
  if (S.locked) { hideSplash(); renderLogin(); }
  else {
    const t0 = Date.now();
    await reload().catch((e) => console.error(e));
    await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (Date.now() - t0))));
    hideSplash(); renderApp(); Nav.first();
    syncNow(false); autoUpdate(true); loadAccounts();
  }
  startSyncLoop();
  setInterval(() => { if (!S.locked) autoUpdate(false); }, 30 * 60000);
  // ao voltar para a frente (webOS mantém o app em segundo plano), revalida a conta
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S.locked) syncNow(false); });
  // Voltar na tela inicial: o webOS mostra "sair do app?" por conta própria (disableBackHistoryAPI)
  Nav.pushKeys((e, k) => {
    if (k === Nav.K.BACK && !document.querySelector('.layer.open')) {
      if (window.webOS && webOS.platformBack) webOS.platformBack(); else if (window.PalmSystem && PalmSystem.platformBack) PalmSystem.platformBack();
      return true;
    }
    return false;
  });
  Presence.start(VER);
  window.NT_VER = VER;
}
window.addEventListener('load', boot);
window.addEventListener('error', (e) => console.error('erro:', e.message));
