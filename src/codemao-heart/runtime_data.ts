import _remove from 'lodash/remove';
import { injectable, inject } from 'inversify';

import * as H from './di_interfaces';
import { ID } from './basic_types';
import {
  ActionStateQueryParams,
} from './public_interfaces';
import { BINDING } from './di_symbols';

type ArbitraryData = {[key:string]:any};

enum RunStatus {
  Running,
  Stopped,
}

@injectable()
export class RuntimeDataImpl implements H.RuntimeData {

  private per_entity_clone_limit:number|undefined;

  private _clone_id_2_original_id:{[clone_id:string]:string} = {}; // clone_id -> original_id
  private original_id_2_clone_id_list:{[sprite_id:string]:ID[]} = {}; // sprite_id -> clone_id[]

  private _is_mirror:{[sprite_id:string]:boolean} = {};

  private run_status = RunStatus.Stopped;
  private arbitrary_data:ArbitraryData = {}; // This is global to the running program
  private interpreter_data:{[key:string]:ArbitraryData} = {}; // key is actually ID

  private running_blocks_map:{[interpreter_id:string]:ID} = {};
  private should_report_current_running_block:boolean|undefined;

  public constructor(
    @inject(BINDING.ActionStateStore) private state_store:H.ActionStateStore,
    @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
    @inject(BINDING.Util) private u:H.Util,
    @inject(BINDING.Config) private config:H.Config,
  ) {
    this.per_entity_clone_limit = this.config.get().per_entity_clone_limit;
    this.should_report_current_running_block = this.config.get().should_report_current_running_block;

    this.event_bus.system.config_updated.immediate.sub(() => {
      this.per_entity_clone_limit = this.config.get().per_entity_clone_limit;
      this.should_report_current_running_block = this.config.get().should_report_current_running_block;
    });
  }

  public clear() : void {
    this.run_status = RunStatus.Stopped;
    this._clone_id_2_original_id = {};
    this.arbitrary_data = {};
    this.interpreter_data = {};
    this._is_mirror = {};
    this.original_id_2_clone_id_list = {};

    if (!this.should_report_current_running_block) {
      return;
    }
    this.clear_running_blocks_map();
  }

  public set_mirror(interpreter_id:ID) : void {
    this._is_mirror[interpreter_id] = true;
  }

  public is_mirror(interpreter_id:ID) : boolean {
    return this._is_mirror[interpreter_id] == true;
  }

  public set_arbitrary_data(key:string, value:any) : void {
    this.arbitrary_data[key] = value;
  }

  public get_arbitrary_data(key:string) : any | undefined {
    return this.arbitrary_data[key];
  }

  public set_interpreter_data(interpreter_id:ID, key:string, value:any) : void {
    if (this.interpreter_data[interpreter_id] == undefined) {
      this.interpreter_data[interpreter_id] = {};
    }
    this.interpreter_data[interpreter_id][key] = value;
  }

  public get_interpreter_data(interpreter_id:ID, key:string) : any {
    const value = this.interpreter_data[interpreter_id][key];
    return value;
  }

  public dispose_interpreter_data(interpreter_id:ID) : void {
    this.interpreter_data[interpreter_id] = {};
    delete(this._is_mirror[interpreter_id]);

    if (this.should_report_current_running_block && (this.running_blocks_map[interpreter_id] !== undefined)) {
      this.set_finished_block(this.running_blocks_map[interpreter_id]);
      delete(this.running_blocks_map[interpreter_id]);
    }
  }

  public report_variable_updated(var_id:string, new_value:any) : void {
    this.event_bus.runtime_data.variable_update.send({
      var_id,
      new_value,
    });
  }

  public report_list_updated(list_id:string, new_value:any) : void {
    this.event_bus.runtime_data.list_update.send({
      list_id,
      new_value,
    });
  }

  public report_entity_variable_updated(var_id:string, new_value:any, entity_id:string) : void {
    this.event_bus.runtime_data.entity_variable_update.send({
      var_id,
      new_value,
      entity_id,
    });
  }

  public report_entity_list_updated(list_id:string, new_value:any, entity_id:string) : void {
    this.event_bus.runtime_data.entity_list_update.send({
      list_id,
      new_value,
      entity_id,
    });
  }

  public is_running() : boolean {
    return this.run_status === RunStatus.Running;
  }

  public is_stopped() : boolean {
    return this.run_status === RunStatus.Stopped;
  }

  public set_running() : void {
    this.run_status = RunStatus.Running;
  }

  public set_stopped() : void {
    this.run_status = RunStatus.Stopped;
  }

  public clone_id_2_original_id(entity_id:ID) : ID|undefined {
    return this._clone_id_2_original_id[entity_id];
  }

  public get_sprite_clones(sprite_id:ID) : ID[] {
    return this.original_id_2_clone_id_list[sprite_id];
  }

  public clone_created(original_entity_id:string, clone_entity_id:string) : void {
    this._clone_id_2_original_id[clone_entity_id] = original_entity_id;
    if (!this.original_id_2_clone_id_list[original_entity_id]) {
      this.original_id_2_clone_id_list[original_entity_id] = [];
    }

    this.original_id_2_clone_id_list[original_entity_id].push(clone_entity_id);

    if (this.per_entity_clone_limit == undefined) { return; }

    const clone_list = this.original_id_2_clone_id_list[original_entity_id];
    const n_too_many = clone_list.length - this.per_entity_clone_limit;

    for (let i = 0; i < n_too_many; i++) {
      this.event_bus.clones.dispose_clone.send(
        clone_list[i],
      );
    }
  }

  private remove_clone_lookups(removed_id:ID) : void {
    const original_id = this._clone_id_2_original_id[removed_id];
    if (original_id == undefined) { return; }

    delete(this._clone_id_2_original_id[removed_id]);
    const clone_list = this.original_id_2_clone_id_list[original_id];
    _remove(clone_list, (clone_id) => clone_id === removed_id);
    if (clone_list.length === 0) {
      // This entity was the last clone of another entity
      delete(this.original_id_2_clone_id_list[original_id]);
    }
  }

  public entity_disposed(removed_id:ID) : void {
    this.remove_clone_lookups(removed_id);
    this.event_bus.runtime_data.entity_dispose.send({entity_id: removed_id});
  }

  public get_action_state_value(params:ActionStateQueryParams) : string {
    return this.state_store.get_action_state_value(params);
  }

  public set_running_block(interpreter_id:ID, running_block_id:ID) {
    if (this.running_blocks_map[interpreter_id] === running_block_id) {
      return;
    }
    if (this.running_blocks_map[interpreter_id] !== undefined) {
      this.event_bus.runtime_data.block_finished.send(this.running_blocks_map[interpreter_id]);
    }
    this.running_blocks_map[interpreter_id] = running_block_id;
    this.event_bus.runtime_data.block_running.send(running_block_id);
  }

  private set_finished_block(finished_block_id:ID) : void {
    this.event_bus.runtime_data.block_finished.send(finished_block_id);
  }

  private clear_running_blocks_map() {
    const running_interpreters = Object.keys(this.running_blocks_map);
    for (let i = 0; i < running_interpreters.length; i++) {
      const interpreter_id = running_interpreters[i];
      this.set_finished_block(this.running_blocks_map[interpreter_id]);
    }
    this.running_blocks_map = {};
  }
}
