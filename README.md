# FarEdge Labs

日英2言語のコーポレートサイト。**Next.js 16 App Router を静的 HTML に書き出し、
GitHub Pages が配信**している。<https://faredgelabs.com>（`/en/` が英語）。

バックエンドは別で、GCP の Cloud Run functions（`gc_run_functions/`）を Terraform
（`terraform/`）で管理している。

## 動かす

```bash
npm ci
npm run dev        # http://localhost:3000
```

| コマンド | 何をするか |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 静的書き出し（`out/`） |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | 型検査。**lint だけでは死んだ import が見つからない** |
| `npm run brand` | アイコンと OG カードの再生成。ビルドには含まれないので、変えたら手で実行して PNG をコミットする |

## デプロイ

`main` → 自動で作られるリリース PR → `production` へマージ → ビルド → `out/` が
`gh-pages` へ push される。

- **サイト**は `.github/workflows/deploy.yml`
- **バックエンド**は `.github/workflows/infra.yml`（`production` への push で `terraform apply`）
- 両者は独立している。サイトのデプロイが関数の存在に依存してはいけないし、その逆も同じ

## 資料

| 何を | どこに |
|---|---|
| 全体に効く制約・ハードルール | [`CLAUDE.md`](./CLAUDE.md) ← **これが契約** |
| そのディレクトリだけの約束 | `<dir>/CLAUDE.md` |
| いつ何を決め、何を却下したか | [`DECISIONS.md`](./DECISIONS.md) |
| 残っている作業 | [`TODO.md`](./TODO.md) |

`CLAUDE.md` は Claude Code が毎回自動で読む。ディレクトリごとの `CLAUDE.md` は、その
ディレクトリのファイルを読んだときだけ載る。実装が終わったら `/docs` で更新する。

> [!note] この repo はテンプレート（`next16-claude-starter`）から始まった
> アニメーションまわりには当時のコードが残っているが、コピー・ルーティング・配色・
> サーバ側は全部書き直してある。テンプレートが持ち込んだ資料は 2026-09-10 に削除した
> （`DECISIONS.md` の ADR-0021）。**古い README は Vercel へのデプロイを案内していたが、
> 実際は GitHub Pages。** 同種の記述を見つけたら疑うこと。
