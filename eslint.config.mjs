import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'dist/**', 'build/**', 'next-env.d.ts'] },
  ...nextConfig,
  {
    rules: {
      '@next/next/no-img-element': 'off',
      // TypeScript already flags unused locals; plain JS no-unused-vars misreads type signatures.
      'no-unused-vars': 'off',
    },
  },
];

export default config;
