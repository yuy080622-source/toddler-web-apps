# PRJ-003 引き継ぎ

更新日：2026-08-23

## 現在状態

| ID | アプリ | 状態 | 次の確認 |
|---|---|---|---|
| APP-002 | シャボン玉タッチ | **コード公開前検証PASS・公開判定はPM判断待ち** | 子ども画面の回数表示、実機の複数指・音量・刺激 |
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

## APP-002 公開前検証

2026-08-23にCodex公開前検証を実施し、コード上の公開阻害事項を修正した。

- 音OFF設定を端末内保存し、保存失敗時も継続
- 同時効果音を最大4音に制限
- Oscillator、Gain、Filterを終了時に切断
- `visibilitychange`、`pagehide`、`pageshow`、BFCache復帰へ対応
- 非表示・退出時に泡、光粒、文字DOM、生成タイマー、効果音を停止・削除
- フォーカス中の泡を一時停止し、画面外消失を防止
- 390×844、844×390、1024×768でスクロールなし
- 同一泡への高速操作は1回のみ、別々の2泡への同時相当操作は2回反応
- 60秒超の連続動作後にDOM残留・増加なし
- JavaScript・コンソールエラーなし

技術検証はPASS。実際の複数指、音量・音質、刺激、safe area、reduced-motion、発熱はスマートフォン実機確認待ち。

子ども画面の「○こ われたよ！」は共通仕様の「回数を原則表示しない」と衝突する。アプリ固有の結果表示として例外にするか、削除するかはPM判断待ち。この判断が終わるまでAPP-002の正式公開判定は行わない。

## 公開

- Repository：`https://github.com/yuy080622-source/toddler-web-apps`
- branch：`main`
- GitHub Pages：mainブランチの`/ (root)`から公開済み
- APP-006公開URL：`https://yuy080622-source.github.io/toddler-web-apps/apps/APP-006-colorful-fireworks/`
- APP-002確認URL：`https://yuy080622-source.github.io/toddler-web-apps/apps/APP-002-bubble-touch/`
- 公開URLで画面表示、CSS、JavaScript、花火、音OFF、再読み込み後の音OFF維持を確認済み
- 公開URLのブラウザコンソールにエラー・警告なし

## 次の作業

1. APP-006は「効果判定待ち」とし、重大不具合がない限り追加変更しない。
2. APP-002の子ども画面に回数表示を残すか、PMが判断する。
3. 判断反映後、GitHub Pages上でスマホ実機の複数指、音量・音質、刺激、safe area、reduced-motion、発熱を確認する。
4. コード検証、PM判断、実機確認が揃った時点でAPP-002の正式公開可否を判断する。
