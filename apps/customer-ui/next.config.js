//@ts-check

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  turbopack: {
    rules: {
      '*.svg': {
        loaders: [
          {
            loader: '@svgr/webpack',
            options: {
              icon: true,
              exportType: 'named',
            },
          },
        ],
        as: '*.js',
      },
    },
  },
  skipTrailingSlashRedirect: true,
  cacheComponents: true,
  // Proxy API requests to the backend
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:3000';

    return [
      // GraphQL endpoint
      {
        source: '/graphql',
        destination: `${backendUrl}/graphql`,
      },
      // REST API endpoints
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // Auth endpoints
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
      // Assistant endpoints
      {
        source: '/assistant/:path*',
        destination: `${backendUrl}/assistant/:path*`,
      },
      {
        source: '/integrations/:path*',
        destination: `${backendUrl}/integrations/:path*`,
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
