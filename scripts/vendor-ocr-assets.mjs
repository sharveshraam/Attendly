/**
 * Copy the locally installed Tesseract.js worker, WASM core and English model
 * into `public/vendor/ocr` so browser OCR works with zero external network
 * calls (CSP stays `self`-only). Output is generated and gitignored; this runs
 * automatically on `npm install` / `npm ci`, so Vercel builds get it too.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "vendor", "ocr");
mkdirSync(output, { recursive: true });

const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt", "worker.min.js.LICENSE.txt"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/LICENSE", "TESSERACT-CORE-LICENSE.txt"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];

let copied = 0;
for (const [from, to] of assets) {
  const source = join(root, from);
  if (!existsSync(source)) {
    // An optional licence file must never fail an install.
    if (to.includes("LICENSE")) continue;
    console.warn(`[vendor:ocr] missing ${from}; run npm install first.`);
    continue;
  }
  const target = join(output, to);
  if (existsSync(target) && statSync(target).size === statSync(source).size) continue;
  copyFileSync(source, target);
  copied += 1;
}
console.log(`[vendor:ocr] ${copied} asset(s) updated in public/vendor/ocr`);
