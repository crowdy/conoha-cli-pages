import { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const ko: LocaleSpecificConfig<DefaultTheme.Config> = {
  label: '한국어',
  lang: 'ko',
  description: 'ConoHa VPS3 API용 CLI 도구',

  themeConfig: {
    nav: [
      { text: '가이드', link: '/ko/guide/getting-started' },
      { text: '레퍼런스', link: '/ko/reference/app' },
    ],

    sidebar: {
      '/ko/guide/': [
        {
          text: '가이드',
          items: [
            { text: '시작하기', link: '/ko/guide/getting-started' },
            { text: '앱 배포', link: '/ko/guide/app-deploy' },
          ],
        },
      ],
      '/ko/reference/': [
        {
          text: '커맨드 레퍼런스',
          items: [
            { text: 'server', link: '/ko/reference/server' },
            { text: 'app', link: '/ko/reference/app' },
            { text: 'proxy', link: '/ko/reference/proxy' },
          ],
        },
        {
          text: '부록',
          items: [
            { text: '글로벌 플래그 / 환경 변수', link: '/ko/reference/global-flags' },
            { text: '종료 코드', link: '/ko/reference/exit-codes' },
          ],
        },
      ],
    },

    editLink: {
      pattern: 'https://github.com/crowdy/conoha-cli-pages/edit/main/docs/:path',
      text: '이 페이지 편집하기',
    },

    lastUpdated: {
      text: '마지막 업데이트',
    },

    outline: {
      label: '목차',
    },

    docFooter: {
      prev: '이전 페이지',
      next: '다음 페이지',
    },
  },
}
