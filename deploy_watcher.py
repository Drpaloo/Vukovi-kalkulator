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
import http.cookiejar
import json
import os
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser

URL = os.environ.get("ED_URL", "https://edominations.com/en/index")
COOKIE = os.environ.get("ED_COOKIE", "")
LOGIN = os.environ.get("ED_LOGIN", "")
PASSWORD = os.environ.get("ED_PASSWORD", "")
LOGIN_URL = os.environ.get("ED_LOGIN_URL", "https://edominations.com/en/login")
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


class FormFinder(HTMLParser):
    """Nalazi formu koja ima polje za lozinku."""

    def __init__(self):
        super().__init__()
        self.forms, self.cur = [], None

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "form":
            self.cur = {"action": a.get("action", ""), "inputs": []}
        elif tag == "input" and self.cur is not None:
            self.cur["inputs"].append(a)

    def handle_endtag(self, tag):
        if tag == "form" and self.cur is not None:
            self.forms.append(self.cur)
            self.cur = None


OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
OPENER.addheaders = [("User-Agent", "Mozilla/5.0")]
if COOKIE:
    OPENER.addheaders.append(("Cookie", COOKIE))


def login():
    html = OPENER.open(LOGIN_URL, timeout=30).read().decode("utf-8", "replace")
    finder = FormFinder()
    finder.feed(html)
    form = next((f for f in finder.forms if any(i.get("type") == "password" for i in f["inputs"])), None)
    if not form:
        raise RuntimeError("na stranici za prijavu nema forme sa lozinkom (proveri ED_LOGIN_URL)")
    data = {}
    for i in form["inputs"]:
        name, typ = i.get("name"), (i.get("type") or "text").lower()
        if not name or typ in ("submit", "button", "checkbox", "radio"):
            continue
        if typ == "password":
            data[name] = PASSWORD
        elif typ in ("text", "email"):
            data[name] = LOGIN
        else:
            data[name] = i.get("value", "")
    target = urllib.parse.urljoin(LOGIN_URL, form["action"] or LOGIN_URL)
    OPENER.open(target, data=urllib.parse.urlencode(data).encode(), timeout=30).read()


def fetch():
    if LOGIN and PASSWORD and not COOKIE:
        login()
    return OPENER.open(URL, timeout=30).read().decode("utf-8", "replace")


def once():
    """Jedna provera, stanje se pamti u fajlu (za GitHub Actions)."""
    path = os.environ.get("STATE_FILE", "state.json")
    try:
        active = json.load(open(path)).get("active", False)
    except Exception:
        active = False
    try:
        err_sent = json.load(open(path)).get("err", False)
    except Exception:
        err_sent = False
    try:
        html = fetch()
    except Exception as e:
        if not err_sent:
            notify(f"Skripta ne uspeva da se prijavi/ucita igru: {e}")
        json.dump({"active": active, "err": True}, open(path, "w"))
        return
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
