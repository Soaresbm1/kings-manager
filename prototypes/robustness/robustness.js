const stage = document.getElementById("stage");
const screen = document.getElementById("lab-screen");
const data = document.getElementById("lab-data");
const params = new URLSearchParams(location.search);
screen.value = params.get("screen") || "squad";
data.value = params.get("data") || "demo";
let generation = 0;
async function renderLab() {
  if (["empty", "one"].includes(data.value) && !["squad", "market"].includes(screen.value)) screen.value = "squad";
  const url = new URL(location);
  url.searchParams.set("screen", screen.value); url.searchParams.set("data", data.value);
  history.replaceState(null, "", url);
  const current = ++generation;
  const surface = document.createElement("div"); surface.style.height = "100%";
  await KingsLab.mount(surface, { screen: screen.value, data: data.value });
  if (current === generation) stage.replaceChildren(...surface.childNodes);
}
screen.onchange = data.onchange = renderLab;
document.getElementById("lab-reload").onclick = renderLab;
renderLab().catch(error => { stage.textContent = error.message; });
