/* Liaison au stockage vérifié ; aucune carrière n'est remplacée par un téléchargement. */
'use strict';
const CLOUD_KEY = 'kingsManager7v7_cloud_v1';
let cloudLinks = {}, cloudBusy = false, cloudTimer = null, cloudConflict = null, cloudMessage = '';
let cloudStorageBlocked = false;
let cloudLinksStale = false, cloudRegistryLocked = false, cloudLinksRaw = null;
const cloudSuspendedControls = new Map();
try {
  cloudLinksRaw = localStorage.getItem(CLOUD_KEY);
  const parsed = JSON.parse(cloudLinksRaw || '{}');
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [slot, link] of Object.entries(parsed).slice(0, 30)) {
      if (link && /^KM1\.[A-Za-z0-9_-]{43}$/.test(link.code) && typeof link.etag === 'string' && link.etag.length < 257) {
        cloudLinks[slot] = { code: link.code, etag: link.etag, hash: typeof link.hash === 'string' ? link.hash : '', conflict: !!link.conflict, syncedAt: Number(link.syncedAt) || 0 };
      }
    }
  }
} catch { cloudStorageBlocked = true; cloudLinksStale = true; }

function invalidateCloudLinks() {
  cloudLinksStale = true;
  cloudMessage = 'Le lien cloud a changé dans un autre onglet. Recharge depuis Mes carrières pour continuer. Aucun lien ne sera remplacé par cet onglet.';
  clearTimeout(cloudTimer);
  renderCloudControls();
}
async function withCloudRegistryLock(action) {
  if (!navigator.locks?.request) throw new Error('Ce navigateur ne permet pas de sécuriser les liens entre onglets. Mets-le à jour ou utilise l’export/import JSON.');
  return navigator.locks.request('kings-manager-cloud-registry-v1', async () => {
    if (cloudLinksStale || localStorage.getItem(CLOUD_KEY) !== cloudLinksRaw) { invalidateCloudLinks(); throw new Error(cloudMessage); }
    cloudRegistryLocked = true;
    try { return await action(); } finally { cloudRegistryLocked = false; }
  });
}

