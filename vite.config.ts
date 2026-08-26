import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// وضع "single" ينتج ملف HTML واحدًا يتضمن كل شيء (للمعاينة والمشاركة)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    plugins: [react(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    base: './',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 30 * 1024 * 1024 : 4096,
      cssCodeSplit: !single,
      chunkSizeWarningLimit: 4000,
    },
    server: { host: true, port: 5173 },
  }
})
