// Snimak cena opreme (poslednjih 40 prodaja po komadu, medijana i zavisnost cene od kvaliteta).
// Prodaje opreme igra daje samo uz API ključ, pa ovo radi GitHub Actions sa tajnom WARERA_API_KEY,
// a kalkulator čita data/equipment.json, tako da svaki igrač dobija sveže cene i bez svog ključa.
import { writeFileSync } from "node:fs";

const API = "https://api2.warera.io/trpc/";
const KEY = process.env.WARERA_API_KEY || "";
const FILE = new URL("../data/equipment.json", import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// medijana sortiranog niza: srednji element, a za paran broj prosek dva srednja
const median = v => { const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

if (!KEY) { console.log("WARERA_API_KEY nije podešen, preskačem (dodaj ga kao tajnu u Settings > Secrets and variables > Actions)."); process.exit(0); }

async function api(proc, input, auth) {
  for (let t = 0; t < 6; t++) {
    const r = await fetch(API + proc + "?input=" + encodeURIComponent(JSON.stringify(input)), { headers: auth ? { "X-API-Key": KEY } : {}, signal: AbortSignal.timeout(20000) });
    if (r.status === 429) { await sleep(1500 * 2 ** t); continue; }
    if (!r.ok) throw new Error(`${proc} ${r.status}`);
    const j = await r.json().catch(() => null);
    if (!j || !j.result) throw new Error(`${proc}: neispravan odgovor`);
    return j.result.data;
  }
  throw new Error(`${proc}: previše zahteva (429)`);
}

const cfg = (await api("gameConfig.getGameConfig", {}, false)).items;
const WEAPONS = ["knife", "gun", "rifle", "sniper", "tank", "jet"];
const SLOTS = ["helmet", "chest", "pants", "boots", "gloves"];
const codes = [...WEAPONS, ...SLOTS.flatMap(s => [1, 2, 3, 4, 5, 6].map(r => s + r))];

const items = {};
let ok = 0;
for (const code of codes) {
  try {
    const d = await api("transaction.getPaginatedTransactions", { itemCode: code, transactionType: "itemMarket", limit: 40 }, true);
    const good = d.items.filter(t => (t.item?.state || 0) >= 20 && Number.isFinite(t.money));
    const v = good.map(t => t.money * 100 / t.item.state).sort((a, b) => a - b);
    if (!v.length) continue;
    const e = { price: Math.round(median(v) * 1000) / 1000 };
    const rng = cfg[code]?.dynamicStats || {}, st = "attack" in rng ? "attack" : Object.keys(rng)[0];
    const pts = good.map(t => { const x = t.item.skills?.[st]; return x == null ? null : [(x - rng[st][0]) / ((rng[st][1] - rng[st][0]) || 1), t.money * 100 / t.item.state]; }).filter(Boolean);
    if (pts.length >= 8) {
      const mq = pts.reduce((a, p) => a + p[0], 0) / pts.length, mp = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const vr = pts.reduce((a, p) => a + (p[0] - mq) ** 2, 0);
      if (vr > 0.05) { const b = Math.max(0, pts.reduce((a, p) => a + (p[0] - mq) * (p[1] - mp), 0) / vr); e.a = Math.round((mp - b * mq) * 1000) / 1000; e.b = Math.round(b * 1000) / 1000; }
    }
    items[code] = e; ok++;
  } catch (err) { console.error("neuspeh", code, err.message); }
  await sleep(120);
}
if (ok < 20) { console.error(`samo ${ok} od ${codes.length} komada, ne diram fajl`); process.exit(1); }
writeFileSync(FILE, JSON.stringify({ updated: new Date().toISOString(), items }));
console.log(`snimljeno ${ok} od ${codes.length} komada`);
