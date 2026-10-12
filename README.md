# Vukovi kalkulator

Kalkulator ratnog budžeta za WarEra (MU Vukovi). Upišeš ime iz igre, a stranica uživo povuče skilove, opremu, firme, cene, bitke, bounty i ugovore iz WarEra API-ja. Pokaže build sa najviše štete koji te ostavlja u plusu.

Otvori: https://drpaloo.github.io/vukovi-kalkulator/

API ključ nije obavezan (treba samo za zaradu od radnika). Ako ga upišeš, ostaje u tvom browseru i šalje se jedino na api2.warera.io.

## Sadržaj repoa
- `index.html`: cela aplikacija (HTML, CSS i JS u jednom fajlu, bez build koraka; objavljuje se svaki push na `main`)
- `data/`: `equipment.json` (cene opreme), `wealth.json` (bogatstvo članova MU), `damage.json` (šteta i bounty), `pool.json` (uzorak rundi za pool loot)
- `scripts/`: Node 20 skripte za snimke podataka, bez zavisnosti
- `.github/workflows/`: zakazani zadaci koji pokreću skripte (bogatstvo dnevno, oprema na 6 h, šteta i pool svakog sata)
- `SAZETAK.md`: detaljan opis logike, izvora podataka i otvorenih pitanja
