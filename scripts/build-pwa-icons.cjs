// Composition des icônes de l'application à partir du blason existant, sans le modifier.
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const root = path.resolve(__dirname, "..");
const targets = [
  { file: "icon-192.png", size: 192, fraction: 0.7 },
  { file: "icon-512.png", size: 512, fraction: 0.7 },
  { file: "apple-touch-icon.png", size: 180, fraction: 0.7 },
  // Le rectangle complet du blason reste dans le disque central de diamètre 80 %.
  { file: "icon-maskable-512.png", size: 512, fraction: 0.62 }
];
async function main() {
  const bytes = await fs.readFile(path.join(root, "images/favicon.png"));
  if (bytes.readUInt32BE(16) !== 277 || bytes.readUInt32BE(20) !== 361) throw new Error("Dimensions du blason modifiées : revoir la composition");
  const output = path.join(root, "images/pwa");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const target of targets) {
      const result = await page.evaluate(async ({ source, size, fraction }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#111512";
        context.fillRect(0, 0, size, size);
        const height = size * fraction;
        const width = height * image.naturalWidth / image.naturalHeight;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        const pixels = context.getImageData(0, 0, size, size).data;
        let opaque = true, outsideSafeZone = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          if (pixels[i + 3] !== 255) opaque = false;
          if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.4 && (pixels[i] !== 17 || pixels[i + 1] !== 21 || pixels[i + 2] !== 18)) outsideSafeZone++;
        }
        return { url: canvas.toDataURL("image/png"), opaque, outsideSafeZone, width, height };
      }, { source: "data:image/png;base64," + bytes.toString("base64"), ...target });
      if (!result.opaque || (target.file.includes("maskable") && result.outsideSafeZone)) throw new Error("Zone de sécurité ou opacité invalide : " + target.file);
      const png = Buffer.from(result.url.split(",")[1], "base64");
      if (png.readUInt32BE(16) !== target.size || png.readUInt32BE(20) !== target.size) throw new Error("Dimensions PNG invalides");
      await fs.writeFile(path.join(output, target.file), png);
      console.log(`${target.file} : ${target.size}×${target.size}, ${png.length} octets, fond opaque, débordements du masque=${result.outsideSafeZone}`);
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
