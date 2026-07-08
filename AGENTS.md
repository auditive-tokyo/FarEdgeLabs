# FarEdge Labs

## 📁 Project Structure

```
src/
├── api/            # API呼び出し関数（fetch ラッパー）
├── auth/           # Authentication context & routes
├── components/
│   ├── Content/    # Page creation, editing, display
│   ├── Menu/       # Navigation system
│   └── CyberCursor/  # Custom cursor effect
├── hooks/          # Custom hooks (useSiteSettings)
├── lib/amplify/    # AWS Amplify configuration (Cognito auth only)
└── types/          # TypeScript definitions
```

## 🏗 Architecture

```mermaid
flowchart LR
    subgraph Browser["ブラウザ (React + Vite SPA / GitHub Pages)"]
        subgraph PublicView["公開ビュー（未認証の訪問者 / 誰でも）"]
            View["ページ閲覧 / Menu"]
            MD["Markdown → HTML レンダリング"]
            ContactUI["お問い合わせフォーム"]
        end
        subgraph AdminView["管理ビュー（Cognito 認証済みの管理者のみ）"]
            Editor["ページ作成・編集・削除 / メニュー並べ替え"]
            Amplify["Amplify (認証トークン取得)"]
        end
    end

    subgraph AWS["AWS (ap-northeast-1)"]
        APIGW["API Gateway (REST, stage: prod)"]
        Cognito["Cognito User Pool (管理者のみ / セルフサインアップ無効)"]

        subgraph Lambdas["Lambda"]
            CRUD["content_crud"]
            CONTACT["contact_form"]
        end

        subgraph Data["データストア"]
            DDBContent[("DynamoDB: content-table<br/>正 (source of truth)")]
            DDBConfig[("DynamoDB: site-config")]
            DDBRate[("DynamoDB: rate-limit")]
            S3[("S3: content-md (非公開 / Block Public Access)<br/>markdown / contents-list.json / site-config.json")]
        end
    end

    Zoho["Zoho SMTP (メール送信)"]

    %% --- 公開読み取り (認証不要 / API GW が非公開 S3 をプロキシ) ---
    View -- "GET /contents, /contents/{id}, /site-config" --> APIGW
    APIGW -- "AWS 統合 + IAM ロールで GetObject" --> S3
    S3 -- "オブジェクト本文" --> APIGW
    APIGW -- "markdown / JSON (Cache-Control 5分)" --> MD

    %% --- お問い合わせ (認証不要) ---
    ContactUI -- "POST /contact" --> APIGW
    APIGW --> CONTACT
    CONTACT -- "レートリミット" --> DDBRate
    CONTACT -- "メール送信" --> Zoho

    %% --- 管理者ログイン ---
    Amplify -- "ログイン" --> Cognito
    Cognito -- "ID トークン" --> Amplify

    %% --- 管理者書き込み (Cognito 認可が必須) ---
    Editor -- "POST/PUT/DELETE /admin/* + ID トークン" --> APIGW
    APIGW -- "Cognito Authorizer で検証" --> CRUD
    CRUD -- "書き込み (正)" --> DDBContent
    CRUD -- "menu order / default page" --> DDBConfig
    CRUD -- "write-through (md + 一覧 JSON)" --> S3
```

### データフロー概要

> ブラウザ内は同一の React SPA だが、機能面では **公開ビュー（未認証の訪問者：閲覧・お問い合わせ）** と **管理ビュー（Cognito 認証済みの管理者：作成・編集・削除・メニュー並べ替え）** に分かれる。メニューからのアイテム追加・編集・削除など `/admin/*` を叩く操作はすべて Cognito のログインが前提で、API Gateway 側の Cognito Authorizer でトークンが検証される。

- **公開読み取り**: フロント → API Gateway → **S3 の AWS 統合**（Lambda を経由しない）。S3 バケットは非公開（Block Public Access 全ブロック）で、API Gateway が実行用 IAM ロールでサーバー側から `GetObject` し、その本文をクライアントへ返す。**署名付き URL も公開バケットも使わない**。生の markdown / JSON を返し、クライアント側で HTML にレンダリング。
- **管理者書き込み**: フロント（Cognito 認証）→ API Gateway `/admin/*` → `content_crud` Lambda → **DynamoDB（正）** に保存し、**S3 へ write-through**（`contents/{id}.md` と一覧 `contents-list.json`）。
- **お問い合わせ**: フロント → API Gateway `/contact` → `contact_form` Lambda → レートリミット確認後、Zoho SMTP でメール送信。
- **認証**: Cognito User Pool（管理者のみ、セルフサインアップ無効）。フロントは Amplify 経由でトークンを取得し `/admin/*` 呼び出しに付与。

> 補足: S3 は読み取り高速化のためのレイヤーで、コンテンツの正 (source of truth) は DynamoDB。Lambda が書き込み時に両者を同期している。
