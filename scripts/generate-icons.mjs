import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, "..");
const src       = join(root, "public", "logo.png");
const outDir    = join(root, "public", "icons");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const icons = [
  { name: "icon-72x72.png",   size: 72  },
  { name: "icon-96x96.png",   size: 96  },
  { name: "icon-128x128.png", size: 128 },
  { name: "icon-144x144.png", size: 144 },
  { name: "icon-152x152.png", size: 152 },
  { name: "icon-180x180.png", size: 180 }, // Apple touch icon
  { name: "icon-192x192.png", size: 192 },
  { name: "icon-384x384.png", size: 384 },
  { name: "icon-512x512.png", size: 512 },
];

console.log("🍈 Gerando ícones PWA a partir de logo.png...\n");

for (const icon of icons) {
  const out = join(outDir, icon.name);
  await sharp(src)
    .resize(icon.size, icon.size, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toFile(out);
  console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`);
}

// Maskable icon (com padding de 20% para safe area)
const maskableOut = join(outDir, "icon-512x512-maskable.png");
await sharp(src)
  .resize(410, 410, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 10, g: 10, b: 10, alpha: 1 } })
  .png()
  .toFile(maskableOut);
console.log("  ✓ icon-512x512-maskable.png");

console.log("\n✅ Todos os ícones gerados em public/icons/");
