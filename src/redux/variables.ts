import { create_action, set_payload } from './base';
import { Action } from './base';

// VariableStates
export interface VariableStates {
  variables:string[];
}

const initial_variable_state:VariableStates = {
  variables:[],
};

export const SET_VARIABLES = 'codemon/variable/set_variables';
export const set_variables = create_action<AddVariablesPayload>(SET_VARIABLES);

type AddVariablesPayload = VariableStates;

type VariableActionPayload = AddVariablesPayload;

type VariableAction = Action<VariableActionPayload>;
export function variable_reducer(
    state:VariableStates = initial_variable_state,
    action:VariableAction) : VariableStates {
  switch (action.type) {
    case SET_VARIABLES:
      return set_payload(state, {
        variables: action.payload.variables,
      });
    default:
      return state;
  }
}