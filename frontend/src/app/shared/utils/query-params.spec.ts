import { convertToParamMap } from '@angular/router';
import { queryApiParams, queryViewParams } from './query-params';

describe('query URL state', () => {
  it('validates malformed URL state and omits the inactive score filter so unknown rows remain visible', () => {
    const params = queryViewParams(
      convertToParamMap({
        min_score: 'NaN',
        page: '-1',
        per_page: '1000',
        status: 'wrong',
        sort: 'wrong',
        order: 'wrong',
      }),
    );
    expect(params).toEqual({
      min_score: 0,
      page: 1,
      per_page: 20,
      sort: 'opportunity_score',
      order: 'desc',
    });
    expect(queryApiParams(params).min_score).toBeUndefined();
  });
  it('keeps valid filters, pagination and sorting', () => {
    const params = queryViewParams(
      convertToParamMap({
        min_score: '0.7',
        status: 'unknown',
        page: '2',
        per_page: '50',
        sort: 'competitive_difficulty',
        order: 'asc',
      }),
    );
    expect(queryApiParams(params)).toEqual({
      min_score: 0.7,
      status: 'unknown',
      page: 2,
      per_page: 50,
      sort: 'competitive_difficulty',
      order: 'asc',
    });
  });
});
