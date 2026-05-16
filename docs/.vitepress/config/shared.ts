import { defineConfig } from 'vitepress'

const SITE_URL = 'https://conoha-cli.crowdy.dev'
const SITE_DESCRIPTION =
  'ConoHa VPS3 をコマンドラインから操作。サーバー作成からアプリデプロイまで、すべてターミナルから。'
const OG_IMAGE = `${SITE_URL}/og.png`
const GA4_ID = 'G-L35SK4TD46'
const GTM_ID = 'GTM-MXP59Q7F'

export const shared = defineConfig({
  title: 'ConoHa CLI',
  description: SITE_DESCRIPTION,
  base: '/',
  lastUpdated: true,
  cleanUrls: true,
  srcExclude: ['**/superpowers/**'],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'alternate icon', type: 'image/x-icon', href: '/favicon.ico' }],

    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'ConoHa CLI' }],
    ['meta', { property: 'og:title', content: 'ConoHa CLI' }],
    ['meta', { property: 'og:description', content: SITE_DESCRIPTION }],
    ['meta', { property: 'og:url', content: `${SITE_URL}/` }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:locale', content: 'ja_JP' }],

    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'ConoHa CLI' }],
    ['meta', { name: 'twitter:description', content: SITE_DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],

    ['script', { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}` }],
    [
      'script',
      {},
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');`,
    ],

    [
      'script',
      {},
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
    ],
  ],

  transformHtml(code) {
    return code.replace(
      /<body([^>]*)>/,
      `<body$1><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
    )
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/crowdy/conoha-cli' },
    ],
    search: {
      provider: 'local',
    },
  },
})
