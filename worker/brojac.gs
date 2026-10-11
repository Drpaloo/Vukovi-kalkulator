// Google Apps Script: upisuje ko koristi kalkulator u tvoju privatnu tabelu.
// Kolone: Nik, Prvi put, Poslednji put, Ulazaka. Po igraču se upisuje najviše jednom na sat.
const TABELA = "1-TGpI6GqKT9e1l4zpJQUYQ_-X7lKNOCIA84Jp-hwAZk"; // šifra tvoje tabele iz njenog linka
const LIST = "Igrači";

function sheet_() {
  const ss = SpreadsheetApp.openById(TABELA);
  let sh = ss.getSheetByName(LIST);
  if (!sh) {
    sh = ss.insertSheet(LIST);
    sh.appendRow(["Nik", "Prvi put", "Poslednji put", "Ulazaka"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  let nik = "";
  try { nik = String(JSON.parse(e.postData.contents).n || "").trim(); } catch (x) {}
  if (!/^[\p{L}\p{N}_.\- ]{2,40}$/u.test(nik)) return ContentService.createTextOutput("x");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(), now = new Date(), key = nik.toLowerCase();
    const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues() : [];
    const i = rows.findIndex(r => String(r[0]).toLowerCase() === key);
    if (i < 0) sh.appendRow([nik, now, now, 1]);
    else if (now - new Date(rows[i][2]) >= 36e5) {
      sh.getRange(i + 2, 3, 1, 2).setValues([[now, (Number(rows[i][3]) || 0) + 1]]);
    }
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput("ok");
}

function doGet() { return ContentService.createTextOutput("ok"); }
