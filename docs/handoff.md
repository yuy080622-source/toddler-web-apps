# PRJ-003 引き継ぎ

更新日：2026-08-23

## 現在状態

| ID | アプリ | 状態 | 次の確認 |
|---|---|---|---|
| APP-002 | シャボン玉タッチ | Repository移行済み。主要実装あり | スマホ・タブレット実機、複数指、音量 |
| APP-003 | くだものポン！ | Repository移行済み。主要実装あり | 素材フォールバック、連打、音量 |
| APP-004 | 音あそびピアノ | Repository移行済み。主要実装あり | 複数指、指滑り、同時発音、音量 |
| APP-005 | できたよ！生活習慣 | Repository移行済み。主要実装あり | 3モード完走、ドラッグ、途中退出 |
| APP-006 | カラフル花火 | **Codex公開前検証PASS・実機確認待ち** | iPhone音量、複数指、発熱、光量、reduced-motion |
| APP-007 | どうぶつをタッチ！ | Repository移行済み。保護者機能あり | タイマー、統計、長押し、実機音声 |
| APP-008 | いないいないばあ！ | Repository移行済み。主要実装あり | カーテン速度、読み上げ、連打 |

## APP-006 公開前検証

対応済み：

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

実機確認待ち：

- iPhone／Androidでの音量
- 実際の複数指
- 発熱
- 幼児本人が感じる光量・刺激
- 実際のタップ感
- reduced-motionを実際に有効化した操作

## 公開

- Repository：`https://github.com/yuy080622-source/toddler-web-apps`
- branch：`main`
- GitHub Pages：mainブランチの`/ (root)`から公開済み
- APP-006公開URL：`https://yuy080622-source.github.io/toddler-web-apps/apps/APP-006-colorful-fireworks/`
- 公開URLで画面表示、CSS、JavaScript、花火、音OFF、再読み込み後の音OFF維持を確認済み
- 公開URLのブラウザコンソールにエラー・警告なし

## 次の作業

1. ユーザーがAPP-006公開URLをiPhoneで開く。
2. 音量、音OFF保持、複数指、高速タップ、発熱、光量、タップ感を確認する。
3. iPhoneの「視差効果を減らす」を有効にして刺激が弱まることを確認する。
4. 実機結果をAPP-006のCHANGELOGと本handoffへ反映する。
