// -----------------------------------------------------------------------------
// Blog content sources.
//
// Single source of truth for which knowledge-base write-ups publish as blog
// posts, plus the blog-specific metadata for each. Edit this and run
// `npm run sync`.
//
// The knowledge-base is a fact -> content -> publish system; this manifest
// pulls from its `writeups/` (content) layer. See the KB's pipeline/registry.mjs
// for the full lineage back to sources.
//
// Each entry:
//   source       path to the write-up, relative to KB_PATH
//   slug         URL slug -> /blog/<slug>  (also the cross-link target)
//   title        post title (H1 in the source is stripped; this replaces it)
//   description  one-line summary for cards, meta tags, and RSS
//   pubDate      YYYY-MM-DD
//   tags         string[]
//   featured     surface on the homepage (optional, default false)
//   hero         image path relative to KB_PATH, copied into /public (optional)
//   replace      [[from, to], ...] literal pre-transform replacements (optional).
//                Prefer <!-- blog:skip --> spans in the source over rules here.
// -----------------------------------------------------------------------------

import os from 'node:os';
import path from 'node:path';

// Where the knowledge-base repo lives. Override with the KB_PATH env var (CI).
export const KB_PATH =
  process.env.KB_PATH || path.join(os.homedir(), 'Dev/ai/knowledge-base');

const PE = 'writeups/platform-engineering';

export const posts = [
  {
    source: `${PE}/platform-engineering.md`,
    slug: 'platform-engineering',
    title: 'From Ticket Queue to Federated Product',
    description:
      'Why central platform teams collapse at scale, the shift from platform-as-a-queue to a federated product, and the Kubernetes control-plane patterns any platform is built on.',
    pubDate: '2026-07-20',
    tags: ['platform-engineering', 'kubernetes', 'developer-experience'],
    featured: true,
  },
  {
    source: `${PE}/building-a-platform.md`,
    slug: 'building-a-platform',
    title: 'Building a Platform, Layer by Layer: The PAVED Road',
    description:
      'A layered, tool-by-tool guide to building an internal developer platform following the PAVED framework: contracts, verified delivery, guardrails, interfaces, and catalog.',
    pubDate: '2026-07-27',
    tags: ['platform-engineering', 'kubernetes', 'paved', 'internal-developer-platform'],
    featured: true,
    hero: `${PE}/assets/paved-stack.svg`,
  },
  {
    source: `${PE}/platform-from-scratch.md`,
    slug: 'platform-from-scratch',
    title: 'A Platform From Scratch',
    description:
      'I built a tiny internal platform in Python to prove the PAVED layers are not Kubernetes-shaped: contracts, reconcilers, guardrails, a CLI, a catalog. Then the one production tool I would use at each layer instead.',
    pubDate: '2026-08-18',
    tags: ['platform-engineering', 'paved', 'internal-developer-platform'],
    featured: true,
    hero: `${PE}/assets/platform-from-scratch-hero.png`,
  },
  {
    source: `${PE}/platform-on-aws.md`,
    slug: 'platform-on-aws',
    title: 'A Platform on AWS',
    description:
      'The same PAVED layers, paved with managed services: DynamoDB, IAM Identity Center, Step Functions, App Runner, Amplify, Secrets Manager. One contract, two compute paths, no cluster.',
    pubDate: '2026-08-18',
    tags: ['platform-engineering', 'paved', 'aws', 'internal-developer-platform'],
    featured: true,
    hero: `${PE}/assets/platform-on-aws-hero.png`,
  },
  {
    source: `${PE}/kratix.md`,
    slug: 'kratix',
    title: 'Kratix: Platform APIs as Kubernetes-Native Promises',
    description:
      'How Kratix turns a platform capability into a first-class Kubernetes API: the Promise, the pipeline filesystem contract, Kratix vs. Crossplane, and nested Promises for federating a platform.',
    pubDate: '2026-08-01',
    tags: ['kratix', 'kubernetes', 'platform-engineering'],
    featured: false,
  },
  {
    source: `${PE}/kubernetes-is-a-control-plane.md`,
    slug: 'kubernetes-is-a-control-plane',
    title: 'Kubernetes Is Not a Container Orchestrator',
    description:
      'Strip Kubernetes down and you get a declarative API, a store, and controllers that reconcile drift. Containers are the reference architecture, not the definition - and that reframing changes what you hand it.',
    pubDate: '2026-08-05',
    tags: ['kubernetes', 'platform-engineering', 'control-plane'],
    featured: true,
  },
  {
    source: `${PE}/engine-and-platform.md`,
    slug: 'engine-and-platform',
    title: 'The Engine and the Platform',
    description:
      'What building a reusable agentic workflow engine taught me about platform APIs: extract the engine, point the dependencies inward, invert control, hide the imperative core behind a declarative surface.',
    pubDate: '2026-08-06',
    tags: ['platform-engineering', 'architecture', 'ai'],
    featured: false,
  },
  {
    source: 'writeups/personal/git-gud-or-get-rekt.md',
    slug: 'git-gud-or-get-rekt',
    title: 'Git Gud Or Get Rekt',
    description:
      'A shift toward mastery: failing a stack of FAANG interviews, and what changed when I stopped chasing the offer and started closing the gaps.',
    pubDate: '2024-09-06',
    tags: ['career', 'personal', 'software-engineering'],
    featured: false,
    // Original post has unfilled placeholder tokens (<INSERT_FAANG_COMPANY>, etc.).
    // Kept as draft (excluded from production build) until they're filled in.
    draft: true,
  },
];
