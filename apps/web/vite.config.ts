import { mkdirSync, writeFileSync } from "node:fs"
import path, { resolve } from "node:path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"

type ChunkBudget = {
  initialJsKb: number
  routeChunkKb: number
}

const PERF_BUDGET: ChunkBudget = {
  initialJsKb: 180,
  routeChunkKb: 90,
}

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

      const initialJsKb = Number(chunks.filter((chunk) => chunk.isEntry).reduce((sum, chunk) => sum + chunk.sizeKb, 0).toFixed(2))
      const oversizedRouteChunks = chunks.filter((chunk) => !chunk.isEntry && chunk.name.startsWith('route-') && chunk.sizeKb > PERF_BUDGET.routeChunkKb)
      const warnings: string[] = []

      if (initialJsKb > PERF_BUDGET.initialJsKb) {
        warnings.push(`Initial JS ${initialJsKb}kB vượt budget ${PERF_BUDGET.initialJsKb}kB`)
      }
      for (const chunk of oversizedRouteChunks) {
        warnings.push(`Route chunk ${chunk.fileName} = ${chunk.sizeKb}kB vượt budget ${PERF_BUDGET.routeChunkKb}kB`)
      }

      mkdirSync(outDir, { recursive: true })
      writeFileSync(path.join(outDir, 'performance-budget.json'), JSON.stringify({
        generatedAt: new Date().toISOString(),
        budget: PERF_BUDGET,
        initialJsKb,
        warnings,
        chunks,
      }, null, 2))
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
          if (id.includes('/src/pages/AuditViewerPage')) return 'route-audit'
          if (id.includes('/src/pages/SessionsPage')) return 'route-sessions'
          if (id.includes('/src/pages/ReportsPage')) return 'route-reports'
          if (id.includes('/src/pages/MobileCapturePage')) return 'route-mobile-capture'
          if (id.includes('/src/pages/RunLanePage')) return 'route-run-lane'
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-core'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('@radix-ui')) return 'radix-ui'
          if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) return 'ui-utils'
          return 'vendor'
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
