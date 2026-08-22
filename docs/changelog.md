# PRJ-003 変更履歴

## 2026-08-23 — GitHub正式運用への初回移行

### 変更

- 公開Repository `yuy080622-source/toddler-web-apps`を新規作成
- PRJ-003現行7アプリを`apps/`配下へコピー移行
- 旧`Fashion`フォルダ内の動物タッチ旧版は移行対象外とした
- `AGENTS.md`を追加し、PM・ChatGPT・Codexの役割と更新ルールを明文化
- 共通のプロジェクト背景、仕様、設計、引き継ぎ、変更履歴を`docs/`へ追加
- GitHub PagesのJekyll処理を無効化する`.nojekyll`を追加
- `.DS_Store`等を除外する`.gitignore`を追加

### 移行元の扱い

- デスクトップ上の元フォルダは削除・変更せず、当面バックアップとして保持

### APP-006

- 公開前検証PASS版を`apps/APP-006-colorful-fireworks/`へ移行
- GitHub Pagesのサブディレクトリで動作する相対パス構成を維持

### 検証・公開

- 7アプリの移行元と移行先にファイル差分がないことを確認
- 全アプリのJavaScript構文を確認
- HTML内にGitHub Pagesで壊れるルート絶対パスがないことを確認
- `main`ブランチへ初回commitをpush
- GitHub Pagesを`main`／`/ (root)`から有効化
- APP-006を次のURLで公開
  - `https://yuy080622-source.github.io/toddler-web-apps/apps/APP-006-colorful-fireworks/`
- 公開URLで以下を確認
  - HTML表示：PASS
  - CSS読込：PASS
  - JavaScript初期化：PASS
  - タッチ相当操作による花火：PASS
  - 音ON／OFF表示：PASS
  - 音OFFの再読み込み後保持：PASS
  - 相対パス：PASS
  - コンソールエラー・警告：なし

### 残る確認

- iPhone／Android実機の音量
- 実際の複数指
- 発熱
- 幼児本人が感じる光量・刺激
- 実際のタップ感
- reduced-motionを実機で有効にした操作
