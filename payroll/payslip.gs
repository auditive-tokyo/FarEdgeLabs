/**
 * 役員報酬の給与明細を PDF で発行し、Google Drive に保存する。
 *
 * 前提（これが変わったらコードではなくシートを直す）:
 *   - 役員1名、定期同額。翌月払い（7月分 → 8月25日支給）
 *   - 住民税は普通徴収。控除欄に無い
 *   - 介護保険料あり（40歳以上）
 *   - 雇用保険・労災は役員のため対象外
 */

const SHEET = {
  設定: '設定',
  マスタ: '単価マスタ',
  レイアウト: '明細レイアウト',
  ログ: '発行ログ',
};

/**
 * 明細レイアウトのどのセルに何を書くか。
 * レイアウトを作り替えたときに触るのはここだけで済むよう、
 * セル番地をコードから切り出してある。
 */
const CELL = {
  対象年月: 'B2',
  支給日: 'E2',
  会社名: 'B4',
  氏名: 'B6',
  役員報酬: 'C9',
  支給合計: 'C13',
  健康保険料: 'F9',
  介護保険料: 'F10',
  厚生年金保険料: 'F11',
  源泉所得税: 'F12',
  控除合計: 'F13',
  差引支給額: 'F15',
};

/** PDF に含める範囲。1始まりの行列で指定する（内部で0始まりに直す） */
const 印刷範囲 = { 開始行: 1, 開始列: 1, 終了行: 17, 終了列: 6 };

/** 単価マスタの列順。ヘッダ行は1行目 */
const マスタ列 = ['適用開始', '役員報酬', '健康保険料', '介護保険料', '厚生年金保険料', '源泉所得税'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('給与明細')
    .addItem('発行…', '給与明細を発行')
    .addToUi();
}

/**
 * メニューからの入口。
 * onEdit ではなく明示的な操作にしてあるのは、発行が事故で起きてはいけないため。
 */
