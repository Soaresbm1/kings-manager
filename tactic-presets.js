/* Trois emplacements tactiques persistants. Aucune règle d'effectif ou de match ici :
   app.js reste responsable de sanitizeTactic avant l'application d'une tactique. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TacticPresets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SLOTS = [
    { id: "usual", name: "Habituel" },
    { id: "protect", name: "Protéger l’avance" },
    { id: "chase", name: "Revenir au score" }
  ];
  const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const ownValue = (object, key) => {
    if (!object || typeof object !== "object") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value") ? descriptor.value : undefined;
  };
  const isRecord = value => !!value && typeof value === "object" && !Array.isArray(value);
  const token = value => typeof value === "string" && value.trim() && !BLOCKED_KEYS.has(value.trim()) ? value.trim() : null;

  function normalizeName(value, fallback) {
    if (typeof value !== "string") return fallback;
    // maxlength uses UTF-16 units too; never leave half of a surrogate pair at the end.
    const name = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
      .slice(0, 40).replace(/[\ud800-\udbff]$/, "").trim();
    return name || fallback;
  }

  function copyOrder(value) {
    if (!Array.isArray(value)) return undefined;
    const used = new Set();
    const order = [];
    for (let i = 0; i < value.length; i++) {
      const id = token(ownValue(value, String(i)));
      if (id && !used.has(id)) {
        used.add(id);
        order.push(id);
      }
    }
    return order;
  }

  /** Copie exclusivement les données tactiques. Les identifiants et plans inconnus
      restent à réparer par sanitizeTactic ; les objets importés ne sont jamais étalés. */
  function capture(setup) {
    if (!isRecord(setup)) return null;
    const tactic = {};
    const formation = token(ownValue(setup, "formation"));
    if (formation) {
      tactic.formation = formation;
      tactic.formationOOP = formation;
    }
    const assignments = ownValue(setup, "assignments");
    if (Array.isArray(assignments)) {
      tactic.assignments = Array.from({ length: assignments.length }, (_, index) => token(ownValue(assignments, String(index))));
      tactic.assignmentsOOP = tactic.assignments.slice();
    }
    ["attackPlan", "defensePlan", "mentality"].forEach(key => {
      const value = token(ownValue(setup, key));
      if (value) tactic[key] = value;
    });
    const roles = ownValue(setup, "playerRoles");
    if (isRecord(roles)) {
      tactic.playerRoles = {};
      Object.keys(roles).forEach(key => {
        if (!token(key) || BLOCKED_KEYS.has(key)) return;
        const role = token(ownValue(roles, key));
        if (role) tactic.playerRoles[key] = role;
      });
    }
    ["escalierOrder", "matchballOrder"].forEach(key => {
      const order = copyOrder(ownValue(setup, key));
      if (order) tactic[key] = order;
    });
    return Object.keys(tactic).length ? tactic : null;
  }

  /** Le format sauvegardé est toujours un tableau de trois emplacements, dans cet
      ordre. Une carrière dépourvue de ce tableau migre sa savedTactic vers Habituel. */
  function normalizePresets(value, legacyTactic) {
    const source = Array.isArray(value) ? value : null;
    return SLOTS.map((slot, index) => {
      let saved;
      if (source) {
        for (let i = 0; i < source.length; i++) {
          const candidate = ownValue(source, String(i));
          if (isRecord(candidate) && ownValue(candidate, "id") === slot.id) {
            saved = candidate;
            break;
          }
        }
      }
      return {
        id: slot.id,
        name: normalizeName(ownValue(saved, "name"), slot.name),
        tactic: capture(saved ? ownValue(saved, "tactic") : (!source && index === 0 ? legacyTactic : null))
      };
    });
  }

  /** Retourne toujours une nouvelle collection indépendante. undefined conserve la
      tactique (renommage), null vide l'emplacement, un objet remplace sa tactique. */
  function upsert(presets, id, tactic, name) {
    return normalizePresets(presets).map(slot => {
      if (slot.id !== id) return slot;
      return {
        id: slot.id,
        name: normalizeName(name, slot.name),
        tactic: tactic === undefined ? slot.tactic : capture(tactic)
      };
    });
  }

  /** La copie renvoyée peut être assainie/appliquée sans modifier la sauvegarde. */
  function getPreset(presets, id) {
    return normalizePresets(presets).find(slot => slot.id === id) || null;
  }

  function render(container, options) {
    if (!container || !container.ownerDocument) return;
    const settings = options || {};
    const presets = normalizePresets(settings.presets);
    const doc = container.ownerDocument;
    const current = capture(settings.currentSetup);
    const previousFocus = container.contains(doc.activeElement) ? doc.activeElement : null;
    const focusId = previousFocus && previousFocus.getAttribute("data-preset-id");
    const focusAction = previousFocus && previousFocus.getAttribute("data-preset-action");
    const selection = previousFocus && typeof previousFocus.selectionStart === "number"
      ? [previousFocus.selectionStart, previousFocus.selectionEnd] : null;
    const fragment = doc.createDocumentFragment();
    const grid = doc.createElement("div");
    grid.className = "preset-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Tactiques réutilisables");

    presets.forEach((slot, index) => {
      const active = slot.id === settings.activeId;
      const card = doc.createElement("article");
      card.className = "preset-card" + (active ? " preset-card-active" : "") + (!slot.tactic ? " preset-card-empty" : "");
      card.dataset.presetId = slot.id;
      card.setAttribute("aria-label", "Tactique " + (index + 1));
      const header = doc.createElement("div");
      header.className = "preset-header";
      const label = doc.createElement("label");
      label.className = "preset-name-label";
      const labelText = doc.createElement("span");
      labelText.className = "preset-label-text";
      labelText.textContent = "Nom de la tactique " + (index + 1);
      const input = doc.createElement("input");
      input.type = "text";
      input.className = "preset-name";
      input.value = slot.name;
      input.maxLength = 40;
      input.setAttribute("enterkeyhint", "done");
      input.dataset.presetId = slot.id;
      input.dataset.presetAction = "rename";
      let committedName = slot.name;
      const commitRename = () => {
        const name = normalizeName(input.value, committedName);
        input.value = name;
        if (name === committedName) return;
        committedName = name;
        if (typeof settings.onRename === "function") settings.onRename(slot.id, name);
      };
      input.addEventListener("change", commitRename);
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitRename();
          input.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          input.value = committedName;
          input.blur();
        }
      });
      label.append(labelText, input);
      const status = doc.createElement("span");
      status.className = "preset-status";
      status.textContent = active ? (slot.tactic ? "Active" : "Active · vide") : (slot.tactic ? "Enregistrée" : "Vide");
      header.append(label, status);
      const summary = doc.createElement("p");
      summary.className = "preset-summary";
      const mentalityNames = { cautious: "Prudent", balanced: "Équilibré", attacking: "Offensif" };
      summary.textContent = slot.tactic
        ? [slot.tactic.formation, mentalityNames[slot.tactic.mentality]].filter(Boolean).join(" · ") || "Configuration enregistrée"
        : "Enregistrez votre configuration courante dans cet emplacement.";
      const actions = doc.createElement("div");
      actions.className = "preset-actions";
      const load = doc.createElement("button");
      load.type = "button";
      load.className = "preset-button preset-load";
      load.textContent = "Charger";
      load.disabled = !slot.tactic || typeof settings.onLoad !== "function";
      load.setAttribute("aria-label", "Charger la tactique « " + slot.name + " »");
      load.dataset.presetId = slot.id;
      load.dataset.presetAction = "load";
      load.addEventListener("click", () => {
        if (!load.disabled) settings.onLoad(slot.id);
      });
      const save = doc.createElement("button");
      save.type = "button";
      save.className = "preset-button preset-save";
      save.textContent = "Enregistrer la configuration courante";
      save.disabled = !current || typeof settings.onSave !== "function";
      save.setAttribute("aria-label", "Enregistrer la configuration courante dans « " + slot.name + " »");
      save.dataset.presetId = slot.id;
      save.dataset.presetAction = "save";
      save.addEventListener("click", () => {
        if (!save.disabled) settings.onSave(slot.id);
      });
      actions.append(load, save);
      card.append(header, summary, actions);
      grid.appendChild(card);
    });
    fragment.appendChild(grid);
    container.replaceChildren(fragment);
    // Conserve la navigation clavier quand le contrôleur réaffiche les cartes.
    if (focusId && focusAction) {
      const target = Array.from(container.querySelectorAll("[data-preset-action]")).find(element =>
        element.dataset.presetId === focusId && element.dataset.presetAction === focusAction);
      if (target && !target.disabled) {
        target.focus({ preventScroll: true });
        if (selection && typeof target.setSelectionRange === "function") target.setSelectionRange(selection[0], selection[1]);
      }
    }
  }

  return Object.freeze({ capture, normalizePresets, upsert, getPreset, render });
});
