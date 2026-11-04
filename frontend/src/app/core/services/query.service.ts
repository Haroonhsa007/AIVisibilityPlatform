import { DataRevisionService } from './data-revision.service';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, EMPTY, expand, map, Observable, reduce, tap } from 'rxjs';
import { Page, QueryItem, QueryParams } from '../../shared/models';
import { API_URL } from './api-url';
import { apiParams } from './api-params';

@Injectable({ providedIn: 'root' })
export class QueryService {
  private readonly http = inject(HttpClient);
  private readonly revision = inject(DataRevisionService);

  list(profileUuid: string, params: QueryParams = {}): Observable<Page<QueryItem>> {
    return this.http.get<Page<QueryItem>>(
      `${API_URL}/profiles/${encodeURIComponent(profileUuid)}/queries`,
      {
        params: apiParams({ ...params }),
      },
    );
  }

  listAll(
    profileUuid: string,
    params: Omit<QueryParams, 'page' | 'per_page'> = {},
    progress?: (loaded: number, total?: number) => void,
  ): Observable<QueryItem[]> {
    return defer(() => {
      let loaded = 0;
      const fetchPage = (number: number) =>
        this.list(profileUuid, { ...params, page: number, per_page: 100 }).pipe(
          map((response) => ({ response, number })),
        );
      return fetchPage(1).pipe(
        expand(({ response, number }) => {
          const more =
            response.pages !== undefined
              ? number < response.pages
              : response.total !== undefined
                ? number * 100 < response.total
                : (response.items?.length ?? 0) === 100;
          return more ? fetchPage(number + 1) : EMPTY;
        }),
        tap(({ response }) => {
          loaded += response.items?.length ?? 0;
          progress?.(loaded, response.total);
        }),
        reduce((items, { response }) => [...items, ...(response.items ?? [])], [] as QueryItem[]),
      );
    });
  }

  recheck(queryUuid: string): Observable<QueryItem> {
    return this.http
      .post<QueryItem>(`${API_URL}/queries/${encodeURIComponent(queryUuid)}/recheck`, null)
      .pipe(tap(() => this.revision.invalidate()));
  }
}
