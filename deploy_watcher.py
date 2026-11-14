#!/usr/bin/env python3
"""Javlja na Telegram kad nestane traka "Deploy Active" u eDominations.

Pokretanje (Raspberry Pi / server):
  export ED_COOKIE='ime=vrednost; ime2=vrednost2'   # Cookie header iz browsera
  export TG_TOKEN='...'                             # token od @BotFather
  export TG_CHAT_ID='...'                           # tvoj chat id
  python3 deploy_watcher.py

Opciono: ED_URL, INTERVAL (sekunde, default 60), MARKER (default "Deploy Active"),
LOGGED_IN_MARKER (tekst koji se vidi samo kad si ulogovan; ako nestane, javlja da je cookie istekao).
"""
import json
import os
import time
import urllib.request

URL = os.environ.get("ED_URL", "https://edominations.com/en/index")
COOKIE = os.environ["ED_COOKIE"]
TOKEN = os.environ["TG_TOKEN"]
CHAT_ID = os.environ["TG_CHAT_ID"]
INTERVAL = int(os.environ.get("INTERVAL", "60"))
MARKER = os.environ.get("MARKER", "Deploy Active")
LOGGED_IN_MARKER = os.environ.get("LOGGED_IN_MARKER", "")
MISSES_NEEDED = 2  # koliko uzastopnih provera bez trake pre alarma


def notify(text):
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TOKEN}/sendMessage",
        data=json.dumps({"chat_id": CHAT_ID, "text": text}).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=20).read()


def fetch():
    req = urllib.request.Request(URL, headers={"Cookie": COOKIE, "User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")


def once():
    """Jedna provera, stanje se pamti u fajlu (za GitHub Actions)."""
    path = os.environ.get("STATE_FILE", "state.json")
    try:
        active = json.load(open(path)).get("active", False)
    except Exception:
        active = False
    html = fetch()
    if LOGGED_IN_MARKER and LOGGED_IN_MARKER not in html:
        notify("Cookie je istekao ili nisi ulogovan, obnovi ED_COOKIE.")
        return
    if MARKER in html:
        active = True
    elif active:
        notify("Deploy je zavrsen (traka 'Deploy Active' je nestala).")
        active = False
    json.dump({"active": active}, open(path, "w"))


def main():
    if os.environ.get("ONCE"):
        return once()
    active = False
    misses = 0
    while True:
        try:
            html = fetch()
            if LOGGED_IN_MARKER and LOGGED_IN_MARKER not in html:
                notify("Cookie je istekao ili nisi ulogovan, obnovi ED_COOKIE.")
                return
            if MARKER in html:
                if not active:
                    print("Deploy aktivan")
                active, misses = True, 0
            elif active:
                misses += 1
                if misses >= MISSES_NEEDED:
                    notify("Deploy je zavrsen (traka 'Deploy Active' je nestala).")
                    active, misses = False, 0
        except Exception as e:  # mrezna greska ne sme da obori skriptu
            print("greska:", e)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
