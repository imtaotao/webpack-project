import * as r from 'resul-ts';
import { Catastrophe } from 'catastrophic';

import * as P from './public_interfaces';

import {
  CompiledEntity,
  Dict,
  Entity,
  EntityCompileResult,
  EntityState,
  ID,
  Identities,
  InterpreterMetadata,
  InterpreterPriorities,
  Logger,
  MilliSeconds,
  ProcedureContainer,
  RuntimeStackMetadata,
  ScriptVariableSpecDict,
  StepResult,
  Task,
  TaskHandle,
  VariableStore,
} from './basic_types';

import * as B from './block_types';
import * as O from './opti/types';

import {
  Blockly,
} from './blockly_interface';

import {
  Action,
  ActionSpec,
  BlockProvider,
  ResponderInfo,
  RuntimeProvider,
  FunctionDict,
} from './block_provider';

import {
  Ohno,
} from './error_types';

import {
  EntityToAdd,
  Runnable,
} from './runtime_manager';

import { BlockResult, ResultProcedureCall } from './block_interpreter';
import { HeartConfig, PartialHeartConfig } from './config';

export {
  HeartConfig,
  Logger,
  Ohno,
  PartialHeartConfig,
};

export interface RuntimeData extends P.RuntimeData {
  clear() : void;

  entity_disposed(entity_id:ID) : void;
  dispose_interpreter_data(root_block_id:ID) : void;

  report_variable_updated(var_id:string, new_value:any) : void;
  report_entity_variable_updated(var_id:string, new_value:any, entity_id:string) : void;

  clone_created(original_entity_id:string, clone_entity_id:string) : void;
  set_mirror(block_id:ID) : void;

  set_running() : void;
  set_stopped() : void;

  set_running_block(interpreter_id:ID, running_block_id:ID) : void;
}

export interface BlockPool {
  get() : B.PoolBlock;
  release(block:B.CompiledBlock) : void;
  clone(compiled_block:B.CompiledBlock, parent?:B.PoolBlock) : B.CompiledBlock;
}

export interface BlockInterpreterFactory {
  create(
      runtime_manager:RuntimeManager,
      identities:Identities,
      priorities:InterpreterPriorities,
      compile_cache_id:ID,
      compiled_block:B.CompiledBlock,
      script_variable_specs:ScriptVariableSpecDict,
      group_id:ID|undefined,
      is_warped:boolean,
      action_parameters?:Dict<any>,
      on_finished?:OnInterpreterFinished,
  ) : BlockInterpreter;
  clear() : void;
}

export interface RuntimeManager extends P.RuntimeManager {
  get_entity_state(entity_id:ID) : EntityState;
  get_procedure(p_name:string, do_clone?:boolean) : ProcedureContainer|undefined;
  set_current_interpreter_not_blocked() : void;
  current_interpreter_must_yield(interpreter_id:ID, group_id?:ID) : boolean;
  is_blocking(rbid:ID, sprite_id?:ID) : boolean;
  spawn_async_tell_interpreter(
      teller_identities:Identities,
      new_target_entity:ID,
      script:B.CompiledBlock, // already cloned by caller
      group_id:ID|undefined,
      is_warped?:boolean,
  ) : void;
  spawn_sync_tell_interpreter(
      teller_identities:Identities,
      new_target_entity:ID,
      script:B.CompiledBlock, // already cloned by caller
      group_id:ID|undefined,
  ) : void;
  report_warning(e:Catastrophe) : void;
  get_compiled_block_by_interpreter_id(rbid:ID) : B.CompiledBlock;
  set_running_block(rbid:ID, block_id:ID) : void;
  report_error_and_stop(e:Catastrophe|Error, caught_at:string) : void;
}

export interface RunningTask extends Task {
  id:ID;
  previous_tick?:MilliSeconds; // unix time
  start_tick?:MilliSeconds; // unix time
  n_ticks?:number;
}

