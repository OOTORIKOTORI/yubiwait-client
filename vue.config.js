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
    name: 'YubiWait - 順番待ち受付システム',
    themeColor: '#2196F3',
    msTileColor: '#000000',

    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: './src/service-worker.js',
    },

    manifestOptions: {
      short_name: 'YubiWait',
      start_url: './#/staff-login',
      display: 'standalone',
      scope: '/',
      background_color: '#ffffff',
      icons: [
        { src: 'img/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
        { src: 'img/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
        { src: 'img/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
        { src: 'img/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
        { src: 'img/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
        { src: 'img/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'img/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
        { src: 'img/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
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
