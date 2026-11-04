import { Recommendation } from '../../../shared/models';
import { filterRecommendations } from './recommendations-list.component';

describe('recommendation priority filtering', () => {
  const base: Recommendation = {
    recommendation_uuid: 'rec-1',
    target_query_uuid: 'query-1',
    title: 'Answer the query',
    content_type: 'faq',
    rationale: 'Cover the missing question.',
    target_keywords: ['seo'],
    priority: 'high',
  };
  const items: Recommendation[] = [
    base,
    { ...base, recommendation_uuid: 'rec-2', priority: 'medium' },
    { ...base, recommendation_uuid: 'rec-3', priority: 'low' },
  ];
  it('shows all priorities without mutating or refetching the list', () => {
    expect(filterRecommendations(items, '')).toBe(items);
    expect(items.length).toBe(3);
  });
  for (const priority of ['high', 'medium', 'low'] as const) {
    it(`selects only ${priority}`, () =>
      expect(filterRecommendations(items, priority).map((item) => item.priority)).toEqual([
        priority,
      ]));
  }
  it('keeps an empty list empty', () => expect(filterRecommendations([], 'high')).toEqual([]));
});
