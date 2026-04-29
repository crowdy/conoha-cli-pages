import { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const ja: LocaleSpecificConfig<DefaultTheme.Config> = {
  label: '日本語',
  lang: 'ja',
  description: 'ConoHa VPS3をコマンドラインから操作するCLIツール',

  themeConfig: {
    nav: [
      { text: 'ガイド', link: '/guide/getting-started' },
      { text: '実践例', link: '/examples/nextjs' },
      { text: 'リファレンス', link: '/reference/auth' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'ガイド',
          items: [
            { text: 'はじめに', link: '/guide/getting-started' },
            { text: 'クイックスタート', link: '/guide/quickstart' },
            { text: 'サーバー管理', link: '/guide/server' },
            { text: 'アプリデプロイ', link: '/guide/app-deploy' },
            { text: 'アプリ管理', link: '/guide/app-management' },
            { text: 'conoha-proxy セットアップ', link: '/guide/proxy-setup' },
            { text: 'DNS / TLS', link: '/guide/dns-tls' },
            { text: 'GPU セットアップ', link: '/guide/gpu-setup' },
            { text: 'Claude Code スキル', link: '/guide/skill' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'スターター',
          items: [
            { text: 'Hello World', link: '/examples/hello-world' },
          ],
        },
        {
          text: 'Webフレームワーク',
          items: [
            { text: 'Next.js', link: '/examples/nextjs' },
            { text: 'Vite + React', link: '/examples/vite-react' },
            { text: 'SvelteKit', link: '/examples/sveltekit' },
            { text: 'Rails + PostgreSQL', link: '/examples/rails-postgresql' },
            { text: 'Django + PostgreSQL', link: '/examples/django-postgresql' },
            { text: 'Laravel + MySQL', link: '/examples/laravel-mysql' },
            { text: 'Spring Boot + PostgreSQL', link: '/examples/spring-boot-postgresql' },
            { text: 'Express.js + MongoDB', link: '/examples/express-mongodb' },
            { text: 'NestJS + PostgreSQL', link: '/examples/nestjs-postgresql' },
            { text: 'Go Fiber', link: '/examples/go-fiber' },
            { text: 'Rust Actix-web', link: '/examples/rust-actix-web' },
          ],
        },
        {
          text: 'AI / LLM',
          items: [
            { text: 'FastAPI + AIチャットボット', link: '/examples/fastapi-ai-chatbot' },
            { text: 'Ollama + Open WebUI', link: '/examples/ollama-webui' },
          ],
        },
        {
          text: 'セルフホスティング',
          items: [
            { text: 'WordPress', link: '/examples/wordpress' },
            { text: 'Ghost ブログ', link: '/examples/ghost-blog' },
            { text: 'Gitea', link: '/examples/gitea' },
            { text: 'MinIO + n8n', link: '/examples/minio-n8n' },
          ],
        },
        {
          text: 'アーキテクチャパターン',
          items: [
            { text: 'nginx リバースプロキシ', link: '/examples/nginx-reverse-proxy' },
            { text: 'Ory Hydra + FastAPI (OAuth2)', link: '/examples/hydra-python-api' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'コマンドリファレンス',
          items: [
            { text: 'auth', link: '/reference/auth' },
            { text: 'server', link: '/reference/server' },
            { text: 'keypair', link: '/reference/keypair' },
            { text: 'volume', link: '/reference/volume' },
            { text: 'network', link: '/reference/network' },
            { text: 'flavor', link: '/reference/flavor' },
            { text: 'image', link: '/reference/image' },
            { text: 'dns', link: '/reference/dns' },
            { text: 'lb', link: '/reference/lb' },
            { text: 'storage', link: '/reference/storage' },
            { text: 'identity', link: '/reference/identity' },
            { text: 'app', link: '/reference/app' },
            { text: 'proxy', link: '/reference/proxy' },
            { text: 'gpu', link: '/reference/gpu' },
            { text: 'config', link: '/reference/config' },
            { text: 'skill', link: '/reference/skill' },
          ],
        },
        {
          text: '付録',
          items: [
            { text: 'グローバルフラグ・環境変数', link: '/reference/global-flags' },
            { text: '終了コード', link: '/reference/exit-codes' },
          ],
        },
      ],
    },

    editLink: {
      pattern: 'https://github.com/crowdy/conoha-cli-pages/edit/main/docs/:path',
      text: 'このページを編集する',
    },

    lastUpdated: {
      text: '最終更新',
    },

    outline: {
      label: '目次',
    },

    docFooter: {
      prev: '前のページ',
      next: '次のページ',
    },
  },
}
