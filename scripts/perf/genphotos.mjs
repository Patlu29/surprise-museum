import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const sizes = [
  [3000, 2000],
  [2000, 3000],
  [3000, 2250],
  [2250, 3000],
  [3000, 2000],
  [2400, 2400],
];
for (let i = 0; i < 20; i++) {
  const [w, h] = sizes[i % sizes.length];
  const b64 = await page.evaluate(
    ([w, h, i]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      const hue = (i * 47) % 360;
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsl(${hue},60%,55%)`);
      grad.addColorStop(1, `hsl(${(hue + 90) % 360},55%,35%)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      let s = i * 9301 + 49297;
      const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let k = 0; k < 400; k++) {
        g.fillStyle = `hsla(${Math.floor(rnd() * 360)},70%,${30 + rnd() * 50}%,${0.15 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 20 + rnd() * 220, 0, 7);
        g.fill();
      }
      // fine grain so the JPEG is a realistic size
      const id = g.getImageData(0, 0, w, h);
      const d = id.data;
      for (let p = 0; p < d.length; p += 4) {
        const n = (rnd() - 0.5) * 40;
        d[p] += n;
        d[p + 1] += n;
        d[p + 2] += n;
      }
      g.putImageData(id, 0, 0);
      g.fillStyle = '#fff';
      g.font = `bold ${Math.round(h / 8)}px sans-serif`;
      g.fillText(`Photo ${i + 1}`, w * 0.08, h * 0.5);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    [w, h, i],
  );
  fs.writeFileSync(
    `${out}/photo-${String(i + 1).padStart(2, '0')}.jpg`,
    Buffer.from(b64, 'base64'),
  );
}
await browser.close();
console.log(
  fs
    .readdirSync(out)
    .map((f) => `${f} ${(fs.statSync(out + '/' + f).size / 1024).toFixed(0)}kB`)
    .join('\n'),
);
