// Séances optionnelles entre les rencontres. Aucun hasard et aucune mutation implicite.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ClubTraining = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_CHARS = 8000, MAX_CREDITS = 80, MAX_HISTORY = 24, MAX_PARTICIPANTS = 80;
  const SESSIONS_PER_POINT = 4;
  const MODES = Object.freeze({
    recovery: Object.freeze({ label: "Récupération", description: "+2 de forme, sans dépasser 99. Aucun effet sur les blessures.", attribute: null }),
    technique: Object.freeze({ label: "Technique", description: "−2 de forme. Après 4 séances de technique par joueur : +1 en technique, au maximum 99.", attribute: "technique" }),
    physical: Object.freeze({ label: "Physique", description: "−2 de forme. Après 4 séances physiques par joueur : +1 en physique, au maximum 99.", attribute: "physical" })
  });
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const int = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const validId = id => typeof id === "string" && id.length > 0 && id.length <= 160;
  const text = (value, fallback = "Sans nom") => typeof value === "string" && value.length ? value.slice(0, 120) : fallback;
  const epoch = value => value && int(value.season, 1, 1000000) && int(value.round, 0, 1000000)
    ? { season: value.season, round: value.round } : null;
  const compareEpoch = (a, b) => a.season - b.season || a.round - b.round;
  const failure = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

  function normalize(input) {
    const state = { version: 1, last: epoch(input?.last), credits: [], history: [] };
    const credits = new Map();
    for (const entry of Array.isArray(input?.credits) ? input.credits.slice(-160) : []) {
      if (!entry || !validId(entry.id)) continue;
      const technique = int(entry.technique, 0, 3) ? entry.technique : 0;
      const physical = int(entry.physical, 0, 3) ? entry.physical : 0;
      if (technique || physical) credits.set(entry.id, { id: entry.id, technique, physical });
    }
    state.credits = [...credits.values()].slice(-MAX_CREDITS);
    const history = new Map();
    for (const entry of Array.isArray(input?.history) ? input.history.slice(-48) : []) {
      const at = epoch(entry);
      if (!at || !own(MODES, entry.mode) || !int(entry.players, 1, MAX_PARTICIPANTS) || !int(entry.gains, 0, entry.players)) continue;
      history.set(at.season + ":" + at.round, { ...at, mode: entry.mode, players: entry.players, gains: entry.gains });
      if (!state.last || compareEpoch(at, state.last) > 0) state.last = at;
    }
    state.history = [...history.values()].sort(compareEpoch).slice(-MAX_HISTORY);
    // Le dernier engagement consommé reste conservé même si des détails anciens sont retirés.
    while (JSON.stringify(state).length > MAX_CHARS && state.history.length > 1) state.history.shift();
    while (JSON.stringify(state).length > MAX_CHARS && state.credits.length) state.credits.shift();
    return state;
  }

  function eligibility(player, mode) {
    if (!player || !validId(player.id)) return "Identité inconnue";
    if (player.injured) return "Blessé";
    if (player.suspended) return "Suspendu";
    if (!finite(player.form) || player.form < 40 || player.form > 99) return "Forme inconnue";
    if (mode === "recovery") return player.form >= 99 ? "Forme déjà à 99" : null;
    const attribute = MODES[mode]?.attribute;
    if (!attribute) return "Séance inconnue";
    if (!["speed", "technique", "physical", "mental"].every(key => finite(player[key]) && player[key] >= 0 && player[key] <= 99)) return "Attributs inconnus";
    if (!finite(player.overall) || player.overall < 0 || player.overall > 100 || !finite(player.value) || player.value < 0 || player.value > 1e12) return "Profil incomplet";
    return player[attribute] >= 99 ? "Attribut déjà à 99" : null;
  }

  function fingerprint(value) {
    const source = JSON.stringify(value);
    let a = 2166136261, b = 2246822519;
    for (let i = 0; i < source.length; i++) { const code = source.charCodeAt(i); a = Math.imul(a ^ code, 16777619); b = Math.imul(b ^ code, 3266489917); }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  }

  function availability(input, context = {}) {
    const state = normalize(input), at = epoch(context);
    if (!at || !context.team || !validId(context.team.id) || !Array.isArray(context.team.players)
      || !int(context.totalRounds, 1, 1000000)) return failure("invalid-context", "Choisis une carrière valide pour préparer une séance.");
    if (context.round >= context.totalRounds) return failure("season-finished", "Les séances sont terminées pour ce championnat. Elles reprendront à la prochaine saison.");
    if (context.blocked || context.activeMatch || context.lineupActive || context.pendingResult || context.advancing)
      return failure("busy", typeof context.blocked === "string" ? context.blocked : "Termine la préparation ou la rencontre en cours avant de lancer une séance.");
    if (state.last && compareEpoch(at, state.last) <= 0) return failure("already-trained", compareEpoch(at, state.last) === 0
      ? "La séance de cette journée de championnat a déjà été effectuée."
      : "Le suivi d’entraînement est plus avancé que cette carrière. Vérifie la sauvegarde avant de continuer.");
    const ids = context.team.players.filter(player => player && validId(player.id)).map(player => player.id);
    if (new Set(ids).size !== ids.length) return failure("ambiguous-players", "Certaines identités de joueurs sont dupliquées. La séance n’a pas été appliquée.");
    return { ok: true, state, at };
  }

  function preview(input, context = {}) {
    const available = availability(input, context);
    if (!available.ok) return available;
    const { state, at } = available;
    const mode = context.mode || "recovery";
    if (!own(MODES, mode)) return failure("invalid-mode", "Choisis un type de séance disponible.");
    const minimum = context.valueStarMin === undefined ? 60 : context.valueStarMin;
    const maximum = context.valueStarMax === undefined ? 95 : context.valueStarMax;
    if (!finite(minimum) || !finite(maximum) || minimum < 0 || maximum > 100 || maximum <= minimum)
      return failure("invalid-values", "Les paramètres de valorisation sont invalides. Aucun effet n’a été appliqué.");
    const ids = context.playerIds === undefined
      ? context.team.players.filter(player => !eligibility(player, mode)).map(player => player.id)
      : context.playerIds;
    if (!Array.isArray(ids) || ids.some(id => !validId(id))) return failure("invalid-selection", "La sélection de joueurs est invalide.");
    const selected = [...new Set(ids)].sort();
    if (!selected.length) return failure("empty-selection", "Choisis au moins un joueur apte pour cette séance.");
    if (selected.length > MAX_PARTICIPANTS) return failure("large-selection", `Choisis au maximum ${MAX_PARTICIPANTS} joueurs par séance.`);
    const effects = [];
    for (const id of selected) {
      const player = context.team.players.find(player => player?.id === id), reason = eligibility(player, mode);
      if (reason) return failure("unavailable-player", "La sélection comprend un joueur indisponible ou sans données suffisantes. Vérifie les participants.", { playerId: id });
      const attribute = MODES[mode].attribute;
      const credit = state.credits.find(entry => entry.id === id) || { id, technique: 0, physical: 0 };
      const patch = { form: Math.max(40, Math.min(99, player.form + (attribute ? -2 : 2))) };
      let creditsAfter = attribute ? credit[attribute] + 1 : null;
      const gain = !!attribute && creditsAfter >= SESSIONS_PER_POINT;
      if (gain) {
        creditsAfter = 0;
        patch[attribute] = Math.min(99, player[attribute] + 1);
        const current = { ...player, ...patch };
        patch.overall = Math.round((current.speed + current.technique + current.physical + current.mental) / 4);
        const stars = Math.max(0, Math.min(5, (patch.overall - minimum) / (maximum - minimum) * 5));
        patch.value = Math.round(patch.overall * 1000 * (.55 + .85 * Math.pow(stars / 5, 1.8)));
      }
      effects.push({ playerId: id, name: text(player.name), formBefore: player.form, formAfter: patch.form,
        attribute, attributeBefore: attribute ? player[attribute] : null,
        attributeAfter: attribute ? patch[attribute] ?? player[attribute] : null,
        creditsBefore: attribute ? credit[attribute] : null, creditsAfter, gain,
        overallBefore: finite(player.overall) ? player.overall : null, overallAfter: patch.overall ?? (finite(player.overall) ? player.overall : null),
        valueBefore: finite(player.value) ? player.value : null, valueAfter: patch.value ?? (finite(player.value) ? player.value : null), patch });
    }
    return { ok: true, code: "preview", mode, at, playerIds: selected, effects,
      gains: effects.filter(effect => effect.gain).length,
      token: fingerprint({ state, teamId: context.team.id, at, mode, minimum, maximum, effects }) };
  }

  function commit(input, context, { expectedToken } = {}) {
    const plan = preview(input, context);
    if (!plan.ok) return plan;
    if (typeof expectedToken !== "string" || expectedToken !== plan.token)
      return failure("stale-preview", "Les participants ou leurs données ont changé. Vérifie le nouvel aperçu avant de confirmer.");
    const state = normalize(input), currentIds = new Set(context.team.players.map(player => player.id));
    const credits = new Map(state.credits.filter(entry => currentIds.has(entry.id)).map(entry => [entry.id, { ...entry }]));
    for (const effect of plan.effects) {
      if (!effect.attribute) continue;
      const credit = credits.get(effect.playerId) || { id: effect.playerId, technique: 0, physical: 0 };
      credit[effect.attribute] = effect.creditsAfter;
      credits.delete(effect.playerId);
      if (credit.technique || credit.physical) credits.set(effect.playerId, credit);
    }
    const next = normalize({ version: 1, last: plan.at, credits: [...credits.values()], history: [...state.history,
      { ...plan.at, mode: plan.mode, players: plan.effects.length, gains: plan.gains }] });
    return { ok: true, code: "completed", state: next, mode: plan.mode, effects: plan.effects,
      updates: plan.effects.map(effect => ({ playerId: effect.playerId, patch: { ...effect.patch } })) };
  }

  const views = new WeakMap();
  function element(document, tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function render(container, { state: input, context = {}, onCommit } = {}) {
    if (!container) return;
    const document = container.ownerDocument, state = normalize(input);
    const stamp = `${context.careerId || ""}:${context.team?.id}:${context.season}:${context.round}`;
    let view = views.get(container);
    if (!view || view.stamp !== stamp) {
      view = { stamp, mode: "recovery", selected: new Set((context.team?.players || []).filter(player => validId(player?.id)).map(player => player.id)) };
      views.set(container, view);
    }
    container.replaceChildren();
    container.classList.add("club-training-content");
    const introduction = element(document, "p", "Une séance facultative par journée de championnat, avant le match. Elle ne fait pas avancer le calendrier.", "training-muted");
    container.append(introduction);
    const modeLabel = element(document, "label", "Type de séance"); modeLabel.htmlFor = "training-mode";
    const select = element(document, "select"); select.id = "training-mode";
    Object.entries(MODES).forEach(([key, mode]) => { const option = element(document, "option", mode.label); option.value = key; select.append(option); });
    select.value = view.mode;
    const toolbar = element(document, "div", null, "training-toolbar"); toolbar.append(modeLabel, select); container.append(toolbar);
    const description = element(document, "p", MODES[view.mode].description, "training-description"); container.append(description);
    const available = availability(state, context);
    select.disabled = !available.ok;
    const selection = element(document, "fieldset", null, "training-selection");
    selection.append(element(document, "legend", "Joueurs participants"));
    const list = element(document, "div", null, "training-player-list");
    const teamPlayers = Array.isArray(context.team?.players) ? context.team.players : [];
    const unique = new Set();
    for (const player of teamPlayers) {
      if (!validId(player?.id) || unique.has(player.id)) continue;
      unique.add(player.id);
      const reason = eligibility(player, view.mode);
      const label = element(document, "label", null, "training-player");
      const checkbox = element(document, "input"); checkbox.type = "checkbox"; checkbox.dataset.trainingPlayer = player.id;
      checkbox.checked = !reason && view.selected.has(player.id); checkbox.disabled = !!reason || !available.ok;
      const name = element(document, "span", text(player.name));
      label.append(checkbox, name);
      label.append(element(document, "span", reason || `Forme ${player.form}/99`, "training-muted"));
      checkbox.onchange = () => { if (checkbox.checked) view.selected.add(player.id); else view.selected.delete(player.id); updatePreview(); };
      list.append(label);
    }
    if (!unique.size) list.append(element(document, "p", "Aucun joueur dans cet effectif."));
    selection.append(list); container.append(selection);
    const actions = element(document, "div", null, "training-selection-actions");
    for (const [label, checked] of [["Tous les joueurs aptes", true], ["Retirer la sélection", false]]) {
      const button = element(document, "button", label, "secondary"); button.type = "button"; button.disabled = !available.ok;
      button.onclick = () => { teamPlayers.forEach(player => { if (!eligibility(player, view.mode)) { if (checked) view.selected.add(player.id); else view.selected.delete(player.id); } });
        list.querySelectorAll("input").forEach(input => { if (!input.disabled) input.checked = view.selected.has(input.dataset.trainingPlayer); }); updatePreview(); };
      actions.append(button);
    }
    container.append(actions);
    const previewRoot = element(document, "div", null, "training-preview"); previewRoot.id = "training-preview"; previewRoot.setAttribute("aria-live", "polite"); container.append(previewRoot);
    const confirm = element(document, "button", "Confirmer la séance", "primary"); confirm.type = "button"; confirm.id = "training-confirm";
    const feedback = element(document, "p", null, "training-feedback"); feedback.id = "training-feedback"; feedback.setAttribute("role", "status");
    container.append(confirm, feedback);
    let plan;
    function updatePreview() {
      const playerIds = teamPlayers.filter(player => !eligibility(player, view.mode) && view.selected.has(player.id)).map(player => player.id);
      plan = preview(state, { ...context, mode: view.mode, playerIds });
      previewRoot.replaceChildren();
      confirm.disabled = !plan.ok || typeof onCommit !== "function";
      if (!plan.ok) { previewRoot.append(element(document, "p", plan.message, "training-muted")); return; }
      previewRoot.append(element(document, "p", `${plan.effects.length} joueur${plan.effects.length === 1 ? "" : "s"} sélectionné${plan.effects.length === 1 ? "" : "s"}. Vérifie les effets avant de confirmer.`));
      const effects = element(document, "ul", null, "training-effects");
      plan.effects.forEach(effect => {
        let detail = `Forme ${effect.formBefore} → ${effect.formAfter}`;
        if (effect.attribute) detail += effect.gain
          ? ` · ${effect.attribute === "technique" ? "Technique" : "Physique"} ${effect.attributeBefore} → ${effect.attributeAfter} · crédit remis à 0/4`
          : ` · progression de séance ${effect.creditsBefore}/4 → ${effect.creditsAfter}/4`;
        if (effect.gain) detail += ` · note ${effect.overallBefore} → ${effect.overallAfter} · valeur ${effect.valueBefore.toLocaleString("fr-FR")} € → ${effect.valueAfter.toLocaleString("fr-FR")} €`;
        const row = element(document, "li"); row.append(element(document, "strong", effect.name), element(document, "span", detail)); effects.append(row);
      });
      previewRoot.append(effects);
    }
    select.onchange = () => { view.mode = select.value; render(container, { state, context, onCommit }); container.querySelector("#training-mode").focus(); };
    confirm.onclick = () => { if (!plan?.ok || typeof onCommit !== "function") return; onCommit({ mode: plan.mode, playerIds: [...plan.playerIds], token: plan.token, preview: plan }); };
    updatePreview();
    if (state.history.length) {
      const details = element(document, "details", null, "training-history"); details.append(element(document, "summary", "Séances précédentes"));
      const history = element(document, "ul");
      state.history.slice().reverse().forEach(entry => history.append(element(document, "li", `Saison ${entry.season} · Journée ${entry.round + 1} · ${MODES[entry.mode].label} · ${entry.players} joueur${entry.players === 1 ? "" : "s"}${entry.gains ? ` · ${entry.gains} progression${entry.gains === 1 ? "" : "s"} d’attribut` : ""}`)));
      details.append(history); container.append(details);
    }
  }
  return { normalize, eligibility, availability, preview, commit, render, MODES, SESSIONS_PER_POINT, MAX_CHARS, MAX_HISTORY, MAX_CREDITS, MAX_PARTICIPANTS };
});
