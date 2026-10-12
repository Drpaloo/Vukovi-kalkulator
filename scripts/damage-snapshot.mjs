// Šteta i bounty članova MU po danima. Igra daje samo ukupne zbirove, pa se dnevna vrednost dobija iz razlike
// između dva uzastopna snimka. Pokreće ga GitHub Actions na sat, a rezultat čita kalkulator iz data/damage.json.
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://api2.warera.io/trpc/";
const FILE = new URL("../data/damage.json", import.meta.url);
const KEEP_DAYS = 400;
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
const mu = await api("mu.getById", { muId: data.mu });
const ids = (mu.members || []).map(m => (typeof m === "string" ? m : m.user || m._id || m.id)).filter(Boolean);
if (!ids.length) throw new Error("MU nema članova u odgovoru, ne diram fajl");

// razlika pokriva poslednji sat, pa je pripada danu od pre pola sata (u ponoć se ne meša novi dan)
const day = new Date(Date.now() - 30 * 60000).toISOString().slice(0, 10);
const rd = v => Math.round(v * 1000) / 1000;
let done = 0, failed = 0;
for (const id of ids) {
  try {
    const u = await api("user.getUserById", { userId: id });
    const R = u.rankings || {};
    const A = R.userDamages && R.userDamages.value, B = R.userBounty && R.userBounty.value;
    if (!(A >= 0) || !(B >= 0)) throw new Error("nema zbirova");
    const p = (data.players[id] = data.players[id] || { n: u.username, d: {}, b: {} });
    p.n = u.username;
    if (p.a != null && A >= p.a) {
      p.d[day] = (p.d[day] || 0) + (A - p.a);
      p.b[day] = rd((p.b[day] || 0) + Math.max(0, B - (p.bt || 0)));
    }
    p.a = A; p.bt = B;
    for (const k of ["d", "b"]) { const ks = Object.keys(p[k]).sort(); ks.slice(0, Math.max(0, ks.length - KEEP_DAYS)).forEach(x => delete p[k][x]); }
    done++;
  } catch (e) { failed++; console.error("neuspeh", id, e.message); }
  await sleep(150);
}
data.updated = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data));
console.log(`snimljeno ${done}, neuspešno ${failed}, dan ${day}`);
if (done === 0) process.exit(1);
