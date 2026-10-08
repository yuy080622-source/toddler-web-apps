# APP-013 かたちポン！

1歳児の「持つ→近づける→はまる→動物が完成して動く」を楽しむ、無音のMVP試作です。正式仕様・設計は[個別正本](../../docs/APP-013-shape-match.md)です。

## 1図形1動物

1画面に大きなピース1個と動物型1個を表示し、○かめ→□いぬ→△きつね→○かめの固定順で循環します。旧3ピース／3型同時表示・3形まとめて完成する方式は廃止しました。

- ○：緑の甲羅。薄い頭・足・しっぽと、抜けた丸い甲羅を表示。完成すると甲羅模様と顔が明瞭になり、頭が少し前後します。
- □：少し角を丸めたビスケット色の胴体。頭・垂れ耳・足・しっぽが周囲に見え、完成するとしっぽを小さく2回振ります。
- △：オレンジ色の下向き三角形の顔。耳・小さな体・しっぽを周囲に表示。完成すると白い頬・目・鼻が現れ、耳が1回だけ小さく動きます。

リアルな動物ではなく、丸みのある図形で作った動物です。外部画像・素材は使用していません。

## 操作・吸着判定

- Pointer Eventsで最初のpointerIdだけが1ピースを操作します。追加指は状態を増やしません。
- ピース枠は短辺に応じて120〜150px。390×844／844×390では約140px、1024×768では150pxです。ドラッグは押下直後から追従し、通常表示では指より10px上へ補正します。
- ピース中心から型中心までの距離を判定します。半径は「型枠の幅÷4＋ピース幅×0.60」で、開始位置との間に30px残す上限を設けます。表示実寸から再計算し、固定画面座標を使いません。
- 390×844では吸着半径約160px。型の見える穴より広く、少し手前から明るくなる予告反応があります。
- 吸着範囲に入るとpointerupを待たず180msで中央へスナップします。その時点で操作権を解放し、後続のpointerup／cancelや追加入力では二重進行しません。
- 範囲外で離した場合、×・警告色・音・減点・強い揺れなしで280msで元位置へ戻します。戻り途中でも再操作できます。
- pointercancel／lostpointercaptureも未完成なら元へ戻し、所有権を解放します。
- Enter／Spaceと支援技術のボタン操作でも完成できます。通常のタップだけでは配置しません。

## 完成・自動遷移

スナップ後に周囲パーツが濃くなり、図形部分と動物全体が完成します。動物の動きは各1種類・1回のみです。完成状態を1400ms保持し、220msの穏やかなフェードで次へ切り替えます。吸着開始から次のステージまで通常約1800ms。追加タップは不要です。

全画面フラッシュ、強い点滅、紙吹雪、画面揺れ、急激な拡大、ループするご褒美はありません。

## 画面・中断復帰

- HTML／CSS／Vanilla JavaScriptと固定SVG。DOMは64要素固定です。表示する図形・動物は各1個で、3種類のテンプレートは切り替えて使用します。
- 100vhフォールバック、100dvh、safe area、不要スクロール防止を維持しています。
- stageIndexとidle／dragging／completing／transitioningで管理。スナップ・完成保持・切替は同じタイマースロットを順に使い、最大1本・待機時0本です。RAF、interval、動的DOM生成はありません。
- visibilitychange／pagehideでpointerとタイマーを解放し、半完成・アニメーションを除去して同じステージの未完成状態へ戻します。
- pageshow／BFCache復帰、resize・縦横回転でも現在ステージを安定した開始位置へ再計算。イベントは初期登録のみで再登録しません。古いタイマーcallbackは世代番号で無効化します。
- prefers-reduced-motionでは動物の歩行・頭・しっぽ・耳の動きを停止。ドラッグ拡大・上方補正も停止し、スナップ／戻り60ms・フェード120msに短縮します。完成・自動循環は維持します。

## 公開範囲

GitHub Pages試作直接URL：

<https://yuy080622-source.github.io/toddler-web-apps/apps/APP-013-shape-match/>

正式公開はiPhone実機確認とPM承認待ちです。無音、保存なし、外部通信なし。スコア・回数・ランキング・制限時間、追加形状、鳴き声、効果音、ランダム順、設定、共通ポータル、共通ホーム、GA4、Clarity、ConoHa allowlistは追加していません。

## 検証方法

Repositoryルートで起動：

```bash
python3 -m http.server 8000
```

<http://localhost:8000/apps/APP-013-shape-match/>を開きます。

外部依存のない自動回帰：

```bash
node apps/APP-013-shape-match/tests/app.test.js
node apps/APP-010-liquid-play/tests/app.test.js
node apps/APP-011-faucet-water-play/tests/app.test.js
```

ブラウザ自動回帰は検証用PlaywrightとChromiumを使用します。アプリ本体にはライブラリを読み込みません。依存をRepository外へ置く例：

```bash
npm install --prefix /tmp/shape-match-tools --cache /tmp/shape-match-npm-cache playwright
NODE_PATH=/tmp/shape-match-tools/node_modules APP013_LONG_SECONDS=180 \
  node apps/APP-013-shape-match/tests/browser.test.js
```

CHROMIUM_PATHでブラウザのパス、APP013_BASE_URLで検証先、APP013_ARTIFACT_DIRでスクリーンショット・結果の保存先を指定できます。既定ブラウザは/usr/bin/chromiumです。BFCache検証のためChromiumのdisable-back-forward-cache既定引数を除いて実行します。

## 確認結果

- Node回帰：300ステージ／540秒の疑似時間、広い判定、pointerup前吸着、全段階の中断、古いcallback、追加指・高速入力・二重進行防止をPASS。
- APP-010／APP-011の既存Node回帰：PASS。
- 3サイズの表示・操作：ピース約140／140／150px、図形・動物型各1個、重なり・横縦スクロールなし。
- Chromiumのpointerup前吸着、全3動物の実アニメーション・完成・フェード・循環、実タッチの2指所有権、cancel／capture喪失、100回高速入力、resize・回転、visibilitychange相当、実BFCache（pageshow.persisted=true）、reduced-motion、キーボード：PASS。
- 実時間180.6秒／96ステージ：PASS。DOM64固定、タイマー最大1本・待機時0本、二重進行なし、外部通信なし、console error／warningなし。
- 全18 JavaScript構文、git diff --check、既存ポータル5カード＋APP-002／003／004／006／010／011の3サイズスモーク回帰：PASS。既存分析通信は検証時のみローカルスタブ化。既存公開コードとConoHa workflowは変更なし。
- Pages：実装commit `3f1546a991216cd23661959bcbbda18c45b4a036`の[run 37745805611](https://github.com/yuy080622-source/toddler-web-apps/actions/runs/37745805611)はbuild／deployともsuccess。公開HTML／CSS／JSと必須4文書はHTTP 200、mainとSHA-256一致。
- TLS検証つきHTTPSで取得したPages版をローカル配信し、3サイズ・全動物・実タッチ・実BFCache・reduced-motion等のブラウザ回帰をPASS。公開HTTPS URLへのChromium直接接続は環境CA未信頼（ERR_CERT_AUTHORITY_INVALID）のため確認できていません。証明書検証・信頼設定は変更していません。
- BFCacheテストの移動先は同じアプリの別query URLとし、無関係なMarkdownページのfavicon要求を避けています。mainへのGit commit／pushは成功し、main／origin/mainを同期しています。
- iPhone／Androidの実際の複数指、safe area、回転・中断復帰、刺激量、発熱、幼児の操作感は実機確認待ちです。
