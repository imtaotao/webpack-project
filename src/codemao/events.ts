import {
  Heart,
  block_provider,
} from 'src/codemao-heart';
import { store_manager } from '../redux/store';

const ResponderType = block_provider.ResponderType;
export type Action<T> = block_provider.Action<T>;
type ID = string;

export function get_events(
  get_heart:() => Heart,
  deps?:any,
) {
  const fns = {
    get_action_specs: function () {
      return [];
    },
  };
  return fns;
}
