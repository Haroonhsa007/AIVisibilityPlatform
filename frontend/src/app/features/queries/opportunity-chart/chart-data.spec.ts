import { QueryItem } from '../../../shared/models';
import { buildChartData, truncateQuery } from './chart-data';

describe('chart data builder', () => {
  const palette = {
    visible: 'blue',
    notVisible: 'orange',
    unknown: 'grey',
    text: 'black',
    border: 'silver',
  };
  const query: QueryItem = {
    query_uuid: 'query-1',
    profile_uuid: 'profile-1',
    run_uuid: 'run-1',
    query_text: 'Which SEO tools help a growing business?',
    opportunity_score: 0.7,
    domain_visible: true,
    visibility_position: 1,
    discovered_at: '2026-11-04T10:00:00Z',
  };
  it('truncates long labels to exactly 30 characters without changing full query text', () => {
    expect(truncateQuery(query.query_text).length).toBe(30);
    expect(truncateQuery(query.query_text).endsWith('…')).toBeTrue();
    expect(truncateQuery('Short')).toBe('Short');
    expect(query.query_text).toBe('Which SEO tools help a growing business?');
  });
  it('maps visible/not-visible/unknown to the supplied tokens and preserves null scores', () => {
    const data = buildChartData(
      [
        query,
        { ...query, domain_visible: false, opportunity_score: 0.9 },
        { ...query, domain_visible: null, opportunity_score: null },
      ],
      palette,
    );
    expect(data.datasets[0].backgroundColor).toEqual(['blue', 'orange', 'grey']);
    expect(data.datasets[0].data).toEqual([0.7, 0.9, null]);
  });
});
