import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Emits sw.js with the list of built files to cache for offline use. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff'))
      const files = ['./', ...built.map((f) => `./${f}`), ...readdirSync('public').map((f) => `./${f}`)]
      const template = readFileSync('pwa/sw.template.js', 'utf8')
      const version = createHash('sha256').update(files.join('\n')).update(template).digest('hex').slice(0, 10)
      const source = template
        .replace("'urgiin-mod-__VERSION__'", `'urgiin-mod-${version}'`)
        .replace('= __PRECACHE__', `= ${JSON.stringify(files, null, 2)}`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative paths, so the build works from any folder (e.g. GitHub Pages' /repo-name/).
  base: './',
  plugins: [react(), serviceWorker()],
})
