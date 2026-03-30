import { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const ko: LocaleSpecificConfig<DefaultTheme.Config> = {
  label: '한국어',
  lang: 'ko',
  description: 'ConoHa VPS3 API용 CLI 도구',

  themeConfig: {
    nav: [
      { text: '가이드', link: '/ko/guide/getting-started' },
      { text: '실전 예제', link: '/ko/examples/nextjs' },
      { text: '레퍼런스', link: '/ko/reference/auth' },
    ],

    sidebar: {
      '/ko/guide/': [
        {
          text: '가이드',
          items: [
            { text: '시작하기', link: '/ko/guide/getting-started' },
            { text: '서버 관리', link: '/ko/guide/server' },
            { text: '앱 배포', link: '/ko/guide/app-deploy' },
            { text: '앱 관리', link: '/ko/guide/app-management' },
          ],
        },
      ],
      '/ko/examples/': [
        {
          text: '실전 배포 예제',
          items: [
            { text: 'Next.js', link: '/ko/examples/nextjs' },
            { text: 'FastAPI + AI 챗봇', link: '/ko/examples/fastapi-ai-chatbot' },
            { text: 'Rails + PostgreSQL', link: '/ko/examples/rails-postgresql' },
            { text: 'WordPress', link: '/ko/examples/wordpress' },
          ],
        },
      ],
      '/ko/reference/': [
        {
          text: '커맨드 레퍼런스',
          items: [
            { text: 'auth', link: '/ko/reference/auth' },
            { text: 'server', link: '/ko/reference/server' },
            { text: 'app', link: '/ko/reference/app' },
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
