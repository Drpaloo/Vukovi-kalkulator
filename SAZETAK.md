# Vukovi kalkulator: sažetak projekta (stanje 12. 10. 2026)

## 1. Šta je ovo
Kalkulator ratnog budžeta za igru WarEra (MU Vukovi). Igrač upiše ime iz igre, a stranica uživo povuče njegove skilove, opremu, firme, cene, bitke, bounty i ugovore i izračuna build sa najviše štete koji ga ostavlja u plusu. API ključ nije obavezan (treba samo za zaradu od radnika).
- Sajt (GitHub Pages): https://drpaloo.github.io/vukovi-kalkulator/
- Repo: Drpaloo/Vukovi-kalkulator, grana `main` (nema build koraka, objavljuje se svaki push)
- Jezik interfejsa: srpski latinica, engleski nazivi iz igre (attack, crit, pill, steak, scraps…), osim „ukupna vrednost" (net worth)

## 2. Fajlovi
| Fajl | Šta radi |
|---|---|
| `index.html` (~205 KB, ~1700 redova) | Cela aplikacija: HTML + CSS + JS u jednom fajlu |
| `data/equipment.json` | Cene opreme po komadu (medijana poslednjih 40 prodaja + linearna ocena po kvalitetu a+b·q), osvežava ga GitHub zadatak na 6 h |
| `data/wealth.json` | Bogatstvo 25 članova MU Vukovi po danima (istorija 30+ dana, backfill sa SPYWarera, dalje dnevni snimak) |
| `data/damage.json` | Šteta i bounty članova MU po danima + poslednji zbirovi (`a`, `bt`) za računanje razlike, satni snimak |
| `data/pool.json` | Uzorak 38–60 poslednjih rundi: šteta → predmet (za pool loot), satni snimak |
| `scripts/*.mjs` | `wealth-snapshot`, `equipment-snapshot`, `damage-snapshot`, `pool-snapshot` (Node 20, bez zavisnosti) |
| `.github/workflows/` | `wealth.yml` (dnevno 23:40 UTC), `equipment.yml` (svakih 6 h, treba secret `WARERA_API_KEY`), `damage.yml` (svakog sata u :07, pokreće damage + pool snimak) |
| `README.md` | Kratak opis (zastareo, ne pominje nove funkcije) |

