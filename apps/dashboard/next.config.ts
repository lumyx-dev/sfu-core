import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@lumyx/ui'],
  // Sortie autoportante pour l'image Docker : Next recopie le sous-ensemble de
  // node_modules qu'il a trace, l'image finale n'embarque pas le workspace.
  output: 'standalone',
  // Sans cette racine, le tracage s'arrete a apps/dashboard et @lumyx/ui
  // manque a l'appel.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
