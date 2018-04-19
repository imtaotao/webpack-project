import { heart } from '../heart';
import * as I from './interfaces';

export function get_domain_functions() {
  const runtime_manager = heart().get_runtime_manager();
  const fns = {
    restart () {
      runtime_manager.restart();
    },
  };

  return () => fns;
}