# APP-013 かたちポン！

1歳児にも「持つ→近づける→はまる→動物が完成して動く」が分かる、無音のMVP試作です。[個別正本](../../docs/APP-013-shape-match.md)の「2026-10-09 PM実機フィードバック：吸着速度と完成キラキラ（現行優先）」と採用済み5動物仕様に沿っています。旧3動物の仕様は履歴です。

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
- 範囲へ入った瞬間からpointerupを待たず1000msのease-outで中央へ移動。直前のドラッグ位置を確定してから連続して移し、待機・位置飛び・サイズ変化・指離しによる巻き戻りを防ぎます。
- transformのtransitionendで実際の到達を確認して完成。イベント未通知／移動距離0の場合は1080msの保険タイマーで復旧します。重複通知や古い戻りイベントでは完成演出を再開しません。
- 完成時は固定SVGの小さな星2個＋光点2個を、600msの穏やかなフェードで1回表示。移動・拡大・点滅なし。装飾用タイマーや操作ごとのDOM追加はありません。
- 光が消える600ms後から既存の固有動作を1100msのease-in-outで1回再生。完成保持1800ms＋220msフェードで次へ。吸着開始から次まで通常約3020msです。
- 範囲外の指離しは否定表現なしで280ms戻り。戻り途中でも再操作できます。
- 通常のタップだけでは完成しません。Enter／Space・支援技術のボタン操作は維持しています。

## 安全・中断復帰

- HTML／CSS／Vanilla JavaScript、固定DOM112要素。単一タイマースロットを順に使い、最大1本・待機時0本。RAF・interval・操作ごとのDOM追加なし。
- safe area、100vhフォールバック／100dvh、不要スクロール防止、縦横回転・resizeを維持。
- visibilitychange／pagehideでpointer、タイマー、半完成、動作を解除。同じステージの未完成状態へ戻します。
- pageshow／実BFCache復帰でも同じステージを再配置。イベント再登録なし、古いcallbackは世代番号で無効化。
- reduced-motionでは頭・しっぽ・跳ね・耳・泳ぎを停止。スナップ／戻り60ms、フェード120ms。固定4個の光は600msの薄いフェードのみ（最大不透明度0.3）。完成と自動循環は維持します。
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

Playwrightは検証時だけ使用し、アプリの依存には含めません。CHROMIUM_PATH、APP013_BASE_URL、APP013_ARTIFACT_DIRでブラウザ・検証先・保存先を指定できます。通常／キラキラ／動物動作は5種×3サイズの45枚、reduced-motionは5枚を生成します。実描画の吸着時間・連続座標を検証用RAFで測定し、アプリ本体のRAFやタイマーには追加しません。

## 確認結果

### 2026-10-09 吸着1秒・完成キラキラの実装と検証

