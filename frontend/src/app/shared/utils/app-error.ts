import { AppError } from '../models';

export function appError(error: unknown): AppError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error as AppError;
  }
  return { kind: 'request', message: 'We could not complete that request. Please try again.' };
}
