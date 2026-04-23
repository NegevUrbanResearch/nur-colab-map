import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Layer pack `import.meta.glob` lists GeoJSON/PMTiles under `src/assets/layers/**`; mark as static assets, not parseable JS.
  assetsInclude: ['**/*.pmtiles', '**/*.geojson'],
  test: {
    environment: 'node',
  },
})
