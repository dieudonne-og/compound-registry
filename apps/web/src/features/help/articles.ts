import type { Action } from '@cr/contracts';

/** Texts live in the catalogues at `help.articles.<id>.title` and `.steps.<n>` (n from 1). */
export type Article = { id: string; link: string; steps: number; action?: Action };

export const ARTICLES: Article[] = [
  { id: 'upload', link: '/compounds/upload', steps: 5, action: 'compound:extract' },
  { id: 'confidence', link: '/compounds/upload', steps: 4 },
  { id: 'production', link: '/production/new', steps: 4, action: 'production:create' },
  { id: 'verify', link: '/production', steps: 4 },
  { id: 'admin', link: '/admin/users', steps: 4, action: 'admin:manage' },
];

export const stepKeys = (a: Article) =>
  Array.from({ length: a.steps }, (_, i) => `help.articles.${a.id}.steps.${i + 1}`);

const normalise = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Articles whose title or steps contain every word of the query, ignoring case and accents. */
export function searchArticles(query: string, t: (key: string) => string, articles = ARTICLES): Article[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (!words.length) return articles;
  return articles.filter((a) => {
    const text = normalise([t(`help.articles.${a.id}.title`), ...stepKeys(a).map(t)].join(' '));
    return words.every((w) => text.includes(w));
  });
}
