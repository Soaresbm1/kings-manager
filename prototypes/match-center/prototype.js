const variants = ["coach", "broadcast", "analysis"];
const descriptions = [
  "Banc du coach · Terrain dominant et consignes proches. Les détails statistiques prennent moins de place.",
  "Régie du match · Terrain central et fil repliable. Plus d'espace pour observer, un geste pour ouvrir les détails.",
  "Analyse tactique · Indicateurs et chronologie côte à côte. Lecture dense pour comparer le jeu aux consignes."
];
const stage = document.getElementById("stage");
const picker = document.querySelector(".proto-picker");
const highlight = picker.querySelector(".proto-picker-highlight");
const items = [...picker.querySelectorAll(".proto-picker-item:not(.proto-picker-replay)")];
const replay = picker.querySelector(".proto-picker-replay");
let current = 0;
let mounting = 0;
function moveHighlight() {
  const el = items[current];
  highlight.style.width = el.offsetWidth + "px";
  highlight.style.transform = `translateX(${el.offsetLeft}px)`;
}
async function mount(i) {
  const generation = ++mounting;
  document.getElementById("variant-description").textContent = descriptions[i];
  // Le changement de variante reste instantané ; le vrai jeu est remonté avec la même graine.
  const surface = document.createElement("div");
  surface.style.height = "100%";
  await KingsLab.mount(surface, { variant: variants[i], screen: "match", data: "demo" });
  if (generation === mounting) stage.replaceChildren(...surface.childNodes);
}
function setActive(i) {
  if (i < 0 || i >= variants.length) return;
  current = i;
  items.forEach((el, j) => {
    el.toggleAttribute("data-active", j === i);
    if (j === i) el.setAttribute("aria-current", "true");
    else el.removeAttribute("aria-current");
  });
  moveHighlight();
  const url = new URL(location);
  url.searchParams.set("v", i + 1);
  history.replaceState(null, "", url);
  mount(i).catch(error => { stage.textContent = error.message; });
}
items.forEach((el, i) => el.addEventListener("click", () => setActive(i)));
replay.addEventListener("click", () => mount(current));
window.addEventListener("resize", moveHighlight);
function handleShortcut(event) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const number = parseInt(event.key, 10);
  if (number >= 1 && number <= variants.length) setActive(number - 1);
  else if (event.key === "ArrowRight") setActive((current + 1) % variants.length);
  else if (event.key === "ArrowLeft") setActive((current - 1 + variants.length) % variants.length);
  else if (/^r$/i.test(event.key)) mount(current);
}
document.addEventListener("keydown", handleShortcut);
window.addEventListener("message", event => {
  if (event.source === stage.querySelector("iframe")?.contentWindow && event.data?.type === "kings-lab-shortcut") {
    handleShortcut({ key: event.data.key, target: { tagName: "BODY" } });
  }
});
setActive(Math.max(0, Math.min(2, (parseInt(new URLSearchParams(location.search).get("v"), 10) || 1) - 1)));
requestAnimationFrame(() => requestAnimationFrame(() => picker.setAttribute("data-ready", "")));
