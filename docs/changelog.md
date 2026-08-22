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

- ローカル移行後の検証、commit、push、GitHub Pages公開結果は同日セクションへ追記する。

