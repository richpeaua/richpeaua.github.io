# richpeaua.github.io

Personal site and blog for Rich Peaua, built with [Astro](https://astro.build) and deployed to GitHub Pages.

## Stack

- **Astro** static site (zero JS by default; mermaid loads only on posts that use it)
- **Shiki** dual-theme code highlighting (light/dark)
- **Content collections** for typed blog frontmatter (`src/content.config.ts`)
- Dark/light theme with system preference + persisted toggle
- RSS (`/rss.xml`), sitemap, tags, reading time

## Develop

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # output to dist/
npm run preview    # serve the production build
```

## Structure

```
src/
  components/      Header, Footer, Icon, PostCard, BaseHead, FormattedDate
  layouts/         BaseLayout, BlogPost
  pages/           index, about, blog/, tags/, rss.xml.js, 404
  content/blog/    posts (Markdown with typed frontmatter)
  styles/global.css
  consts.ts        site metadata, socials, nav (edit these first)
  utils.ts         post sorting, reading time, tags
public/            avatar, favicon, static images
astro.config.mjs   site URL + mermaid/table markdown plugins
```

## Writing a post

Add a Markdown file to `src/content/blog/`:

```md
---
title: "Post title"
description: "One-line summary for cards, meta tags, and RSS."
pubDate: 2026-08-03
tags: ["platform-engineering", "kubernetes"]
featured: false            # surface on the homepage
heroImage: "/some.svg"     # optional
---

Body in Markdown. Fenced ```mermaid blocks render as diagrams.
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml` (the official
`withastro/action`), which builds and publishes via the GitHub Pages artifact.

**One-time setup:** in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions** (not "Deploy from a branch"). The old branch-based deploy is
replaced by this workflow.
