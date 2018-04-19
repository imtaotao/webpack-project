import * as basic from './basic';

export function map<T, E, R>(
    res:basic.Result<T, E>,
    f:(ok_res:T) => R)
    : basic.Result<R, E> {

  if (basic.is_ok(res)) {
    return basic.success(f(res.result));
  }
  return res;
}

export function map_over<T, E, R>(
    res:basic.Result<T, E>[],
    f:(ok_res:T) => R)
    : basic.Result<R, E>[] {

  return res.map((i) => map(i, f));
}

export function eq<T, E>(res:basic.Result<T, E>, val:T) : boolean {
  if (basic.is_ok(res)) {
    return res.result == val;
  }
  return false;
}

export function eq_strict<T, E>(res:basic.Result<T, E>, val:T) : boolean {
  if (basic.is_ok(res)) {
    return res.result === val;
  }
  return false;
}