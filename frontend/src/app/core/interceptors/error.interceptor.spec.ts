import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from './error.interceptor';

describe('error interceptor mapping', () => {
  it('maps a network failure', () => {
    expect(mapHttpError(new HttpErrorResponse({ status: 0 })).kind).toBe('network');
  });

  it('preserves a safe 4xx envelope message', () => {
    expect(
      mapHttpError(
        new HttpErrorResponse({
          status: 400,
          error: { error: { code: 'bad_request', message: 'Invalid JSON.' } },
        }),
      ),
    ).toEqual({ kind: 'request', message: 'Invalid JSON.' });
  });

  it('maps conflict and missing-resource envelopes', () => {
    expect(mapHttpError(new HttpErrorResponse({ status: 409 })).kind).toBe('conflict');
    expect(mapHttpError(new HttpErrorResponse({ status: 404 })).kind).toBe('not_found');
  });

  it('maps validation errors and keeps only string field messages', () => {
    expect(
      mapHttpError(
        new HttpErrorResponse({
          status: 422,
          error: {
            error: {
              code: 'validation_error',
              message: 'Check your fields.',
              details: { domain: 'Invalid host.', unexpected: { nested: true } },
            },
          },
        }),
      ),
    ).toEqual({
      kind: 'validation',
      message: 'Check your fields.',
      fieldErrors: { domain: 'Invalid host.' },
    });
  });

  for (const body of [
    null,
    '<html>proxy error</html>',
    { error: 'broken' },
    { error: { message: 17, details: [] } },
  ]) {
    it(`handles malformed envelope ${JSON.stringify(body)}`, () => {
      const result = mapHttpError(new HttpErrorResponse({ status: 422, error: body }));
      expect(result.kind).toBe('validation');
      expect(result.message).toBe('Please check the highlighted fields.');
      expect(result.fieldErrors).toEqual({});
    });
  }

  it('uses friendly server copy and hides internal details', () => {
    const error = mapHttpError(
      new HttpErrorResponse({
        status: 500,
        error: { error: { code: 'internal_error', message: 'Sensitive traceback' } },
      }),
    );
    expect(error.kind).toBe('server');
    expect(error.message).not.toContain('Sensitive');
  });

  it('distinguishes upstream failure from server failure', () => {
    const error = mapHttpError(new HttpErrorResponse({ status: 502 }));
    expect(error.kind).toBe('upstream');
    expect(error.message).toContain('AI provider');
  });
});
