import { defineConfig } from 'vitepress'
import { shared } from './shared'
import { ja } from './ja'

export default defineConfig({
  ...shared,
  locales: {
    root: { ...ja },
  },
})
