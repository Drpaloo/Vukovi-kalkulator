// Cloudflare Worker: broji ko koristi kalkulator. Čuva samo nik igrača, prvi i poslednji ulazak i broj ulazaka.
// Povezati KV prostor imenom BROJAC i tajnu LOZINKA (vidi uputstvo u chatu). Spisak: https://<adresa-workera>/?k=<LOZINKA>
const NIK = /^[\p{L}\p{N}_.\- ]{2,40}$/u;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET", "access-control-allow-headers": "content-type" };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method === "POST") {
      let nik = "";
      try { nik = String(JSON.parse(await req.text()).n || "").trim(); } catch (e) {}
      if (!NIK.test(nik)) return new Response("x", { status: 400, headers: CORS });
      const key = nik.toLowerCase(), now = Date.now();
      const old = await env.BROJAC.get(key, "json");
      // upis najviše jednom na sat po igraču, da ne potrošimo besplatnu kvotu upisa
      if (old && now - old.last < 36e5) return new Response("ok", { headers: CORS });
      await env.BROJAC.put(key, JSON.stringify({ n: nik, first: old ? old.first : now, last: now, c: (old ? old.c : 0) + 1 }));
      return new Response("ok", { headers: CORS });
    }
    if (url.searchParams.get("k") !== env.LOZINKA || !env.LOZINKA) return new Response("Nema pristupa", { status: 403 });
    const rows = [];
    let cursor;
    do {
      const l = await env.BROJAC.list({ cursor });
      for (const k of l.keys) { const v = await env.BROJAC.get(k.name, "json"); if (v) rows.push(v); }
      cursor = l.list_complete ? null : l.cursor;
    } while (cursor);
    rows.sort((a, b) => b.last - a.last);
    const d = t => new Date(t).toLocaleString("sr-Latn", { timeZone: "Europe/Belgrade", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const day = rows.filter(r => Date.now() - r.last < 864e5).length, week = rows.filter(r => Date.now() - r.last < 7 * 864e5).length;
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ko koristi kalkulator</title>
<style>body{font:15px system-ui;margin:16px;background:#171a14;color:#e7eadc}table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border-bottom:1px solid #363d2e;text-align:left}th{color:#a2a993}h1{font-size:20px}.n{text-align:right}</style>
<h1>Ko koristi kalkulator</h1><p>Ukupno igrača: <b>${rows.length}</b> · aktivnih u 24 h: <b>${day}</b> · u 7 dana: <b>${week}</b></p>
<table><tr><th>Nik</th><th>Prvi put</th><th>Poslednji put</th><th class="n">Ulazaka</th></tr>${rows.map(r => `<tr><td>${esc(r.n)}</td><td>${d(r.first)}</td><td>${d(r.last)}</td><td class="n">${r.c}</td></tr>`).join("")}</table>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
};
