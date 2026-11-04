import { ParamMap } from '@angular/router';
import { QueryParams, QuerySort, SortOrder, VisibilityStatus } from '../models';

export interface QueryViewParams extends QueryParams {
  min_score: number;
  page: number;
  per_page: number;
  sort: QuerySort;
  order: SortOrder;
}

export function queryViewParams(params: ParamMap): QueryViewParams {
  const minimum = Number(params.get('min_score') ?? 0);
  const page = Number(params.get('page') ?? 1);
  const size = Number(params.get('per_page') ?? 20);
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    min_score: Number.isFinite(minimum) && minimum >= 0 && minimum <= 1 ? minimum : 0,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    per_page: [10, 20, 50, 100].includes(size) ? size : 20,
    ...(status && ['visible', 'not_visible', 'unknown'].includes(status)
      ? { status: status as VisibilityStatus }
      : {}),
    sort:
      sort &&
      [
        'opportunity_score',
        'estimated_search_volume',
        'competitive_difficulty',
        'discovered_at',
      ].includes(sort)
        ? (sort as QuerySort)
        : 'opportunity_score',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
  };
}

export function queryApiParams(params: QueryViewParams): QueryParams {
  const { min_score, ...rest } = params;
  return { ...rest, ...(min_score > 0 ? { min_score } : {}) };
}
