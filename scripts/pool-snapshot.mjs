// Pool loot po rundama: igra posle svake runde deli predmete igračima po rangu štete u toj rundi (bolji rang, bolji predmet).
// Ovde čuvamo uzorak poslednjih rundi (šteta -> predmet), a kalkulator iz njega računa šta bi igrač dobio sa svojom štetom.
// Pokreće ga GitHub Actions, rezultat je data/pool.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API = "https://api2.warera.io/trpc/";
const FILE = new URL("../data/pool.json", import.meta.url);
const KEEP = 60, NEW_MAX = 40;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(proc, input) {
  for (let t = 0; t < 6; t++) {
    const r = await fetch(API + proc + "?input=" + encodeURIComponent(JSON.stringify(input)));
    if (r.status === 429) { await sleep(1500 * 2 ** t); continue; }
    const j = await r.json();
    if (!j.result) throw new Error(`${proc} ${JSON.stringify(j).slice(0, 120)}`);
    return j.result.data;
  }
  throw new Error(`${proc}: previše zahteva (429)`);
}

const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { rounds: [] };
const have = new Set(data.rounds.map(r => r.id));

// najnovije završene bitke, pa njihove runde koje još nemamo
const battles = [];
let cur = null;
for (let i = 0; i < 2; i++) {
  const d = await api("battle.getBattles", { isActive: false, limit: 100, ...(cur ? { cursor: cur } : {}) });
  battles.push(...d.items);
  cur = d.nextCursor;
  if (!cur) break;
}
const todo = [];
for (const b of battles) for (const rid of (b.rounds || [])) if (!have.has(rid) && todo.length < NEW_MAX) todo.push({ id: rid, at: b.endedAt || b.updatedAt || "" });

// iz liste predmeta ostavljamo gušće na vrhu (gde se predmeti brzo menjaju) i ređe dole
const keepRank = r => r <= 20 || (r <= 100 && r % 3 === 0) || r % 6 === 0;
let added = 0;
for (const t of todo) {
  try {
    let all = [], c = null;
    for (let i = 0; i < 8; i++) {
      const d = await api("battleRanking.getRanking", { roundId: t.id, dataType: "damage", type: "user", side: "merged", ...(c ? { cursor: c } : {}) });
      all.push(...d.items);
      c = d.nextCursor;
      if (!c) break;
      await sleep(80);
    }
    const w = all.filter(x => x.lootItem && x.lootItem.code);
    if (w.length < 5) continue;
    data.rounds.push({ id: t.id, at: t.at, n: all.length, w: w.filter(x => keepRank(x.rank)).map(x => [x.value, x.lootItem.code, x.lootItem.skills || {}]) });
    added++;
  } catch (e) { console.error("neuspeh runda", t.id, e.message); }
  await sleep(120);
}
data.rounds.sort((a, b) => (a.at < b.at ? 1 : -1));
data.rounds = data.rounds.slice(0, KEEP);
data.updated = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data));
console.log(`dodato rundi ${added}, ukupno ${data.rounds.length}`);
if (!data.rounds.length) process.exit(1);
