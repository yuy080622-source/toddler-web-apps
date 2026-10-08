# APP-013 CHANGELOG

## 2026-10-08 — 5動物の絵本風デザイン・輪郭一致・滑らかな動作

- Pages：実装commit `de9696dd6010192695f857d8aae04846cd6993ff`の[run 37781153375](https://github.com/yuy080622-source/toddler-web-apps/actions/runs/37781153375)はbuild／deploy success。公開HTML／CSS／JSと必須4文書はHTTP 200、mainとSHA-256一致
- TLS検証つきHTTPSで取得したPages版の5種×3サイズ・輪郭一致・全動作・循環・実タッチ・実BFCache・reduced-motion等のブラウザ回帰もPASS。公開HTTPS URLへのChromium直接接続は環境CA未信頼（ERR_CERT_AUTHORITY_INVALID）で確認不可。証明書検証・信頼設定は変更なし
- mainへのcommit／push成功、main／origin/main同期。実機確認・PM承認後に正式公開を別判断。仕様変更を要する未解決問題はなし

- Chromiumの5種×3サイズで同一形状参照・描画境界一致・ピース保持・全固有動作・ひよこ／魚の一体移動・固定循環、広い吸着・各形状の範囲外戻り／実pointercancelをPASS
- 実2指所有権、100回高速入力、完成中入力、lostpointercapture、resize・回転、visibilitychange相当、実BFCache（pageshow.persisted=true）、全5種のreduced-motionをPASS
- 通常／完成のスクリーンショット30枚と3サイズの比較シートを生成して目視レビュー。犬の横長胴体・首・脚、狐の顔・耳・頬、周囲パーツの接続・輪郭・画面内配置を確認
- 実時間181.7秒／96ステージでDOM107固定・タイマー最大1本／待機時0本、二重進行・外部通信・console error／warningなし
- APP-010／011 Node回帰、既存ポータル＋APP-002／003／004／006／010／011の3サイズスモーク回帰、全18 JS構文、git diff --checkをPASS

- 開始main／origin/main：`1294edbde7e871e269bc81f2f0d8940639424b66`。正本の現行優先5動物仕様に沿い、個別正本は変更なし
- 固定循環を円かめ→横長長方形いぬ→縦長たまご形ひよこ→丸みのある三角形きつね→角丸ひし形さかなへ拡張。ねこなし
- SVG defsの同一輪郭を穴・ピースが参照し、図形別viewBox・幅・高さと共通ユーザー単位で縦横比・角丸・実寸を一致
- ピースを完成時に消さず、そのまま胴体／顔として保持。周囲パーツを後ろ、顔・模様を前に固定レイヤー化し、犬の首・脚、狐の耳・頬・胴体の接続を調整
- 淡い配色と丸みのある絵本風SVGへ改善。頭・尾・耳は付け根で小さく動かし、ひよこは6pxの1回跳ね、魚は尾びれ＋8pxのゆっくり泳ぎ。ピース・顔も一緒に動く
- スナップ180ms ease-out→完成保持1400ms（固有動作1100msを1回）→フェード220ms。ドラッグの拡大を除去し、サイズの飛びを防止
- 既存Pointer Events・広いpointerup前吸着・誤配置280ms戻り・所有権・lifecycle・実BFCache・safe area・100dvh・reduced-motionを維持。DOM107固定、タイマー最大1本／待機時0本
- 無音、保存・外部通信・スコア・制限時間なし。GitHub Pages試作のみ。ポータル・ホーム・分析・ConoHa allowlist・既存公開アプリの変更なし

## 2026-10-08 — 1図形1動物方式へ改修

- 作業開始main／origin/main：`2beb643161823752cd202ffda39940d1ecb84d4e`。最新取得後に一致を確認
- 旧3ピース／3型の同時表示・一括完成を廃止。○かめの甲羅→□いぬの胴体→△きつねの顔の固定循環へ変更
- 固定SVGで幼児向け動物を表現し、完成時に薄い周囲パーツと顔・甲羅模様を明瞭化。外部素材なし
- ピースを120〜150pxへ拡大。押下直後に追従し、通常表示は指より10px上へ補正
- 表示実寸に追従する広い中心距離判定とpointerup前の自動吸着。通常180msスナップ、範囲外は否定表現なしの280ms戻り
- かめの頭、いぬのしっぽ、きつねの耳を小さく1回だけ動かし、完成保持1400ms＋フェード220msで次へ。吸着から次まで約1800ms
- 最初のpointerIdだけが操作。追加指・高速入力・完成中の入力による二重進行を防止
- 既存Pointer Events・safe area・100dvh・lifecycle・BFCache・reduced-motion・テスト基盤を再利用。現在ステージと単一タイマーへ整理
- 中断・復帰・resize・回転で同じステージの未完成状態へ戻す。古いcallbackを無効化し、DOM64固定・タイマー最大1本／待機時0本を維持
- reduced-motionでは動物の動きなし、スナップ／戻り60ms・フェード120ms。完成と自動循環は維持
- 無音、保存・外部通信なし。正式公開・ポータル・ホーム・分析・ConoHa allowlist・追加形状は対象外。個別正本は変更なし
- Node300ステージ回帰、APP-010／011既存Node回帰、全18 JS構文、git diff --checkをPASS
- Chromium指定3サイズ、全動物の完成・実アニメーション・固定循環、pointerup前の広い吸着、戻り、実2指タッチ所有権、cancel／capture喪失、100回高速入力、resize・回転、visibilitychange相当、実BFCache、reduced-motion・キーボードをPASS
- 実時間180.6秒／96ステージでDOM64固定、タイマー最大1本・待機時0本、二重進行なし、外部通信なし、console error／warningなし
- 既存ポータル＋APP-002／003／004／006／010／011の3サイズスモーク回帰もPASS。既存分析通信は検証時のみスタブ化、公開コード・ConoHa workflowに変更なし
- 実装commit `3f1546a991216cd23661959bcbbda18c45b4a036`のPages run `37745805611`はbuild／deployともsuccess。公開HTML／CSS／JSと必須4文書はHTTP 200、mainとSHA-256一致
- TLS検証つきHTTPSで取得したPages版をローカル配信し、3サイズ・全動物・実タッチ・実BFCache・reduced-motion等を回帰PASS。公開URLへのChromium直接接続は環境CA未信頼で確認不可。証明書検証・信頼設定は変更なし
- BFCacheテストの移動先を同じアプリの別query URLに整理し、Markdownページの無関係なfavicon要求を回避。復帰ごとにpageshow.persisted=trueを確認
- mainへのGit commit／push成功、main／origin/mainを同期。iPhone実機・PM承認は待ち

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
