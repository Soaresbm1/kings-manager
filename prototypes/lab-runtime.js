// Le vrai jeu tourne dans une origine opaque et un stockage en mémoire.
// Aucun accès aux carrières de l'utilisateur ; aucun import de ce fichier en production.
window.KingsLab = (() => {
  const root = new URL("../", document.currentScript.src);
  const source = fetch(new URL("index.html", root)).then(response => {
    if (!response.ok) throw new Error("Lancer le laboratoire avec npm run dev.");
    return response.text();
  });
  async function mount(stage, config) {
    const html = await source;
    const frame = document.createElement("iframe");
    frame.title = "Kings Manager — session de démonstration isolée";
    frame.setAttribute("sandbox", "allow-scripts");
    const setup = `window.KINGS_LAB=${JSON.stringify(config).replace(/</g, "\\u003c")};
      let labSeed=20261102;
      Math.random=()=>((labSeed=(Math.imul(labSeed,1664525)+1013904223)>>>0)/4294967296);
      const labStorage=new Map();
      Object.defineProperty(window,'localStorage',{value:{getItem:key=>labStorage.get(key)||null,setItem:(key,value)=>labStorage.set(key,String(value)),removeItem:key=>labStorage.delete(key)}});`;
    const extraStyle = config.variant ? `<link rel="stylesheet" href="${new URL(`prototypes/match-center/variants/${config.variant}.css`, root).href}">` : "";
    frame.srcdoc = html.replace("<head>", `<head><base href="${root.href}"><script>${setup}<\/script>`)
      .replace("</head>", `${extraStyle}</head>`)
      .replace("</body>", `<script src="${new URL("prototypes/lab-fixtures.js", root).href}"><\/script></body>`);
    stage.replaceChildren(frame);
    return frame;
  }
  return { mount };
})();