## 3. Struktura `index.html`
### HTML
Gornja traka (ime, „Izveštaj", „Uputstvo", promena igrača), prijava (ime, opcioni API ključ, „Zapamti me"), 5 tabova u donjoj traci:
- **Pregled**: kartice (Build za danas, Bogatstvo, Bogatstvo MU, Šteta MU, Skilovi, Prestiž, Firme, Bitke 7 dana). Kartica je kompaktna `.ovc2`, široke su `.ovc.wide`.
- **Danas**: izbor bitke i strane, bonus bitke (lista stavki), polje ugovor/bounty, **Preporuka** (pločice opreme, dnevno trošenje opreme, napomena o cenama), **Kad ti se napuni health** (+ održiv build bez pill-a), **Pill debuff, preliv** (3 opcije u padajućim menijima), „Probaj svoj build" (ručni izbor + dnevni obračun), tvoje bitke 7 dana.
- **Oprema i market**: „Oprema za tvoj izbor: pravi ili kupi" (tabela sa linkom Kupi ↗), izrada nasumičnog komada, case-ovi i višak opreme, cene po komadu (polje za ručnu cenu) i sve kombinacije boja.
- **Skilovi**: ručni raspored, optimizator rasporeda, šta da kupiš, slobodni poeni.
- **Ekonomija** (oznaka u kodu `ekonomija`): firme, najbolji proizvodi na mapi, firme uživo.
- Uputstvo (`#guideBox`) otvara se dugmetom, ažurirano 12. 10.

### CSS (u `<style>`, promenljive u `:root`)
Tamna/svetla tema preko `prefers-color-scheme`, boje: `--brass` (zlatna za istaknute brojeve), `--good`, `--bad`, `--line`. Klase: `.panel`, `.tile` (pločice opreme), `.ldg` (obračun), `.dg` (7 polja štete po danima), `.ovc/.ovc2/.ovn3` (kartice pregleda), `.pin` (polje ručne cene), `.tbuy` (link kupi), `.guide`. Mobilni prikaz je prioritet.

### JS (jedan `<script>`, ~105 funkcija)
Glavni delovi:
- `loadUser(name)`: traži igrača po imenu, učitava skilove, opremu, MU, državu, savez (udeo razvoja sveta), firme, cene, aktivne bitke; zatim `loadWeek`, `wealthTrack`, `data/*.json`.
- `stats`, `sess`, `calc`: proračun štete, trošenja i salda.
- `bestBuild/bestBuild0`, `tuneQ`: pretraga preporuke.
- `renderRec`, `renderHp`, `renderDebuff`, `ovRender`, `muDamageCard`, `muWealthCard`, `wealthCard`, `tables`, `skManual`, `prestLine`.
- `checkDefs/autoChecks/applyChecks`: bonus bitke. `loadOrders`, `loadContracts`, `setBountyFromBattle`: naredbe, ugovori, bounty.
- `lootVal`, `poolRounds/poolAt/poolAuto`: pool loot. `market/buy/itemCost/craftCost/way/bestWay`: cene i kupi-ili-napravi.
- Ažuriranje stranice: `VKV` (10 hex znakova) se menja pri svakoj izmeni, otvorena stranica ga poredi i javlja novu verziju.

## 4. Logika proračuna
**Šteta jednog udarca** = `napad (skil+oružje+preliv) × (1+bonus bitke) × (1+municija) × pill × (1+rang)`. Bonusi bitke se **sabiraju** u jedan množilac (potvrđeno sa +100% na slikama iz igre), ostalo se množi zasebno. Napad 605 koji pokazuje igra već sadrži municiju i rang. Očekivanje: `at·(1+crit%·critDmg)` pri preciznosti 100. U igri se uočava odstupanje oko ±8% po udarcu.
**Armor/dodge**: `x/(x+40)`, armor u koracima po 0,1 health-a, pa višak iznad praga stepenice ne donosi ništa. Health regen u celim tickovima na početku svakog punog sata (UTC), jedan udarac košta 2–3 health-a.
**Trošenje opreme**: oružje −1% po udarcu, svaki komad seta −1% po neizbegnutom udarcu, 100% je jedan komad. Prikazuje se „Dnevno trošenje opreme".
**Sesije**: glavna 8 h pod pill-om (+60%, pun health + 8 h regena), druga sesija ostatak dana (debuff −60% traje 15,5 h). Hrana: do `floor(hunger·0,1·24)` jela dnevno.
**Cena opreme**: `market(code,q)` = medijana prodaja ili `a+b·q`; `buy()` = ručna cena ako je upisana, inače isto (dodatak +25% je isprobano i uklonjeno, `ASKM=1`). Kupi ili napravi: jeftinije između `buy` i `craftCost`. Link „Kupi ↗" vodi na `app.warera.io/market/equipments?item=<kod>` (neproveren kao prijavljen igrač).
**Preporuka** (`bestBuild0`): za pill da/ne pretraži oružje × set × municija × hrana × kvalitet za glavnu i drugu sesiju odvojeno, uslov saldo ≥ `NETMIN` (0), najveća šteta; među svim buildovima do 1,5% ispod najbolje bira onaj sa najviše plusa (stabilnost, rešava „tenk i plavi" skakanje). `tuneQ` posle bira kvalitet po komadu.
**Prihod u saldu**: firme (API) + rad + case-ovi iz pogođenih udaraca + wooden case + **pool loot** + scraps + bounty/ugovor.
**Pool loot**: igra posle svake runde deli predmete po rangu štete u rundi (88% učesnika dobije predmet, bolji rang bolji predmet). Model: uzorak rundi iz `data/pool.json` → za štetu po rundi (dnevna šteta / broj rundi dnevno iz tvojih poslednjih 7 dana) uzme predmet za taj rang, vrednuje ga po tržišnoj ceni (min. vrednost rastavljanja), prosek preko rundi × rundi na dan. Polje „Pool loot dnevno" prazno = auto. Provereno: 97/dan modela naspram 117 stvarno.
**Ugovor i bounty**: ugovor ima prioritet nad bounty-jem. Čita se `mercenaryContractAuction.getPaginatedAuctions` (status `won` i `active`). Popunjenost = zbir `totalMoneyFromContract` članova MU iz `battleLootSummary` (bez ključa), troši se redom dobijanja. Ugovor u licitaciji se računa ako MU vodi ponudu.
**Bonus bitke** (`checkDefs`): patriot +20, naredba države i MU (high 15 / low 5, čita se iz `battleOrder`), MU štab nivo×5, bunker (odbrana), vojna baza (napad, pola ako si saveznik), savez (+20 do 10% udela razvoja sveta, minus 4 po procentu preko), saveznik +10 (kad nije član saveza), zakleti neprijatelj +10, minusi (−50 drži region, −25 izgubljen region). Server igre (`battle.getDamageBonuses`) ne daje ove brojeve ni API ključu.
**Preliv posle pill-a**: kad health istekne debuff, udaraš samo ono što bi se bacilo preko pune trake; tri ponuđena seta u padajućim menijima.
**Kad ti se napuni health**: vreme do punog health-a (ticks), koliko propada za izabrano trajanje spavanja (4–12 h), i održiv build bez pill-a (regen + hrana, najveća šteta u plusu).
**Prestiž**: nivo 50 = 86.600 XP, prestiž oduzima 65.000, XP množilac 1,5 pa +0,1; procena iz dnevnih/nedeljnih/mesečnih misija.
**Skilovi**: optimizator rasporeda (reset 0,5 coina po poenu, zaključava 7 dana), plan XP-a.
**Wealth/MU**: bogatstvo igrača (localStorage + `wealth.json`), kartica MU sa zbirom, rastom po danu i tabelom. **Šteta MU**: 7 polja po danima, tri kocke za štetu i tri za bounty, prosek 30 dana, uživo = satni snimak + trenutno stanje 25 članova (20 s posle učitavanja, pa na 10 min dok je stranica otvorena).

## 5. API izvori
- Javno (bez ključa): `battle.getBattles/getById`, `battleLootSummary.getByBattleAndUser` (pool loot, bounty, ugovor po igraču), `battleRanking.getRanking` (rang liste sa predmetima, parametar `side` obavezan), `mercenaryContractAuction.getPaginatedAuctions`, `battleOrder.getByBattle`, `user.getUserById/getUserLite`, `mu.getById`, `alliance.getById`, `gameStat.getWorldDevelopment`, `gameConfig.getGameConfig`, `itemTrading.getPrices` (samo resursi), `inventory.fetchCurrentEquipment`.
- Traži ključ: `worker.getWorkers`, `transaction.getPaginatedTransactions` (cene opreme po kvalitetu).
- Zatvoreno za API ključ: `itemOffer.getItemOffers` (ponude na marketu), `battle.getDamageBonuses`.
- SPYWarera (Laravel Inertia) nema CORS, korišćen samo jednom sa servera za backfill (bogatstvo, šteta, bounty).

## 6. Šta je urađeno (po redosledu)
1. Provera tačnosti (7 dana bitaka, transakcije, bogatstvo), armor stepenice, dodge, pantalone se troše kao ostala oprema.
2. Prestiž i XP predviđanje (kartice + linija iznad skilova), pravila misija.
3. Bonus naredbe iz igre, ugovor ispred bounty-ja sa detekcijom popunjenosti, ugovori bez ključa.
4. Pill debuff/preliv sa tri opcije u padajućim menijima.
5. Redizajn tabova (Pregled/Danas/Oprema/Skilovi/Ekonomija), uklonjeni suvišni paneli, Uputstvo (dugme).
6. Poređenje sa SPYWarera Combat optimizatorom, praćenje bogatstva (localStorage + dnevni GitHub snimak za MU Vukovi).
7. Učitavanje bitaka/lootа/ugovora bez ključa; dnevni snimak cena opreme (GitHub zadatak, secret `WARERA_API_KEY` je postavljen).
8. Kartica Šteta MU (po danima, bounty, uživo), satni snimak.
9. pločice opreme samo sa cenom i linkom Kupi ↗, broj metaka, dnevno trošenje opreme, kartica „Kad ti se napuni health" + održiv build.
10. Pool loot iz rang lista rundi, stabilnija preporuka, ugovori u licitaciji, ažurirano Uputstvo.
11. Provera koda (sintaksa, JSON, učitavanje stranice), uklonjena kolona „Kvalitet" (Min/Avg/Max) iz tabele opreme, prepisan README.

## 7. Nedovršeno / otvorena pitanja
- **Bonus saveza**: kalkulator daje 17,39 za ATLAS (K0ld ukupno 82,39), igrač je pomenuo 82,7. Treba slika „Bonus damages" iz igre da se potvrdi formula saveza.
- **Cene ponuda na marketu** ne mogu da se čitaju automatski (zatvoreno za API ključ). Ostaje procena iz prodaja + ručno polje. Link „Kupi ↗" nije proveren na prijavljenom nalogu (parametar `?item=`).
- Ugovor „samo za profesionalce" (`professionalsOnly`): pravilo igre nije poznato, kalkulator samo ispiše napomenu.
- Pool loot model validiran na jednom nalogu (97 naspram 117 dnevno); uzorak rundi je mali (38–60). Procena dolazi iz tvojih rundi/dan koje zavise od istorije.
- Zaokružena preporuka druge sesije može da se menja između jeftinih opcija kad se menja bounty (zanemarljiva šteta).
- Zarada od radnika traži API ključ (bez njega procena).
- Mrtav kod, README je zastareo, `FALLBACK.equipment` je stari snimak od 9. 10.
- Istorija bogatstva za igrače van MU Vukovi počinje od prvog otvaranja (samo localStorage).

## 8. Radni dogovori sa korisnikom
- Odgovori na srpskom, latinica, minimum engleskih reči u razgovoru.
- Pitanja kroz kutiju sa opcijama (kad kutija bude odbijena, pitati običnim tekstom). Tekst za kopiranje u poseban blok.
- Svaku izmenu: testirati Playwright-om (`/opt/node-tools/node_modules/playwright`, lokalni `python3 -m http.server 8765`), proveriti sintaksu, podići `VKV`, commit + push na `main`. Odgovor mora da kaže šta je urađeno i šta nije moglo da se proveri.
- Ne zaobilaziti zaštitu igre (ponude na marketu, bonusi), ne tražiti prijavu igrača.
