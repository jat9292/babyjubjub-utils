/** @type {import('next').NextConfig} */

module.exports = {

    webpack(config, options) {
      config.externals.push({
        'worker_threads': 'commonjs worker_threads'
      })
      config.experiments = { layers: true, syncWebAssembly: true };
      config.resolve.fallback = { fs: false, net: false, tls: false };
      return config;
    },
  
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
          ],
        },
      ];
    },
  };
  