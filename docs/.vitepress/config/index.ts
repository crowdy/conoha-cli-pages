import { defineConfig } from 'vitepress'
import { shared } from './shared'
import { ja } from './ja'
import { en } from './en'
import { ko } from './ko'

export default defineConfig({
  ...shared,
  locales: {
    root: { ...ja },
    en: { ...en },
    ko: { ...ko },
  },
})
