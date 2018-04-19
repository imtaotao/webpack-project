import { create_action, set_payload, Action } from '../base';
// import { NEXTSTEP, BACKPACKTYPE, LoadingState, LoadingProgressState } from './defs';
import { language_dict } from '../../i18n/def';
import * as _ from 'lodash';

// export * from './defs';
// Actions
export type CloudActionType = 'codemon/cloud/set_language';

export const SET_LANGUAGE = 'codemon/cloud/set_language';

type CloudActionPayload = number
  & string
  & boolean;

type CloudAction = Action<CloudStates & CloudActionPayload>;

// States
export interface CloudStates {
  readonly language:number;
}

const initial_state = {
  language: (sessionStorage.language && _.indexOf(language_dict, sessionStorage.language)) || 0,
};
// Action Creator
export const set_language = create_action<number>(SET_LANGUAGE);

// Reducer
export function cloud_reducer(
    state:CloudStates = initial_state,
    action:CloudAction,
) : CloudStates {
  switch (action.type) {
    case SET_LANGUAGE:
      return set_payload(state, {
        language: action.payload,
      });
    default:
      return state;
  }
}

// Export
export const cloud = {
  actions: {
    set_language,
  },
  types: {
    SET_LANGUAGE,
  },
  reducer: cloud_reducer,
};