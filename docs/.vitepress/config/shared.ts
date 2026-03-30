import { defineConfig } from 'vitepress'

export const shared = defineConfig({
  title: 'ConoHa CLI',
  base: '/conoha-cli-pages/',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/crowdy/conoha-cli' },
    ],
    search: {
      provider: 'local',
    },
  },
})
