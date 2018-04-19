import * as BLK from '../block_types';
import * as H from '../di_interfaces';
import { ID, Identities } from '../basic_types';
import { FunctionDict } from '../block_provider';

// A dictionary or list which contains any type of data
export interface AnyStorage {
  [id:string]:any;
}

export interface ProcStackFrame {
  proc_id:ID;
  proc_parameters:AnyStorage;

  program_counter:number[];
  dynamic_data:AnyStorage;

  // Domain functions act on an entity, usually whatever is
  // the target_entity in the Runner::identities property.
  // However, if a procedure is called from inside a Tell
  // block, it will have a different target_entity. We use
  // the value in the stack frame as our target at all times,
  // except inside a tell block, where the target is taken from
  // the tell block's dynamic_data parameters.
  target_entity_id:ID;

  // A stack frame may belong to any procedure, so we must
  // store the source map for error display purposes.
  source_map_entity:ID;
  source_map_rbid:ID;

  // ID of the procedure call block,
  proc_call_bid?:ID;

  // CompiledBlock AST trees representing async tell block children
  async_tell_asts:{[block_id:string]:BLK.CompiledBlock};

  // If this frame is inside a warp block
  is_warped:boolean;
}

export interface State {
  finished:boolean;
  proc_stack:ProcStackFrame[];
  proc_has_return_value:boolean;
  proc_return_value:any;
  did_proc_yield:boolean;
}

export type ShouldYield = boolean;

/**
 * We have tried representing StepArgs as an array
 * instead of a dictionary. It is slower. Probably
 * because the dictionary is small enough, and has
 * the same properties throughout its lifetime, so
 * that it becomes very well optimized.
 */
export type StepArgs = StepInputOutput & StepInputs & StepOutputs & StepState;

export interface StepInputOutput {
  ohno:H.Ohno;
  call_domain_function(
      return_value_storage_id:string,
      function_id:string,
      block_id:ID,
      args:any,
      target_entity:ID,
  ) : any;
  report_sync_telling(
    block_id:ID,
    new_target_entity:ID,
  ) : void;
  async_tell(
    block_id:ID,
    target_entity:ID,
    new_target_entity:ID,
    is_inside_warp:boolean,
  ) : void;
}

export interface StepInputs {
  identities:Identities;
  default_target_entity_id:ID; // see ProcStackFrame::target_entity_id
  static_data:AnyStorage;

  proc_parameters:AnyStorage;
  proc_return_value:any;
  proc_has_return_value:boolean;
}

export interface StepOutputs {
  after_iteration(is_in_warp_block:boolean) : boolean;
  before_expression(
      block_id:ID,
      source_map_entity:ID,
      source_map_rbid:ID,
      yield_group_id:number,
      next_statement_id:number,
  ) : ShouldYield;
  after_potential_blocker(
      block_id:ID,
      source_map_entity:ID,
      source_map_rbid:ID,
      yield_group_id:number,
      next_statement_id:number,
  ) : ShouldYield;
  reset_program_counter(
      source_map_entity:ID,
      source_map_rbid:ID,
      yield_group_id:number,
  ) : void;
  increment_program_counter(
      source_map_entity:ID,
      source_map_rbid:ID,
      yield_group_id:number,
      statement_id:number,
  ) : void;
  finished() : void;
  proc_call(
      function_id:ID,
      target_entity_id:ID,
      parameters:AnyStorage,
  ) : void;
  proc_yield_after_call(
      yield_group_id:number,
      statement_id:number,
  ) : void;
  proc_do_return_value(block_id:ID, value:any) : void;
}

export interface StepState {
  dynamic_data:AnyStorage;
  program_counter:number[];
}

export type CompiledAST = (X:StepArgs) => ShouldYield;

export interface OptiProgram {
  script:CompiledAST;
  static_data:AnyStorage;
  dynamic_data_size:number;
  n_yield_groups:number;
  async_tell_asts:{[block_id:string]:BLK.CompiledBlock};
}

export interface CompiledScript {
  main:OptiProgram;
  procedures:{[procedure_id:string]:OptiProgram};
}
