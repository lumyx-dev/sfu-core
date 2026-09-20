import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';

const docs = defineDocs({
  dir: 'content/docs',
});

// baseUrl '/' : sur docs.lumyx.dev la documentation est a la racine du domaine. Le prefixe
// /docs de l'ancienne implantation disparait avec le changement de domaine.
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
