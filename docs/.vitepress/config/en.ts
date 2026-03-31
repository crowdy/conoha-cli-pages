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
          text: 'Starter',
          items: [
            { text: 'Hello World', link: '/en/examples/hello-world' },
          ],
        },
        {
          text: 'Web Frameworks',
          items: [
            { text: 'Next.js', link: '/en/examples/nextjs' },
            { text: 'Vite + React', link: '/en/examples/vite-react' },
            { text: 'SvelteKit', link: '/en/examples/sveltekit' },
            { text: 'Rails + PostgreSQL', link: '/en/examples/rails-postgresql' },
            { text: 'Django + PostgreSQL', link: '/en/examples/django-postgresql' },
            { text: 'Laravel + MySQL', link: '/en/examples/laravel-mysql' },
            { text: 'Spring Boot + PostgreSQL', link: '/en/examples/spring-boot-postgresql' },
            { text: 'Express.js + MongoDB', link: '/en/examples/express-mongodb' },
            { text: 'NestJS + PostgreSQL', link: '/en/examples/nestjs-postgresql' },
            { text: 'Go Fiber', link: '/en/examples/go-fiber' },
            { text: 'Rust Actix-web', link: '/en/examples/rust-actix-web' },
          ],
        },
        {
          text: 'AI / LLM',
          items: [
            { text: 'FastAPI + AI Chatbot', link: '/en/examples/fastapi-ai-chatbot' },
            { text: 'Ollama + Open WebUI', link: '/en/examples/ollama-webui' },
          ],
        },
        {
          text: 'Self-Hosting',
          items: [
            { text: 'WordPress', link: '/en/examples/wordpress' },
            { text: 'Ghost Blog', link: '/en/examples/ghost-blog' },
            { text: 'Gitea', link: '/en/examples/gitea' },
            { text: 'MinIO + n8n', link: '/en/examples/minio-n8n' },
          ],
        },
        {
          text: 'Architecture Patterns',
          items: [
            { text: 'nginx Reverse Proxy', link: '/en/examples/nginx-reverse-proxy' },
            { text: 'Ory Hydra + FastAPI (OAuth2)', link: '/en/examples/hydra-python-api' },
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
