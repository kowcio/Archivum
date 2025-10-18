// vite.config.ts
import { defineConfig } from "file:///C:/Users/kowcio/IdeaProjects/czynsz_ff/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/kowcio/IdeaProjects/czynsz_ff/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueDevTools from "file:///C:/Users/kowcio/IdeaProjects/czynsz_ff/node_modules/vite-plugin-vue-devtools/dist/vite.mjs";
import { readFileSync } from "fs";
import webExtension from "file:///C:/Users/kowcio/IdeaProjects/czynsz_ff/node_modules/vite-plugin-web-extension/dist/index.js";
import copy from "file:///C:/Users/kowcio/IdeaProjects/czynsz_ff/node_modules/rollup-plugin-copy/dist/index.commonjs.js";
import { transformAssetUrls } from "file:///C:/Users/kowcio/IdeaProjects/czynsz_ff/node_modules/@quasar/vite-plugin/src/index.js";
var packageJson = JSON.parse(readFileSync("./package.json", "utf8")) || "";
console.log(packageJson.version);
console.log(packageJson);
var vite_config_default = defineConfig({
  plugins: [
    vue({
      include: ["src/**/*.{vue,js}"],
      template: {
        transformAssetUrls,
        compilerOptions: {
          // isCustomElement: (tag) => tag.includes('ext-'),
        }
      }
    }),
    vueDevTools(),
    webExtension({ browser: "firefox", printSummary: true }),
    copy({
      targets: [{ src: "assets/*", dest: "assets" }],
      hook: "writeBundle"
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "quasar/dist/quasar.sass";'
      }
    }
  },
  base: "./",
  //Base public path when served in development or production.
  build: {
    outDir: "dist",
    minify: false,
    cssMinify: false,
    // manifest: 'manifest.json',
    assetsDir: "js"
    // rollupOptions: {
    // input: {
    // popup: 'popup.html', // Entry for your popup UI
    // Add more entries as needed (e.g., options page)
    // },
    // Ensure all dependencies are bundled (not externalized)
    // external: [],
    // output: {
    // Prevent code splitting
    // manualChunks: undefined,
    // inlineDynamicImports: true,
    // },
    // },
    // lib: {
    //   entry: 'src/App.vue', // Entry point (can be a .js or .vue file)
    //   name: 'my-plugin', // Global name for UMD/IIFE
    //   formats: ['umd', 'es'],
    //   fileName: 'my-plugin', // Output file name
    // },
    // copy: [
    //   {
    //     src: 'src/assets',
    //     dest: 'dist/assets2',
    //   },
    // ],
  },
  resolve: {
    alias: {
      "@": "./src"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxrb3djaW9cXFxcSWRlYVByb2plY3RzXFxcXGN6eW5zel9mZlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxca293Y2lvXFxcXElkZWFQcm9qZWN0c1xcXFxjenluc3pfZmZcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2tvd2Npby9JZGVhUHJvamVjdHMvY3p5bnN6X2ZmL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xuaW1wb3J0IHZ1ZURldlRvb2xzIGZyb20gJ3ZpdGUtcGx1Z2luLXZ1ZS1kZXZ0b29scydcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJ1xuLy8gaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tICd2aXRlLXBsdWdpbi1zdGF0aWMtY29weSdcbmltcG9ydCB3ZWJFeHRlbnNpb24gZnJvbSAndml0ZS1wbHVnaW4td2ViLWV4dGVuc2lvbidcbmltcG9ydCBjb3B5IGZyb20gJ3JvbGx1cC1wbHVnaW4tY29weSdcbmltcG9ydCB7IHRyYW5zZm9ybUFzc2V0VXJscyB9IGZyb20gJ0BxdWFzYXIvdml0ZS1wbHVnaW4nXG5jb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKCcuL3BhY2thZ2UuanNvbicsICd1dGY4JykpIHx8ICcnXG5jb25zb2xlLmxvZyhwYWNrYWdlSnNvbi52ZXJzaW9uKVxuY29uc29sZS5sb2cocGFja2FnZUpzb24pXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICB2dWUoe1xuICAgICAgaW5jbHVkZTogWydzcmMvKiovKi57dnVlLGpzfSddLFxuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgdHJhbnNmb3JtQXNzZXRVcmxzLFxuICAgICAgICBjb21waWxlck9wdGlvbnM6IHtcbiAgICAgICAgICAvLyBpc0N1c3RvbUVsZW1lbnQ6ICh0YWcpID0+IHRhZy5pbmNsdWRlcygnZXh0LScpLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSxcbiAgICB2dWVEZXZUb29scygpLFxuICAgIHdlYkV4dGVuc2lvbih7IGJyb3dzZXI6ICdmaXJlZm94JywgcHJpbnRTdW1tYXJ5OiB0cnVlIH0pLFxuICAgIGNvcHkoe1xuICAgICAgdGFyZ2V0czogW3sgc3JjOiAnYXNzZXRzLyonLCBkZXN0OiAnYXNzZXRzJyB9XSxcbiAgICAgIGhvb2s6ICd3cml0ZUJ1bmRsZScsXG4gICAgfSksXG4gIF0sXG4gIGNzczoge1xuICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcbiAgICAgIHNjc3M6IHtcbiAgICAgICAgYWRkaXRpb25hbERhdGE6ICdAaW1wb3J0IFwicXVhc2FyL2Rpc3QvcXVhc2FyLnNhc3NcIjsnLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBiYXNlOiAnLi8nLCAvL0Jhc2UgcHVibGljIHBhdGggd2hlbiBzZXJ2ZWQgaW4gZGV2ZWxvcG1lbnQgb3IgcHJvZHVjdGlvbi5cblxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIG1pbmlmeTogZmFsc2UsXG4gICAgY3NzTWluaWZ5OiBmYWxzZSxcblxuICAgIC8vIG1hbmlmZXN0OiAnbWFuaWZlc3QuanNvbicsXG4gICAgYXNzZXRzRGlyOiAnanMnLFxuICAgIC8vIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAvLyBpbnB1dDoge1xuICAgIC8vIHBvcHVwOiAncG9wdXAuaHRtbCcsIC8vIEVudHJ5IGZvciB5b3VyIHBvcHVwIFVJXG4gICAgLy8gQWRkIG1vcmUgZW50cmllcyBhcyBuZWVkZWQgKGUuZy4sIG9wdGlvbnMgcGFnZSlcbiAgICAvLyB9LFxuICAgIC8vIEVuc3VyZSBhbGwgZGVwZW5kZW5jaWVzIGFyZSBidW5kbGVkIChub3QgZXh0ZXJuYWxpemVkKVxuICAgIC8vIGV4dGVybmFsOiBbXSxcbiAgICAvLyBvdXRwdXQ6IHtcbiAgICAvLyBQcmV2ZW50IGNvZGUgc3BsaXR0aW5nXG4gICAgLy8gbWFudWFsQ2h1bmtzOiB1bmRlZmluZWQsXG4gICAgLy8gaW5saW5lRHluYW1pY0ltcG9ydHM6IHRydWUsXG4gICAgLy8gfSxcbiAgICAvLyB9LFxuICAgIC8vIGxpYjoge1xuICAgIC8vICAgZW50cnk6ICdzcmMvQXBwLnZ1ZScsIC8vIEVudHJ5IHBvaW50IChjYW4gYmUgYSAuanMgb3IgLnZ1ZSBmaWxlKVxuICAgIC8vICAgbmFtZTogJ215LXBsdWdpbicsIC8vIEdsb2JhbCBuYW1lIGZvciBVTUQvSUlGRVxuICAgIC8vICAgZm9ybWF0czogWyd1bWQnLCAnZXMnXSxcbiAgICAvLyAgIGZpbGVOYW1lOiAnbXktcGx1Z2luJywgLy8gT3V0cHV0IGZpbGUgbmFtZVxuICAgIC8vIH0sXG5cbiAgICAvLyBjb3B5OiBbXG4gICAgLy8gICB7XG4gICAgLy8gICAgIHNyYzogJ3NyYy9hc3NldHMnLFxuICAgIC8vICAgICBkZXN0OiAnZGlzdC9hc3NldHMyJyxcbiAgICAvLyAgIH0sXG4gICAgLy8gXSxcbiAgfSxcblxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogJy4vc3JjJyxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOFMsU0FBUyxvQkFBb0I7QUFDM1UsT0FBTyxTQUFTO0FBQ2hCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsb0JBQW9CO0FBRTdCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sVUFBVTtBQUNqQixTQUFTLDBCQUEwQjtBQUNuQyxJQUFNLGNBQWMsS0FBSyxNQUFNLGFBQWEsa0JBQWtCLE1BQU0sQ0FBQyxLQUFLO0FBQzFFLFFBQVEsSUFBSSxZQUFZLE9BQU87QUFDL0IsUUFBUSxJQUFJLFdBQVc7QUFFdkIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBLE1BQ0YsU0FBUyxDQUFDLG1CQUFtQjtBQUFBLE1BQzdCLFVBQVU7QUFBQSxRQUNSO0FBQUEsUUFDQSxpQkFBaUI7QUFBQTtBQUFBLFFBRWpCO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLElBQ0QsWUFBWTtBQUFBLElBQ1osYUFBYSxFQUFFLFNBQVMsV0FBVyxjQUFjLEtBQUssQ0FBQztBQUFBLElBQ3ZELEtBQUs7QUFBQSxNQUNILFNBQVMsQ0FBQyxFQUFFLEtBQUssWUFBWSxNQUFNLFNBQVMsQ0FBQztBQUFBLE1BQzdDLE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxxQkFBcUI7QUFBQSxNQUNuQixNQUFNO0FBQUEsUUFDSixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUE7QUFBQSxFQUVOLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQTtBQUFBLElBR1gsV0FBVztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUEyQmI7QUFBQSxFQUVBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUs7QUFBQSxJQUNQO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
