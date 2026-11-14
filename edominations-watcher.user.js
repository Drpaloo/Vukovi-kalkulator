// ==UserScript==
// @name         eDominations watcher (Telegram)
// @namespace    local.edominations.watcher
// @version      1.0
// @description  Javlja na Telegram kada tvoja skripta u bitci prestane da radi (nema aktivnosti na stranici ili se broj oruzja ne menja).
// @match        https://edominations.com/*
// @match        https://*.edominations.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.telegram.org
// ==/UserScript==

(function () {
  'use strict';

  // ====== PODESAVANJA ======
  const TELEGRAM_BOT_TOKEN = 'OVDE_TOKEN';   // od @BotFather
  const TELEGRAM_CHAT_ID   = 'OVDE_CHAT_ID'; // tvoj chat id (npr. preko @userinfobot)

  const CHECK_EVERY_SEC = 60;   // provera svaki minut
  const STALL_MINUTES   = 3;    // posle koliko minuta bez promene se smatra da je skripta stala

  // Opciono: CSS selektor elementa ciji se tekst menja dok tvoja skripta radi
  // (npr. broj preostalog oruzja / energije). Ako ostane prazno, prati se
  // bilo kakva promena DOM-a na stranici.
  const WATCH_SELECTOR  = '';

  // Opciono: regex teksta na stranici koji znaci "zavrseno" (npr. /no weapons/i)
  const DONE_REGEX      = null;
  // =========================

  let lastChange = Date.now();
  let lastValue  = null;
  let alerted    = false;

  function notify(text) {
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text })
    });
  }

  function markActive() {
    lastChange = Date.now();
    if (alerted) alerted = false; // skripta je opet krenula
  }

  if (!WATCH_SELECTOR) {
    new MutationObserver(markActive).observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true
    });
  }

  setInterval(function () {
    if (WATCH_SELECTOR) {
      const el = document.querySelector(WATCH_SELECTOR);
      const val = el ? el.textContent.trim() : null;
      if (val !== lastValue) { lastValue = val; markActive(); }
    }

    if (DONE_REGEX && DONE_REGEX.test(document.body.innerText) && !alerted) {
      alerted = true;
      notify('Skripta je zavrsena.\n' + location.href);
      return;
    }

    const idleMin = (Date.now() - lastChange) / 60000;
    if (idleMin >= STALL_MINUTES && !alerted) {
      alerted = true;
      notify('Skripta je prestala da radi (' + Math.round(idleMin) + ' min bez aktivnosti).\n' + location.href);
    }
  }, CHECK_EVERY_SEC * 1000);
})();
