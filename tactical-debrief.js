/* Débrief de lecture : uniquement des instantanés observés, sans moteur ni hasard.
 * Les appels record* sont purs et renvoient une nouvelle capture. Appeler recordSample
 * aux frontières de séquences/minutes, avec getLiveStats() ET getScore(), jamais par frame.
 * Les statistiques finales ne deviennent jamais des points chronologiques.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TacticalDebrief = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1, MAX_SAMPLES = 100, MAX_DECISIONS = 60, MAX_EVENTS = 100;
  const SIDES = ["home", "away"];
  const FIELDS = ["shots", "shotsOnTarget", "xG", "passesAttempted", "passesCompleted", "interceptions", "tackles"];
  const PLAN_LABELS = { possession: "Possession", direct: "Jeu direct", transition: "Transition", zone: "Zone",
    high: "Pressing haut", low: "Bloc bas", balanced: "Équilibrée", attacking: "Offensive", cautious: "Prudente" };
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const own = (value, key) => object(value) && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  const number = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  const text = (value, limit = 240) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, limit) : "";
  const id = value => typeof value === "string" ? text(value, 80) : Number.isFinite(value) ? String(value) : null;
  const side = value => SIDES.includes(value) ? value : null;
  const order = (value, fallback) => number(value) === null ? fallback : Math.floor(value);
  const ids = value => Array.isArray(value) ? value.slice(0, 16).map(id) : [];
  const compare = (a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity) || a.order - b.order;
  const sort = values => values.map((value, index) => ({ value, index })).sort((a, b) => compare(a.value, b.value) || a.index - b.index).map(entry => entry.value);

  function setup(value) {
    const source = object(value) ? value : {};
    const result = {};
    for (const key of ["formation", "formationOOP", "attackPlan", "defensePlan", "mentality", "teamStyle"]) result[key] = text(source[key], 40);
    for (const key of ["lineup", "assignments", "assignmentsOOP", "escalierOrder", "matchballOrder", "activeOverride"]) result[key] = ids(source[key]);
    result.playerRoles = Object.fromEntries(Object.entries(object(source.playerRoles) ? source.playerRoles : {}).slice(0, 32).map(([key, value]) => [text(key, 80), text(value, 40)]));
    return result;
  }
  function score(value) {
    return { homeGoals: number(own(value, "homeGoals")), awayGoals: number(own(value, "awayGoals")) };
  }
  function statistics(value, flat) {
    const result = { home: {}, away: {} };
    for (const camp of SIDES) for (const key of FIELDS) {
      result[camp][key] = number(flat ? own(value, camp + key.charAt(0).toUpperCase() + key.slice(1)) : own(own(value, camp), key));
    }
    return result;
  }
  function sample(value, index) {
    if (!object(value) || number(value.minute) === null) return null;
    return { minute: number(value.minute), order: order(value.order, index),
      stats: statistics(value.stats), score: score(value.score), label: text(value.label, 80) };
  }
  function decision(value, index) {
    if (!object(value) || number(value.minute) === null || (value.source && value.source !== "human")) return null;
    return { minute: number(value.minute), order: order(value.order, index), side: side(value.side),
      kind: text(value.kind, 40) || "tactic", text: text(value.text || value.description), setup: setup(value.setup), source: "human" };
  }
  function eventKind(value) {
    const type = text(value.type, 40).toLowerCase().split(/\s+/)[0], line = text(value.text, 300);
    if (["goal", "owngoal", "yellow", "red", "injury", "substitution", "penalty", "format", "card", "president"].includes(type)) return type;
    if (type === "shootout") return "shootout";
    if (["miss", "save"].includes(type) && /penalty|shootout|président/i.test(line)) return "penalty";
    if (type !== "phase") return null;
    if (value.inId != null || value.outId != null) return "substitution";
    if (/carte|joker|arme secrète/i.test(line)) return "card";
    if (/président|actionne le buzzer/i.test(line)) return "president";
    if (/penalty/i.test(line)) return "penalty";
    if (/matchball|dé géant|nouveau joueur|format complet|\d+\s*(?:v|contre)\s*\d+|buts? (?:comptent|comptera)|ballon d'une autre couleur|coup d.envoi|reprise.*mi.temps|mi.temps/i.test(line)) return "format";
    if (/tirs au but|séance|fin du temps réglementaire/i.test(line)) return "shootout";
    return null;
  }
  function event(value, index) {
    if (!object(value)) return null;
    const kind = eventKind(value);
    if (!kind) return null;
    const result = { minute: number(value.minute), order: order(value.order, index), type: text(value.type, 40), kind,
      text: text(value.text, 300), side: side(value.side), score: score(value.score) };
    for (const key of ["team", "playerId", "scorerId", "assisterId", "inId", "outId", "takerId"]) {
      const valueId = key === "team" ? text(value[key], 120) : id(value[key]);
      if (valueId) result[key] = valueId;
    }
    return result;
  }
  function bounded(values, limit, preserveFirst) {
    if (values.length <= limit) return { values, omitted: 0 };
    return { values: preserveFirst ? [values[0], ...values.slice(-(limit - 1))] : values.slice(-limit), omitted: values.length - limit };
  }
  function normalize(value) {
    if (!object(value) || value.version !== VERSION) return null;
    const captured = {};
    const omitted = {};
    for (const [key, normalizer, limit] of [["samples", sample, MAX_SAMPLES], ["decisions", decision, MAX_DECISIONS], ["events", event, MAX_EVENTS]]) {
      const values = sort((Array.isArray(value[key]) ? value[key] : []).map(normalizer).filter(Boolean));
      const limited = bounded(values, limit, key === "samples");
      captured[key] = limited.values;
      omitted[key] = (number(own(value.omitted, key)) || 0) + limited.omitted;
    }
    const latest = [...captured.samples, ...captured.decisions, ...captured.events].reduce((n, entry) => Math.max(n, entry.order + 1), 0);
    return { version: VERSION, side: side(value.side), homeName: text(value.homeName, 120), awayName: text(value.awayName, 120),
      initialSetup: setup(value.initialSetup), ...captured, score: score(value.score), totals: statistics(value.totals), omitted,
      nextOrder: Math.max(latest, order(value.nextOrder, 0)) };
  }

  function create(options) {
    options = object(options) ? options : {};
    return normalize({ version: VERSION, side: options.side, homeName: options.homeName, awayName: options.awayName,
      initialSetup: options.setup || options.initialSetup });
  }
  function record(value, source, key, normalizer) {
    const capture = normalize(value) || create();
    if (!object(source)) return capture;
    const entry = normalizer({ ...source, order: capture.nextOrder }, capture.nextOrder);
    if (!entry) return capture;
    // Ignore an adjacent identical point; keep identical points on either side of a decision.
    const last = capture.samples[capture.samples.length - 1];
    if (key === "samples" && last && last.order === capture.nextOrder - 1 && last.minute === entry.minute &&
        JSON.stringify([last.stats, last.score]) === JSON.stringify([entry.stats, entry.score])) return capture;
    return normalize({ ...capture, [key]: [...capture[key], entry], nextOrder: capture.nextOrder + 1 });
  }
  const recordSample = (capture, point) => record(capture, point, "samples", sample);
  const recordDecision = (capture, value) => record(capture, object(value) ? { ...value, side: value.side || own(capture, "side") } : value, "decisions", decision);
  const recordEvent = (capture, value) => record(capture, value, "events", event);
  function eventKey(value, withoutMinute) {
    return JSON.stringify([withoutMinute ? null : value.minute, value.type.split(/\s+/)[0], value.text, value.side, value.playerId,
      value.scorerId, value.inId, value.outId, value.score]);
  }
  /** result est le résultat final déjà calculé par l'appelant. Aucun appel au moteur ici.
   * Sans capture (match IA / ancien rapport), les totaux restent seulement des totaux.
   */
  function build(options) {
    options = object(options) ? options : {};
    const capture = normalize(options.capture) || create(options);
    const result = object(options.result) ? options.result : {};
    let output = normalize({ ...capture, decisions: options.decisions || capture.decisions, samples: options.samples || capture.samples,
      score: options.result ? score(result) : capture.score, totals: options.result ? statistics(result, true) : capture.totals });
    for (const sources of [options.events, result.events]) {
      if (!Array.isArray(sources)) continue;
      const available = output.events.slice();
      const oldest = output.events[0];
      for (const raw of sources) {
        const entry = event(raw, output.nextOrder);
        if (!entry) continue;
        const found = available.findIndex(saved => eventKey(saved) === eventKey(entry) ||
          (entry.minute === null && eventKey(saved, true) === eventKey(entry, true)));
        if (found >= 0) { available.splice(found, 1); continue; }
        // Already discarded old captured events must not be counted twice on finalization.
        if (output.omitted.events && oldest && entry.minute !== null && oldest.minute !== null && entry.minute < oldest.minute) continue;
        output = recordEvent(output, entry);
      }
    }
    return output;
  }

  function delta(first, last) {
    if (!first || !last || compare(first, last) >= 0) return null;
    const difference = (a, b) => a === null || b === null || b < a ? null : Math.round((b - a) * 100) / 100;
    const stats = { home: {}, away: {} };
    for (const camp of SIDES) {
      for (const field of FIELDS) stats[camp][field] = difference(first.stats[camp][field], last.stats[camp][field]);
      stats[camp].goals = difference(first.score[camp + "Goals"], last.score[camp + "Goals"]);
    }
    return { from: first.minute, to: last.minute, fromOrder: first.order, toOrder: last.order, stats };
  }
  const lastWhere = (values, predicate) => { for (let i = values.length - 1; i >= 0; i--) if (predicate(values[i])) return values[i]; return null; };
  function read(value) {
    const data = normalize(value);
    if (!data) return { available: false, timeline: [], phases: [], comparisons: [], hasTemporalStats: false };
    const timeline = sort([...data.events.map(entry => ({ ...entry, source: "event" })), ...data.decisions.map(entry => ({ ...entry, source: "human" }))]);
    const boundaries = data.events.filter(entry => entry.kind === "format" && entry.minute !== null);
    const phases = [];
    if (data.samples.length) {
      const first = data.samples[0];
      const starts = [{ minute: first.minute, order: -1, text: "Début des observations" }, ...boundaries.filter(entry => compare(entry, first) >= 0)];
      starts.forEach((start, index) => {
        const end = starts[index + 1];
        const preceding = lastWhere(data.samples, entry => compare(entry, start) <= 0);
        // A distant point retained by compression may include several earlier formats.
        const from = preceding && start.minute - preceding.minute <= 1 ? preceding : data.samples.find(entry => compare(entry, start) >= 0);
        const to = lastWhere(data.samples, entry => !end || compare(entry, end) < 0);
        // A point collected after the next format is never attributed to this phase.
        const observed = from && to && (!end || compare(from, end) < 0) ? delta(from, to) : null;
        phases.push({ minute: start.minute, label: start.text, observed });
      });
    }
    const comparisons = data.decisions.map(entry => {
      const beforeEnd = lastWhere(data.samples, point => compare(point, entry) <= 0);
      const afterStart = data.samples.find(point => compare(point, entry) >= 0) || null;
      const beforeStart = beforeEnd && data.samples.find(point => point.minute >= Math.max(0, entry.minute - 5) && compare(point, beforeEnd) < 0);
      const afterEnd = afterStart && lastWhere(data.samples, point => point.minute <= entry.minute + 5 && compare(point, afterStart) > 0);
      return { decision: entry, before: delta(beforeStart, beforeEnd), after: delta(afterStart, afterEnd) };
    });
    const hasTemporalStats = data.samples.length > 1 && data.samples.some(point => SIDES.some(camp => FIELDS.some(field => point.stats[camp][field] !== null)));
    return { available: true, timeline, phases, comparisons, hasTemporalStats };
  }

  function node(doc, tag, className, value) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  }
  const display = (value, key) => value === null ? "—" : key === "xG" ? value.toFixed(2) : String(value);
  const minuteLabel = value => value === null ? "Minute non enregistrée" : `${value}′`;
  function renderInterval(doc, interval, data, label) {
    const box = node(doc, "div", "debrief-interval");
    box.append(node(doc, "p", "debrief-interval-title", label));
    if (!interval) { box.append(node(doc, "p", "debrief-note", "Pas assez de points observés pour cet intervalle.")); return box; }
    box.append(node(doc, "p", "debrief-note", `Points observés : ${minuteLabel(interval.from)} → ${minuteLabel(interval.to)}`));
    const table = node(doc, "table", "debrief-stats");
    table.append(node(doc, "caption", "debrief-sr-only", `${label} — variation entre deux relevés cumulés`));
    const head = node(doc, "thead"); const row = node(doc, "tr");
    for (const title of ["Équipe", "xG", "Tirs", "Score +"]) { const cell = node(doc, "th", "", title); cell.scope = "col"; row.append(cell); }
    head.append(row); table.append(head);
    const body = node(doc, "tbody");
    for (const camp of SIDES) {
      const tr = node(doc, "tr"), name = node(doc, "th", "debrief-team", data[camp + "Name"] || (camp === "home" ? "Domicile" : "Extérieur"));
      name.scope = "row"; tr.append(name);
      for (const key of ["xG", "shots", "goals"]) tr.append(node(doc, "td", "", display(interval.stats[camp][key], key)));
      body.append(tr);
    }
    table.append(body); box.append(table); return box;
  }
  function render(container, value) {
    const doc = container.ownerDocument, data = normalize(value), view = read(data);
    container.replaceChildren(); container.classList.add("debrief-root");
    container.append(node(doc, "h4", "debrief-title", "Débrief tactique"));
    if (!data) { container.append(node(doc, "p", "debrief-empty", "Aucun débrief chronologique enregistré pour ce rapport ancien ou ce match simulé.")); return view; }
    container.append(node(doc, "p", "debrief-note", "Les évolutions décrivent les intervalles observés. Le format, l’adversaire et les faits de jeu interviennent aussi : ces chiffres ne prouvent pas l’effet d’une décision."));
    if (!view.hasTemporalStats) container.append(node(doc, "p", "debrief-empty", "Statistiques temporelles indisponibles pour ce match. Les totaux finaux ne permettent pas de reconstituer leur évolution."));
    const omitted = Object.entries(data.omitted).filter(([, count]) => count).map(([key, count]) => `${count} ${key === "samples" ? "point(s)" : key === "decisions" ? "décision(s)" : "événement(s)"}`);
    if (omitted.length) container.append(node(doc, "p", "debrief-note", `Rapport compact : ${omitted.join(", ")} omis. Les intervalles affichent leurs vraies bornes.`));
    const timeline = node(doc, "ol", "debrief-timeline");
    timeline.setAttribute("aria-label", "Chronologie du match et décisions humaines");
    for (const entry of view.timeline) {
      const item = node(doc, "li", "debrief-moment" + (entry.source === "human" ? " debrief-human" : ""));
      item.append(node(doc, "span", "debrief-minute", minuteLabel(entry.minute)));
      const content = node(doc, "div", "debrief-content");
      content.append(node(doc, "span", "debrief-kind", entry.source === "human" ? "Décision humaine" : entry.kind === "format" ? "Changement de phase / format" : "Fait de jeu"));
      content.append(node(doc, "p", "debrief-description", entry.text.replace(/^\d+(?:\.\d+)?['′]\s*(?:—|-)\s*/, "") || entry.kind));
      if (entry.source === "human") {
        const chosen = [entry.setup.formation, ...[entry.setup.attackPlan, entry.setup.defensePlan, entry.setup.mentality].map(value => PLAN_LABELS[value] || value)].filter(Boolean);
        if (chosen.length) content.append(node(doc, "p", "debrief-note", `Réglages enregistrés : ${chosen.join(" · ")}`));
      } else if (entry.score.homeGoals !== null || entry.score.awayGoals !== null) {
        content.append(node(doc, "p", "debrief-score", `Score enregistré : ${display(entry.score.homeGoals)} – ${display(entry.score.awayGoals)}`));
      }
      item.append(content); timeline.append(item);
    }
    if (view.timeline.length) container.append(timeline);
    else container.append(node(doc, "p", "debrief-empty", "Aucun fait marquant ni décision humaine enregistré."));
    if (view.hasTemporalStats) {
      const phases = node(doc, "section", "debrief-section");
      phases.append(node(doc, "h5", "debrief-subtitle", "Évolution par phase observée"));
      for (const phase of view.phases) phases.append(renderInterval(doc, phase.observed, data, phase.label));
      container.append(phases);
    }
    if (view.comparisons.length) {
      const decisions = node(doc, "section", "debrief-section");
      decisions.append(node(doc, "h5", "debrief-subtitle", "Autour de vos décisions"));
      decisions.append(node(doc, "p", "debrief-note", "Fenêtre de cinq minutes de chaque côté, limitée aux relevés disponibles. Les durées observées peuvent différer."));
      for (const comparison of view.comparisons) {
        const block = node(doc, "article", "debrief-comparison");
        block.append(node(doc, "h6", "debrief-decision-title", `${minuteLabel(comparison.decision.minute)} · ${comparison.decision.text || "Décision tactique"}`));
        const grid = node(doc, "div", "debrief-comparison-grid");
        grid.append(renderInterval(doc, comparison.before, data, "Avant la décision"), renderInterval(doc, comparison.after, data, "Après la décision"));
        block.append(grid); decisions.append(block);
      }
      container.append(decisions);
    }
    container.append(node(doc, "p", "debrief-note", "— indique une donnée absente. « Score + » compte les points au tableau d’affichage, y compris les buts doubles et spéciaux."));
    return view;
  }
  return Object.freeze({ VERSION, MAX_SAMPLES, MAX_DECISIONS, MAX_EVENTS, create, recordDecision, recordSample, recordEvent,
    build, finalize: build, normalize, read, delta, render });
});
