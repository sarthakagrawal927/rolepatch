const INTERNAL_HEADER = 'x-rolepatch-internal';
const INTERNAL_HEADER_VALUE = 'worker';

export function isInternalWorkerRequest(headers: Headers): boolean {
  return headers.get(INTERNAL_HEADER) === INTERNAL_HEADER_VALUE;
}
