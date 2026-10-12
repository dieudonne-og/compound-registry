import { describe, expect, it } from 'vitest';
import { searchArticles } from './articles';

const t = (k: string) =>
  ({
    'help.articles.verify.title': 'Verify a record’s history',
    'help.articles.upload.title': 'Upload and review a report',
    'help.articles.production.steps.2': 'Choisissez la société et le métal',
  })[k] ?? k;

describe('searchArticles', () => {
  it('matches titles and steps, ignoring case and accents', () => {
    expect(searchArticles('HISTORY', t).map((a) => a.id)).toEqual(['verify']);
    expect(searchArticles('societe metal', t).map((a) => a.id)).toEqual(['production']);
    expect(searchArticles('', t).length).toBeGreaterThan(1);
  });
});
