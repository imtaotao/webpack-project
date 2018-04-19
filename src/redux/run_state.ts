import { create_action, set_payload, Action } from './base';

// ReasourceStates
// TODO add state to distinguish running and debugging
export interface RunState {
  is_running:boolean;
}

const initial_run_state:RunState = {
  is_running: false,
};

interface SetRunStatePayload {
  is_running:boolean;
}
export const SET_RUN_STATE = 'codemon/run/set_run_state';
export const set_run_state = create_action<SetRunStatePayload>(SET_RUN_STATE);

export function reducer_run (
    state:RunState = initial_run_state,
    action:Action<SetRunStatePayload>) : RunState {
  switch (action.type) {
    case SET_RUN_STATE:
      return set_payload(state, {
        is_running: action.payload.is_running,
      });
    default:
      return state;
  }
}