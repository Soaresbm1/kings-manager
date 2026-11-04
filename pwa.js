// Installation et cache uniquement : aucune donnée de carrière ni décision de match.
(() => {
  "use strict";
  // Les variantes de démonstration s’exécutent dans une origine opaque isolée.
  if (window.KINGS_LAB) return;
  let serviceWorker = null;
  try { serviceWorker = navigator.serviceWorker; } catch {}
  let installPrompt = null;
  let registration = null;
  let applyingUpdate = false;
  let reloading = false;
  let preparing = false;
  let offlineReady = false;
  let ui = null;
  let unlockTimer = null;
  let previousInert = false;
  const watchedWorkers = new WeakSet();
  const watchedRegistrations = new WeakSet();

  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function safeToUpdate() {
    return !!document.getElementById("screen-home")?.classList.contains("active")
      && (typeof STATE === "undefined" || !STATE.currentSlotId)
      && (typeof managerPendingEntry === "undefined" || !managerPendingEntry)
      && !document.querySelector('#import-save-feedback[data-save-error], #import-save-feedback[data-importing="true"]');
  }

  function askWorker(worker, type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!worker) { reject(new Error("Worker indisponible")); return; }
      const channel = new MessageChannel();
      const close = () => { channel.port1.close(); channel.port2.close(); };
      const timer = setTimeout(() => { close(); reject(new Error("Le cache ne répond pas")); }, timeout);
      channel.port1.onmessage = event => { clearTimeout(timer); close(); resolve(event.data); };
      channel.port1.onmessageerror = () => { clearTimeout(timer); close(); reject(new Error("Réponse invalide")); };
      try { worker.postMessage({ type }, [channel.port2]); }
      catch (error) { clearTimeout(timer); close(); reject(error); }
    });
  }

  function renderInstall() {
    if (!ui) return;
    const installed = standalone();
    ui.install.hidden = installed || !installPrompt;
    ui.help.hidden = installed;
    if (installed) ui.installFeedback.textContent = "Application ouverte en mode installé.";
  }

  function renderUpdate() {
    if (!ui) return;
    const waiting = registration?.waiting;
    ui.update.hidden = !waiting;
    ui.update.disabled = applyingUpdate || !safeToUpdate();
    if (waiting && !applyingUpdate) {
      ui.updateStatus.hidden = false;
      ui.updateStatus.textContent = safeToUpdate()
        ? "Une mise à jour est prête. Elle s’appliquera au prochain lancement ou avec le bouton ci-dessous."
        : "Une mise à jour est prête. Termine ta partie et reviens à Mes carrières pour l’appliquer.";
    } else if (!waiting && !applyingUpdate) {
      ui.updateStatus.hidden = true;
    }
    ui.label.textContent = waiting ? "Mise à jour prête" : offlineReady ? "Prêt hors ligne" : preparing ? "Préparation…" : "À préparer";
  }

  function showReadiness(ready, message) {
    offlineReady = ready;
    ui.status.dataset.pwaReady = String(ready);
    ui.status.textContent = message;
    ui.retry.hidden = ready || preparing;
    ui.retry.disabled = preparing;
    renderUpdate();
  }

  async function refreshReadiness() {
    if (!ui || applyingUpdate) return;
    if (!registration?.active) {
      if (!preparing) showReadiness(false, "Le mode hors ligne n’est pas encore prêt. Connecte-toi, puis réessaie.");
      return;
    }
    try {
      const result = await askWorker(registration.active, "PWA_STATUS");
      const ready = result?.type === "PWA_STATUS" && result.ready === true;
      showReadiness(ready, ready
        ? (navigator.onLine ? "Jeu prêt hors ligne. Tu peux jouer sans connexion et reprendre tes carrières sur cet appareil."
          : "Tu es hors ligne. Le jeu et tes carrières restent disponibles sur cet appareil.")
        : "La préparation hors ligne est incomplète. Reconnecte-toi, puis réessaie.");
    } catch {
      showReadiness(false, "La disponibilité hors ligne n’a pas pu être vérifiée. Reconnecte-toi, puis réessaie.");
    }
  }

  function watchWorker(worker) {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    const changed = () => {
      renderUpdate();
      if (worker.state === "activated") { preparing = false; refreshReadiness(); }
      else if (worker.state === "redundant" && !registration?.active) {
        preparing = false;
        showReadiness(false, "La préparation hors ligne a échoué. Le jeu reste accessible en ligne ; reconnecte-toi et réessaie.");
      }
    };
    worker.addEventListener("statechange", changed);
    changed();
  }

  async function prepare() {
    if (preparing || applyingUpdate) return;
    preparing = true;
    showReadiness(offlineReady, offlineReady ? ui.status.textContent : "Préparation du jeu pour le mode hors ligne…");
    try {
      registration = await serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" });
      if (!watchedRegistrations.has(registration)) {
        watchedRegistrations.add(registration);
        registration.addEventListener("updatefound", () => { watchWorker(registration.installing); renderUpdate(); });
      }
      watchWorker(registration.installing);
      renderUpdate();
      if (registration.active) {
        const current = await askWorker(registration.active, "PWA_STATUS");
        if (!current?.ready) await askWorker(registration.active, "PWA_PREPARE", 60000);
        preparing = false;
        await refreshReadiness();
        // Une mise à jour complète possède son propre cache ; aucune activation ici.
        registration.update().catch(() => {});
      } else if (!registration.installing && !registration.waiting) {
        preparing = false;
        showReadiness(false, "La préparation hors ligne n’a pas démarré. Reconnecte-toi, puis réessaie.");
      }
    } catch {
      preparing = false;
      showReadiness(false, "Le mode hors ligne n’a pas pu être préparé. Vérifie ta connexion et l’espace disponible, puis réessaie.");
    }
  }

  function unlockUpdate() {
    clearTimeout(unlockTimer);
    document.getElementById("screen-home").inert = previousInert;
    applyingUpdate = false;
    renderUpdate();
  }

  function finishUpdate() {
    if (!applyingUpdate || reloading) return;
    if (!safeToUpdate()) { unlockUpdate(); return; }
    reloading = true;
    clearTimeout(unlockTimer);
    window.location.reload();
  }

  async function applyUpdate() {
    const waiting = registration?.waiting;
    if (!waiting || applyingUpdate || !safeToUpdate()) { renderUpdate(); return; }
    applyingUpdate = true;
    const home = document.getElementById("screen-home");
    previousInert = home.inert;
    home.inert = true;
    ui.updateStatus.hidden = false;
    ui.updateStatus.textContent = "Application de la mise à jour…";
    ui.update.disabled = true;
    unlockTimer = setTimeout(() => {
      unlockUpdate();
      ui.updateStatus.hidden = false;
      ui.updateStatus.textContent = "La mise à jour n’a pas abouti. Ferme les autres onglets du jeu, puis réessaie.";
    }, 15000);
    try {
      const result = await askWorker(waiting, "SKIP_WAITING", 7000);
      if (result?.type !== "PWA_UPDATE_RESULT" || !result.ok) {
        unlockUpdate();
        ui.updateStatus.hidden = false;
        ui.updateStatus.textContent = result?.reason === "other-clients"
          ? "Ferme les autres onglets de Kings Manager avant d’appliquer la mise à jour."
          : "La mise à jour attend la fin de la partie ou de l’importation. Reviens à Mes carrières, puis réessaie.";
        return;
      }
      waiting.addEventListener("statechange", () => { if (waiting.state === "activated") finishUpdate(); });
      if (waiting.state === "activated") finishUpdate();
    } catch {
      unlockUpdate();
      ui.updateStatus.hidden = false;
      ui.updateStatus.textContent = "La mise à jour n’a pas pu être appliquée. Ferme les autres onglets du jeu, puis réessaie.";
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    renderInstall();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    renderInstall();
    if (ui) ui.installFeedback.textContent = "Kings Manager est installé. Tu peux l’ouvrir depuis son icône.";
  });

  document.addEventListener("DOMContentLoaded", () => {
    ui = {
      status: document.getElementById("pwa-status"), label: document.getElementById("pwa-state-label"),
      install: document.getElementById("pwa-install"), installFeedback: document.getElementById("pwa-install-feedback"),
      help: document.getElementById("pwa-install-help"), retry: document.getElementById("pwa-retry"),
      update: document.getElementById("pwa-update"), updateStatus: document.getElementById("pwa-update-status")
    };
    renderInstall();
    window.matchMedia("(display-mode: standalone)").addEventListener("change", renderInstall);
    ui.install.addEventListener("click", async () => {
      const prompt = installPrompt;
      if (!prompt || standalone()) return;
      installPrompt = null;
      ui.install.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        ui.installFeedback.textContent = choice?.outcome === "accepted"
          ? "Installation demandée. Le navigateur termine l’installation."
          : "Tu peux installer le jeu plus tard depuis le menu du navigateur.";
      } catch { ui.installFeedback.textContent = "Utilise le menu du navigateur pour installer Kings Manager."; }
      finally { ui.install.disabled = false; renderInstall(); }
    });
    ui.retry.addEventListener("click", prepare);
    ui.update.addEventListener("click", applyUpdate);
    if (!serviceWorker || !window.isSecureContext) {
      showReadiness(false, "Le mode hors ligne est indisponible dans ce navigateur. Ouvre Kings Manager dans un navigateur récent avec une connexion sécurisée.");
      ui.retry.hidden = true;
      return;
    }
    serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "PWA_CAN_UPDATE" && event.ports[0])
        event.ports[0].postMessage({ safe: applyingUpdate && safeToUpdate() });
    });
    serviceWorker.addEventListener("controllerchange", () => {
      if (applyingUpdate) finishUpdate();
      else refreshReadiness();
    });
    new MutationObserver(renderUpdate).observe(document.getElementById("screen-home"), { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(renderUpdate).observe(document.getElementById("import-save-feedback"), { attributes: true, childList: true });
    window.addEventListener("online", () => { refreshReadiness(); registration?.update().catch(() => {}); });
    window.addEventListener("offline", refreshReadiness);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") { refreshReadiness(); if (navigator.onLine) registration?.update().catch(() => {}); }
    });
    prepare();
  });
})();
