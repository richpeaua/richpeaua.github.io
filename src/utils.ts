import { getCollection, type CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';

export type Post = CollectionEntry<'blog'>;

const isPublished = (p: Post) => import.meta.env.DEV || !p.data.draft;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', isPublished);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function minutesFor(post: Post): number {
  const stats = readingTime(post.body ?? '');
  return Math.max(1, Math.round(stats.minutes));
}

export async function getAllTags(): Promise<Map<string, number>> {
  const posts = await getPosts();
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}
