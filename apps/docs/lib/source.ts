import { loader } from 'fumadocs-core/source';
import { pageSchema } from 'fumadocs-core/source/schema';
import { defineDocs } from 'fumadocs-mdx/macro';

// Schema de frontmatter etendu d'un seul champ, `draft`. Les onze squelettes de la §6.4 n'ont pour
// corps qu'un `<Callout>` et des titres vides : les laisser dans le sitemap soumettait onze pages
// creuses a l'indexation le jour de la mise en ligne du sous-domaine, ce qui va contre l'objectif
// de continuite SEO qui a motive les redirections. Le drapeau est lu par `sitemap()` (qui les
// exclut) et par `generateMetadata` (qui emet `robots: { index: false }`). Il ne touche PAS a
// `meta.json` : la nav reste complete, c'etait tout l'objet de la tache 6.
//
// `pageSchema.shape.full` est reutilise comme type du champ (`ZodOptional<ZodBoolean>`) plutot que
// d'ecrire `z.boolean().optional()` : `zod` n'est pas une dependance declaree d'apps/docs, elle
// n'est visible ici que par hissage, et un import direct serait exactement le defaut que
// `@types/bun` corrige par ailleurs dans ce meme lot.
export const frontmatterSchema = pageSchema.extend({
  draft: pageSchema.shape.full,
});

const docs = defineDocs({
  dir: 'content/docs',
  docs: { schema: frontmatterSchema },
});

// baseUrl '/' : sur docs.lumyx.dev la documentation est a la racine du domaine. Le prefixe
// /docs de l'ancienne implantation disparait avec le changement de domaine.
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
