import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { visit } from 'unist-util-visit';

// Turn ```mermaid fenced blocks into <pre class="mermaid"> so the client-side
// mermaid runtime renders them, instead of Shiki highlighting them as code.
function remarkMermaid() {
  const escape = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'mermaid' && parent && typeof index === 'number') {
        parent.children[index] = {
          type: 'html',
          value: `<pre class="mermaid" data-mermaid>${escape(node.value)}</pre>`,
        };
      }
    });
  };
}

// Wrap every <table> in a scroll container so wide tables never break the page.
function rehypeTableWrap() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'table' && parent && typeof index === 'number') {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrap'] },
          children: [node],
        };
      }
    });
  };
}

// https://astro.build
export default defineConfig({
  site: 'https://richpeaua.github.io',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkMermaid],
    rehypePlugins: [rehypeTableWrap],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
