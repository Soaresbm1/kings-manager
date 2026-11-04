// Polices locales : sources Google Fonts officielles, conservées sous SIL OFL.
// Cette commande est un outil de maintenance ; l'application ne contacte pas Google.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const directory = path.resolve(__dirname, "../assets/fonts");
const stylesheet = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Rajdhani:wght@500;600;700&display=swap";
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} : ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
async function main() {
  const css = (await download(stylesheet)).toString("utf8");
  const faces = [...css.matchAll(/\/\* (latin(?:-ext)?) \*\/\s*(@font-face\s*\{[^}]+\})/g)].map(match => {
    const body = match[2];
    const family = body.match(/font-family: '([^']+)'/)[1];
    const weight = Number(body.match(/font-weight: (\d+)/)[1]);
    const source = body.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)[1];
    const filename = `${family.toLowerCase()}-${weight}-${match[1]}.woff2`;
    return { family, weight, subset: match[1], source, filename, css: body.replace(source, filename) };
  });
  const expected = new Set(["Poppins:400", "Poppins:600", "Poppins:700", "Poppins:800", "Rajdhani:500", "Rajdhani:600", "Rajdhani:700"]);
  if (faces.length !== 14 || faces.some(face => !expected.has(face.family + ":" + face.weight))) throw new Error("Sous-ensembles de polices inattendus");
  await fs.mkdir(directory, { recursive: true });
  const entries = await Promise.all(faces.map(async face => {
    const bytes = await download(face.source);
    if (bytes.toString("ascii", 0, 4) !== "wOF2") throw new Error("WOFF2 invalide : " + face.filename);
    await fs.writeFile(path.join(directory, face.filename), bytes);
    return { family: face.family, weight: face.weight, subset: face.subset, filename: face.filename, source: face.source, bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  }));
  for (const family of ["poppins", "rajdhani"]) {
    await fs.writeFile(path.join(directory, `${family}-OFL.txt`), await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`));
  }
  await fs.writeFile(path.join(directory, "fonts.css"), "/* Poppins et Rajdhani : sources Google Fonts, licences SIL OFL locales. */\n" + faces.map(face => `/* ${face.subset} */\n${face.css}`).join("\n\n") + "\n");
  await fs.writeFile(path.join(directory, "sources.json"), JSON.stringify({ stylesheet, fonts: entries }, null, 2) + "\n");
  console.log(`${entries.length} fontes WOFF2 locales : ${entries.reduce((sum, entry) => sum + entry.bytes, 0)} octets`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
