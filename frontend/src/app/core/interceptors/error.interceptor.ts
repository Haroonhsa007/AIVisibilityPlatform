import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AppError } from '../../shared/models';
import { ToastService } from '../services/toast.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapHttpError(response: HttpErrorResponse): AppError {
  const body: unknown = response.error;
  const envelope = isRecord(body) && isRecord(body['error']) ? body['error'] : undefined;
  const serverMessage = typeof envelope?.['message'] === 'string' ? envelope['message'] : undefined;
  if (response.status === 0)
    return {
      kind: 'network',
      message: 'Cannot reach the server. Check your connection and try again.',
    };
  if (response.status === 502)
    return {
      kind: 'upstream',
      message: 'The AI provider is unavailable. Please try again shortly.',
    };
  if (response.status >= 500)
    return { kind: 'server', message: 'Something went wrong on the server. Please try again.' };
  if (response.status === 422 || envelope?.['code'] === 'validation_error') {
    const details = envelope?.['details'];
    const fieldErrors: Record<string, string> = {};
    if (isRecord(details)) {
      for (const [field, message] of Object.entries(details)) {
        if (typeof message === 'string') fieldErrors[field] = message;
      }
    }
    return {
      kind: 'validation',
      message: serverMessage ?? 'Please check the highlighted fields.',
      fieldErrors,
    };
  }
  if (response.status === 404)
    return { kind: 'not_found', message: serverMessage ?? 'This item could not be found.' };
  if (response.status === 409)
    return {
      kind: 'conflict',
      message: serverMessage ?? 'This action conflicts with an existing item or running pipeline.',
    };
  return {
    kind: 'request',
    message: serverMessage ?? 'The request could not be completed. Please try again.',
  };
}

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const appError = mapHttpError(error);
      toast.error(appError.message);
      return throwError(() => appError);
    }),
  );
};