export interface TaskManager {
  clear() : void;
  update_dispose() : void;
  update() : void;
  add_task(id:ID, t:Task) : TaskHandle;
  is_blocking(rbid:ID) : boolean;
  dispose_task(task_id:ID) : void;
  dispose_tasks_given(match:Partial<RunningTask>) : void;
}

export interface BlockInterpreter {
  readonly metadata:InterpreterMetadata;

  /**
   * Resets the BlockInterpreter to before execution
   */
  reset() : void;

  set_variable(name:string, value:any) : void;
  get_variable(name:string) : any;
  get_variables() : VariableStore;
  step() : StepResult;

  /**
   * Releases the BlockInterpreter's CompiledBlocks back
   * to the object pool, must be called before deleting
   * the BlockInterpreter
   */
  dispose() : void;

  /**
   * Return if this interpreter is inside warp parent when spawn a tell interpreter.
   * Only block_interpreter need this, optirunner pass is_warped as parameter.
   */
  is_inside_warp?() : boolean;

  /*
   * Get interpreter stack at the moment.
   */
  get_current_stack() : RuntimeStackMetadata[];
}

export interface BlockRunner {
  run_block(
      identities:Identities,
      metadata:InterpreterMetadata,
      root_block_id:ID,
      block:B.BlockParam,
      latest_frame?:ResultProcedureCall,
  ) : BlockResult;
}

export interface ActionStateStore {
  clear() : void;
  update(new_actions:Action[]) : void;
  get_action_state_value(params:P.ActionStateQueryParams) : string;
}

export type MaybeActionSpec = ActionSpec | undefined;
export type MaybeResponderInfo = ResponderInfo | undefined;

export interface BlockRegistry extends P.BlockRegistry {
  get_action_spec(ns_event_id:string) : MaybeActionSpec;
  get_spec_of_action(event:Action) : MaybeActionSpec;
  get_event_types() : string[];
  get_responder_info(ns_responder_id:string) : MaybeResponderInfo;
  has_responder_type(ns_responder_id:string) : boolean;
  get_domain_functions() : FunctionDict;
  block_restart_when_finished(namespace:string) : boolean;
  block_finish_out_of_run_group(ns_id:string) : boolean;
}

export interface BlockXMLBuilderFactory {
  create(
      block_provider:BlockProvider,
  ) : P.BlockXMLBuilder;
}

import {
  ToolboxConfig,
  ToolboxCategoryConfig,
  IconConfig,
} from './toolbox';
export {
  ToolboxConfig,
  ToolboxCategoryConfig,
  IconConfig,
};

export interface ToolboxFactory {
  create(
      toolbox_config:ToolboxConfig,
      block_xml:P.BlockXML,
  ) : P.Toolbox;
}

export interface Util extends P.Util {
  ohno:Ohno;
  log:Logger;
  block:BlockUtil;
  config:Config;
  misc:{
    ce_restore_cyclical_references(ce:CompiledEntity) : void,
    ce_without_cyclical_references(ce:CompiledEntity) : CompiledEntity,
  };
}

export interface BlockUtil extends P.BlockUtil {
  is:BlockPredicates;

  reset_state(block:B.PreBlock) : void;

  get_first_ancestor_satisfying(
      block:B.CompiledBlock|B.PreBlock|undefined,
      assert:(parent:B.CompiledBlock|B.PreBlock) => boolean,
  ) : B.CompiledBlock | undefined;
}

export interface BlockPredicates {
  // Client defined blocks
  responder_block(b:B.Block) : b is B.ResponderBlock;
  responder_type(t:string) : boolean;

  // Block kinds
  atomic_type(t:string) : boolean;
  cond_block(b:B.Block) : b is B.CondBlock;
  domain_block(b:B.Block) : b is B.DomainBlock;
  event_block(b:B.Block) : b is B.EventBlock;
  loop_block(b:B.Block) : b is B.LoopBlock;
  proc_block(b:B.Block) : b is B.ProcBlock;

