const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Desativar modo estrito pode ajudar com erros de hidratação
  swcMinify: true,
  // Configuração para ignorar erros de hidratação de atributos data-*
  onDemandEntries: {
    // Aumentar o tempo limite para desenvolvimento
    maxInactiveAge: 60 * 60 * 1000, // 1 hora
    pagesBufferLength: 5,
  },
  compiler: {
    // Remover console logs em produção
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    // Estabilidade para o processo de hidratação
    optimizeCss: true,
    // Não usar otimização do React no servidor para evitar diferenças de hidratação
    optimizeServerReact: false
  }
}

module.exports = withBundleAnalyzer(nextConfig) 