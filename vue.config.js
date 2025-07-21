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
  pwa: {
    name: '受付システム',
    themeColor: '#4DBA87',
    msTileColor: '#000000',
    manifestOptions: {
      short_name: '受付',
      "start_url": "./",
      "display": "standalone",
      "scope": "/",
      background_color: '#ffffff'
    },
  }
})
