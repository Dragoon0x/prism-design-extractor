import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the trace root so Next stops detecting the home-dir package-lock.json.
  outputFileTracingRoot: resolve(__dirname, '../..'),
  // TS NodeNext-style imports use `.js` extensions that point at `.ts` files.
  // Tell webpack to try those extensions in order so transpiled workspace
  // packages resolve correctly.
  webpack(config, { isServer }) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    if (isServer) {
      // Heavy Node-only binaries (Playwright, Chromium, Sharp, pdfjs, canvas)
      // must stay as runtime require()s — webpack can't safely bundle their
      // native bindings, asset files, or dynamic-loader code paths.
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      externals.push(
        'playwright-core',
        '@sparticuz/chromium',
        '@sparticuz/chromium/bin',
        'sharp',
        'pdfjs-dist',
        'pdfjs-dist/legacy/build/pdf.mjs',
        '@napi-rs/canvas',
        'chromium-bidi',
        'electron',
      );
      config.externals = externals;
    }
    return config;
  },
  // Workspace packages Next should bundle for us (plain TS/TSX, no native code).
  transpilePackages: [
    '@prism/shared',
    '@prism/db',
    '@prism/queue',
    '@prism/claude',
    '@prism/tokens',
    '@prism/extractor-url',
    '@prism/extractor-vision',
    '@prism/extractor-pdf',
    '@prism/intelligence',
    '@prism/outputs',
  ],
  // Packages that must stay external (native bindings, large binaries, or
  // runtime executable paths). Bundling these into the function breaks at runtime.
  serverExternalPackages: [
    '@sparticuz/chromium',
    'playwright-core',
    'sharp',
    '@napi-rs/canvas',
    'pdfjs-dist',
    '@prism/browser',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // SSE responses shouldn't be cached anywhere.
        source: '/api/stream/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-transform' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ];
  },
};

export default nextConfig;
