/**
 * バインド先のスプレッドシートに、execute() が読み込むシートを用意する。
 * - シートが無ければ作成し、見出し行・書式・入力規則を設定する。
 * - 同名のシートがすでにあり、データが入っている場合は何も変更しない。
 * Apps Script エディタから手動で実行する。
 */
function setupSpreadsheet() {
  // シート名と列の並び順は main.js の execute() と一致させること
  const SCHEDULED_MESSAGES_SHEET_NAME = 'Scheduled messages'
  const NONBUSINESS_DAYS_SHEET_NAME = 'Non business days'

  const TEXT_FORMAT = '@'
  const DATE_FORMAT = 'yyyy/mm/dd'

  const SCHEDULED_MESSAGES_COLUMNS = [
    { header: 'ID', width: 60, format: TEXT_FORMAT, note: 'メッセージの識別子（ログ出力に使う）' },
    { header: 'Minute', width: 80, format: TEXT_FORMAT, note: '分（0〜59）。カンマ区切りで複数指定、* で毎分。先頭に 0 を付けない（例: 5）' },
    { header: 'Hour', width: 80, format: TEXT_FORMAT, note: '時（0〜23）。カンマ区切りで複数指定、* で毎時。先頭に 0 を付けない' },
    { header: 'Day', width: 80, format: TEXT_FORMAT, note: '日（1〜31）。カンマ区切りで複数指定、* で毎日。先頭に 0 を付けない' },
    { header: 'Month', width: 80, format: TEXT_FORMAT, note: '月（1〜12）。カンマ区切りで複数指定、* で毎月。先頭に 0 を付けない' },
    { header: 'Day of week', width: 100, format: TEXT_FORMAT, note: '曜日（1=月 〜 7=日）。カンマ区切りで複数指定、* で毎日' },
    { header: 'Skip on non-business day', width: 120, validation: 'boolean', note: 'TRUE にすると、土日と「Non business days」シートの日付には送信しない' },
    { header: 'Send on the previous business day', width: 120, validation: 'boolean', note: '「Skip on non-business day」が TRUE のときだけ有効。送信予定日が非営業日なら、直前の営業日に送る' },
    { header: 'Send on the next business day', width: 120, validation: 'boolean', note: '「Skip on non-business day」が TRUE のときだけ有効。送信予定日が非営業日なら、直後の営業日に送る' },
    { header: 'Message', width: 300, note: '本文。Google Chat のカード（textParagraph）で使える HTML タグを利用できる' },
    { header: 'Webhook URL', width: 200, note: '送信先スペースの Webhook URL' },
    { header: 'Thread URL', width: 200, note: '任意。指定すると、そのスレッドに返信する' }
  ]

  const NONBUSINESS_DAYS_COLUMNS = [
    { header: 'Date', width: 120, format: DATE_FORMAT, validation: 'date', note: '非営業日（祝日・会社の休業日など）。土日は登録しなくても非営業日として扱う' },
    { header: 'Description', width: 200, note: '任意。メモ用（処理では使わない）' }
  ]

  const buildValidation = function (type) {
    if (type === 'boolean') {
      // チェックボックスは全行に FALSE が入り getDataRange() の範囲が広がるため、プルダウンにする
      return SpreadsheetApp.newDataValidation()
        .requireValueInList(['TRUE', 'FALSE'], true)
        .setAllowInvalid(false)
        .build()
    }
    if (type === 'date') {
      return SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(false)
        .build()
    }
    return null
  }

  const spreadsheet = SpreadsheetApp.getActive()

  const prepareSheet = function (name, columns) {
    let sheet = spreadsheet.getSheetByName(name)
    if (sheet && sheet.getLastRow() > 0) {
      Logger.log('Sheet "%s" already has data. Skipped.', name)
      return
    }
    if (!sheet) sheet = spreadsheet.insertSheet(name)

    sheet.getRange(1, 1, 1, columns.length)
      .setValues([columns.map(function (c) { return c.header })])
      .setNotes([columns.map(function (c) { return c.note || '' })])
      .setFontWeight('bold')
      .setBackground('#f3f3f3')
      .setWrap(true)
    sheet.setFrozenRows(1)

    const bodyRows = sheet.getMaxRows() - 1
    for (let i = 0; i < columns.length; i++) {
      sheet.setColumnWidth(i + 1, columns[i].width)
      if (bodyRows < 1) continue

      const body = sheet.getRange(2, i + 1, bodyRows, 1)
      if (columns[i].format) body.setNumberFormat(columns[i].format)
      const validation = buildValidation(columns[i].validation)
      if (validation) body.setDataValidation(validation)
    }
    Logger.log('Sheet "%s" has been prepared.', name)
  }

  prepareSheet(SCHEDULED_MESSAGES_SHEET_NAME, SCHEDULED_MESSAGES_COLUMNS)
  prepareSheet(NONBUSINESS_DAYS_SHEET_NAME, NONBUSINESS_DAYS_COLUMNS)
}
