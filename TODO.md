# FarEdge Labs サイト リブランディング TODO

Auditive（旧・音楽サイト）から FarEdge Labs（IT企業コーポレートサイト）への移行タスク管理。
チェック済み = 対応済み / 未チェック = 保留・今後対応。

---

## 1. ブランディング（公開画面）

- [x] `index.html` タイトル・メタ説明・キーワードを FarEdge Labs / IT向けに刷新
- [x] `index.html` `lang="ja"`（デフォルト日本語）
- [x] `public/manifest.json` の `short_name`/`name` を FarEdge Labs に
- [x] `public/sitemap.xml` の URL を `https://auditive-tokyo.github.io/FarEdgeLabs/` に
- [x] Header/Footer のブランド名・タグラインを差し替え（i18n化）
- [x] 背景動画（BackgroundVideo + `public/videos/bg_noise.mp4`）を削除
- [ ] **favicon / logo192.png の差し替え**（現状は旧Auditiveのアイコン）。新ロゴ確定後に置換
- [ ] OGP / Twitter カード メタタグの追加（`og:title` / `og:description` / `og:image`）
- [ ] `markdown-test.md` 内のサンプル文字列 "Auditive"（低優先・サンプルコンテンツ）

## 2. Analytics / CSP（`index.html`）

- [ ] **GA4 差し替え**: 旧プロパティ `G-NWPM86JM40` → FarEdge Labs用の新規GA4測定IDへ（2箇所）
- [ ] GA インライン初期化を外部ファイル化（例: `public/gtag-init.js`）し、`script-src` から `'unsafe-inline'` を削除（SonarQube Web:S7039 の script-src側を解消）
- [ ] CSP `frame-src https://w.soundcloud.com` の要否判断（音楽用。使わないなら削除して締める）
- [ ] CSP ワイルドカード見直し（SonarQube Web:S7039）:
  - `img-src https:` を実使用の配信元に限定
  - `connect-src https://*.execute-api...` を確定した API GW ID に具体化
- [x] `style-src 'unsafe-inline'` は **Won't Fix**（mermaidのランタイムinline style属性のため回避不可。コメント記載済み）

## 3. 国際化（i18n）

- [x] 軽量自前 i18n 基盤（`src/i18n/`: context / provider / ja・en リソース / useDocumentMeta）
- [x] 公開画面UIの文言を `t()` 化（Header/Footer/Loading/Menu開閉・並べ替え/Contactフォーム）
- [x] 言語トグル(JA/EN) を Header に追加、`localStorage` + `navigator.language` で検出
- [ ] **メニュー項目ラベル / ページタイトルの多言語化**（DynamoDB由来）:
  - ページ = 動的コンテンツで、ページタイトルがそのままメニューになる構造
  - ページ作成時に ja/en 両方を用意し、言語切替で出し分ける処理が必要
  - DynamoDB のコンテンツモデル変更（IaC）+ `content_crud` Lambda + フロント対応が絡む → 後日設計
- [ ] 管理画面UIの文言 i18n化 → **対応しない方針**（単一管理者・非販売のためYAGNI。将来製品化時に検討）

## 4. インフラ / CI・CD リブランド

- [x] **インフラの "auditive-*" リソース名を `faredgelabs-*` に刷新**（アカウント内衝突回避。`cdk synth` 検証済み）:
  - `cdk/app.py`: スタック名 `faredgelabs-lambda` / `faredgelabs-apigw`
  - `cdk/apigw_stack.py`, `cdk/lambda_stack.py`: テーブル/バケット/Cognito/API GW/Lambda/ロググループ/export名
  - `lambda_functions/*/app.py`: デフォルトテーブル名・バケット名
  - `deploy.yml`: スタック名・パラメータ参照
  - `package.json` / `package-lock.json`: `name` を `faredgelabs`、`homepage` を GitHub Pages URL に
  - CORS: `https://auditive-tokyo.github.io`（実ホストのため**維持**）、`https://auditive.tokyo`（旧ドメイン・**削除**）
  - 注意: DynamoDB/S3 は RETAIN。旧auditiveリソースが別途残る場合は手動削除を検討（新規は faredgelabs で作成される）
- [ ] （任意）プロジェクト名を単一定数化して各所へ渡すリファクタ（現状は各ファイルに直書き。CDK/Lambda/YAMLで実行環境が異なるため共通化は限定的）
- [x] `.vscode/settings.json`: SonarLint projectKey を `auditive-tokyo_FarEdgeLabs` に更新、Kiroで未認識だった `python.analysis.exclude`（Pylance用）を削除

## 5. デプロイ / ドメイン

- [x] `deploy.yml` の `cname: auditive.tokyo` を削除（GitHub Pages デフォルトドメインへ）
- [x] GitHub Actions のアクションを最新版へ SHA ピン留めで統一
- [ ] 独自ドメインを取得する場合: `cname` 再設定 + `sitemap.xml` / CSP / GA の URL 見直し

---

## 補足メモ
- コンテンツ本文（マークダウン）は自分で作成予定。確定後に ja/en 変換は別途対応。
- セキュリティ確認（保留中）: 管理画面のコンタクト送信表示・マークダウンレンダラで生HTML（`dangerouslySetInnerHTML` / `rehype-raw`）を使っていないか → XSS経路の実在有無を確定できる。
