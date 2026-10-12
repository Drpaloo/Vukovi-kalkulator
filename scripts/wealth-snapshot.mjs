// Dnevni snimak bogatstva članova MU (zvanični API igre). Pokreće ga GitHub Actions jednom dnevno,
// a rezultat čita kalkulator iz data/wealth.json. Igra daje samo trenutno stanje, pa se istorija pravi ovakvim snimanjem.
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://api2.warera.io/trpc/";
const FILE = new URL("../data/wealth.json", import.meta.url);
const KEEP_DAYS = 120;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(proc, input) {
  for (let t = 0; t < 6; t++) {
    const r = await fetch(API + proc + "?input=" + encodeURIComponent(JSON.stringify(input)), { signal: AbortSignal.timeout(20000) });
    if (r.status === 429) { await sleep(1500 * 2 ** t); continue; }
    if (!r.ok) throw new Error(`${proc} ${r.status}`);
    const j = await r.json().catch(() => null);
    if (!j || !j.result) throw new Error(`${proc}: neispravan odgovor`);
    return j.result.data;
  }
  throw new Error(`${proc}: previše zahteva (429)`);
}

const data = JSON.parse(readFileSync(FILE, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const mu = await api("mu.getById", { muId: data.mu });
const ids = (mu.members || []).map(m => (typeof m === "string" ? m : m.user || m._id || m.id)).filter(Boolean);
if (!ids.length) throw new Error("MU nema članova u odgovoru, ne diram fajl");

const rd = v => Math.round((v || 0) * 100) / 100;
let done = 0, failed = 0;
for (const id of ids) {
  try {
    const u = await api("user.getUserById", { userId: id });
    const w = u.stats && u.stats.wealth;
    if (!w || !(w.total > 0)) throw new Error("nema bogatstva");
    const p = (data.players[id] = data.players[id] || { n: u.username, h: [] });
    p.n = u.username;
    p.h = p.h.filter(x => x.d !== today);
    p.h.push({ d: today, t: rd(w.total), m: rd(w.money), c: rd(w.companies), i: rd(w.items), e: rd(w.equipments), w: rd(w.weapons) });
    p.h.sort((a, b) => (a.d < b.d ? -1 : 1));
    p.h = p.h.slice(-KEEP_DAYS);
    done++;
  } catch (e) { failed++; console.error("neuspeh", id, e.message); }
  await sleep(150);
}
data.updated = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data));
console.log(`snimljeno ${done}, neuspešno ${failed}, datum ${today}`);
if (done === 0) process.exit(1);
