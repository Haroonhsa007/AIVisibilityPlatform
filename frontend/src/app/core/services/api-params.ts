import { HttpParams } from '@angular/common/http';

export function apiParams(
  values: Record<string, string | number | boolean | undefined>,
): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params = params.set(key, value);
  }
  return params;
}
