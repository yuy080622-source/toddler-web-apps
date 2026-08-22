# いないいないばあ！

カーテンをタッチすると、笑顔の動物が「ばあ！」と現れる、1歳前後の子どもと保護者向けのWebアプリです。正解・失敗・制限時間はなく、何度でも遊べます。

## 使用技術

- HTML / CSS / JavaScript
- Web Speech API（MP3がない場合の読み上げ）
- HTML Audio API

外部ライブラリやフレームワークは使用していません。

## ファイル構成

```text
いないいないばあ/
├── index.html
├── css/style.css
├── js/script.js
├── assets/images/  # bear.png, rabbit.png, chick.png, frog.png
├── assets/sounds/  # bear.mp3, rabbit.mp3, chick.mp3, frog.mp3
└── README.md
```

## 起動方法

`index.html` をブラウザで開きます。音声ファイルの動作確認を安定させるには、このフォルダでローカルWebサーバーを起動し、表示されたURLをブラウザで開いてください。

例：`python3 -m http.server 8000`

## 操作方法

- カーテン（ステージ全体）をタッチまたはクリックすると開きます。
- キーボードではステージにフォーカスし、Enterまたはスペースで開けます。
- 右上の丸いボタンで音声のオン・オフを切り替えます。
- 約2.6秒後に自動で閉じ、次のキャラクターを準備します。

## 画像を差し替える

背景透過PNGを `assets/images/` に置き、次の名前にします。

- `bear.png`（くま）
- `rabbit.png`（うさぎ）
- `chick.png`（ひよこ）
- `frog.png`（かえる）

画像が存在しない、または読み込めない場合は、自動的に絵文字を表示します。

## 音声を差し替える

MP3を `assets/sounds/` に置き、`bear.mp3`、`rabbit.mp3`、`chick.mp3`、`frog.mp3` の名前にします。MP3を再生できない場合はWeb Speech APIの日本語読み上げへ切り替わります。どちらも使えない場合でもアニメーションは動きます。

## キャラクターを追加する

1. `js/script.js` の `CHARACTERS` 配列にデータを1件追加します。
2. `id`、`name`、`image`、`sound`、`speech`、`emoji`、`color` を設定します。
3. 指定した画像と音声を各assetsフォルダへ置きます。

同じキャラクターが2回連続で選ばれない処理は自動で適用されます。

## 時間を変更する

`js/script.js` 冒頭の `SETTINGS` を変更します。

- 表示時間：`revealDuration: 2600`（ミリ秒）
- カーテン速度：`curtainDuration: 620`（ミリ秒）

カーテン速度を変更したら、`css/style.css` 冒頭の `--curtain-speed: 620ms` も同じ値にしてください。

## GitHub Pagesで公開する基本手順

1. GitHubで新しいリポジトリを作ります。
2. このフォルダ内のファイルをリポジトリへ追加してpushします。
3. リポジトリの **Settings → Pages** を開きます。
4. **Deploy from a branch** を選び、公開するブランチと `/ (root)` を指定します。
5. 保存後に表示される公開URLを開きます。

## 現在の制限事項

- 初期状態では正式なPNGとMP3を同梱していないため、絵文字と端末の読み上げ音声を使用します。
- Web Speech APIの声質や利用可否はブラウザ・端末によって異なります。
- ブラウザの音声許可設定によっては音が出ない場合があります。
- 遊んだ回数はページを再読み込みすると0に戻ります（得点や履歴として保存しません）。
