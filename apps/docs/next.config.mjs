// Fichier en .mjs et non .ts, contrairement aux autres apps du monorepo : fumadocs-mdx est
// ESM-only et sa documentation recommande explicitement .mjs pour une resolution ESM correcte.
// Un next.config.ts exigerait le resolveur TypeScript natif de Node.
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // @lumyx/ui exporte du TypeScript source, pas un build — Next le transpile.
  transpilePackages: ['@lumyx/ui'],
};

export default withMDX(config);
