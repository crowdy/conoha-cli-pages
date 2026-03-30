import { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const en: LocaleSpecificConfig<DefaultTheme.Config> = {
  label: 'English',
  lang: 'en',
  description: 'CLI tool for ConoHa VPS3 API',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/en/guide/getting-started' },
      { text: 'Examples', link: '/en/examples/nextjs' },
      { text: 'Reference', link: '/en/reference/auth' },
    ],

    sidebar: {
      '/en/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/en/guide/getting-started' },
            { text: 'Server Management', link: '/en/guide/server' },
            { text: 'App Deploy', link: '/en/guide/app-deploy' },
            { text: 'App Management', link: '/en/guide/app-management' },
          ],
        },
      ],
      '/en/examples/': [
        {
          text: 'Deployment Examples',
          items: [
            { text: 'Next.js', link: '/en/examples/nextjs' },
            { text: 'FastAPI + AI Chatbot', link: '/en/examples/fastapi-ai-chatbot' },
            { text: 'Rails + PostgreSQL', link: '/en/examples/rails-postgresql' },
            { text: 'WordPress', link: '/en/examples/wordpress' },
          ],
        },
      ],
      '/en/reference/': [
        {
          text: 'Command Reference',
          items: [
            { text: 'auth', link: '/en/reference/auth' },
            { text: 'server', link: '/en/reference/server' },
            { text: 'app', link: '/en/reference/app' },
          ],
        },
      ],
    },

    editLink: {
      pattern: 'https://github.com/crowdy/conoha-cli-pages/edit/main/docs/:path',
      text: 'Edit this page',
    },
  },
}
