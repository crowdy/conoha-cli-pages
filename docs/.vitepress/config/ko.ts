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
          text: '스타터',
          items: [
            { text: 'Hello World', link: '/ko/examples/hello-world' },
          ],
        },
        {
          text: '웹 프레임워크',
          items: [
            { text: 'Next.js', link: '/ko/examples/nextjs' },
            { text: 'Vite + React', link: '/ko/examples/vite-react' },
            { text: 'SvelteKit', link: '/ko/examples/sveltekit' },
            { text: 'Rails + PostgreSQL', link: '/ko/examples/rails-postgresql' },
            { text: 'Django + PostgreSQL', link: '/ko/examples/django-postgresql' },
            { text: 'Laravel + MySQL', link: '/ko/examples/laravel-mysql' },
            { text: 'Spring Boot + PostgreSQL', link: '/ko/examples/spring-boot-postgresql' },
            { text: 'Express.js + MongoDB', link: '/ko/examples/express-mongodb' },
            { text: 'NestJS + PostgreSQL', link: '/ko/examples/nestjs-postgresql' },
            { text: 'Go Fiber', link: '/ko/examples/go-fiber' },
            { text: 'Rust Actix-web', link: '/ko/examples/rust-actix-web' },
          ],
        },
        {
          text: 'AI / LLM',
          items: [
            { text: 'FastAPI + AI 챗봇', link: '/ko/examples/fastapi-ai-chatbot' },
            { text: 'Ollama + Open WebUI', link: '/ko/examples/ollama-webui' },
          ],
        },
        {
          text: '셀프 호스팅',
          items: [
            { text: 'WordPress', link: '/ko/examples/wordpress' },
            { text: 'Ghost 블로그', link: '/ko/examples/ghost-blog' },
            { text: 'Gitea', link: '/ko/examples/gitea' },
            { text: 'MinIO + n8n', link: '/ko/examples/minio-n8n' },
          ],
        },
        {
          text: '아키텍처 패턴',
          items: [
            { text: 'nginx 리버스 프록시', link: '/ko/examples/nginx-reverse-proxy' },
            { text: 'Ory Hydra + FastAPI (OAuth2)', link: '/ko/examples/hydra-python-api' },
          ],
        },
      ],
      '/ko/reference/': [
        {
          text: '커맨드 레퍼런스',
          items: [
            { text: 'auth', link: '/ko/reference/auth' },
            { text: 'server', link: '/ko/reference/server' },
            { text: 'network', link: '/ko/reference/network' },
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
