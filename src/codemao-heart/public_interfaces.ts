import * as r from 'resul-ts';

import * as basic_types from './basic_types'; // for export
import { HeartConfig } from './config';

import {
  CompiledEntity,
  Entity,
  EntityCompileResult,
  ID,
  MaybeCompiledEntities,
  MilliSeconds,
  Task,
  TaskHandle,
  VariableSpec,
  VariableStore,
} from './basic_types';

import {
  Runnable,
  EntityToAdd,
} from './runtime_manager';

import { Action, BlockProvider, RuntimeProvider, BlockConfigDict } from './block_provider';
import { Blockly } from './blockly_interface';
import { EventBusPublic }  from './event/event_bus';
import { ProcedureDefinitionBlock } from './block_types';
import { ToolboxConfig } from './toolbox';

export type EventBus = EventBusPublic;
export type StorableItem = string|number|boolean|List;
export interface List extends Array<StorableItem> {}

export {
  HeartConfig,
  BlockProvider,
  RuntimeProvider,
  Action,
  Blockly,
  ToolboxConfig,
};

export interface ActionStateQueryParams {
  action_namespace:string;
  action_id:string;
  entity_id?:ID;
  sub_type?:string;
}

export interface RuntimeData {
  is_mirror(interpreter_id:ID) : void;

  set_arbitrary_data(key:string, value:any) : void;
  get_arbitrary_data(key:string) : any | undefined;

  set_interpreter_data(interpreter_id:ID, key:string, value:any) : void;
  get_interpreter_data(interpreter_id:ID, key:string) : any;

  report_list_updated(list_id:string, value:any) : void;
  report_entity_list_updated(list_id:string, new_value:any, entity_id:string) : void;

  is_running() : boolean;
  is_stopped() : boolean;

  clone_id_2_original_id(entity_id:ID) : ID|undefined;
  get_sprite_clones(sprite_id:ID) : ID[];

  get_action_state_value(params:ActionStateQueryParams) : string;
}

export interface Broadcasts {
  start(message:string) : void;
  end(message:string) : void;
  has(message:string) : void;
}

// Returns interpreter_id of new running interpreter if successful
export type InitRunnableResult = r.Result<string, void>;

export interface RuntimeManager {

  restart() : void;
  run() : void;
  stop() : void;
  update() : void;

  clone_entity(entity_id:ID, is_mirror:boolean) : ID|undefined;
  set_entity_known(entity_id:ID) : void;
  clear() : void;
  // TODO API Remove public initialize_runnable
  initialize_runnable(r:Runnable) : InitRunnableResult;
  change_running_group(id:string) : void;
  load(entities:CompiledEntity[]) : r.Res[];
  create_singleton_entity_instances() : InitRunnableResult[];
  create_entity_instance(
      typeclass_id:ID,
      entity_id:ID,
      params?:any,
  ) :  InitRunnableResult[];
  procedure_load(
      source_entity_id:ID,
      procedure_name:string,
      compiled_block:ProcedureDefinitionBlock,
  ) : void;
  set_variable_specs(variable_specs:VariableSpec[]) : void;

  add_task(t:Task) : TaskHandle;
  get_thread_lock(entity_id:ID, interpreter_id:ID) : TaskHandle;
  send_action(action:Action) : void;
  thread_wait(entity_id:ID, interpreter_id:ID, lifetime:MilliSeconds) : void;

  get_elapsed_frames() : number;
  get_timer_elapsed_s() : number;
  reset_timer() : void;

  get_entity_id_from_root_block_id(block_id:ID) : ID;

  delete_other_interpreters(rbid:ID) : void;
  dispose_all() : void;
  dispose_block_group(rbid:ID) : void;
  dispose_block_groups_of_other_entities(entity_id:ID) : void;
  dispose_other_block_groups_of_entity(entity_id:ID, rbid:ID) : void;
  dispose_sprite(sprite_id:string) : void;
  destruct_entity(entity_id:string) : void;

  get_global_variable(var_id:string) : any;
  get_variable(var_id:string, interpreter_id?:ID, entity_id?:ID) : any;
  lists_get(var_id:string, interpreter_id?:ID, entity_id?:ID) : any[];
  set_variable(var_id:string, val:any, interpreter_id?:ID, entity_id?:ID) : void;
  is_entity_variable(var_id:string) : boolean;

  get_random_number() : number;
  get_list_id(list:List, entity_id:ID) : string | undefined;
}

export interface LoadedBlockConfigs {
  defined_by_json:{[namespace:string]:BlockConfigDict};
  defined_by_init_function:{[namespace:string]:string[]};
}

export interface BlockRegistry {
  register_provider(block_provider:BlockProvider) : void;
  register_runtime_provider(p:RuntimeProvider) : void;
  get_loaded_block_configs() : LoadedBlockConfigs;
}

export type BlockXML = {[block_type:string]:string};
export interface BlockXMLBuilder {
  define_block_xml(block_type:string, xml?:string, gap?:string, real_block_type?:string) : void;
  get_block_xml() : BlockXML;
}

export interface Toolbox {
  get_styles() : string[];
  set_id(id:ID) : void;
  set_scope(scope:string) : void;
  get_id() : ID;
  get_xml() : string;
  get_type() : string;
  get_block_array() : string[];
  get_scope() : string | undefined;
}

export type ForcedIds = {[block_id:string]:boolean};
export interface Compiler {
  compile(
      entities:Entity[],
      force_compile_block_ids?:ForcedIds,
      compile_all_blocks?:boolean,
  ) : MaybeCompiledEntities;
}

export interface Util {
  misc:{
    ce_restore_cyclical_references(ce:CompiledEntity) : void,
    ce_without_cyclical_references(ce:CompiledEntity) : CompiledEntity,
  };
  block:BlockUtil;
}

export interface BlockUtil {
  has_block_of_types(
      cws:EntityCompileResult[],
      block_types:string[],
  ) : boolean;
}

export interface BlockColors {
  green:string;
  darkBlue:string;
  purple:string;
  blue:string;
  pink:string;
  yellow:string;
  orange:string;
  red:string;
  actions:string;
  control:string;
  appearance:string;
  sensing:string;
  sound:string;
  pen:string;
  operators:string;
  variables:string;
  events:string;
  physics:string;
  lists:string;
  procedure:string;
  building:string;
  advanced:string;
}

export interface IconUrls {
  block_control_icon:string;
  block_list_icon:string;
  block_variables_icon:string;
  block_sensing_icon:string;
  block_events_icon:string;
  block_msg_icon:string;
  block_procedure_icon:string;
  block_start_icon:string;
  block_advanced_icon:string;
}

export type BlocklyOption = [string, string];

export interface BasicBlockConfigDependencies {
  get_variables:(type_name:string, add_default_word?:boolean) => BlocklyOption[];
  get_entities:() => BlocklyOption[];
  get_icon_urls() : IconUrls;
  get_procedure_parameters() : string[];
  get_block_colors?:() => BlockColors;
}

export interface AvaTestLike {
  plan(n_tests:number) : void;
  fail(message?:string) : void;
  pass(message?:string) : void;
  truthy(obj:any, message?:string) : void;
  falsy(obj:any, message?:string) : void;
  is(value:any, expected:any, message?:string) : void;
  not(value:any, expected:any, message?:string) : void;
}

export interface TestAssertionTool extends AvaTestLike {
  get_result() : AssertionToolResult;
  reset() : void;
}

export interface AssertionToolResult {
  success:boolean;
  message:string;
}

export interface BenchmarkTool {
  set(col_name:string, row_value:string) : void;
  start_iteration() : void;
  finish_iteration() : void;
}
