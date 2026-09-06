# APP-011 じゃぐちみずあそび

1歳前後の幼児向けに、画面のどこでも押している間だけ、左上の蛇口から水が流れるMVP試作です。

## 遊び方

- 画面のどこでも押すと、左上の蛇口から水が出ます。
- 押している間は水が流れ続け、画面下の楕円形の水たまりが短時間で分かる速度で広がります。
- 指を離すと水は止まり、水たまりはゆっくり小さくなります。
- 複数の指で触れている場合は、最後の指を離したときに水が止まります。

## MVP方針

- 幼児の短い押下にも即座に因果を返すため、長押し判定の待ち時間は設けず、`pointerdown`直後から水を出します。短押しでは一瞬だけ流れ、押し続けた場合だけ流れ続けます。
- 蛇口、水、水たまり、控えめな押下ヒントだけで構成し、文字説明、スコア、回数表示、音、設定は追加していません。
- 蛇口は丸い本体と大きなハンドルを組み合わせた、やわらかくおもちゃらしい簡略デザインです。
- 水たまりは水量に応じて全周を保ったまま拡大し、縦横画面とも左右端・下端に余白を残します。
- 中央の円形ヒントは最初の押下までだけ表示し、そのページセッション中は再表示しません。
- 通常表示では着水位置に小さな波紋を2本だけ描き、reduced-motionでは波紋を停止します。
- 水たまり量は上限を設け、解除後に時間で減衰させます。
- Canvas 1枚、単一`requestAnimationFrame`、固定数の描画要素で、長時間利用時もDOMやタイマーを増殖させません。
- `100dvh`、safe area、縦横回転、`prefers-reduced-motion`、複数指、`pointercancel`、`visibilitychange`、`pagehide`／`pageshow`、BFCache復帰を考慮しています。
- 外部ライブラリ、外部素材、保存、外部通信はありません。

## 公開範囲

MVP試作段階のため、共通ポータル、ConoHa公開allowlist、GA4、Clarityへは追加していません。GitHub Pages上では次の試作URLから直接確認できます。

`https://yuy080622-source.github.io/toddler-web-apps/apps/APP-011-faucet-water-play/`

## ローカル確認

Repositoryルートで次を実行し、`http://localhost:8000/apps/APP-011-faucet-water-play/`を開きます。

```bash
python3 -m http.server 8000
```

自動回帰テスト：

```bash
node apps/APP-011-faucet-water-play/tests/app.test.js
```
