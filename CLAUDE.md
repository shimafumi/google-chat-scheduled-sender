# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

Google スプレッドシートに定義したスケジュール（cron 風）に従って、Google Chat の Webhook へリマインダーカードを投稿する Google Apps Script（GAS）プロジェクト。スプレッドシートにバインドされたスクリプトとして動作する（`SpreadsheetApp.getActive()` を使用）。

## 開発コマンド

clasp でローカルと Apps Script を同期する（`.clasp.json` の `rootDir` は `src`）。

次の 2 ファイルは ID を含むため git 管理外（`.gitignore` 済み）。新しい環境ではリポジトリ直下のテンプレートからコピーして作る。scriptId と libraryId はリポジトリ内のファイルに書かないこと。

- `.clasp.json` ← `.clasp.json.example`。`scriptId` に Apps Script のスクリプト ID を設定する。
- `src/appsscript.json` ← `appsscript.json.example`。`libraryId` に `GoogleChatMessageSender` ライブラリのスクリプト ID を設定する。このライブラリはユーザーが別リポジトリで管理している。マニフェストの設定（タイムゾーン、ライブラリのバージョンなど）を変えるときは、テンプレートにも同じ変更を反映する。

- `clasp pull` — Apps Script 上の最新コードを `src/` に取得
- `clasp push` — `src/` の内容を Apps Script に反映
- `clasp open` — Apps Script エディタを開く

ビルド・lint・テストの仕組みは無い。動作確認は Apps Script エディタから関数を実行し、実行ログ（`Logger.log`）で行う。

## アーキテクチャ

- `src/main.js` の `execute()` がメイン処理。1 関数の中にヘルパーをすべてクロージャで定義している。
  1. シート `Scheduled messages`（1 行目はヘッダー）を読み込む。列順は固定: id, minute, hour, day, month, dayOfWeek, skipOnNonBusinessDay, sendOnThePreviousBusinessDay, sendOnTheNextBusinessDay, message, webhookUrl, threadUrl。minute〜dayOfWeek はカンマ区切りの値か `*`。
  2. シート `Non business days`（1 行目はヘッダー、A 列に日付）を読み込む。土日は常に非営業日扱い（ハードコード）。
  3. 現在時刻（`Asia/Tokyo`）と各行を `isSendable()` で照合する。dayOfWeek は `Utilities.formatDate` の `u` 書式（1=月〜7=日）で比較する。
     - `skipOnNonBusinessDay` が `true` のとき、非営業日は送らない。さらに `sendOnTheNextBusinessDay` / `sendOnThePreviousBusinessDay` が `true` なら、連続する非営業日を再帰的にさかのぼる（または先へ進む）。そこで本来の送信予定日が見つかれば、当日（営業日）に振り替えて送る。
     - `true` 判定は文字列の小文字比較（`'true'`）。
  4. 送信は外部ライブラリ `GoogleChatMessageSender`（`src/appsscript.json` で version 4 を参照）の `send()` を使う。`threadUrl` がある場合は `buildThreadName()` でスレッド名を作り、Webhook URL に `&messageReplyOption=REPLY_MESSAGE_OR_FAIL` を付けて既存スレッドへ返信する。
- `src/trigger.js` の `deleteTrigger()` は、プロジェクトの全トリガーを削除する。`execute()` を 1 分毎に動かすトリガーは、Apps Script エディタの「トリガー」画面で設定する。
- 1 分毎に実行し、その「分」に一致する行を送る仕組みのため、トリガーの遅延や重複実行に対する二重送信・送信漏れの対策は無い。
- 投稿カードのフッター（`MESSAGE_FOOTER`）のリンクは、実行時にバインド先スプレッドシートの `Scheduled messages` シートの URL から組み立てる。
