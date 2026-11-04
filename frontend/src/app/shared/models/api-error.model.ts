export type ApiErrorCode =
  | 'bad_request'
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'upstream_error'
  | 'internal_error';

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type AppErrorKind =
  'network' | 'validation' | 'not_found' | 'conflict' | 'upstream' | 'server' | 'request';

export interface AppError {
  kind: AppErrorKind;
  message: string;
  fieldErrors?: Record<string, string>;
}
