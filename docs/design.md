# PRJ-003 共通設計

## ポータル構成

- Repositoryルートの`index.html`を共通ポータルとし、`portal/apps.js`の一覧データからカードを生成する。
- 正式アイコンは後から差し替え可能とし、試作では絵文字とカード別CSS背景を使用する。
- 2列をスマートフォン縦の基本とし、620px以上は3列、940px以上は4列を目安にする。低い横画面は3列とする。
- ポータルは`overflow-x: hidden`だけを指定し、縦方向のブラウザ標準スクロールを維持する。
- 共通ホーム導線は`shared/portal-home.css`と`shared/portal-home.js`に分離し、各アプリの遊び処理とは独立させる。
- 長押し進捗は`requestAnimationFrame`と円形の穏やかな表示で示し、完了前の解除・取消では状態を破棄する。

## Microsoft Clarity

- Project ID `y7wygqymd5`を`shared/clarity.js`の1か所で管理する。
- Repositoryルートは`shared/clarity.js`、各APPは`../../shared/clarity.js`を参照し、GitHub Pagesの相対パスに対応する。
- Clarity本体は非同期で読み込み、取得失敗や遮断時もポータルと各アプリの初期化・操作へ依存関係を作らない。
- URLパス別の標準分析、セッション録画、ヒートマップだけで開始し、カスタムイベントやカスタムユーザーIDは設定しない。
- 将来正式公開するAPPも同じ共通ファイルを参照する。

## 基本構成

- HTML、CSS、Vanilla JavaScriptを基本とする。
- 各アプリは単独の`index.html`から起動できる静的構成を維持する。
- 外部ライブラリやビルド工程は、明確な必要性がない限り追加しない。
- アプリ内リンクやCSS・JavaScript参照は、GitHub Pagesのサブディレクトリでも動く相対パスとする。

## 入力

- タッチ、マウス、スタイラスをPointer Eventsへ統一する。
- `pointerId`で複数指を区別する必要があるアプリは、ポインターごとの状態を保持する。
- `touch-action`、`preventDefault()`、文字選択抑制を必要範囲に設定する。
- ボタン操作が背景の遊びへ伝播しないようイベント境界を明確にする。

## レイアウト

- `100dvh`を使用し、`100vh`をフォールバックとして併記する。
- `env(safe-area-inset-*)`を利用する。
- スクロール不要の1画面アプリは、横スクロールとオーバースクロールを防ぐ。
- 画面回転・リサイズ時にCanvasや操作領域を再計算する。

## 動き

- CSSの`prefers-reduced-motion`とJavaScriptの`matchMedia()`を併用する。
- reduced-motion時は、粒子数、寿命、移動距離、揺れ、光跡、繰り返しアニメーションを減らす。
- `requestAnimationFrame`は二重起動を防ぎ、非表示・終了時に停止する。

## 音声

- 短い効果音はWeb Audio APIで生成可能とする。
- 正式音源がある場合はHTML Audio APIを使用し、読込失敗時に安全なフォールバックへ移る。
- Web Speech APIは端末差が大きいため、視覚演出を音声成功へ依存させない。
- AudioContextはユーザー操作後に作成・再開する。
- 同時AudioNode数、再生間隔、最大音量を制限する。
- 終了したOscillator、Gain、Filter等を切断する。

## 状態保存

- 音OFF等の端末設定は`localStorage`へ保存する。
- 読み書きは`try/catch`で囲み、保存不可でもアプリを継続する。
- 子どもの操作履歴を保存する場合は、必要性をPMが承認したものに限定する。

## 中断と後片付け

- `visibilitychange`で不要な描画、生成、タイマー、音声を停止する。
- `pagehide`／`pageshow`ではBFCache復帰を考慮する。
- `setTimeout`、`setInterval`、DOM装飾、粒子配列、AudioNodeを残し続けない。
- 復帰時はアニメーションループやタイマーを1つだけ再開する。

## 連打対策

- 粒子・DOM・同時音声へ上限を設ける。
- 古い演出を削除するか、実行IDで無効化する。
- 音を間引いても視覚反応は返し、操作が無視された印象を避ける。
