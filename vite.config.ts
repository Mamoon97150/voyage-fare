import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { configDefaults } from 'vitest/config'

/** Every file under a folder, as site addresses ("/icons/icon-192.png"). */
function filesIn(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesIn(path, root) : [`/${relative(root, path).split('\\').join('/')}`]
  })
}

/**
 * The service worker (build 7 step 5): `pwa/sw.js` with the list of the build's files and a
 * version, written as /sw.js. Only at build time: the dev server has no service worker.
 */
function serviceWorker(): Plugin {
  return {
    name: 'voyage-fare-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).map((name) => `/${name}`)
      const kept = [...new Set(['/index.html', ...built, ...filesIn('public')])]
        // Fonts: the woff2 files for Latin scripts are enough (other alphabets load when needed).
        .filter((file) => !file.endsWith('.map') && file !== '/sw.js')
        .filter((file) => !/\.woff$|(cyrillic|greek|vietnamese|hebrew|math|symbols)/.test(file))
        .sort()
      const template = readFileSync('pwa/sw.js', 'utf8')
      const version = createHash('sha256')
        .update(template)
        .update(kept.join('\n'))
        .update(
          Object.values(bundle)
            .map((b) => ('code' in b ? b.code : String(b.source)))
            .join('\n'),
        )
        .digest('hex')
        .slice(0, 12)
      const source = template
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__FILES__', JSON.stringify(kept, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // The smoke test talks to the real Supabase project with the demo account: run it on demand.
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
  },
})