- 開始main／origin/main：`f244b709b9a009e7b56747b7f71d9601d57c89e1`。指定正本に沿い、5動物・図形・広い判定・誤配置280ms戻り・安全処理を維持。
- 全5動物×390×844／844×390／1024×768でCSS実測1000ms。吸着開始から到達通知まで998.1〜1071.5ms（15件、中央値1014.4ms）。即時開始、連続移動、減速、位置・サイズ一致、指離し後の巻き戻りなしを確認。
- 完全到達→固定4個の光600ms／1回→既存動物動作→フェード→固定循環をPASS。各形状の吸着中・キラキラ中・動作中に100回高速入力しても二重開始なし。
- 実2指所有権、pointercancel／lostpointercapture、範囲外戻り、resize・回転、visibilitychange相当、吸着／光／動物動作／フェード中の実BFCache、全5種のreduced-motion・キーボードをPASS。中断復帰後は同じ動物の未完成状態で光・タイマー・pointerが残りません。
- 実時間181.4秒／58ステージでDOM112固定、光4個固定／発火58回、タイマー最大1本・待機時0本、二重進行・不要スクロール・外部通信・console error／warningなし。
- Node300ステージ／疑似930秒（transitionend未通知の保険も検証）、APP-010／011 Node回帰、全18 JS構文、既存ポータル＋APP-002／003／004／006／010／011の3サイズ操作回帰をPASS。既存分析は検証時だけスタブ化、公開コードは変更なし。
- 通常／キラキラ／動物動作45枚＋reduced-motion5枚を生成し、全5動物・3サイズの光の位置・輪郭・接続を目視レビュー。成果物：`/workspace/scratch/app013-snap-glow-20261009/`。
- 実装commit `12b19603d6cdba472a897b215abeb12b9a4939c9`の[Pages run 37938097613](https://github.com/yuy080622-source/toddler-web-apps/actions/runs/37938097613)はbuild／deploy success。公開HTML／CSS／JSと必須4文書はHTTP 200、mainとのSHA-256一致。
- TLS検証つきHTTPSで取得した公開版でも、全5種×3サイズ、連続吸着・減速・光・固有動作・循環、100回高速入力、実2指、実BFCache、reduced-motion等をPASS。公開HTTPS URLへのChromium直接接続は環境CA未信頼（ERR_CERT_AUTHORITY_INVALID）で確認不可。証明書検証・信頼設定は変更なし。
- mainへcommit／push済み。正式公開はiPhone実機のPM確認後に別判断。個別正本は今回変更していません。

### 2026-10-09 最新main・公開版の再確認

- 開始main／origin/mainは`d9e3c57de45905193bae7e97b492528ee19a577c`。指定基準`1294edbde7e871e269bc81f2f0d8940639424b66`以後の5動物改修は実装済みでした。アプリ本体・テスト・個別正本の追加変更は不要と確認し、必須4文書へ最新の検証結果を反映。
- [Pages run 37781908408](https://github.com/yuy080622-source/toddler-web-apps/actions/runs/37781908408)は開始mainでbuild／deploy success。公開HTML／CSS／JSと必須4文書をTLS検証つきHTTPSで再取得し、HTTP 200・mainとのSHA-256一致を確認。
- 取得した公開版をローカル配信し、390×844／844×390／1024×768の全5種で輪郭・描画境界一致、ピース保持、固有動作、一体移動、固定循環、広いpointerup前吸着、範囲外戻り、実pointercancelを再検証PASS。
- 実2指の所有権、100回高速入力、完成中入力、lostpointercapture、resize・回転、visibilitychange相当、実BFCache（pageshow.persisted=true）、全5種のreduced-motion・キーボードを再検証PASS。DOM107固定・タイマー最大1本／待機時0本、不要スクロール・外部通信・console error／warningなし。
- 通常／完成30枚と3サイズの比較シートを再生成・目視レビュー。犬の横長胴体・首・脚、狐の顔・耳・頬・胴体、全動物の接続・輪郭・画面内配置を確認。検証成果物は作業環境の`/workspace/scratch/app013-five-recheck-20261009/`へ保存。
- APP-013 Node300ステージ／疑似540秒、APP-010／011 Node回帰、全18 JavaScript構文、git diff --checkを再検証PASS。

### 2026-10-08 実装時の継続動作・既存アプリ回帰

- 5動物デザインの実装commitは`de9696dd6010192695f857d8aae04846cd6993ff`。2026-10-09の再確認時点ではアプリ本体・テストに変更はありませんでした。その後の吸着・キラキラ改修は直前の現行検証結果を参照してください。
- 実時間181.7秒／96ステージでDOM107固定・タイマー最大1本／待機時0本、二重進行・外部通信・console error／warningなし。2026-10-09は同一コードの記録を引き継ぎ、長時間テストの再実施はしていません。
- 既存ポータル＋APP-002／003／004／006／010／011の3サイズスモーク回帰は実装時にPASS。今回も既存公開アプリ・共通ファイル・公開設定への差分はありません。

公開HTTPS URLへのChromium直接接続は実装時に環境CA未信頼（ERR_CERT_AUTHORITY_INVALID）で確認不可だったため、証明書検証つきHTTPS取得と取得版のブラウザ検証を用いています。iPhone実機の複数指、safe area、回転・復帰、刺激量・発熱・幼児の操作感はPM確認待ちです。仕様変更を要する未解決問題はありません。
