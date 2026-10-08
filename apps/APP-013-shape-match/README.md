# APP-013 かたちポン！

1歳児にも「持つ→近づける→はまる→動物が完成して動く」が分かる、無音のMVP試作です。[個別正本](../../docs/APP-013-shape-match.md)の「2026-10-08 採用済みデザイン・5動物改修仕様（現行優先）」に沿っています。旧3動物の仕様は履歴です。

## 5ステージ

1画面1ピース＋1動物型を維持し、次の固定順で循環します。ねこは追加していません。

| 動物 | はめる図形・見た目 | 完成後の動作 |
|---|---|---|
| かめ | 淡い緑の丸い甲羅。丸い足・柔らかな首・笑顔 | 頭をゆっくり前後 |
| いぬ | ビスケット色の横長角丸長方形の胴体。垂れ耳・丸い口元 | 付け根を軸にしっぽを小さく2回振る |
| ひよこ | 淡い黄色の縦長だ円の胴体。小さな羽・くちばし・足 | 全体で6pxだけ1回跳ねる |
| きつね | 丸みのある三角の顔。耳・白い頬・胴体・柔らかい尾 | 耳の付け根を軸に控えめに1回動く |
| さかな | 水色の角丸ひし形の胴体。丸いひれ・簡単な顔 | 尾びれを振り、全体で8pxだけゆっくり泳いで戻る |

## 図形と穴の一致

- 各形状はSVG defs内で1回だけ定義し、穴とピースのuseが同じ定義を参照します。
- 図形ごとに幅・高さ・縦横比・角丸を設定。ピースのviewBoxと動物SVGで1ユーザー単位を同じCSS実寸にしています。
- 390×844の操作枠は、円約146×146px、横長長方形202×129px、たまご形140×168px、三角形157×157px、ひし形174×140pxです。横画面では両方が収まるよう比率を保って縮小します。
- 完成してもピースは消さず、同じ色・輪郭・サイズのまま動物の胴体／顔に残ります。
- 周囲パーツはピースの後ろ、顔・甲羅模様は前に置いた固定SVGレイヤーです。完成後に周囲の透明度が上がり、特徴が現れます。
- ひよこと魚はピース・周囲・顔が同一タイミングの動作を共有し、パーツが離れません。外部画像・素材は使いません。

## 操作・滑らかな流れ

- 最初のpointerIdだけが操作。追加指は状態を増やしません。Pointer Events、cancel／capture喪失時の所有権解放を維持。
- 押下直後から追従し、通常表示は指より10px上へ補正。ドラッグ中の拡大は除去し、吸着開始・終了のサイズ変化をなくしました。
- 中心距離の広い吸着半径は操作枠長辺×1.1を基準に、開始位置との間に30px残す上限を設定。表示実寸に追従します。
- 範囲へ入った時点でpointerupを待たず180msのease-outで中央へスナップ。指離し・追加入力で演出を重複開始しません。
- 完成保持1400ms。固有動作は160ms後から1100msのease-in-outで1回だけ再生し、220msフェード後に次へ。吸着から次まで約1800msです。
- 範囲外の指離しは否定表現なしで280ms戻り。戻り途中でも再操作できます。
- 通常のタップだけでは完成しません。Enter／Space・支援技術のボタン操作は維持しています。

## 安全・中断復帰

- HTML／CSS／Vanilla JavaScript、固定DOM107要素。単一タイマースロットを順に使い、最大1本・待機時0本。RAF・interval・操作ごとのDOM追加なし。
- safe area、100vhフォールバック／100dvh、不要スクロール防止、縦横回転・resizeを維持。
- visibilitychange／pagehideでpointer、タイマー、半完成、動作を解除。同じステージの未完成状態へ戻します。
- pageshow／実BFCache復帰でも同じステージを再配置。イベント再登録なし、古いcallbackは世代番号で無効化。
- reduced-motionでは頭・しっぽ・跳ね・耳・泳ぎを停止。スナップ／戻り60ms、フェード120ms。完成と自動循環は維持します。
- 無音、保存・外部通信なし。スコア、回数、制限時間、設定、ポータル、共通ホーム、分析、ConoHa公開設定は追加していません。

## 公開範囲

GitHub Pages試作直接URL：
<https://yuy080622-source.github.io/toddler-web-apps/apps/APP-013-shape-match/>

正式公開はiPhone実機でのPM確認後に別判断します。個別正本は今回変更していません。

## 検証方法

Repositoryルートで `python3 -m http.server 8000` を起動します。

```bash
node apps/APP-013-shape-match/tests/app.test.js
node apps/APP-010-liquid-play/tests/app.test.js
node apps/APP-011-faucet-water-play/tests/app.test.js
npm install --prefix /tmp/shape-match-tools --cache /tmp/shape-match-npm-cache playwright
NODE_PATH=/tmp/shape-match-tools/node_modules APP013_LONG_SECONDS=180 \
  node apps/APP-013-shape-match/tests/browser.test.js
```

Playwrightは検証時だけ使用し、アプリの依存には含めません。CHROMIUM_PATH、APP013_BASE_URL、APP013_ARTIFACT_DIRでブラウザ・検証先・保存先を指定できます。通常／完成スクリーンショットは5種×3サイズの30枚を生成します。

## 確認結果

- Pages：実装commit `de9696dd6010192695f857d8aae04846cd6993ff`の[run 37781153375](https://github.com/yuy080622-source/toddler-web-apps/actions/runs/37781153375)はbuild／deploy success。公開HTML／CSS／JSと必須4文書はHTTP 200、mainとSHA-256一致
- TLS検証つきHTTPSで取得したPages版の5種×3サイズ・輪郭一致・全動作・循環・実タッチ・実BFCache・reduced-motion等のブラウザ回帰もPASS。公開HTTPS URLへのChromium直接接続は環境CA未信頼（ERR_CERT_AUTHORITY_INVALID）で確認不可。証明書検証・信頼設定は変更なし
- mainへのcommit／push成功、main／origin/main同期。実機確認・PM承認後に正式公開を別判断。仕様変更を要する未解決問題はなし

- Chromiumの5種×3サイズで同一形状参照・描画境界一致・ピース保持・全固有動作・ひよこ／魚の一体移動・固定循環、広い吸着・各形状の範囲外戻り／実pointercancelをPASS
- 実2指所有権、100回高速入力、完成中入力、lostpointercapture、resize・回転、visibilitychange相当、実BFCache（pageshow.persisted=true）、全5種のreduced-motionをPASS
- 通常／完成のスクリーンショット30枚と3サイズの比較シートを生成して目視レビュー。犬の横長胴体・首・脚、狐の顔・耳・頬、周囲パーツの接続・輪郭・画面内配置を確認
- 実時間181.7秒／96ステージでDOM107固定・タイマー最大1本／待機時0本、二重進行・外部通信・console error／warningなし
- APP-010／011 Node回帰、既存ポータル＋APP-002／003／004／006／010／011の3サイズスモーク回帰、全18 JS構文、git diff --checkをPASS

- Node300ステージ・540秒の疑似時間、5種類で所有権・キャンセル・高速入力・各段階の中断・古いcallbackをPASS。
- 全18 JavaScript構文、git diff --check、APP-010／011 Node回帰、既存ポータル＋APP-002／003／004／006／010／011の3サイズスモーク回帰をPASS。既存分析は検証時のみスタブ化。
- iPhone実機の複数指、safe area、回転・復帰、刺激量・発熱・幼児の操作感はPM確認待ちです。
