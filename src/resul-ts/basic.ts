// This enum (dict lookup) is used instead of direct string comparisons because
// it is faster at the time of writing. It should be changed when TS allows us
// to use numbers instead of strings as type values for tagging kinds.
//
// We would not want to use Symbols, because it would prevent people from using
// this library when they need to target ES5.
enum SPEED_DICT {
  success = 1,
  error = 2,
}

export type Result<T, E> = Error<E> | Success<T>;
export type Res = Result<void, void>;

export interface Success<T> {
  readonly kind:'success';
  result:T;
}

export interface Error<E> {
  readonly kind:'error';
  message:string;
  error:E;
}

export function success<T>(result:T) : Success<T> {

  return {
    kind: 'success',
    result: result,
  };
}

export function error<E>(
    msg:string,
    error:E,
) : Error<E> {

  return {
    kind: 'error',
    message: msg,
    error: error,
  };
}

export function ok() : Success<void> {
    return <Success<void>>{
      kind: 'success',
    };
}

export function fail(msg:string) : Error<void> {
  return <Error<void>>{
    kind: 'error',
    message: msg,
  };
}

export function is_success<T>(r:Result<T, any>) : r is Success<T> {
  return SPEED_DICT[r.kind] === SPEED_DICT.success;
}

export function is_error<E>(r:Result<any, E>) : r is Error<E> {
  return SPEED_DICT[r.kind] === SPEED_DICT.error;
}

export function is_ok(r:Result<any, any>) : r is Success<any> {
  return SPEED_DICT[r.kind] === SPEED_DICT.success;
}

export function is_fail(r:Result<any, any>) : r is Error<any> {
  return SPEED_DICT[r.kind] === SPEED_DICT.error;
}