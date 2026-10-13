// Provere bez zavisnosti: node tests/run.mjs
// Kod se čita iz pravih fajlova (scripts/*.mjs i index.html), pa se testira ono što se stvarno objavljuje.
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const pick = (src, re, what) => { const m = src.match(re); assert.ok(m, `ne nalazim ${what}`); return m[0]; };
let n = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log("ok   " + name); } catch (e) { console.error("FAIL " + name + "\n     " + e.message); process.exitCode = 1; } };

const html = read("index.html");
const medianSrc = pick(html, /const median=v=>\{[^\n]*\};/, "median u index.html");
const escSrc = pick(html, /const esc=s=>[^\n]*;/, "esc u index.html");
const median = new Function(medianSrc + "return median")();
const esc = new Function(escSrc + "return esc")();
const medianScript = new Function(pick(read("scripts/equipment-snapshot.mjs"), /const median = v => \{[^\n]*\};/, "median u skripti") + "return median")();

for (const [ime, fn] of [["index.html", median], ["equipment-snapshot.mjs", medianScript]]) {
  await test(`median (${ime}): jedna vrednost`, () => assert.equal(fn([7]), 7));
  await test(`median (${ime}): neparan broj`, () => assert.equal(fn([1, 2, 10]), 2));
  await test(`median (${ime}): paran broj je prosek dve srednje`, () => { assert.equal(fn([1, 2, 3, 10]), 2.5); assert.equal(fn([4, 6]), 5); });
  await test(`median (${ime}): duplikati`, () => { assert.equal(fn([3, 3, 3, 3]), 3); assert.equal(fn([1, 5, 5, 9]), 5); });
}

await test("esc: HTML znakovi i null", () => {
  assert.equal(esc(`<img src=x onerror="a('b')">&`), "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
  assert.equal(esc(null), ""); assert.equal(esc(undefined), ""); assert.equal(esc(5), "5");
});

// api() u svakoj skripti: uzima se stvarni tekst funkcije i pušta sa lažnim fetch-om
const mkApi = file => {
  const src = pick(read("scripts/" + file), /async function api\([^)]*\) \{[\s\S]*?\n\}\n/, "api u " + file);
  return (fetchImpl) => new Function("fetch", "API", "KEY", "sleep", "AbortSignal", src + "return api")(fetchImpl, "https://x/", "k", () => Promise.resolve(), AbortSignal);
};
const resp = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => { if (body instanceof Error) throw body; return body; } });
for (const f of readdirSync(new URL("scripts/", root)).filter(x => x.endsWith(".mjs"))) {
  if (!/async function api\(/.test(read("scripts/" + f))) continue;
  const mk = mkApi(f);
  await test(`${f}: ispravan odgovor`, async () => assert.equal(await mk(resp(200, { result: { data: 42 } }))("p", {}, true), 42));
  await test(`${f}: telo nije JSON daje razumljivu grešku`, async () => await assert.rejects(mk(resp(200, new SyntaxError("x")))("p", {}, true), /p/));
  await test(`${f}: nedostaje result daje grešku`, async () => await assert.rejects(mk(resp(200, { error: 1 }))("p", {}, true), /p/));
  await test(`${f}: HTTP 500 daje grešku`, async () => await assert.rejects(mk(resp(500, {}))("p", {}, true), f === "pool-snapshot.mjs" ? /p/ : /500/)); // pool ne gleda status, ali baca grešku kad nema result
  await test(`${f}: fetch dobija vremensko ograničenje`, async () => { let sig; await mk(async (u, o) => { sig = o && o.signal; return { status: 200, ok: true, json: async () => ({ result: { data: 1 } }) }; })("p", {}, true); assert.ok(sig, "nema signal-a"); });
}


await test("Elite case: šanse po retkosti iz tooltipa daju 100%", () => {
  const m = pick(html, /const ELITERAR=\{[^\n]*\};/, "ELITERAR u index.html");
  const R = new Function(m + "return ELITERAR")();
  assert.deepEqual(R, { 2: 50, 3: 32, 4: 15, 5: 2.5, 6: 0.5 });
  assert.equal(Object.values(R).reduce((a, b) => a + b, 0), 100);
});
console.log(n + " provera prošlo" + (process.exitCode ? ", ima grešaka" : ""));
