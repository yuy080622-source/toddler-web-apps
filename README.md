# PRJ-003 幼児向けWebアプリ群

1〜2歳前後の子どもと保護者が、スマートフォンやタブレットで直感的に遊べる静的Webアプリ集です。

GitHub Repositoryをコード、仕様、設計、変更履歴、引き継ぎ情報の正式な共通参照点として使用します。

## アプリ一覧

| ID | アプリ | 保存場所 | 状態 |
|---|---|---|---|
| APP-002 | シャボン玉タッチ | `apps/APP-002-bubble-touch/` | 実装済み・実機テスト待ち |
| APP-003 | くだものポン！ | `apps/APP-003-fruit-pop/` | 実装済み・実機テスト待ち |
| APP-004 | 音あそびピアノ | `apps/APP-004-sound-play-piano/` | 正式公開済み・iPhone実機確認PASS |
| APP-005 | できたよ！生活習慣 | `apps/APP-005-daily-habits-play/` | 実装済み・実機テスト待ち |
| APP-006 | カラフル花火 | `apps/APP-006-colorful-fireworks/` | Codex公開前検証PASS・実機確認待ち |
| APP-007 | どうぶつをタッチ！ | `apps/APP-007-animal-touch/` | 実装済み・実機テスト待ち |
| APP-008 | いないいないばあ！ | `apps/APP-008-peekaboo/` | 実装済み・実機テスト待ち |

## 共通資料

- [プロジェクト背景](docs/project-context.md)
- [共通仕様](docs/specification.md)
- [共通設計](docs/design.md)
- [引き継ぎ](docs/handoff.md)
- [変更履歴](docs/changelog.md)

## 公開URL

- 共通ポータル：`https://yulab-web.com/apps/`
- APP-004：`https://yulab-web.com/apps/apps/APP-004-sound-play-piano/`
- 旧GitHub Pages：`https://yuy080622-source.github.io/toddler-web-apps/`


## ローカル確認

各アプリの`index.html`を直接開くか、Repositoryルートで静的サーバーを起動してください。

```bash
python3 -m http.server 8000
```
