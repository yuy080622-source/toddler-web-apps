# APP-013 正式公開準備・事前検証

更新日：2026-11-02

## 状態と承認

- PMのiPhone実機5項目・デザイン・操作性は2026-11-02に最終PASS。
- 作業開始main：`cdfb05b329693ea0850a25de42363d8edfc39708`。
- 作業ブランチ：`prep/app013-production-20261102`。公開用差分はPRでレビューする。
- Draft PR：[#1 APP-013 正式公開準備・事前検証](https://github.com/yuy080622-source/toddler-web-apps/pull/1)。公開実行承認待ちとしてDraftを維持する。
- **本番未反映・公開実行承認待ち**。mainへのpush／merge、ConoHa workflow_dispatch、FTP接続・アップロードを実行していない。GitHub Pagesも現行mainを維持する。
- 正式公開予定：<https://yulab-web.com/apps/apps/APP-013-shape-match/>。
- ポータル：<https://yulab-web.com/apps/>。

## 変更と配信範囲

- `.github/workflows/deploy-conoha.yml`の明示的allowlistへAPP-013の`index.html`、`styles.css`、`app.js`だけ追加。トリガー・FTPS・証明書検証・リモート削除しない方式・Secrets設定は変更なし。
- 配信29ファイル。従来26ファイルをすべて維持し、ポータルHTMLと一覧JSだけを更新。残る既存24資産はバイト単位で一致する。
- `portal/apps.js`の末尾へ「かたちポン！」を追加。旧5カードは名前・アイコン・順・リンク・テーマを維持し、新カードは既存の淡色テーマを再利用。ルートHTMLの一覧JS参照へ版を付けてキャッシュを更新。
- APP-013のheadへ共有GA4／Clarityを同一URLのmoduleとして追加。module mapで同じdocument内の再挿入・再importを一度に限定する。共有ファイルは変更しない。
- GA4測定ID `G-M5FPMG34LE`、Clarity Project ID `y7wygqymd5`は既存と同じ。カスタムイベント・ユーザーID・タッチ情報・操作ログ送信をゲームへ追加しない。
- APP-013のbody、CSS、ゲームJSと既存公開アプリ・共通ファイルは変更なし。広告・外部リンク・購入・設定・共通ホームは子どもの画面に追加しない。
- README、CHANGELOG、docs、テスト、未公開APP-011等は配信しない。実FTPルート`./`がURLの`/apps/`に対応するため、APPのURLは`/apps/apps/APP-013-shape-match/`になる。

## 検証の再現方法

検証用のPyYAMLとPlaywright、Chromiumを使用する。アプリの実行依存には追加しない。以下の出力先は未使用ディレクトリを指定する。

PyYAML未導入の検証環境では`python3 -m pip install --target /tmp/app013-python PyYAML`で導入し、Pythonコマンドに`PYTHONPATH=/tmp/app013-python`を付ける。

```bash
node apps/APP-013-shape-match/tests/app.test.js
node apps/APP-010-liquid-play/tests/app.test.js
node apps/APP-011-faucet-water-play/tests/app.test.js
python3 apps/APP-013-shape-match/tests/release-package.test.py --output /tmp/app013-release/site
python3 -m http.server 8050 --bind 127.0.0.1 --directory /tmp/app013-release/site
```

別ターミナルで実行する。

```bash
npm install --prefix /tmp/shape-match-tools --cache /tmp/shape-match-npm-cache playwright
NODE_PATH=/tmp/shape-match-tools/node_modules \
  APP013_BASE_URL=http://127.0.0.1:8050/apps/apps/APP-013-shape-match/ \
  APP013_LONG_SECONDS=180 node apps/APP-013-shape-match/tests/browser.test.js
NODE_PATH=/tmp/shape-match-tools/node_modules \
  node apps/APP-013-shape-match/tests/release-browser.test.js
git diff --check
```

`release-package.test.py`はworkflowからビルドステップだけを読み、隔離した一時コピーで実行する。FTPやGitHub Actions全体は実行しない。許可リストの追加差分、既存資産、欠落時拒否、開発ファイル非混入、相対パス、moduleタグの一意性を検証する。

## 事前検証結果

- 配信29ファイル完全一致、既存24資産同一、APP-013のbody／JS／CSS同一。欠落ファイルは拒否し、意図的に置いた開発・無関係ファイルは配信対象へ入らない。
- 本番と同じパスで3サイズ・全5動物、1秒吸着、600msの光、固有動作、自動循環、複数指・100回高速入力・cancel、回転・中断・実BFCache、reduced-motionをPASS。
- 3サイズで6カード、旧5カードの全フィールド一致、新カードの二重appsパス、公開済み5アプリの15操作回帰と共通ホーム短押し抑止／長押しでのポータル復帰をPASS。
- APP-013の共有moduleを3回ずつ再挿入・再importしてもローダー／SDK各1、SDK実行各1、GA4 config 1。中断復帰・操作後も同じ。解析SDK／共有ローダーの各遮断ケースで全5動物を操作でき、ゲームのJavaScript例外なし。
- 本番の既存共有JSは読み取りだけでHTTP 200・JavaScript MIME・内容一致を確認。moduleの厳密なMIME要件を満たす。
- 実時間180.1秒／58ステージをPASS。解析用script4要素の初期挿入後、検証時DOM118固定・光4個固定／発火58回、アプリタイマー最大1本／待機時0本。二重進行・演出残留・不要スクロール・正常時console error／warningなし。
- Node300ステージ／疑似930秒、APP-010／011 Node回帰、全19 JavaScript構文・git diffチェックをPASS。操作後もGA4のcommandsはjs／configだけ、config 1・Clarity SDK tag 1で、追加の独自イベントなし。
- 検証成果物：`/workspace/scratch/app013-release-preflight-20261102/`。package-results、release-browser-results、APPブラウザ結果、配信SHA-256、画面キャプチャを保存。

解析は実際の共有ローダーを実行し、第三者SDK応答をスタブ化した。本番の解析イベント・録画は送信していない。正常時の通信候補は承認済みSDKの2 URLだけで、意図的な遮断ケースのリソース失敗は想定内としてJavaScript例外と区別する。実SDK内部のDOM・タイマー・収集通信と管理画面への受信は、この事前検証の対象外で公開後に確認する。

## 本番反映時の手順（PMの公開実行承認後）

1. このPRの差分・検証結果をPMがレビューし、**公開実行**を別途承認する。デザインPASSだけで本番操作へ進まない。
2. 最新mainとの差分を確認。競合や公開資産の更新があれば取り込んで対象の事前検証を再実施する。
3. PRをmainへマージする。main pushにより既存ConoHa workflowが自動実行されるため、同時に手動実行しない。
4. マージSHAに対応する`Deploy toddler apps to ConoHa WING`を確認し、build、事前安全検証、FTPS uploadの成功を確認する。再実行が必要な場合も承認範囲内のmainを対象にする。
5. 下記の公開後ゲートを確認し、handoff／changelogを「公開・運用中／効果判定待ち」へ更新する。公開日を記録し、7日未満または3セッション未満で改善効果を判断しない。

今回は1の公開実行承認前で停止する。

## 公開後の確認項目

- <https://yulab-web.com/apps/>：6カード、旧5アプリのリンク・表示維持、新カードからAPP-013へ移動。
- <https://yulab-web.com/apps/apps/APP-013-shape-match/>：HTML、`styles.css`、`app.js`のHTTP 200・MIME・マージSHAとの内容一致。二重apps階層と共有JSの相対パスを確認。
- スマホ／PCの3サイズ、全5動物・吸着・光・循環、複数指・回転・中断復帰・reduced-motion。実SDK有効時も操作・発熱・コンソールに問題がないこと。
- GA4：測定ID、`/apps/apps/APP-013-shape-match/`のRealtime page_view、同一画面の重複計測なし。独自イベント／ユーザーID／タッチデータ送信を追加していないこと。
- Clarity：Project ID、当該URLのセッション録画・ヒートマップ対象、同じdocumentのタグ重複なし、実際の解析動作がAPP操作を阻害しないこと。
- 開発者ツールで共有ローダー・SDK各1、想定外の第三者通信なし。SDK以降の収集先もGA4／Clarityの通信であることを確認する。
- 公開済み5アプリ、ポータル、共通ホームの回帰。今回追加したAPP-013以外の公開資産に意図しない差分がないこと。

公開停止が必要ならPR差分のrevertをレビューして既存mainデプロイで戻す。配信はリモート削除同期をしないため、allowlistから外すだけでは一度公開したAPP-013の直接URLは消えない。直接URLの取り下げは対象3ファイルの扱いをPMと確認して別途実施し、他アプリを削除しない。
