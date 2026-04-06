import { mkdirSync, writeFileSync } from 'node:fs'
import path, { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

type ChunkBudget = {
  initialJsKb: number
  routeChunkKb: number
}

const PERF_BUDGET: ChunkBudget = {
  initialJsKb: 180,
  routeChunkKb: 90,
}

const VENDOR_CHUNK_RULES: Array<{ name: string; match: string[] }> = [
  {
    name: 'framework',
    match: [
      '/node_modules/react/',
      '/node_modules/react-dom/',
      '/node_modules/@remix-run/',
      '/node_modules/react-router/',
      '/node_modules/react-router-dom/',
      '/node_modules/scheduler/',
      '/node_modules/use-sync-external-store/',
    ],
  },
  {
    name: 'i18n',
    match: [
      '/node_modules/i18next/',
      '/node_modules/react-i18next/',
    ],
  },
  {
    name: 'query',
    match: ['/node_modules/@tanstack/react-query/'],
  },
  {
    name: 'schema',
    match: ['/node_modules/zod/'],
  },
  {
    name: 'radix',
    match: ['/node_modules/@radix-ui/'],
  },
  {
    name: 'topology-vendor',
    match: [
      '/node_modules/@xyflow/',
      '/node_modules/dagre/',
    ],
  },
  {
    name: 'icons',
    match: ['/node_modules/lucide-react/'],
  },
  {
    name: 'toast',
    match: ['/node_modules/sonner/'],
  },
  {
    name: 'ui-utils',
    match: [
      '/node_modules/class-variance-authority/',
      '/node_modules/clsx/',
      '/node_modules/tailwind-merge/',
      '/node_modules/zustand/',
    ],
  },
  {
    name: 'parkly-sdk',
    match: [
      '/node_modules/@parkly/contracts/',
      '/node_modules/@parkly/gate-core/',
    ],
  },
]

function performanceBudgetPlugin(): Plugin {
  let outDir = ''

  return {
    name: 'parkly-performance-budget',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle)
        .filter((asset): asset is import('rollup').OutputChunk => asset.type === 'chunk')
        .map((chunk) => ({
          fileName: chunk.fileName,
          name: chunk.name,
          isEntry: chunk.isEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          modules: Object.keys(chunk.modules).length,
          sizeKb: Number((Buffer.byteLength(chunk.code, 'utf8') / 1024).toFixed(2)),
        }))
        .sort((a, b) => b.sizeKb - a.sizeKb)

      const initialJsKb = Number(
        chunks.filter((chunk) => chunk.isEntry).reduce((sum, chunk) => sum + chunk.sizeKb, 0).toFixed(2),
      )
      const oversizedRouteChunks = chunks.filter(
        (chunk) => !chunk.isEntry && chunk.name.startsWith('route-') && chunk.sizeKb > PERF_BUDGET.routeChunkKb,
      )
      const warnings: string[] = []

      if (initialJsKb > PERF_BUDGET.initialJsKb) {
        warnings.push(`Initial JS ${initialJsKb}kB exceeds budget ${PERF_BUDGET.initialJsKb}kB`)
      }
      for (const chunk of oversizedRouteChunks) {
        warnings.push(`Route chunk ${chunk.fileName} = ${chunk.sizeKb}kB exceeds budget ${PERF_BUDGET.routeChunkKb}kB`)
      }

      mkdirSync(outDir, { recursive: true })
      writeFileSync(
        path.join(outDir, 'performance-budget.json'),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            budget: PERF_BUDGET,
            initialJsKb,
            warnings,
            chunks,
          },
          null,
          2,
        ),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), performanceBudgetPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    cssCodeSplit: true,
    modulePreload: {
      polyfill: true,
    },
    chunkSizeWarningLimit: 220,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const normalizedId = id.replaceAll('\\', '/')
          for (const rule of VENDOR_CHUNK_RULES) {
            if (rule.match.some((segment) => normalizedId.includes(segment))) {
              return rule.name
            }
          }

          return 'vendor-misc'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
