const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  publicPath: './',
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  pages: {
    index: {
      entry: 'src/main.js',
      title: 'YubiWait｜順番待ち受付システム'
    }
  },
  pwa: {
    name: '受付システム',
    themeColor: '#4DBA87',
    msTileColor: '#000000',

    // ✅ InjectManifestで自作 service-worker.js を使う
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: './src/service-worker.js', // ← public じゃなく src 配下に移動する必要あり！
    },

    manifestOptions: {
      short_name: '受付',
      start_url: './',
      display: 'standalone',
      scope: '/',
      background_color: '#ffffff',
      icons: [
        {
          src: 'img/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'img/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]

    },
    iconPaths: {
      favicon32: 'favicon.ico',
      favicon16: 'favicon.ico',
      appleTouchIcon: 'favicon.ico',
      maskIcon: null,
      msTileImage: null
    }
  }
})