  // Special blocks
  special_block(b:B.Block) : b is B.SpecialBlock;
  logic_empty(b:B.Block) : b is B.LogicEmptyBlock;
  async_tell(b:B.Block) : b is B.TellBlock;
  sync_tell(b:B.Block) : b is B.SyncTellBlock;
  warp(b:B.Block) : b is B.WarpBlock;

  // Block types
  break(b:B.Block) : b is B.BreakBlock;
  controls_if(b:B.Block) : b is B.IfBlock;
  controls_if_no_else(b:B.Block) : b is B.IfNoElseBlock;
  procedures_callnoreturn(b:B.Block) : b is B.ProcedureCallNoReturnBlock;
  procedures_callreturn(b:B.Block) : b is B.ProcedureCallReturnBlock;
  procedures_defnoreturn(b:B.Block) : b is B.ProcedureDefinitionBlock;
  procedures_parameter(b:B.Block) : b is B.ProcedureParameterBlock;
  procedures_return_value(b:B.Block) : b is B.ProcedureReturnValueBlock;
  repeat_forever(b:B.Block) : b is B.RepeatForeverBlock;
  repeat_forever_until(b:B.Block) : b is B.RepeatForeverUntilBlock;
  repeat_n_times(b:B.Block) : b is B.RepeatNTimesBlock;
  wait_until(b:B.Block) : b is B.WaitUntilBlock;

  compiled_block(b:B.BlockParam) : b is B.CompiledBlock;
  atomic(b:B.BlockParam) : b is number | string | boolean | undefined;
}

export interface Config {
  get() : HeartConfig;
  set(config:PartialHeartConfig) : void;
}

export type MaybeBlockXML = r.Result<P.BlockXML, void>;

export interface BlockGetters {
  get_block_provider() : BlockProvider;
  get_default_block_xml() : MaybeBlockXML;
}

export interface BasicBlockProviderFactory {
  runtime_provider() : RuntimeProvider;
  block_provider_and_xml(
      block_config_deps:P.BasicBlockConfigDependencies,
  ) : BlockGetters;
}

export interface TestBlockProviderFactory {
  runtime_provider(ava_like_test_object?:P.AvaTestLike) : RuntimeProvider;
  block_provider_and_xml(
      test_icon_url:string,
      ava_like_test_object?:P.AvaTestLike,
  ) : BlockGetters;
}

export interface BenchmarkBlockProviderFactory {
  runtime_provider(benchmark_dependencies?:P.BenchmarkTool) : RuntimeProvider;
  block_provider_and_xml(
      test_icon_url:string,
      benchmark_dependencies?:P.BenchmarkTool,
  ) : BlockGetters;
}

export interface OptiCompiler {
  compile(
      source_map_entity:ID,
      source_map_rbid:ID,
      interpreter_id:ID,
      ast:B.CompiledBlock,
  ) : O.OptiProgram;
}

export interface OptiProgramCache {
  get_program(
      cache_id:ID,
      source_map_entity:ID,
      source_map_rbid:ID,
      interpreter_id:ID,
      ast:B.CompiledBlock,
  ) : O.OptiProgram;
  clear() : void;
}

export interface PRNG<T> {
  get_state() : T;
  set_state(state:T) : void;
  init_seed(s:number) : void;
  init_by_array(init_key:number[], key_length:number) : void;
  random_int() : number;
  random_int31() : number;
  random_incl() : number;
  random() : number;
  random_excl() : number;
  random_long() : number;
}

export interface PRNGFactory {
  create(seed?:number|number[]) : PRNG<any>;
}

export {
  BlockXML,
  BlockXMLBuilder,
  Compiler,
  Toolbox,
  TestAssertionTool,
} from './public_interfaces';

export {
  EventBusPrivate,
  EventBusPublic,
} from './event/event_bus';

export type OnInterpreterFinished = (rbid:ID) => void;
