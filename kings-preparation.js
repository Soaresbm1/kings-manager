/* Ordres de phases préparés : aucun effet sur le moteur ou la composition active.
 * Chargement navigateur avant app.js, ou require("./kings-preparation.js").
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KingsPreparation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PHASES = [
    { kind: "escalier", key: "escalierOrder", title: "Escalier de départ", optIn: "Préparer l’Escalier",
      description: "Ordre d’entrée : le premier de la liste entre en premier.", first: "Premier entrant" },
    { kind: "matchball", key: "matchballOrder", title: "Matchball", optIn: "Préparer le Matchball",
      description: "Ordre de priorité : les premiers restent le plus longtemps sur le terrain.", first: "Priorité maximale" }
  ];
  const mounted = new WeakMap();

  function validId(id) {
    return (typeof id === "string" && id.trim() !== "") || (typeof id === "number" && Number.isFinite(id));
  }

  function uniqueIds(ids) {
    return [...new Set(Array.isArray(ids) ? ids.filter(validId) : [])];
  }

  // Un ordre vide signifie explicitement « choisir pendant le match ».
  // Ne jamais le remplir au chargement d’une ancienne carrière.
  function normalizeOrder(order, poolIds) {
    if (order === null) return null;
    if (!Array.isArray(order)) return null;
    if (order.length === 0) return [];
    const pool = uniqueIds(poolIds);
    const allowed = new Set(pool);
    const chosen = uniqueIds(order).filter(id => allowed.has(id));
    const seen = new Set(chosen);
    return chosen.concat(pool.filter(id => !seen.has(id)));
  }

  function getPool(team, setup) {
    const players = new Map();
    for (const player of (team && Array.isArray(team.players) ? team.players : [])) {
      if (player && validId(player.id) && !players.has(player.id)) players.set(player.id, player);
    }
    return uniqueIds(setup && setup.assignments)
      .map(id => players.get(id))
      .filter(player => player && player.pos !== "GK" && !player.injured);
  }

  // Retourne le même setup ; aucune écriture dans assignments, lineup ou activeOverride.
  function normalizeSetupOrders(setup, team) {
    if (!setup || typeof setup !== "object") return setup;
    const poolIds = getPool(team, setup).map(player => player.id);
    for (const phase of PHASES) {
      if (Array.isArray(setup[phase.key]) && setup[phase.key].length > 0) {
        setup[phase.key] = normalizeOrder(setup[phase.key], poolIds);
      }
    }
    return setup;
  }

  // Le cap compte les joueurs de champ seulement. Le gardien est toujours à part.
  function unavailablePlayers(entries) {
    return new Map((Array.isArray(entries) ? entries : [])
      .filter(entry => entry && validId(entry.playerId))
      .map(entry => [entry.playerId, entry.reason]));
  }

  function unavailableLabel(reason) {
    return ({ red: "Expulsé", yellow: "Exclu temporairement", injury: "Blessé", suspended: "Suspendu" })[reason] || "Indisponible";
  }

  function previewOrder(order, poolIds, cap, unavailable) {
    const blocked = unavailablePlayers(unavailable);
    const normalized = normalizeOrder(order, uniqueIds(poolIds).filter(id => !blocked.has(id)));
    const count = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
    return Array.isArray(normalized) ? normalized.slice(0, count) : [];
  }

  function playerName(player) {
    return player && player.name ? String(player.name) : "Joueur sans nom";
  }

  function getKeeper(team, setup) {
    const assigned = new Set(uniqueIds(setup && setup.assignments));
    return (team && Array.isArray(team.players) ? team.players : [])
      .find(player => player && assigned.has(player.id) && player.pos === "GK" && !player.injured);
  }

  function render(container, options) {
    if (!container || !options || !options.setup) return;
    const doc = container.ownerDocument;
    const { team, setup, onChange, live = false, unavailable = [] } = options;
    const blocked = unavailablePlayers(unavailable);
    const state = mounted.get(container) || { open: new Map(), announcement: "" };
    mounted.set(container, state);
    container.querySelectorAll("details[data-kings-prep-phase]").forEach(details => {
      state.open.set(details.getAttribute("data-kings-prep-phase"), details.open);
    });
    const focused = doc.activeElement;
    const focusKey = focused && container.contains(focused) ? focused.getAttribute("data-kings-prep-focus") : null;
    const focusPhase = focused && container.contains(focused) ? focused.closest("[data-kings-prep-phase]")?.getAttribute("data-kings-prep-phase") : null;
    normalizeSetupOrders(setup, team);
    const pool = getPool(team, setup);
    const poolIds = pool.map(player => player.id);
    const players = new Map(pool.map(player => [player.id, player]));

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }

    function setFocusKey(node, key) {
      node.setAttribute("data-kings-prep-focus", key);
      return node;
    }

    function commit(message) {
      state.announcement = message;
      render(container, options);
      if (typeof onChange === "function") onChange(setup);
    }

    const wrapper = element("div", "kings-prep");
    const heading = element("div", "kings-prep-heading");
    heading.append(element("h3", "kings-prep-title", "Formats spéciaux"));
    heading.append(element("p", "kings-prep-caption", live
      ? "Les ordres seront utilisés au prochain changement de format."
      : "Prépare les ordres avec ton sept de départ."));
    wrapper.append(heading);

    for (const phase of PHASES) {
      const enabled = Array.isArray(setup[phase.key]) && setup[phase.key].length > 0;
      const details = element("details", "kings-prep-section");
      details.setAttribute("data-kings-prep-phase", phase.kind);
      details.open = state.open.has(phase.kind) ? state.open.get(phase.kind) : false;
      const summary = setFocusKey(element("summary", "kings-prep-summary"), phase.kind + "-summary");
      summary.append(element("span", "kings-prep-section-name", phase.title));
      const badge = element("span", "kings-prep-badge", enabled ? "Préparé" : "Choix en match");
      if (enabled) badge.classList.add("kings-prep-badge-ready");
      summary.append(badge);
      details.append(summary);
      const body = element("div", "kings-prep-body");
      const optIn = element("label", "kings-prep-opt-in");
      const checkbox = setFocusKey(element("input", "kings-prep-checkbox"), phase.kind + "-toggle");
      checkbox.type = "checkbox";
      checkbox.checked = enabled;
      checkbox.disabled = !enabled && pool.length === 0;
      optIn.append(checkbox, element("span", "kings-prep-opt-in-text", phase.optIn));
      body.append(optIn);
      body.append(element("p", "kings-prep-description", phase.description));
      checkbox.addEventListener("change", () => {
        setup[phase.key] = checkbox.checked ? [...poolIds] : null;
        commit(checkbox.checked ? phase.title + " préparé." : phase.title + " : choix pendant le match.");
      });

      if (!enabled) {
        body.append(element("p", "kings-prep-note", pool.length
          ? "L’ordre sera choisi pendant le match. Active la préparation pour le définir ici."
          : "Affecte des joueurs de champ disponibles au sept pour préparer cet ordre."));
      } else {
        const list = element("ol", "kings-prep-list");
        list.setAttribute("aria-label", phase.title + " — " + (phase.kind === "escalier" ? "ordre d’entrée" : "ordre de priorité"));
        setup[phase.key].forEach((id, index, order) => {
          const player = players.get(id);
          const name = playerName(player);
          const row = element("li", "kings-prep-player");
          const rank = element("span", "kings-prep-rank", index + 1);
          rank.setAttribute("aria-hidden", "true");
          const copy = element("div", "kings-prep-player-copy");
          copy.append(element("strong", "kings-prep-player-name", name));
          copy.append(element("span", "kings-prep-player-position", (player.pos || "Champ") + (index === 0 ? " · " + phase.first : "")));
          if (blocked.has(id)) copy.append(element("span", "kings-prep-player-unavailable", unavailableLabel(blocked.get(id))));
          const controls = element("div", "kings-prep-move-controls");
          for (const delta of [-1, 1]) {
            const direction = delta === -1 ? "up" : "down";
            const action = delta === -1 ? "Monter" : "Descendre";
            const button = setFocusKey(element("button", "kings-prep-move", delta === -1 ? "↑" : "↓"), JSON.stringify([phase.kind, direction, id]));
            button.type = "button";
            button.setAttribute("aria-label", action + " " + name + " dans l’ordre " + phase.title);
            button.title = action + " " + name;
            // Garder la cible focalisable en bord de liste évite de perdre le focus
            // après plusieurs déplacements au clavier.
            button.setAttribute("aria-disabled", String(index + delta < 0 || index + delta >= order.length));
            button.addEventListener("click", () => {
              const current = normalizeOrder(setup[phase.key], getPool(team, setup).map(item => item.id));
              if (!Array.isArray(current)) return;
              const from = current.indexOf(id);
              const to = from + delta;
              if (from < 0 || to < 0 || to >= current.length) return;
              [current[from], current[to]] = [current[to], current[from]];
              setup[phase.key] = current;
              commit(name + " : position " + (to + 1) + " sur " + current.length + ".");
            });
            controls.append(button);
          }
          row.append(rank, copy, controls);
          list.append(row);
        });
        body.append(list);
        const preview = element("div", "kings-prep-preview");
        preview.append(element("h4", "kings-prep-preview-title", "Aperçu des groupes"));
        const keeper = getKeeper(team, setup);
        preview.append(element("p", "kings-prep-keeper", keeper
          ? "Gardien inclus à part : " + playerName(keeper) + (blocked.has(keeper.id) ? " (" + unavailableLabel(blocked.get(keeper.id)) + ")." : ".")
          : "Gardien inclus à part : à affecter dans le sept."));
        for (const cap of [1, 2, 3]) {
          const ids = previewOrder(setup[phase.key], poolIds, cap, unavailable);
          const previewRow = element("div", "kings-prep-preview-row");
          const format = element("div", "kings-prep-format");
          format.append(element("strong", "kings-prep-format-title", (cap + 1) + " contre " + (cap + 1)));
          format.append(element("span", "kings-prep-format-count", cap + " joueur" + (cap > 1 ? "s" : "") + " de champ + gardien"));
          const names = ids.map(id => playerName(players.get(id))).join(", ");
          const group = element("p", "kings-prep-preview-names", names || "Aucun joueur de champ disponible");
          if (ids.length < cap) group.append(element("span", "kings-prep-shortage", " · " + (cap - ids.length) + " à affecter"));
          previewRow.append(format, group);
          preview.append(previewRow);
        }
        body.append(preview);
      }
      details.append(body);
      wrapper.append(details);
    }
    const announcement = element("p", "kings-prep-announcement", state.announcement);
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    wrapper.append(announcement);
    container.replaceChildren(wrapper);

    if (focusKey) {
      const controls = [...container.querySelectorAll("[data-kings-prep-focus]")];
      const target = controls.find(control => control.getAttribute("data-kings-prep-focus") === focusKey && !control.disabled)
        || controls.find(control => control.getAttribute("data-kings-prep-focus") === focusPhase + "-toggle" && !control.disabled)
        || controls.find(control => control.getAttribute("data-kings-prep-focus") === focusPhase + "-summary");
      if (target) target.focus({ preventScroll: true });
    }
    return wrapper;
  }

  return Object.freeze({ normalizeOrder, getPool, normalizeSetupOrders, previewOrder, render });
});
