// Accessibilité et présentation uniquement. Aucune décision ni donnée de simulation ici.
(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const dismissButtons = {
      "player-info-modal": "btn-player-info-close", "compare-modal": "btn-compare-close",
      "offer-modal": "offer-cancel", "secret-card-modal": "btn-secret-card-cancel",
      "president-select-modal": "btn-president-select-cancel", "confirm-modal": "btn-confirm-cancel",
      "match-tactics-modal": "btn-close-tactics-modal", "match-history-modal": "btn-history-close"
    };
    const dialogs = [...document.querySelectorAll(".match-overlay, #offer-modal")];
    const openStack = [];
    const triggers = new Map();
    const inertBefore = new Map();
    let lastTrigger = null;
    let activeDialog = null;
    const focusables = element => [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
      .filter(control => !control.closest("[inert]") && control.getClientRects().length);
    const focusDialog = dialog => (focusables(dialog)[0] || dialog.querySelector(".modal-box")).focus({ preventScroll: true });
    function updateDialogs() {
      const opened = dialogs.filter(dialog => dialog.classList.contains("active"));
      let restore = null;
      for (let i = openStack.length - 1; i >= 0; i--) {
        if (!opened.includes(openStack[i])) {
          restore ||= triggers.get(openStack[i]);
          triggers.delete(openStack[i]);
          openStack.splice(i, 1);
        }
      }
      opened.forEach(dialog => {
        if (!openStack.includes(dialog)) {
          triggers.set(dialog, document.activeElement !== document.body ? document.activeElement : lastTrigger);
          openStack.push(dialog);
        }
      });
      openStack.forEach((dialog, index) => { dialog.style.zIndex = String(100 + index * 2); });
      const top = openStack[openStack.length - 1] || null;
      if (top === activeDialog) return;
      inertBefore.forEach((value, element) => { element.inert = value; });
      inertBefore.clear();
      activeDialog = top;
      if (top) {
        let branch = top;
        while (branch.parentElement && branch !== document.body) {
          [...branch.parentElement.children].forEach(sibling => {
            if (sibling !== branch && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
              inertBefore.set(sibling, sibling.inert);
              sibling.inert = true;
            }
          });
          branch = branch.parentElement;
        }
        if (!top.contains(document.activeElement)) focusDialog(top);
      } else if (restore?.isConnected && restore.getClientRects().length) {
        restore.focus({ preventScroll: true });
      }
    }
    dialogs.forEach(dialog => {
      const box = dialog.querySelector(".modal-box");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.tabIndex = -1;
      const title = box.querySelector("h3, h2");
      if (title) {
        title.id ||= `${dialog.id}-heading`;
        box.setAttribute("aria-labelledby", title.id);
      } else box.setAttribute("aria-label", dialog.id === "compare-modal" ? "Comparer les joueurs" : "Fiche joueur");
      new MutationObserver(updateDialogs).observe(dialog, { attributes: true, attributeFilter: ["class"] });
    });
    document.addEventListener("pointerdown", event => {
      document.documentElement.dataset.input = "pointer";
      lastTrigger = event.target.closest('button, a, input, select, [tabindex="0"]');
    }, true);
    document.addEventListener("keydown", event => {
      document.documentElement.dataset.input = "keyboard";
      if (!activeDialog) return;
      if (event.key === "Escape") {
        // Un geste ou un sélecteur ouvert possède d'abord son propre Échap.
        if (document.querySelector(".tactic-drag-ghost, #active-position-picker") || event.target.tagName === "SELECT") return;
        const id = dismissButtons[activeDialog.id];
        const button = id && document.getElementById(id);
        if (button && !button.disabled && button.getClientRects().length) {
          event.preventDefault(); event.stopPropagation(); button.click();
        }
      } else if (event.key === "Tab") {
        const controls = focusables(activeDialog);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); focusDialog(activeDialog); }
        else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    }, true);
    document.addEventListener("focusin", event => {
      if (activeDialog && !activeDialog.contains(event.target)) focusDialog(activeDialog);
    });

    // Les tableaux conservent toutes leurs colonnes. Sur mobile, une vue synthétique
    // peut être remplacée par la table complète, avec le même tri et les mêmes actions.
    ["squad-table", "market-table", "standings-table"].forEach(id => {
      const table = document.getElementById(id);
      if (!table) return;
      if (!table.parentElement.classList.contains("table-scroll")) {
        const scroll = document.createElement("div");
        scroll.className = "table-scroll data-table-scroll";
        scroll.tabIndex = 0;
        scroll.setAttribute("role", "region");
        scroll.setAttribute("aria-label", id === "squad-table" ? "Statistiques de l'effectif" : "Classement complet");
        table.before(scroll); scroll.append(table);
      }
      const headers = [...table.querySelectorAll("thead th")];
      let empty = null;
      if (id === "squad-table") {
        empty = document.createElement("p"); empty.className = "mercato-empty"; empty.hidden = true;
        empty.textContent = "Aucun joueur dans cet effectif."; empty.setAttribute("role", "status");
        table.parentElement.after(empty);
      }
      if (id !== "standings-table") {
        const toolbar = document.createElement("div");
        toolbar.className = "table-tools";
        const toggle = document.createElement("button");
        toggle.className = "secondary table-detail-toggle"; toggle.type = "button";
        toggle.textContent = "Toutes les statistiques"; toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", id);
        toggle.onclick = () => {
          const expanded = table.classList.toggle("show-all-columns");
          toggle.setAttribute("aria-expanded", String(expanded));
          toggle.textContent = expanded ? "Vue synthétique" : "Toutes les statistiques";
        };
        const label = document.createElement("label"); label.textContent = "Trier par ";
        const select = document.createElement("select"); select.id = `${id}-sort`; select.setAttribute("aria-label", "Trier les joueurs");
        headers.filter(header => header.dataset.sortKey).forEach(header => {
          const option = document.createElement("option"); option.value = header.dataset.sortKey;
          option.textContent = header.childNodes[0].textContent.trim(); select.append(option);
        });
        select.onchange = () => table.querySelector(`th[data-sort-key="${select.value}"]`).click();
        const direction = document.createElement("button"); direction.type = "button";
        direction.className = "secondary table-sort-direction"; direction.textContent = "↕";
        direction.setAttribute("aria-label", "Inverser le sens du tri");
        direction.onclick = () => table.querySelector(`th[data-sort-key="${select.value}"]`).click();
        label.append(select); toolbar.append(label, direction, toggle); table.parentElement.before(toolbar);
        new MutationObserver(() => { const current = table.querySelector('th[aria-sort="ascending"], th[aria-sort="descending"]'); if (current) select.value = current.dataset.sortKey; })
          .observe(table.tHead, { attributes: true, subtree: true, attributeFilter: ["aria-sort"] });
      }
      const annotate = () => {
        if (empty) empty.hidden = table.tBodies[0].rows.length > 0;
        const current = table.querySelector('th[aria-sort="ascending"], th[aria-sort="descending"]');
        const select = document.getElementById(`${id}-sort`);
        if (select && current) select.value = current.dataset.sortKey;
        table.querySelectorAll("tbody tr").forEach(row => {
          [...row.cells].forEach((cell, index) => { cell.dataset.label = headers[index]?.childNodes[0]?.textContent.trim() || "Actions"; });
          if (row.classList.contains("clickable")) {
            row.tabIndex = 0;
            row.setAttribute("aria-label", `Voir la fiche de ${row.querySelector(".player-cell-name")?.textContent || "ce joueur"}`);
            row.onkeydown = event => {
              if (event.target === row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); row.click(); }
            };
          }
        });
      };
      new MutationObserver(annotate).observe(table.tBodies[0], { childList: true });
      annotate();
    });
    new MutationObserver(() => {
      document.querySelectorAll(".shortlist-row").forEach(row => {
        row.tabIndex = 0; row.setAttribute("role", "button");
        row.setAttribute("aria-pressed", String(row.classList.contains("selected")));
        row.onkeydown = event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); row.click(); } };
      });
    }).observe(document.getElementById("shortlist-rows"), { childList: true });
  });
})();
