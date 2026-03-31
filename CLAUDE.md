# ConoHa CLI Documentation Site

## Project Overview

ConoHa CLI (`conoha-cli`) の公式ドキュメントサイト。VitePress で構築し、GitHub Pages でホスティング。

- **Site URL**: https://crowdy.github.io/conoha-cli-pages/
- **CLI repo**: https://github.com/crowdy/conoha-cli
- **App samples**: https://github.com/crowdy/conoha-cli-app-samples

## Tech Stack

- VitePress 1.6.4
- Base path: `/conoha-cli-pages/`

## Commands

```bash
npm run docs:dev      # Dev server (hot reload)
npm run docs:build    # Production build → docs/.vitepress/dist/
npm run docs:preview  # Preview production build
```

Build verification (use after any doc change):
```bash
npx vitepress build docs
```

## Directory Structure

```
docs/
├── .vitepress/config/
│   ├── index.ts      # Main config (imports shared + locales)
│   ├── shared.ts     # Title, base path, search, social links
│   ├── ja.ts         # Japanese (default locale, root path /)
│   ├── en.ts         # English (/en/)
│   └── ko.ts         # Korean (/ko/)
├── guide/            # How-to guides
│   ├── getting-started.md
│   ├── quickstart.md      # (Japanese only)
│   ├── server.md
│   ├── app-deploy.md
│   └── app-management.md
├── examples/         # Framework/app deployment examples (20 pages)
├── reference/        # CLI command reference
│   ├── auth.md
│   ├── server.md
│   └── app.md
└── public/           # Static assets (favicon, CNAME)
```

## Multi-Language

- Japanese (ja): root `/` — primary language, most complete
- English (en): `/en/` — guide + reference only (example pages are ja only)
- Korean (ko): `/ko/` — guide + reference only (example pages are ja only)

Sidebar navigation is configured separately in each locale config file (`ja.ts`, `en.ts`, `ko.ts`). When adding a new page or sidebar entry, update all 3 files.

## Writing Example Pages

Example pages document how to deploy apps using `conoha app deploy`. Source code lives in a separate repo (`conoha-cli-app-samples`).

### Template

Follow the established pattern in `docs/examples/nextjs.md`:

1. Title (`# {Name} デプロイ`) + 1-2 sentence intro
2. `## 完成イメージ` — what the user will have
3. `## 前提条件` — CLI installed, server created
4. Numbered steps with inline code (Dockerfile, compose.yml, .dockerignore, source code)
5. `## N. デプロイ` — `conoha app init` + `conoha app deploy`
6. `## N. 動作確認` — status, logs, browser check
7. Optional: env vars, customization, code update

### Conventions

- Write in Japanese
- Use `<サーバー名>` as placeholder for server name/ID in conoha commands
- Include complete file content inline (Dockerfile, compose.yml, source code)
- Use `compose.yml` (not `docker-compose.yml`)
- Add `.dockerignore` section for projects with custom Dockerfiles
- Include actual source code from `conoha-cli-app-samples` — don't abbreviate

### Sidebar Categories

Examples are organized in the sidebar by category:
- スターター (Starter)
- Webフレームワーク (Web Frameworks)
- AI / LLM
- セルフホスティング (Self-Hosting)
- アーキテクチャパターン (Architecture Patterns)

## Writing Guide Pages

Guide pages include real CLI output examples (not just commands). See `docs/guide/app-deploy.md` for reference — it shows actual terminal output from `conoha app init`, `conoha app deploy`, etc.

## Git Workflow

- Branch from `main`
- PR with descriptive title
- Build must pass (`npx vitepress build docs`)
- Merge to `main` triggers GitHub Pages deploy
