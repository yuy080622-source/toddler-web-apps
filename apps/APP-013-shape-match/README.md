# APP-013 かたちポン！

1歳半〜2歳向けに、○・□・△を同じ形の型へドラッグして遊ぶ、無音のMVP試作です。正式仕様・設計は[個別正本](../../docs/APP-013-shape-match.md)を参照してください。

## 操作・判定

- コーラルの○、ブルーの□、イエローの△と、それぞれ少し大きい輪郭・薄い面の型を表示します。
- ピース中心から対応する型中心までの距離が「型の表示枠の幅÷2＋22px」以内で、最も近い型が同じ形なら受け入れます。精密な輪郭合わせは不要です。判定範囲が重なる位置でも、別の型の方が近ければ元へ戻します。
- 正しい型に近づくと、その型だけが控えめに明るくなります。
- 指を離すと180msで中央へスナップし、1回だけ小さく弾みます。配置後はラウンド中固定です。
- 別の型や型外へのドロップでは、否定表現を出さず280msで開始位置へ戻ります。
- 3形完成後は型が1回だけ小さく弾み、完成から1100ms後に同じ配置へ自動リセットします。
- 別ピースは2〜3本指で同時操作できます。同一ピースは最初のpointerIdだけが操作権を持ち、追加の指は無視します。
- `pointerup`、`pointercancel`、`lostpointercapture`で操作権と型の予告反応を解放します。キャンセルは配置せず元へ戻します。
- Enter／Space、支援技術のボタン操作でも対応する型へ入れられます。通常のタップだけでは配置しません。

## 画面・中断復帰

- HTML／CSS／Vanilla JavaScriptと固定SVG。スマートフォン縦のピース枠は約96pxです。
- `100vh`をフォールバックとして`100dvh`を使用し、safe area内に表示します。
- 回転・resizeでは未配置ピースを開始位置へ、配置済みピースを対応する型の中央へ再計算します。ドラッグは解除します。
- `visibilitychange`／`pagehide`で操作権・一時演出・リセットタイマーを解除します。途中までの配置は維持し、完成中の中断は新しいラウンドへ戻します。
- `pageshow`／BFCache復帰時に安定した座標へ戻し、イベントを再登録しません。
- reduced-motionではスナップ・戻りを60msに短縮し、持ち上がり・拡大・弾みを停止します。型の明暗変化と配置・戻り・自動リセットは維持します。
- DOMは固定34要素、ラウンドタイマーは最大1本。RAF、interval、動的DOM生成はありません。

## 公開範囲

GitHub Pagesの試作直接URL：

<https://yuy080622-source.github.io/toddler-web-apps/apps/APP-013-shape-match/>

正式公開はiPhone実機確認とPMの操作感承認待ちです。スコア、回数表示、ランキング、時間制限、音、追加形状、保存、外部通信、共通ポータル、共通ホーム、GA4、Clarity、ConoHa allowlistは追加していません。

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

ブラウザ自動回帰は検証用PlaywrightとChromiumを使用します。アプリ本体にはライブラリを読み込みません。検証用依存をリポジトリ外へ置く例：

```bash
npm install --prefix /tmp/shape-match-tools --cache /tmp/shape-match-npm-cache playwright
NODE_PATH=/tmp/shape-match-tools/node_modules APP013_LONG_SECONDS=180 \
  node apps/APP-013-shape-match/tests/browser.test.js
```

`CHROMIUM_PATH`でブラウザのパス、`APP013_BASE_URL`でPages等の検証先、`APP013_ARTIFACT_DIR`でスクリーンショット・長時間結果の保存先を指定できます。既定ブラウザは`/usr/bin/chromium`です。

## 確認結果

- Node自動回帰：PASS。正解、誤配置、広めの判定、3pointer、同一ピースの追加pointer、キャンセル、回転、中断復帰、reduced-motion、540回のドラッグを確認。
- Chromiumの390×844／844×390／1024×768：表示、判定、戻り、完成後リセット、不要スクロールなし、DOM34要素を確認。
- Chromiumの実3指タッチ、同一ピースの所有権、pointercancel、回転、visibilitychange相当、実BFCache（`pageshow.persisted=true`）、reduced-motion、キーボード／ARIA：PASS。
- 最終コードの実時間181.1秒／149ラウンド／447ドラッグ：PASS。DOM34固定、タイマー最大1本・待機時0本、外部通信なし、console error／warningなし。
- 全18 JavaScript構文と、既存ポータル＋APP-002／003／004／006／010／011の3サイズスモーク回帰：PASS。既存分析通信は検証中だけローカルでスタブ化。
- Pages：実装commit `3663218d1bdcef35a6f7d217d1e97234c5bfd465`の[run 37043553611](https://github.com/yuy080622-source/toddler-web-apps/actions/runs/37043553611)はbuild／deployともsuccess。公開HTML／CSS／JSと指定4文書はHTTP 200、mainとSHA-256一致。
- PagesからTLS検証つきHTTPSで取得したファイルをローカル配信し、指定3サイズとドラッグ・実タッチ・BFCache・reduced-motionのブラウザ回帰をPASS。公開HTTPS URLへのChromium直接接続は環境CAが未信頼で未実施。CAをブラウザ信頼ストアへ追加する操作は自動承認審査により拒否されたため、信頼設定を変更していません。
- Git CLIのpush認証が利用できないため、接続済みGitHub APIで同一ツリーを検証してmainへfast-forward反映し、ローカルmain／origin/mainを同期しています。
- iPhone／Androidの実際の複数指、safe area、端末回転・中断復帰、刺激量、発熱、幼児の操作感は実機確認待ちです。