function persistCloudLinks() {
  try {
    if (!cloudRegistryLocked || cloudLinksStale || localStorage.getItem(CLOUD_KEY) !== cloudLinksRaw) { invalidateCloudLinks(); return false; }
    const raw = JSON.stringify(cloudLinks); localStorage.setItem(CLOUD_KEY, raw);
    if (localStorage.getItem(CLOUD_KEY) !== raw) throw new Error();
    cloudLinksRaw = raw;
    cloudStorageBlocked = false; return true;
  } catch {
    cloudStorageBlocked = true;
    cloudMessage = 'Le lien cloud n’a pas pu être enregistré sur cet appareil. Conserve le code avant de fermer cette page.';
    return false;
  }
}
function selectedCloudSlot() { return document.getElementById('cloud-career')?.value || ''; }
function cloudAtHome() {
  return !cloudLinksStale && document.getElementById('screen-home')?.classList.contains('active') && !STATE.currentSlotId && !managerPendingEntry
    && !document.querySelector('#import-save-feedback[data-save-error], #import-save-feedback[data-importing="true"]');
}
function cloudStatus(message) { cloudMessage = message; renderCloudControls(); }
function readCloudCareer(slot) {
  const result = getManagerStorage().read();
  if (!result.ok) throw new Error('Les sauvegardes locales doivent être récupérées avant de synchroniser.');
  const entry = result.map[slot];
  if (!entry || !isPlayableCareerData(entry.data)) throw new Error('Choisis une carrière locale valide.');
  return entry;
}
function cloudDescription(entry) {
  const m = entry.meta || {};
  return `${m.teamName || 'Carrière'} · saison ${entry.data?.season || m.season || 1} · ${entry.data?.currentRound || 0} journée(s) jouée(s)`;
}
function renderCloudControls(refreshList = false) {
  const panel = document.getElementById('cloud-sync-panel'); if (!panel) return;
  const select = document.getElementById('cloud-career');
  if (cloudBusy && document.getElementById('screen-home')?.classList.contains('active')) {
    for (const control of document.querySelectorAll('#saves-list button, #btn-start, #import-save-input')) {
      if (!cloudSuspendedControls.has(control)) cloudSuspendedControls.set(control, control.disabled);
      control.disabled = true;
    }
  } else if (!cloudBusy) {
    for (const [control, disabled] of cloudSuspendedControls) control.disabled = disabled;
    cloudSuspendedControls.clear();
  }
  if (refreshList) {
    const previous = select.value, result = getManagerStorage().read();
    select.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choisir une carrière locale'; select.append(placeholder);
    if (result.ok) for (const [slot, entry] of Object.entries(result.map)) {
      const option = document.createElement('option'); option.value = slot; option.textContent = cloudDescription(entry); select.append(option);
    }
    if (Array.from(select.options).some(option => option.value === previous)) select.value = previous;
  }
  const link = cloudLinks[select.value];
  const status = document.getElementById('cloud-status');
  status.textContent = (cloudStorageBlocked ? 'Le lien cloud n’a pas pu être enregistré sur cet appareil. Conserve le code personnel avant de fermer la page. ' : '') + (cloudMessage || (link ? (link.conflict ? 'Deux progressions sont à départager.' : 'Appareil lié. Les changements enregistrés sont envoyés après 30 secondes sans nouvelle sauvegarde, si la connexion le permet.') : 'La synchronisation est facultative. Le jeu et ses sauvegardes locales fonctionnent hors ligne.'));
  document.getElementById('cloud-active-status').textContent = STATE.currentSlotId && cloudLinks[STATE.currentSlotId] ? (cloudLinks[STATE.currentSlotId].conflict ? 'Cloud : conflit à résoudre dans Mes carrières' : cloudBusy ? 'Cloud : synchronisation…' : cloudMessage || 'Cloud lié · sauvegarde locale active') : '';
  for (const button of panel.querySelectorAll('button')) button.disabled = cloudBusy || !cloudAtHome();
  select.disabled = cloudBusy;
  document.getElementById('cloud-create').hidden = !!link;
  document.getElementById('cloud-create').disabled ||= !select.value;
  for (const id of ['cloud-send', 'cloud-inspect', 'cloud-reveal', 'cloud-disconnect', 'cloud-delete']) document.getElementById(id).hidden = !link;
  document.getElementById('cloud-send').disabled ||= !!link?.conflict;
  document.getElementById('cloud-resolution').hidden = !cloudConflict || cloudConflict.slot !== select.value;
  if (!link) { document.getElementById('cloud-code-display').hidden = true; document.getElementById('cloud-code-output').value = ''; }
}
async function cloudTask(action) {
  if (cloudBusy || !cloudAtHome()) return;
  cloudBusy = true; renderCloudControls();
  try { await withCloudRegistryLock(action); } catch (error) { cloudStatus(error.message || 'La synchronisation a échoué.'); }
  finally { cloudBusy = false; renderCloudControls(true); }
}
async function uploadCloudCareer(slot) {
  const link = cloudLinks[slot]; if (!link || link.conflict) return;
  const entry = readCloudCareer(slot), hash = await CareerCloud.fingerprint(entry);
  if (hash === link.hash) { cloudStatus('Cette progression est déjà synchronisée.'); return; }
  try {
    const envelope = await CareerCloud.seal(entry, link.code);
    const response = await CareerCloud.request(link.code, 'PUT', envelope, link.etag);
    // Ne jamais rétablir un lien déconnecté pendant une requête.
    if (cloudLinks[slot] !== link) return;
    link.etag = response.etag; link.hash = hash; link.syncedAt = Date.now();
    persistCloudLinks();
    const currentHash = await CareerCloud.fingerprint(readCloudCareer(slot));
    cloudStatus(currentHash === hash ? 'Progression envoyée. La copie locale reste disponible.' : 'Nouvelle progression locale en attente d’envoi.');
    if (currentHash !== hash) queueCloudSave(slot);
  } catch (error) {
    if (error.code === 409) { link.conflict = true; persistCloudLinks(); }
    throw error;
  }
}
function queueCloudSave(slot) {
  if (cloudLinksStale) return;
  if (!cloudLinks[slot]) { renderCloudControls(document.getElementById('screen-home')?.classList.contains('active')); return; }
  clearTimeout(cloudTimer);
  cloudMessage = 'Progression enregistrée sur cet appareil · envoi cloud en attente.';
  renderCloudControls(document.getElementById('screen-home')?.classList.contains('active'));
  cloudTimer = setTimeout(() => flushCloudQueue(), 30000);
}
async function flushCloudQueue() {
  if (cloudBusy || cloudLinksStale || navigator.onLine === false || Object.keys(cloudLinks).length === 0) return;
  cloudBusy = true; renderCloudControls();
  try {
    await withCloudRegistryLock(async () => {
      for (const slot of Object.keys(cloudLinks)) {
        if (cloudLinks[slot].conflict) continue;
        try { await uploadCloudCareer(slot); }
        catch (error) { cloudStatus(error.message); }
      }
    });
  } catch (error) { cloudStatus(error.message);
  } finally { cloudBusy = false; renderCloudControls(); }
}
async function getRemoteCloud(link) {
  const response = await CareerCloud.request(link.code);
  const entry = await CareerCloud.open(response.envelope, link.code);
  if (!entry || !isPlayableCareerData(entry.data)) throw new Error('Cette copie distante ne contient pas une carrière valide. Aucun changement local effectué.');
  return { entry, etag: response.etag };
}
function importCloudCopy(entry, code, etag, oldSlot) {
  if (!cloudAtHome()) throw new Error('Reviens à Mes carrières avant de télécharger une progression.');
  const slot = generateSlotId();
  const result = writeCareerSave(slot, entry);
  if (!result.ok) throw new Error('La copie n’a pas pu être enregistrée sur cet appareil. Libère de l’espace ou exporte une carrière.');
  if (oldSlot) delete cloudLinks[oldSlot];
  cloudLinks[slot] = { code, etag, hash: '', syncedAt: Date.now(), conflict: false };
  return { slot, link: cloudLinks[slot] };
}
async function forgetCloudCareer(slot) {
  const forget = () => {
    if (!cloudLinks[slot]) return true;
    const previous = cloudLinks[slot]; delete cloudLinks[slot];
    if (!persistCloudLinks()) { cloudLinks[slot] = previous; renderCloudControls(true); return false; }
    cloudConflict = null; renderCloudControls(true); return true;
  };
  try { return cloudRegistryLocked ? forget() : await withCloudRegistryLock(forget); }
  catch (error) { cloudStatus(error.message); return false; }
}
function initializeCloudUI() {
  const panel = document.createElement('details'); panel.className = 'panel cloud-panel'; panel.id = 'cloud-sync-panel';
  panel.innerHTML = `<summary>Synchroniser PC et mobile</summary>
    <p>Relie tes appareils avec un code personnel. La copie est chiffrée sur ton appareil avant l’envoi. Une connexion est nécessaire pour transférer une progression.</p>
    <p class="cloud-detail">Le code donne accès à cette carrière. Conserve-le dans un endroit privé : il ne peut pas être récupéré si tu le perds. Il est mémorisé dans ce navigateur lorsque tu relies un appareil. Il ne figure pas dans les exports JSON.</p>
    <label for="cloud-career">Carrière sur cet appareil</label><select id="cloud-career"></select>
    <div class="cloud-actions"><button type="button" id="cloud-create" class="primary">Activer pour cette carrière</button><button type="button" id="cloud-send" class="primary" hidden>Envoyer ma progression</button><button type="button" id="cloud-inspect" class="secondary" hidden>Voir la copie distante</button><button type="button" id="cloud-reveal" class="secondary" hidden>Afficher le code personnel</button></div>
    <div id="cloud-code-display" hidden><label for="cloud-code-output">Code à conserver et à saisir sur l’autre appareil</label><input id="cloud-code-output" type="text" readonly autocomplete="off" spellcheck="false"><div class="cloud-actions"><button type="button" class="secondary" id="cloud-copy">Copier le code</button><button type="button" class="secondary" id="cloud-hide">Masquer le code</button></div></div>
    <div id="cloud-resolution" hidden><p id="cloud-remote-description"></p><p>Le téléchargement crée une carrière distincte et conserve la version locale actuelle. L’envoi remplace la copie distante après confirmation.</p><div class="cloud-actions"><button type="button" class="primary" id="cloud-import-remote">Importer cette copie séparément</button><button type="button" class="secondary" id="cloud-replace-remote">Remplacer la copie distante</button></div></div>
    <hr><label for="cloud-join-code">Reprendre depuis un autre appareil</label><input id="cloud-join-code" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" placeholder="KM1.…"><button type="button" class="secondary" id="cloud-join">Relier et télécharger une copie</button>
    <p id="cloud-status" role="status" aria-live="polite"></p><div class="cloud-actions"><button type="button" id="cloud-disconnect" class="secondary" hidden>Déconnecter cet appareil</button><button type="button" id="cloud-delete" class="secondary" hidden>Supprimer la copie distante</button></div>`;
  document.querySelector('#screen-home .import-panel').before(panel);
  const active = document.createElement('p'); active.id = 'cloud-active-status'; active.className = 'cloud-active-status'; active.setAttribute('role', 'status');
  document.getElementById('screen-main').append(active);
  panel.addEventListener('toggle', () => { if (panel.open) renderCloudControls(true); });
  const select = document.getElementById('cloud-career');
  select.onchange = () => { cloudConflict = null; cloudMessage = ''; document.getElementById('cloud-code-display').hidden = true; document.getElementById('cloud-code-output').value = ''; renderCloudControls(); };
  document.getElementById('cloud-create').onclick = () => cloudTask(async () => {
    if (Object.keys(cloudLinks).length >= 30) throw new Error('Le maximum de 30 liens sur cet appareil est atteint. Déconnecte une ancienne carrière avant de poursuivre.');
    const slot = selectedCloudSlot(), entry = readCloudCareer(slot), code = CareerCloud.createCode();
    const envelope = await CareerCloud.seal(entry, code), hash = await CareerCloud.fingerprint(entry);
    const response = await CareerCloud.request(code, 'PUT', envelope);
    let latest;
    try { latest = readCloudCareer(slot); }
    catch {
      // Une suppression dans un autre onglet ne doit pas créer un lien orphelin.
      await CareerCloud.request(code, 'DELETE', undefined, response.etag);
      throw new Error('Cette carrière a été supprimée pendant l’activation. La copie temporaire a été retirée.');
    }
    cloudLinks[slot] = { code, etag: response.etag, hash, syncedAt: Date.now(), conflict: false };
    const persisted = persistCloudLinks();
    document.getElementById('cloud-code-output').value = code; document.getElementById('cloud-code-display').hidden = false;
    if (persisted) {
      cloudStatus('Synchronisation activée. Conserve ce code puis saisis-le sur le second appareil.');
      if (await CareerCloud.fingerprint(latest) !== hash) queueCloudSave(slot);
    }
  });
  document.getElementById('cloud-send').onclick = () => cloudTask(() => uploadCloudCareer(selectedCloudSlot()));
  document.getElementById('cloud-join').onclick = () => cloudTask(async () => {
    if (Object.keys(cloudLinks).length >= 30) throw new Error('Le maximum de 30 liens sur cet appareil est atteint. Déconnecte une ancienne carrière avant de poursuivre.');
    const code = document.getElementById('cloud-join-code').value.trim();
    await CareerCloud.credentials(code);
    if (Object.values(cloudLinks).some(link => link.code === code)) throw new Error('Ce code est déjà relié à une carrière sur cet appareil. Choisis-la dans la liste.');
    const remote = await getRemoteCloud({ code });
    const created = importCloudCopy(remote.entry, code, remote.etag);
    created.link.hash = await CareerCloud.fingerprint(remote.entry);
    const persisted = persistCloudLinks(); renderSavesList(); renderCloudControls(true); select.value = created.slot;
    document.getElementById('cloud-join-code').value = '';
    if (persisted) cloudStatus('Copie téléchargée et enregistrée séparément. Tu peux la reprendre dans Mes carrières.');
  });
  document.getElementById('cloud-inspect').onclick = () => cloudTask(async () => {
    const slot = selectedCloudSlot(), link = cloudLinks[slot]; if (!link) return;
    const remote = await getRemoteCloud(link);
    cloudConflict = { slot, code: link.code, ...remote, localHash: await CareerCloud.fingerprint(readCloudCareer(slot)) };
    document.getElementById('cloud-remote-description').textContent = 'Copie distante : ' + cloudDescription(remote.entry);
    cloudStatus('Compare cette copie à la carrière locale choisie avant de poursuivre.');
  });
  document.getElementById('cloud-import-remote').onclick = () => cloudTask(async () => {
    const compared = cloudConflict; if (!compared || compared.slot !== selectedCloudSlot()) return;
    const created = importCloudCopy(compared.entry, compared.code, compared.etag, compared.slot);
    created.link.hash = await CareerCloud.fingerprint(compared.entry); const persisted = persistCloudLinks();
    cloudConflict = null; renderSavesList(); renderCloudControls(true); select.value = created.slot;
    if (persisted) cloudStatus('Les deux carrières sont conservées. Seule la copie téléchargée est désormais liée au cloud.');
  });
  document.getElementById('cloud-replace-remote').onclick = () => {
    const compared = cloudConflict; if (!compared || compared.slot !== selectedCloudSlot() || !cloudAtHome() || cloudBusy) return;
    showConfirm('Remplacer la copie distante affichée par cette progression locale ? Les autres appareils devront résoudre leur éventuel conflit avant de pouvoir envoyer leur version.', () => cloudTask(async () => {
      const link = cloudLinks[compared.slot]; if (!link || link.code !== compared.code) throw new Error('Le lien a changé. Compare à nouveau les copies.');
      const entry = readCloudCareer(compared.slot), hash = await CareerCloud.fingerprint(entry);
      if (hash !== compared.localHash) throw new Error('La progression locale a changé. Compare à nouveau les copies.');
      const response = await CareerCloud.request(link.code, 'PUT', await CareerCloud.seal(entry, link.code), compared.etag);
      Object.assign(link, { etag: response.etag, hash, syncedAt: Date.now(), conflict: false });
      const persisted = persistCloudLinks(); cloudConflict = null;
      if (persisted) cloudStatus('Copie distante remplacée par la progression locale choisie.');
    }), { title: 'Remplacer la copie distante ?', confirmLabel: 'Remplacer', danger: true });
  };
  document.getElementById('cloud-reveal').onclick = () => {
    const link = cloudLinks[selectedCloudSlot()]; if (!link) return;
    document.getElementById('cloud-code-output').value = link.code; document.getElementById('cloud-code-display').hidden = false;
  };
  document.getElementById('cloud-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(document.getElementById('cloud-code-output').value); cloudStatus('Code copié. Partage-le uniquement avec tes propres appareils.'); }
    catch { document.getElementById('cloud-code-output').select(); cloudStatus('Sélectionne et copie le code affiché.'); }
  };
  document.getElementById('cloud-hide').onclick = () => { document.getElementById('cloud-code-display').hidden = true; document.getElementById('cloud-code-output').value = ''; };
  document.getElementById('cloud-disconnect').onclick = () => {
    if (cloudBusy || !cloudAtHome()) return;
    const slot = selectedCloudSlot();
    showConfirm('Déconnecter cet appareil ? La carrière locale et la copie distante seront conservées. Garde ton code personnel pour te reconnecter.', () => cloudTask(async () => { if (await forgetCloudCareer(slot)) cloudStatus('Appareil déconnecté. La carrière locale est conservée.'); }), { title: 'Déconnecter cet appareil ?', confirmLabel: 'Déconnecter' });
  };
  document.getElementById('cloud-delete').onclick = () => {
    const slot = selectedCloudSlot(), link = cloudLinks[slot]; if (!link || cloudBusy || !cloudAtHome()) return;
    showConfirm('Supprimer la copie distante correspondant à la dernière révision connue ? Ta carrière locale sera conservée. Une version plus récente ne sera pas supprimée.', () => cloudTask(async () => {
      await CareerCloud.request(link.code, 'DELETE', undefined, link.etag);
      if (await forgetCloudCareer(slot)) cloudStatus('Copie distante supprimée. La carrière locale est conservée.');
    }), { title: 'Supprimer la copie distante ?', confirmLabel: 'Supprimer', danger: true });
  };
  window.addEventListener('online', () => flushCloudQueue());
  window.addEventListener('storage', event => {
    if (event.key === CLOUD_KEY) {
      // Un autre onglet peut avoir changé la révision. Ne jamais continuer avec un ETag obsolète.
      invalidateCloudLinks();
    } else if (event.key === SAVES_KEY) renderCloudControls(true);
  });
  new MutationObserver(() => {
    if (cloudAtHome()) { renderCloudControls(true); if (panel.open) flushCloudQueue(); }
    else { document.getElementById('cloud-code-display').hidden = true; document.getElementById('cloud-code-output').value = ''; }
  }).observe(document.getElementById('screen-home'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => renderCloudControls()).observe(document.getElementById('import-save-feedback'), { attributes: true, attributeFilter: ['data-importing', 'data-save-error'] });
  renderCloudControls(true);
  // La carrière locale est aussi la file durable : un rechargement reprend les envois.
  setTimeout(() => flushCloudQueue(), 1000);
}
initializeCloudUI();
