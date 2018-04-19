import * as r from 'resul-ts';
import { Catastrophe } from 'catastrophic';

import { ProcedureDefinitionBlock, CompiledBlock } from './block_types';

export {
  CompiledBlock,
};

export type clog = typeof console.log;

export interface Logger {
  fatal:clog;
  error:clog;
  warn:clog;
  info:clog;
  debug:clog;
  trace:clog;
}

/**
 * Names of the days of the week. Required for the
 * Get Day block to work. Sunday is 0, Monday is 1,
 * and so on.
 */
export interface DayNames {
  0:string; // sunday
  1:string; // monday
  2:string; // tuesday
  3:string; // wednesday
  4:string; // thursday
  5:string; // friday
  6:string; // saturday
}

export type Dict<T> = {[key:string]:T};

export type ID = string;
export type URL = string;
export type MilliSeconds = number;

export interface Identities {
  typeclass_id:ID;
  source_map_entity:ID;
  source_map_rbid:ID;
  target_entity:ID;
  interpreter_id:ID;
}

export interface InterpreterPriorities {
  readonly creation_counter:number;
  readonly frame_created:number;
  readonly responder_priority:number;
}

export interface InterpreterMetadata {
  readonly original_identities:Readonly<Identities>;
  readonly priorities:InterpreterPriorities;
  readonly typeclass_id:string;
  readonly interpreter_id:ID;
  readonly type:string; // type of original root block
  readonly group_id:string|undefined;
}

export interface Entity {
  id:ID;
  blocksXML?:string;
}

export enum EntityState {
  Unknown,
  Known,
  Destructing,
  Disposed,
}

export interface EntityCompileResult {
  compiled_block_map:CompiledBlockMap;
  procedures:{[function_name:string]:ProcedureDefinitionBlock};
}

export interface ProcedureContainer {
  script:ProcedureDefinitionBlock;
  source_entity_id:ID;
  name:string;
}

export interface UncompiledEntity extends Entity {
  blocksXML:string; // required for compilation
}

export interface CompiledEntity extends EntityCompileResult, UncompiledEntity {
  running_group_id?:{[compiled_block_map_rbid:string]:ID|undefined};
}

export type MaybeCompiledEntities = r.Result<CompiledEntity[], Catastrophe>;

export interface CompiledBlockMap {
  [id:string]:CompiledBlock;
}

export type Storable = string | number | boolean;
export interface BaseVariableSpec {
  type:string;
  id:ID;
  value:Storable|Storable[];
}
export enum VariableScope {
  global,
  script,
  entity,
}
export interface GlobalVariableSpec extends BaseVariableSpec {
  scope:VariableScope.global;
}
export interface ScriptVariableSpec extends BaseVariableSpec {
  scope:VariableScope.script;
}
export interface EntityVariableSpec extends BaseVariableSpec {
  scope:VariableScope.entity;
  entity_id:ID;
}
export type VariableSpec = ScriptVariableSpec | EntityVariableSpec | GlobalVariableSpec;
export type VariableSpecDict = {[var_id:string]:VariableSpec};
export type ScriptVariableSpecDict = {[var_id:string]:ScriptVariableSpec};

export type VariableStore = {[var_id:string]:any};
export type EntityVariableStore = {[entity_id:string]:VariableStore};

export enum StepResult {
  yielding,
  finished,
}

// Yes, block_id, not root_block_id - used for running
// just a single block when the user clicks it
export type ForcedBlockIds = {[block_id:string]:boolean};

export interface ClientErrorProperties {
  namespace:string; // Must be identify the BlockProvider to which this error belongs
  id:string; // May be anything, should be used by the BlockProvider to trigger useful error UX
  native_error?:Error;
  [k:string]:any;
}

export interface Task {
  entity_id:ID;
  interpreter_id:ID;

  // If undefined, is an infinite task and will live until TaskHandle's end_task is called.
  // An infinite task will never have its on_end handler called.
  lifetime?:MilliSeconds;

  // If true, will prevent execution of its block group until this task is finished.
  blocking:boolean;

  // Called the first manager update after task is added
  on_start?:() => void;

  // Called every manager update after the first, during the task's lifetime.
  // amount_done in ]0,1[ for finite tasks, not set for infinite tasks
  on_tick?:(delta_time?:MilliSeconds, amount_done?:number) => void;

  // Called once on the first manager update after the lifetime is over.
  // This is not called when task is ended with handler's end_task or when cancelled.
  on_end?:(delta_time?:MilliSeconds) => void;

  // delta_time is the time between previous and current tick
}

export interface TaskHandle {
  // Stopping a task using this handle does not trigger the on_end function
  stop:() => void;
}

export interface RuntimeStackMetadata {
  interpreter_id:ID;
  source_map_rbid:ID;
  source_entity_id:ID;
  block_id?:ID;
  proc_id?:ID;
  proc_parameters?:{[id:string]:any};
}
