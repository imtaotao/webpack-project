import { create_action, Action } from './base';
import { handleActions } from 'redux-actions';

const current_url = 'codemon/redux/global/';

export interface GlobalStates {}

const init_states:GlobalStates = {}

export const global_reducer = handleActions({
// TODO fix type
}, init_states);
