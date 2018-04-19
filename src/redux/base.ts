import { Action as OriginAction, createAction } from 'redux-actions';
import { assign } from 'lodash';

export interface Action<Payload = undefined>
    extends OriginAction<Payload> {
  readonly type:string;
  readonly payload:Payload;
}

export function create_action(action_type:string) : () => Action;
export function create_action<Payload>(
    action_type:string,
) : (payload:Payload) => Action<Payload>;
export function create_action<Payload>(
    action_type:string,
    payloadCreator?:(...args:Payload[keyof Payload][]) => Payload,
) : (payload?:Payload) => Action<Payload|undefined> {
  if (payloadCreator) {
    return (createAction(action_type, payloadCreator) as (payload?:Payload) => Action<Payload>);
  } else {
    return (createAction(action_type, (p:Payload) => p) as (payload?:Payload) => Action<Payload>);
  }
}

/**
 * Set Payload to State
 * @param state
 * @param payload
 * @return {StateType}
 */
export function set_payload<StateType>(state:StateType, payload:Partial<StateType>) : StateType {
  return assign({}, state, payload);
}

/**
 * Set the payload from action to state.
 * WARNING: This method will assign the payload directly to state! Please make sure this is what you want!
 * @param state
 * @param action
 */
export function set_action_to_states<StateType>(
    state:StateType,
    action:Action<any>) {
  return assign({}, state, action.payload);
}

export function is_action<P>(
    action:Action<any>,
    type:string,
) : action is Action<P> {
  return action.type === type;
}
