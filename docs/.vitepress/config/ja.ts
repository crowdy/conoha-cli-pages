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
            { text: 'サーバー管理', link: '/guide/server' },
            { text: 'アプリデプロイ', link: '/guide/app-deploy' },
            { text: 'アプリ管理', link: '/guide/app-management' },
          ],
        },
      ],
      '/examples/': [
        {
          text: '実践デプロイ例',
          items: [
            { text: 'Next.js', link: '/examples/nextjs' },
            { text: 'FastAPI + AIチャットボット', link: '/examples/fastapi-ai-chatbot' },
            { text: 'Rails + PostgreSQL', link: '/examples/rails-postgresql' },
            { text: 'WordPress', link: '/examples/wordpress' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'コマンドリファレンス',
          items: [
            { text: 'auth', link: '/reference/auth' },
            { text: 'server', link: '/reference/server' },
            { text: 'app', link: '/reference/app' },
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
