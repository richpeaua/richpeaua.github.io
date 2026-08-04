// -----------------------------------------------------------------------------
// Blog content sources.
//
// This is the single source of truth for which knowledge-base write-ups get
// published as blog posts, and the blog-specific metadata for each. To publish
// or update a post, edit this file and run `npm run sync`.
//
// Each entry:
//   source       path to the markdown file, relative to KB_PATH
//   slug         URL slug -> /blog/<slug>  (also the cross-link target)
//   title        post title (H1 in the source is stripped; this replaces it)
//   description  one-line summary for cards, meta tags, and RSS
//   pubDate      YYYY-MM-DD
//   tags         string[]
//   featured     surface on the homepage (optional, default false)
//   hero         image path relative to KB_PATH, copied into /public (optional)
//   replace      [[from, to], ...] literal replacements applied to the raw
//                source before transforms. Use for KB-only lines (cross-repo
//                "see also" footers, source notes) that don't belong on the blog.
//                A `from` that is not found is reported as an error by
//                `npm run sync:check`. Alternatively wrap KB-only spans in the
//                source with <!-- blog:skip --> ... <!-- /blog:skip -->.
// -----------------------------------------------------------------------------

import os from 'node:os';
import path from 'node:path';

// Where the knowledge-base repo lives. Override with the KB_PATH env var (CI).
export const KB_PATH =
  process.env.KB_PATH || path.join(os.homedir(), 'Dev/ai/knowledge-base');

export const posts = [
  {
    source: 'platform-eng/platform-engineering.md',
    slug: 'platform-engineering',
    title: 'From Ticket Queue to Federated Product',
    description:
      'Why central platform teams collapse at scale, the shift from platform-as-a-queue to a federated product, and the Kubernetes control-plane patterns any platform is built on.',
    pubDate: '2026-07-20',
    tags: ['platform-engineering', 'kubernetes', 'developer-experience'],
    featured: true,
    replace: [
      [
        '*See [`kratix.md`](./kratix.md) for how one specific tool implements these ideas, [`../k8s/`](../k8s/) for the control-plane patterns this doc builds on, and [`linkedin-posts.md`](./linkedin-posts.md) for short-form versions of these arguments.*',
        '*See [Kratix: Platform APIs as Kubernetes-Native Promises](/blog/kratix) for how one specific tool implements these ideas, and [Building a Platform, Layer by Layer](/blog/building-a-platform) for a hands-on, tool-by-tool build guide.*',
      ],
    ],
  },
  {
    source: 'platform-eng/building-a-platform.md',
    slug: 'building-a-platform',
    title: 'Building a Platform, Layer by Layer: The PAVED Road',
    description:
      'A layered, tool-by-tool guide to building an internal developer platform following the PAVED framework: contracts, verified delivery, guardrails, interfaces, and catalog.',
    pubDate: '2026-07-27',
    tags: ['platform-engineering', 'kubernetes', 'paved', 'internal-developer-platform'],
    featured: true,
    hero: 'platform-eng/paved-stack.svg',
    replace: [
      [
        '*Related: [`platform-engineering.md`](./platform-engineering.md) (the operating model and the control-plane patterns), [`kratix.md`](./kratix.md) (one tool that implements P, V, and much of E in a single object), and [`../k8s/`](../k8s/) (the substrate mechanisms).*',
        '*Related: [From Ticket Queue to Federated Product](/blog/platform-engineering) (the operating model and the control-plane patterns) and [Kratix: Platform APIs as Kubernetes-Native Promises](/blog/kratix) (one tool that implements P, V, and much of E in a single object).*',
      ],
      // KB-only cross-references into the Kubernetes internals notes.
      [
        ' and mechanism-by-mechanism in [`../k8s/`](../k8s/).',
        '.',
      ],
      [
        ' ([`../k8s/`](../k8s/))',
        '',
      ],
    ],
  },
  {
    source: 'platform-eng/kratix.md',
    slug: 'kratix',
    title: 'Kratix: Platform APIs as Kubernetes-Native Promises',
    description:
      'How Kratix turns a platform capability into a first-class Kubernetes API: the Promise, the pipeline filesystem contract, Kratix vs. Crossplane, and nested Promises for federating a platform.',
    pubDate: '2026-08-01',
    tags: ['kratix', 'kubernetes', 'platform-engineering'],
    featured: false,
    replace: [
      // Source-provenance note that only makes sense inside the knowledge base.
      [
        '\n> The source material for this write-up is the raw Q&A in [`kratix-raw-qa.md`](./kratix-raw-qa.md).\n',
        '',
      ],
      [
        'for the tool-independent treatment and the `k8s/` KB for mechanisms.',
        "for the tool-independent treatment, and Kubernetes' own internals for the mechanisms.",
      ],
    ],
  },
];