function 給与明細を発行() {
  const ui = SpreadsheetApp.getUi();
  const 既定 = 前月を返す();
  const 応答 = ui.prompt(
    '給与明細の発行',
    '対象年月を YYYY-MM で入力してください。\n（支給日は自動で翌月25日になります）',
    ui.ButtonSet.OK_CANCEL
  );
  if (応答.getSelectedButton() !== ui.Button.OK) return;

  const 対象年月 = (応答.getResponseText() || 既定).trim();
  if (!/^\d{4}-\d{2}$/.test(対象年月)) {
    ui.alert('YYYY-MM の形式で入力してください。例: ' + 既定);
    return;
  }

  // 二重発行の防止。上書きは選べるが、黙っては起きない
  const 既存 = ログを探す(対象年月);
  if (既存) {
    const 答え = ui.alert(
      '既に発行済みです',
      `${対象年月} は ${既存.発行日時} に発行されています。\n再発行して上書きしますか？`,
      ui.ButtonSet.YES_NO
    );
    if (答え !== ui.Button.YES) return;
  }

  try {
    const 結果 = 発行する(対象年月);
    ui.alert(
      '発行しました',
      `${対象年月} 分\n支給日: ${結果.支給日}\n差引支給額: ${結果.差引支給額.toLocaleString()} 円\n\n${結果.url}`,
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('発行できませんでした', String(e.message || e), ui.ButtonSet.OK);
  }
}

function 発行する(対象年月) {
  const 設定 = 設定を読む();
  const 単価 = 単価を引く(対象年月);
  const 支給日 = 支給日を求める(対象年月);

  const 支給合計 = 単価.役員報酬;
  const 控除合計 =
    単価.健康保険料 + 単価.介護保険料 + 単価.厚生年金保険料 + 単価.源泉所得税;
  const 差引支給額 = 支給合計 - 控除合計;

  const sheet = 取得(SHEET.レイアウト);
  const 書く = (キー, 値) => sheet.getRange(CELL[キー]).setValue(値);

  const [年, 月] = 対象年月.split('-');
  書く('対象年月', `${年}年${Number(月)}月分`);
  書く('支給日', '支給日 ' + Utilities.formatDate(支給日, 'Asia/Tokyo', 'yyyy年M月d日'));
  書く('会社名', 設定.会社名);
  書く('氏名', 設定.氏名);
  書く('役員報酬', 単価.役員報酬);
  書く('支給合計', 支給合計);
  書く('健康保険料', 単価.健康保険料);
  書く('介護保険料', 単価.介護保険料);
  書く('厚生年金保険料', 単価.厚生年金保険料);
  書く('源泉所得税', 単価.源泉所得税);
  書く('控除合計', 控除合計);
  書く('差引支給額', 差引支給額);

  // 値を書いた直後にエクスポートすると、反映前のシートが PDF になることがある
  SpreadsheetApp.flush();

  const blob = PDFにする(sheet).setName(`給与明細_${対象年月}.pdf`);
  const フォルダ = 年フォルダ(設定.保存先フォルダID, 対象年月.slice(0, 4));

  // 上書き再発行のとき、同名ファイルが2つ並ばないよう古い方を捨てる
  const 同名 = フォルダ.getFilesByName(blob.getName());
  while (同名.hasNext()) 同名.next().setTrashed(true);

  const file = フォルダ.createFile(blob);
  ログに記録(対象年月, 支給日, 差引支給額, file);

  return { 支給日: Utilities.formatDate(支給日, 'Asia/Tokyo', 'yyyy-MM-dd'), 差引支給額, url: file.getUrl() };
}

/**
 * 支給日は対象月の翌月25日。25日が土日なら直前の金曜に繰り上げる
 * （金融機関の慣行に合わせる。実際の振込日と明細がずれると突き合わせができない）。
 */
function 支給日を求める(対象年月) {
  const [年, 月] = 対象年月.split('-').map(Number);
  const d = new Date(年, 月, 25); // 月は0始まりなので、これで「翌月25日」になる
  const 曜日 = d.getDay();
  if (曜日 === 0) d.setDate(24); // 日 → 金
  if (曜日 === 6) d.setDate(23); // 土 → 金
  return d;
}

/**
 * 適用開始が対象年月以下の行のうち、最も新しいものを使う。
 * 上書きではなく行を足していく持ち方にしてあるので、
 * 社会保険料が改定されたあとでも過去の月を同じ内容で再発行できる。
 */
function 単価を引く(対象年月) {
  const rows = 取得(SHEET.マスタ).getDataRange().getValues();
  const header = rows[0].map(String);
  const idx = {};
  マスタ列.forEach((名) => {
    const i = header.indexOf(名);
    if (i < 0) throw new Error(`単価マスタに「${名}」列がありません`);
    idx[名] = i;
  });

  let 該当 = null;
  for (let i = 1; i < rows.length; i++) {
    const 適用開始 = 年月に正規化(rows[i][idx['適用開始']]);
    if (!適用開始 || 適用開始 > 対象年月) continue;
    if (!該当 || 適用開始 > 該当.適用開始) {
      該当 = { 適用開始 };
      マスタ列.slice(1).forEach((名) => (該当[名] = Number(rows[i][idx[名]]) || 0));
    }
  }
  if (!該当) throw new Error(`${対象年月} に適用される単価マスタの行がありません`);
  return 該当;
}

/** 適用開始列は日付でも "2026-04" でも受ける。表記の揺れで止まらないように */
function 年月に正規化(値) {
  if (値 instanceof Date) return Utilities.formatDate(値, 'Asia/Tokyo', 'yyyy-MM');
  const s = String(値).trim();
  const m = s.match(/^(\d{4})[-/年]?\s*(\d{1,2})/);
  return m ? `${m[1]}-${('0' + m[2]).slice(-2)}` : null;
}

/**
 * シートを PDF にする。
 * Sheets の Apps Script API に PDF 出力が無いので、エクスポート URL を
 * 自前のトークンで叩く。ここだけ REST 呼び出しになるのはそのため。
 */
function PDFにする(sheet) {
  const id = SpreadsheetApp.getActiveSpreadsheet().getId();
  const params = {
    format: 'pdf',
    gid: sheet.getSheetId(),
    portrait: true,
    size: 'A4',
    fitw: true,
    gridlines: false,
    printtitle: false,
    sheetnames: false,
    pagenumbers: false,
    top_margin: 0.5,
    bottom_margin: 0.5,
    left_margin: 0.5,
    right_margin: 0.5,
    // r/c は0始まり、終了は排他的
    r1: 印刷範囲.開始行 - 1,
    c1: 印刷範囲.開始列 - 1,
    r2: 印刷範囲.終了行,
    c2: 印刷範囲.終了列,
  };
  const query = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const res = UrlFetchApp.fetch(
    `https://docs.google.com/spreadsheets/d/${id}/export?${query}`,
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error('PDF の生成に失敗しました (HTTP ' + res.getResponseCode() + ')');
  }
  return res.getBlob();
}

function 年フォルダ(ルートID, 年) {
  const root = DriveApp.getFolderById(ルートID);
  const it = root.getFoldersByName(年);
  return it.hasNext() ? it.next() : root.createFolder(年);
}

function 設定を読む() {
  const values = 取得(SHEET.設定).getDataRange().getValues();
  const map = {};
  values.forEach(([k, v]) => { if (k) map[String(k).trim()] = v; });
  ['会社名', '氏名', '保存先フォルダID'].forEach((必須) => {
    if (!map[必須]) throw new Error(`設定シートに「${必須}」がありません`);
  });
  return map;
}

function ログを探す(対象年月) {
  const rows = 取得(SHEET.ログ).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (年月に正規化(rows[i][0]) === 対象年月) {
      return { 発行日時: rows[i][3] };
    }
  }
  return null;
}

function ログに記録(対象年月, 支給日, 差引支給額, file) {
  取得(SHEET.ログ).appendRow([
    対象年月,
    Utilities.formatDate(支給日, 'Asia/Tokyo', 'yyyy-MM-dd'),
    差引支給額,
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
    file.getName(),
    file.getUrl(),
  ]);
}

function 取得(名) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(名);
  if (!s) throw new Error(`シート「${名}」がありません`);
  return s;
}

function 前月を返す() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM');
}
