# PRJ-003 引き継ぎ

更新日：2026-08-23

## 現在状態

| ID | アプリ | 状態 | 次の確認 |
|---|---|---|---|
| APP-002 | シャボン玉タッチ | Repository移行済み。主要実装あり | スマホ・タブレット実機、複数指、音量 |
| APP-003 | くだものポン！ | Repository移行済み。主要実装あり | 素材フォールバック、連打、音量 |
| APP-004 | 音あそびピアノ | Repository移行済み。主要実装あり | 複数指、指滑り、同時発音、音量 |
| APP-005 | できたよ！生活習慣 | Repository移行済み。主要実装あり | 3モード完走、ドラッグ、途中退出 |
| APP-006 | カラフル花火 | **MVP正式公開済み・iPhone実機確認PASS** | 効果判定待ち |
| APP-007 | どうぶつをタッチ！ | Repository移行済み。保護者機能あり | タイマー、統計、長押し、実機音声 |
| APP-008 | いないいないばあ！ | Repository移行済み。主要実装あり | カーテン速度、読み上げ、連打 |

## APP-006 公開完了

Codex公開前検証で以下を確認済み：

- 子ども画面から回数表示を削除
- 音OFF設定を端末内保存
- 保存失敗時のフォールバック
- 同時効果音最大4音
- AudioNode解放
- `visibilitychange`対応
- `pagehide`／`pageshow`／BFCache対応
- 高速260回操作PASS
- 粒子上限200
- 1024×768表示確認
- JavaScript・コンソールエラーなし
- reduced-motionコード確認

その後、iPhone実機で音量・操作感・複数指・高速タップ・表示・刺激を確認し、ユーザー確認ですべて問題なし。APP-006はMVP正式公開済みとする。

## 公開

- Repository：`https://github.com/yuy080622-source/toddler-web-apps`
- branch：`main`
- GitHub Pages：mainブランチの`/ (root)`から公開済み
- APP-006公開URL：`https://yuy080622-source.github.io/toddler-web-apps/apps/APP-006-colorful-fireworks/`
- 公開URLで画面表示、CSS、JavaScript、花火、音OFF、再読み込み後の音OFF維持を確認済み
- 公開URLのブラウザコンソールにエラー・警告なし

## 次の作業

1. APP-006は「効果判定待ち」とし、重大不具合がない限り追加変更しない。
2. 次の公開候補としてAPP-002「シャボン玉タッチ」の公開前検証へ進む。
3. APP-002はCodexで公開前の共通安全・レスポンシブ・複数指・高速タップ・中断復帰・音声・reduced-motion検証を実施する。
4. Codex検証PASS後、GitHub Pages上でスマホ実機確認を行い、公開可否を判断する。
