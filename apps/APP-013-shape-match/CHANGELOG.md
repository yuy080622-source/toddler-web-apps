# APP-013 CHANGELOG

## 2026-10-02 — かたちポン！MVP試作

- 作業開始基準main：`5523f197ee0a7a393232192d421524e3868b811a`
- 正本`docs/APP-013-shape-match.md`に沿い、○・□・△の独立したドラッグアプリを追加
- 対応する型中心との距離を「型の枠幅÷2＋22px」で判定し、正しい型だけへ控えめな予告反応を表示。範囲が重なる場所は最寄りの型も照合し、別の型への誤配置を正解にしない
- 正解は180msのスナップ＋1回の小さな弾み。誤配置は否定表現なしで280msの戻り
- 3形完成後に固定DOMで1回の穏やかな演出を行い、1100ms後に自動リセット
- Pointer Events、ピースごとのpointerId所有権、別ピースの同時ドラッグ、キャンセル・capture喪失時の解放を実装
- `100dvh`、safe area、縦横回転・resize、中断・復帰、BFCache、reduced-motion、キーボード／ARIAへ対応
- 固定DOM34要素、最大1本のリセットタイマー、RAF・intervalなしで増殖を防止
- Node回帰とブラウザ検証スクリプトを追加。検証用Playwrightはアプリの実行依存に含めない
- 無音、保存・外部通信なし。ポータル、共通ホーム、GA4、Clarity、ConoHa allowlist、追加形状は未追加
- GitHub Pages試作確認までを対象とし、正式公開・PM操作感承認は実機確認後に判断
- Node540ドラッグ回帰、既存APP-010／011回帰、全18 JS構文、指定3サイズの操作・表示、実3指タッチ、実BFCache、reduced-motion、既存ポータル＋6アプリのスモーク回帰をPASS
- 最終コードの実時間181.1秒／447ドラッグでDOM34固定、タイマー最大1本、外部通信なし、console error／warningなしを確認
- 実装commit `3663218d1bdcef35a6f7d217d1e97234c5bfd465`のPages run `37043553611`はbuild／deployともsuccess。公開HTML／CSS／JSと指定4文書のHTTP 200、SHA-256一致を確認
- HTTPS取得したPages版をローカル配信し、3サイズ・主要操作・実タッチ・実BFCache・reduced-motionを回帰PASS。公開URLへのChromium直接接続は環境CA未信頼のため未実施。信頼ストアへのCA追加は自動承認審査が拒否し、信頼設定は変更なし
- Git CLI push認証不可のため、同一ツリーをGitHub APIでmainへfast-forward反映し、ローカルmain／origin/mainを同期
