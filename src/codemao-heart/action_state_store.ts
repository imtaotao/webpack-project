import _find from 'lodash/find';
import { injectable, inject } from 'inversify';

import * as H from './di_interfaces';
import {
  Action,
  ActionSpec,
  ActionStateSpec,
  namespaced_id,
  StateTransitionTable,
} from './block_provider';
import { ActionStateQueryParams } from './public_interfaces';
import { BINDING } from './di_symbols';
import { ID } from './basic_types';

interface StatefulActionSpec extends ActionSpec {
  statefulness:ActionStateSpec;
}

interface State {
  namespace:string;
  entity_id?:ID;
  sub_type?:string;
  value:string;
  spec:StatefulActionSpec;
}

// TODO PERF Create lookup tables to avoid _.filter in ActionStateStore
// For getting a State, which should be used in update and maybe in get

// TODO MEMORY LEAK Limit amount of stored Action States that are set to their default value

@injectable()
export class ActionStateStoreImpl implements H.ActionStateStore {

  private states:State[] = [];

  public constructor(
    @inject(BINDING.BlockRegistry) private block_registry:H.BlockRegistry,
    @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
    @inject(BINDING.Util) private u:H.Util,
  ) {}

  public clear() : void {
    this.states = [];
  }

  private perform_automatic_state_transitions() {
    // Perform automatic state transitions
    for (let i = 0; i < this.states.length; i++) {
      const s = this.states[i];
      if (s.spec.statefulness.automatic_transitions === 'one_frame') {
        s.value = '';
        continue;
      }
      const transition = (<StateTransitionTable>s.spec.statefulness.automatic_transitions)[s.value];
      if (transition != undefined) {
        s.value = transition;
      }
    }
  }

  public update(new_actions:Action[]) : void {
    this.perform_automatic_state_transitions();

    for (let i = 0; i < new_actions.length; i++) {
      const a = new_actions[i];
      if (a.value == undefined) { continue; }

      const action_id = namespaced_id(a.namespace, a.id);
      const spec = this.block_registry.get_action_spec(action_id);

      if (spec == undefined) {
        this.event_bus.error.runtime.send({
          error: this.u.ohno.system.action_received_without_spec({action: a}),
        });
        continue;
      }

      if (spec.statefulness == undefined) {
        // We only care about Actions which encode some form of state
        continue;
      }

      // Check if a State matching these properties exists
      const state_params:Partial<State> = {
        sub_type: a.sub_type,
      };
      if (spec.entity_specific) {
        state_params.entity_id = a.entity_id;
      }
      const spec_params:Partial<StatefulActionSpec> = {
        id: action_id,
      };
      const matching_state = _find(this.states, <any>{
        ...state_params,
        spec: spec_params,
      });
      if (matching_state != undefined) {
        // Set new value if there was an existing State
        matching_state.value = a.value;
      } else {
        // If there was no existing state, create one
        this.states.push({
          namespace: a.namespace,
          entity_id: a.entity_id,
          sub_type: a.sub_type,
          value: a.value,
          spec: <StatefulActionSpec>spec,
        });
      }
    }
  }

  public get_action_state_value(params:ActionStateQueryParams) : string {
    const state_params:Partial<State> = {
      namespace: params.action_namespace,
    };
    const spec_params:Partial<StatefulActionSpec> = {
      id: params.action_id,
    };
    if (params.entity_id != undefined) {
      state_params.entity_id = params.entity_id;
    }
    if (params.sub_type != undefined) {
      state_params.sub_type = params.sub_type;
    }

    const matching = _find(this.states, <any>{
      ...state_params,
      spec: spec_params,
    });
    if (matching != undefined) {
      return matching.value;
    }

    // Return the default value
    const id = namespaced_id(
        params.action_namespace,
        params.action_id,
    );
    const spec = this.block_registry.get_action_spec(id);
    if (spec == undefined) {
      throw this.u.ohno.system.state_query_received_without_spec({
        query_params: params,
      });
    }
    if (spec.statefulness == undefined) {
      throw this.u.ohno.system.state_query_for_non_stateful_action({
        query_params: params,
      });
    }
    return spec.statefulness.default_value;
  }
}
