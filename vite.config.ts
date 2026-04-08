import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Read the package version at build time so we can bake it into the bundle as
// a literal string constant via Vite's `define`. This avoids importing the
// whole package.json (which inlines the entire JSON object into the IIFE) and
// also sidesteps Foundry's cached `game.modules.get(id).version` on hot-reload.
const pkgVersion = JSON.parse(
  fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
).version;

/**
 * Vite plugin to increment build number on each build
 */
function incrementBuildPlugin() {
  return {
    name: 'increment-build',
    buildStart() {
      const buildInfoPath = resolve('build-info.json');

      let buildInfo = { buildNumber: 0 };

      // Read existing build info
      if (fs.existsSync(buildInfoPath)) {
        const content = fs.readFileSync(buildInfoPath, 'utf-8');
        try {
          buildInfo = JSON.parse(content);
          // Validate buildNumber property
          if (typeof buildInfo.buildNumber !== 'number') {
            console.warn(
              'build-info.json is missing a valid buildNumber property. Resetting build number to 0.'
            );
            buildInfo = { buildNumber: 0 };
          }
        } catch (err) {
          console.error(
            `Error parsing ${buildInfoPath}: ${(err as Error).message}. Resetting build number to 0.`
          );
          buildInfo = { buildNumber: 0 };
        }
      }

      // Increment build number
      buildInfo.buildNumber = (buildInfo.buildNumber || 0) + 1;

      // Write back to file
      fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

      console.log(`Build #${buildInfo.buildNumber}`);
    }
  };
}

export default defineConfig({
  build: {
    // Output configuration
    outDir: 'dist',
    emptyOutDir: false, // Don't delete entire dist folder
    sourcemap: true,
    minify: false, // Set to 'terser' for production if desired
    target: 'es2020',

    // Library mode for IIFE output (required for FoundryVTT)
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      // Global variable name for IIFE - must not conflict with other FoundryVTT modules
      name: 'DormanLakelyCartography',
      formats: ['iife'], // Critical for FoundryVTT compatibility
      fileName: () => 'main.js' // Output filename
    },

    // Rollup-specific options
    rollupOptions: {
      output: {
        // Ensure single file output (no code splitting)
        inlineDynamicImports: true,
        // Include inline sources for better debugging
        sourcemapExcludeSources: false
      },
      onwarn(warning, warn) {
        // Suppress certain warnings
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        warn(warning);
      }
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },

  // Replace __DLC_VERSION__ in source with a literal string at build time.
  define: {
    __DLC_VERSION__: JSON.stringify(pkgVersion)
  },

  // Custom plugins
  plugins: [incrementBuildPlugin()]
});
