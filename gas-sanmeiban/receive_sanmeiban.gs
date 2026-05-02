/**
 * 三命盤データ受信用 GAS WebApp
 *
 * 【セットアップ手順】
 * 1. Google Sheets を新規作成（名前: 「三命盤データ」等）
 * 2. シート名を「submissions」に変更
 * 3. A1行にヘッダーを入力:
 *    timestamp | birthdate | birthtime | sex | birthplace | sun_sign | moon_sign | asc_sign | day_master | life_palace | export_text
 * 4. 拡張機能 → Apps Script を開く
 * 5. このファイルの内容を貼り付け
 * 6. SHEET_ID を自分のスプレッドシートIDに書き換え
 * 7. デプロイ → 新しいデプロイ → ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 8. デプロイURLをコピー → index.html の GAS_WEBAPP_URL に貼り付け
 */

// ★ ここを自分のスプレッドシートIDに書き換え
const SHEET_ID = "YOUR_SPREADSHEET_ID_HERE";
const SHEET_NAME = "submissions";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    sheet.appendRow([
      new Date().toISOString(),
      data.birthdate || "",
      data.birthtime || "",
      data.sex || "",
      data.birthplace || "",
      data.sun_sign || "",
      data.moon_sign || "",
      data.asc_sign || "",
      data.day_master || "",
      data.life_palace || "",
      data.export_text || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET でアクセスされた場合（ブラウザで直接開いた場合）
function doGet() {
  return ContentService
    .createTextOutput("三命盤データ受信エンドポイントです。POSTでデータを送信してください。")
    .setMimeType(ContentService.MimeType.TEXT);
}
