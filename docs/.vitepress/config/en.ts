import { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const en: LocaleSpecificConfig<DefaultTheme.Config> = {
  label: 'English',
  lang: 'en',
  description: 'CLI tool for ConoHa VPS3 API',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/en/guide/getting-started' },
      { text: 'Reference', link: '/en/reference/app' },
    ],

    sidebar: {
      '/en/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/en/guide/getting-started' },
            { text: 'App Deploy', link: '/en/guide/app-deploy' },
          ],
        },
      ],
      '/en/reference/': [
        {
          text: 'Command Reference',
          items: [
            { text: 'server', link: '/en/reference/server' },
            { text: 'app', link: '/en/reference/app' },
            { text: 'proxy', link: '/en/reference/proxy' },
          ],
        },
        {
          text: 'Appendix',
          items: [
            { text: 'Global flags / env vars', link: '/en/reference/global-flags' },
            { text: 'Exit codes', link: '/en/reference/exit-codes' },
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
