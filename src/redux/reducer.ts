import { combineReducers, ReducersMapObject } from 'redux';

import { GlobalStates, global_reducer } from './global_reducer';
import { VariableStates, variable_reducer } from './variables';
import { CloudStates, cloud } from './cloud';
import { RunState, reducer_run } from './run_state';

export interface ReduxState {
  global_states:GlobalStates;
  variable_states:VariableStates;
  cloud_states:CloudStates;
  run_states:RunState;
}

export function get_root_reducer() {
  return combineReducers(<ReducersMapObject>{
    global_states:global_reducer,
    variable_states: variable_reducer,
    cloud_states: cloud.reducer,
    run_states: reducer_run,
  });
}