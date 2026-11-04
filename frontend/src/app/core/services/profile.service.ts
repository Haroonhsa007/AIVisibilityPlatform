import { DataRevisionService } from './data-revision.service';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Page, PageParams, Profile, ProfileCreate } from '../../shared/models';
import { API_URL } from './api-url';
import { apiParams } from './api-params';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly revision = inject(DataRevisionService);

  list(params: PageParams = {}): Observable<Page<Profile>> {
    return this.http.get<Page<Profile>>(`${API_URL}/profiles`, {
      params: apiParams({ ...params }),
    });
  }

  get(profileUuid: string): Observable<Profile> {
    return this.http.get<Profile>(`${API_URL}/profiles/${encodeURIComponent(profileUuid)}`);
  }

  create(profile: ProfileCreate): Observable<Profile> {
    return this.http
      .post<Profile>(`${API_URL}/profiles`, profile)
      .pipe(tap(() => this.revision.invalidate()));
  }
}
