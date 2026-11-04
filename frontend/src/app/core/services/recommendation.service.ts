import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ItemList, Priority, Recommendation } from '../../shared/models';
import { API_URL } from './api-url';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly http = inject(HttpClient);

  list(profileUuid: string, priority?: Priority): Observable<ItemList<Recommendation>> {
    return this.http.get<ItemList<Recommendation>>(
      `${API_URL}/profiles/${encodeURIComponent(profileUuid)}/recommendations`,
      {
        params: priority ? { priority } : {},
      },
    );
  }
}
