import _cloneDeep from 'lodash/cloneDeep';
import _last from 'lodash/last';
import _sortBy from 'lodash/sortBy';
import _identity from 'lodash/identity';
import _defaultsDeep from 'lodash/defaultsDeep';
import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import * as BLK from './block_types';
import { BINDING } from './di_symbols';
import { FunctionDict, DomainFunctionArgs } from './block_provider';
import {
  Dict,
  EntityState,
  ID,
  Identities,
  InterpreterMetadata,
  InterpreterPriorities,
  ScriptVariableSpec,
  ScriptVariableSpecDict,
  StepResult,
  VariableStore,
  RuntimeStackMetadata,
} from './basic_types';

import {
  BlockInterpreter,
  BlockInterpreterFactory,
  BlockPool,
  BlockRegistry,
  BlockRunner,
  BlockUtil,
  EventBusPrivate,
  Ohno,
  OptiCompiler,
  RuntimeManager,
  Util,
  OnInterpreterFinished,
} from './di_interfaces';

enum BLOCK_RES {
  procedure_call = 1,
  procedure_return,
  run_child,
  value,
  empty,
  null_or_undefined_error,
  enter_warp,
}

export interface ResultProcedureCall {
  kind:'procedure_call';
  call_arguments:any;
  yield_to_block:BLK.CompiledBlock;
  procedure_block:BLK.ProcedureDefinitionBlock;
  call_block?:BLK.ProcedureCallReturnBlock;
}
function is_result_procedure_call(r:BlockResult) : r is ResultProcedureCall {
  return BLOCK_RES[r.kind] == BLOCK_RES.procedure_call;
}

export interface ResultProcedureReturn {
  kind:'procedure_return';
  return_value?:any;
}
function is_result_procedure_return(r:BlockResult) : r is ResultProcedureReturn {
  return BLOCK_RES[r.kind] == BLOCK_RES.procedure_return;
}

export interface ResultRunChild {
  kind:'run_child';
  child_block:BLK.CompiledBlock|undefined;
}
function is_result_run_child(r:BlockResult) : r is ResultRunChild {
  return BLOCK_RES[r.kind] == BLOCK_RES.run_child;
}

export interface EmptyResult {
  kind:'empty';
}
function is_result_empty(r:BlockResult) : r is EmptyResult {
  return BLOCK_RES[r.kind] == BLOCK_RES.empty;
}

export interface NullOrUndefinedErrorResult {
  kind:'null_or_undefined_error';
}
function is_null_or_undefined_error(r:BlockResult) : r is NullOrUndefinedErrorResult {
  return BLOCK_RES[r.kind] == BLOCK_RES.null_or_undefined_error;
}

export interface EnterWarp {
  kind:'enter_warp';
  child_block:BLK.CompiledBlock|undefined;
}
function is_enter_warp(r:BlockResult) : r is EnterWarp {
  return BLOCK_RES[r.kind] == BLOCK_RES.enter_warp;
}

export interface ResultValue {
  kind:'value';
  value:any;
}
function is_result_value(r:BlockResult) : r is ResultValue {
  return BLOCK_RES[r.kind] == BLOCK_RES.value;
}

function res_empty() : EmptyResult {
  return {
    kind: 'empty',
  };
}

function res_null_or_undefined_error() : NullOrUndefinedErrorResult {
  return {
    kind: 'null_or_undefined_error',
  };
}

function res_value(val:any) : ResultValue | EmptyResult {
  if (val == undefined) { return {kind: 'empty'}; }

  return {
    kind: 'value',
    value: val,
  };
}

function res_run_child(child?:BLK.CompiledBlock) : ResultRunChild {
  return {
    kind: 'run_child',
    child_block: child,
  };
}

function res_procedure_call(
    yield_to_block:BLK.CompiledBlock,
    procedure:BLK.ProcedureDefinitionBlock,
    args:any,
    call_block?:BLK.ProcedureCallReturnBlock,
) : ResultProcedureCall {
  return {
    kind: 'procedure_call',
    yield_to_block: yield_to_block,
    procedure_block: procedure,
    call_arguments: args,
    call_block: call_block,
  };
}

function res_procedure_return(return_value?:any) : ResultProcedureReturn {
  return {
    kind: 'procedure_return',
    return_value: return_value,
  };
}

export type BlockResult = EmptyResult | ResultValue | ResultRunChild | ResultProcedureCall | ResultProcedureReturn | NullOrUndefinedErrorResult | EnterWarp;

/**
 * An interpreter for one tree of compiled blocks
 */
class BlockInterpreterImpl implements BlockInterpreter {
  private root_block:BLK.CompiledBlock;
  private current_block:BLK.CompiledBlock|undefined;
  private root_block_id:ID;

  private procedure_call_stack:ResultProcedureCall[] = [];

  // interpreter-local variables
  private variables:VariableStore = {};
  // Apparently each time we step into a procedure,
  // we reset the local variables to their original values
  private variables_stack:VariableStore[] = [];
  private original_variables:VariableStore;

  private should_report_current_running_block:boolean = false;
  private n_warp_iterations = 0;
  private n_warp_parents = 0;

  public readonly metadata:InterpreterMetadata;

  // TODO make BlockRunner injectable again, requires figuring out the circular dep
  // RuntimeManager <-> BlockInterpreter
  // RuntimeManager <-> BlockRunner <- BlockInterpreter
  constructor(
      private util:BlockUtil,
      private ohno:Ohno,
      private run_mgr:RuntimeManager,
      private block_pool:BlockPool,
      private block_runner:BlockRunner,
      private priorities:InterpreterPriorities,
      compiled_block:BLK.CompiledBlock,
      script_variable_specs:ScriptVariableSpecDict,
      private original_identities:Identities,
      group_id:ID|undefined,
      should_report_current_running_block:boolean,
      private max_procedure_calls_per_interpreter_step:number,
      private max_warp_iterations_per_interpreter_step:number,
      private is_warped:boolean,
      private on_finished?:OnInterpreterFinished,
  ) {

    this.metadata = {
      priorities,
      original_identities,
      typeclass_id: original_identities.typeclass_id,
      interpreter_id: original_identities.interpreter_id,
      type: compiled_block.type,
      group_id,
    };

    this.current_block = compiled_block;
    this.root_block = this.current_block;

    // TODO Remove BlockInterpreterImpl::root_block_id and use interpreter_id instead
    this.root_block_id = compiled_block.id;
    for (const var_id in script_variable_specs) {
      this.variables[var_id] = script_variable_specs[var_id].value;
    }
    this.original_variables = _cloneDeep(this.variables);
    this.should_report_current_running_block = should_report_current_running_block;
  }

  public reset() : void {
    this.current_block = this.block_pool.clone(
        this.run_mgr.get_compiled_block_by_interpreter_id(this.root_block_id),
    );
    this.block_pool.release(this.root_block);
    this.root_block = this.current_block;
  }

  public dispose() : void {
    this.block_pool.release(this.root_block);
  }

  public is_inside_warp() : boolean {
    return this.is_warped || this.n_warp_parents > 0;
  }

  public set_variable(name:string, value:any) : void {
    this.variables[name] = value;
  }

  public get_variable(name:string) : any {
    return this.variables[name];
  }

  public get_variables() : VariableStore {
    return this.variables;
  }

  private step_into_procedure(res:ResultProcedureCall) : boolean {
    if (res.procedure_block.child_block.length == 0) {
      return false;
    }
    const procedure = res.procedure_block.child_block[0];
    if (procedure == undefined) {
      return false;
    }
    res.yield_to_block.first_evaluation = false;
    res.procedure_block.parent_block = res.yield_to_block;
    this.procedure_call_stack.push(res);
    this.variables_stack.push(this.variables);
    this.variables = _cloneDeep(this.original_variables);
    this.current_block = procedure;
    return true;
  }

  private step_out_of_procedure(res:ResultProcedureReturn) : void {
    const call = this.procedure_call_stack.pop();
    if (call == undefined) {
      throw this.ohno.system.procedure_popped_empty_call_stack({
        root_block_id: this.root_block_id,
        block: this.current_block,
        block_id: this.current_block != undefined ? this.current_block.id : undefined,
      });
    }
    if (call.call_block) {
      // Calling block returns a value
      call.call_block.procedure_return_value = res.return_value;
    } else {
      // Calling block is a statement
      call.yield_to_block.done_evaluating = true;
    }
    this.current_block = call.yield_to_block;
    const var_stack_frame = this.variables_stack.pop();
    if (var_stack_frame == undefined) {
      throw this.ohno.system.popped_empty_variable_stack({
        root_block_id: this.root_block_id,
        block: this.current_block,
        block_id: this.current_block.id,
      });
    }
    this.variables = var_stack_frame;
  }

  private do_step() : StepResult {
    this.run_mgr.set_current_interpreter_not_blocked();
    this.n_warp_iterations = 0;

    // TODO PERF specify this.current_block != undefiend in block_interpreter for
    let n_procedure_calls = 0;
    while (this.current_block) {

      if (this.util.is.break(this.current_block)) {

        const first_loop_ancestor = this.util.get_first_ancestor_satisfying(
            this.current_block,
            this.util.is.loop_block,
        );
        if (!first_loop_ancestor) {
          throw this.ohno.user.break_with_bad_parent({
            root_block_id: this.root_block_id,
            block: this.current_block,
            block_id: this.current_block.id,
          });
        }

        // Reset all blocks up the chain
        let ancestor = this.current_block.parent_block;
        while (ancestor != first_loop_ancestor && ancestor != undefined) {
          if (this.util.is.warp(ancestor)) {
            this.n_warp_parents--;
          }
          this.util.reset_state(ancestor);
          ancestor = ancestor.parent_block;
        }

        // Set the parent loop as finished, and run it next
        first_loop_ancestor.done_evaluating = true;
        this.current_block = first_loop_ancestor;
        continue;
      }

      if (this.current_block.done_evaluating == false) {

        if (this.should_report_current_running_block) {
          this.run_mgr.set_running_block(this.root_block_id, this.current_block.id);
        }

        const res = this.block_runner.run_block(
          this.original_identities,
          this.metadata,
          this.root_block_id,
          this.current_block,
          _last(this.procedure_call_stack),
        );

        if (is_enter_warp(res)) {
          this.n_warp_parents++;
          this.current_block = res.child_block;
          continue;
        }

        // We must first check if result requires further computation to finish
        if (is_result_run_child(res)) {
          this.current_block = res.child_block;
          continue;
        }
        if (is_result_procedure_call(res)) {
          n_procedure_calls++;
          if (n_procedure_calls > this.max_procedure_calls_per_interpreter_step) {
            return StepResult.yielding;
          }
          if (this.step_into_procedure(res)) {
            continue;
          }
        }
        if (is_result_procedure_return(res)) {
          this.step_out_of_procedure(res);
          continue;
        }

        // Check if we should break out of wait_until (requires the computation result)
        if (this.util.is.wait_until(this.current_block)) {
          if (is_result_value(res)) {
            if (!res.value) {
              this.util.reset_state(this.current_block); // Reset to be ready to run again
              return StepResult.yielding;
            }
          }
        }
      }

      // Check if running some domain block caused us to
      // become yielding by an animation or other task
      if (this.run_mgr.current_interpreter_must_yield(this.original_identities.interpreter_id, this.metadata.group_id)) {
        this.current_block.done_evaluating = true;
        return StepResult.yielding;
      }

      // Block is done running, reset and continue with other blocks
      this.util.reset_state(this.current_block);

      // If there is a next block, run it
      if (this.current_block.next_block) {
        this.current_block = this.current_block.next_block;
        continue;
      }

      // If we're an event block, yield and be ready to trigger again
      if (this.util.is.event_block(this.current_block)) {
        return StepResult.yielding;
      }

      // The current scope / block level has finished evaluating, we check
      // the parent if there's anything left to do. Otherwise this interpreter
      // is finished.

      if (!this.current_block.parent_block) {
        if (this.on_finished !== undefined) {
          this.on_finished(this.root_block_id);
        }
        return StepResult.finished;
      }

      const parent_block = this.current_block.parent_block;

      if (this.util.is.loop_block(parent_block)) {
        if (this.util.is.repeat_forever(parent_block)) {
          this.current_block = parent_block.child_block[0];
        }
        if (this.util.is.repeat_n_times(parent_block)) {
          parent_block.times_left--;
          if (parent_block.times_left > 0) {
            this.current_block = parent_block.child_block[0];
          } else {
            parent_block.done_evaluating = true;
            this.current_block = parent_block;
          }
        }

        if (this.util.is.repeat_forever_until(parent_block)) {
          this.util.reset_state(parent_block);
          this.current_block = parent_block;
        }

        if (this.is_inside_warp()) {
          if (this.n_warp_iterations < this.max_warp_iterations_per_interpreter_step) {
            this.n_warp_iterations++;
            continue;
          }
        }

        // yield at the end of loops
        return StepResult.yielding;
      }

      if (this.util.is.warp(parent_block)) {
        parent_block.done_evaluating = true;
        this.current_block = parent_block;
        this.n_warp_parents--;
        continue;
      }

      if (this.util.is.cond_block(parent_block)) {
        parent_block.done_evaluating = true;
        this.current_block = parent_block;
        continue;
      }

      if (this.util.is.event_block(parent_block)) {
        if (BLK.EVENT_BLOCKS[<any>parent_block.type] == <any>BLK.EVENT_BLOCKS.start_as_a_mirror) {
          return StepResult.finished;
        }
        this.current_block = parent_block;
        return StepResult.yielding;
      }

      if (this.util.is.procedures_defnoreturn(parent_block)) {
        // Reached the end of the current procedure without hitting a return value block
        this.step_out_of_procedure(res_procedure_return(undefined));
        continue;
      }

      if (this.util.is.async_tell(parent_block)) {
        return StepResult.finished;
      }

      return StepResult.finished;

    } // end while(this.compiled_block)
    return StepResult.finished;
  }

  public step() : StepResult {
    try {
      return this.do_step();
    } catch (e) {
      // Append interpreter_stack to any caught errors
      const error_metadata = {
        interpreter_id: this.root_block_id,
        interpreter_stack: this.get_current_stack(),
      };

      if (e instanceof Catastrophe) {
        e.annotation = _defaultsDeep(e.annotation, error_metadata);
        throw e;
      }
      throw this.ohno.user.unknown_run_block_error(e, error_metadata);
    }
  }

  public get_current_stack() : RuntimeStackMetadata[] {
    const proc_stack = this.procedure_call_stack;
    const stack = [];
    const is_only_frame = proc_stack.length == 0;
    const main_frame = {
      interpreter_id: this.original_identities.interpreter_id,
      source_map_rbid: this.original_identities.source_map_rbid,
      source_entity_id: this.original_identities.source_map_entity,
      block_id: is_only_frame ?
                (this.current_block != undefined) ? this.current_block.id : undefined :
                this.get_procedure_call_block_id(proc_stack[0]),
      proc_id: undefined,
    };
    stack.push(main_frame);
    if (is_only_frame) {
      return stack;
    }

    for (let i = 0; i < proc_stack.length; i++) {
      const is_last_frame = (i == proc_stack.length - 1);
      const proc_id = proc_stack[i].procedure_block.procedure_name;
      stack.push({
        interpreter_id: this.original_identities.interpreter_id,
        // TODO this source id is incorrect if the procedure was defined in another entity
        source_map_rbid: this.original_identities.source_map_rbid,
        // TODO this source id is incorrect if the procedure was defined in another entity
        source_entity_id: this.original_identities.source_map_entity,
        block_id: is_last_frame ?
                  (this.current_block != undefined) ? this.current_block.id : undefined :
                  this.get_procedure_call_block_id(proc_stack[i + 1]),
        proc_id: proc_id,
      });
    }

    return stack;
  }

  private get_procedure_call_block_id(proc_stack:ResultProcedureCall) {
    if (proc_stack.call_block == undefined) {  // No return procedure call.
      return proc_stack.yield_to_block.id;
    }
    return proc_stack.call_block.id;  // Return procedure call.
  }
}

/**
 * These run_* functions are outside the BlockInterpreter class to ensure that
 * they are pure-ish functions, acting only on their inputs and changing their
 * environment mostly through their output. This makes them easier to reason
 * about in an already complex environment. DO NOT introduce new state for
 * them to act on. This class is a singleton, shared by all BlockInterpreters.
 */
class BlockRunnerImpl implements BlockRunner {

  private tell_should_ensure_entity_exists:boolean;
  private deterministic:boolean;

  public constructor(
      private u:Util,
      private ohno:Ohno,
      private run_mgr:RuntimeManager,
      private block_pool:BlockPool,
      private event_bus:EventBusPrivate,
      private domain_functions:FunctionDict,
  ) {
    this.deterministic = u.config.get().deterministic != undefined;
    this.tell_should_ensure_entity_exists = u.config.get().reports_all_entities;
    event_bus.system.config_updated.immediate.sub(() => {
      this.tell_should_ensure_entity_exists = u.config.get().reports_all_entities;
    });
  }

  public run_block(
      original_identities:Identities,
      metadata:InterpreterMetadata,
      root_block_id:ID,
      block:BLK.BlockParam,
      latest_frame?:ResultProcedureCall,
  ) : BlockResult {
    // TODO Investigate if we can remove this precondition check,
    // seems like the only dynamically generated objects that are
    // fed to run_block are block.params, which should not be
    // bad.
    // tslint:disable-next-line
    if (block == undefined || block == null) {
      return res_null_or_undefined_error();
    }

    if (this.u.block.is.compiled_block(block) && block.disabled) {
      return res_empty();
    }

    // Return atomics (integers, strings)
    try {
      if (this.u.block.is.compiled_block(block) && BLK.ATOMIC_BLOCKS[<any>block.type]) {
        return res_value(block.params[Object.keys(block.params)[0]]);
      }
      if (this.u.block.is.atomic(block)) {
        return res_value(block);
      }
    } catch (e) {
      throw this.ohno.user.error_constructing_value_from_atomic_block(e, {
        root_block_id,
        block,
      });
    }

    if (block.first_evaluation == true) {
      block.last_call = this.run_mgr.get_elapsed_frames();
    }

    // Fill argument list
    const args:DomainFunctionArgs = {blockId: root_block_id};
    let procedure_call_to_wait_for:ResultProcedureCall|undefined;
    let param_ids = Object.keys(block.params);
    if (this.deterministic) {
      param_ids = _sortBy(param_ids, _identity);
    }
    for (let i = 0; i < param_ids.length; i++) {
      const param_id = param_ids[i];
      const param_block = block.params[param_id];
      if (this.u.block.is.compiled_block(param_block) && param_block.disabled) {
        throw this.ohno.compiler.user.disabled_param(new Error(), {
          root_block_id,
          block_id: param_block.id,
          block_type: param_block.type,
          block: param_block,
          source_entity_id: original_identities.source_map_entity,
        });
      }
      const res:BlockResult = this.run_block(
          original_identities,
          metadata,
          root_block_id,
          param_block,
          latest_frame,
      );
      if (is_result_value(res)) {
        args[param_id] = res.value;
        continue;
      }
      if (is_result_procedure_call(res)) {
        procedure_call_to_wait_for = res;
        break;
      }
      if (is_null_or_undefined_error(res)) {
        throw this.ohno.system.undefined_or_null_block({
          root_block_id,
          block,
          block_id: block.id,
        });
      }
      if (is_result_empty(res)) {
        throw this.ohno.user.undefined_code_path_argument({
          root_block_id,
          block,
          block_id: block.id,
        });
      }
      throw this.ohno.system.unhandled_run_block_result({
        root_block_id,
        block,
        block_id: block.id,
      });
    }
    if (procedure_call_to_wait_for != undefined) {
      return procedure_call_to_wait_for;
    }

    try {
      if (this.u.block.is.cond_block(block)) {
        return this.run_conditional(
            original_identities,
            metadata,
            root_block_id,
            block,
            latest_frame,
        );

      } else if (this.u.block.is.loop_block(block)) {
        return this.run_loop(root_block_id, block, args);

      } else if (this.u.block.is.event_block(block)) {
        return this.run_event(root_block_id, block, args);

      } else if (this.u.block.is.responder_block(block)) {
        return res_run_child(block.child_block[0]);

      } else if (this.u.block.is.proc_block(block)) {
        return this.run_procedure(root_block_id, block, args, latest_frame);

      } else if (this.u.block.is.warp(block)) {
        return {
          kind:'enter_warp',
          child_block: block.child_block[0],
        };

      } else if (this.u.block.is.async_tell(block) || this.u.block.is.sync_tell(block)) {
        return this.run_tell(
            original_identities,
            metadata,
            root_block_id,
            block,
            args,
        );

      } else if (this.u.block.is.logic_empty(block)) {
        return res_value(false);
      }

      // Block is not any of the ones that need special handling,
      // so it should be a domain function block. Run it.

      if (this.domain_functions[block.type] == undefined) {
        throw this.ohno.system.missing_domain_function({
          root_block_id,
          block: block,
        });

      } else {
        this.u.block.reset_state(block);

        let domain_fun_result;
        try {
          // The function called MUST be bound to the function dictionary becuase
          // some functions call each other.
          domain_fun_result = (this.domain_functions[block.type])(
              args,
              original_identities.interpreter_id,
              original_identities.target_entity,
              {
                runtime_manager: this.run_mgr,
                add_user_procedure_call_to_stack: () => {
                  throw this.ohno.system.feature_not_available_in_debug_mode({
                    feature: 'Calling user procedures',
                  });
                },
                get_action_parameter: (parameter_id:string) => {
                  throw this.ohno.system.feature_not_available_in_debug_mode({
                    feature: 'Getting action parameters',
                  });
                },
              },
          );
        } catch (e) {
          if (e instanceof Catastrophe) { throw e; }
          throw this.ohno.system.unknown_error_in_domain_function_call(e);
        }

        if (domain_fun_result != undefined && typeof domain_fun_result.then == 'function') {
          throw this.ohno.system.feature_not_available_in_debug_mode({
            feature: 'Async domain functions',
          });
        }

        let block_result = res_value(domain_fun_result);

        if (domain_fun_result == undefined
            && block.type == 'lists_get_value'
            && this.u.config.get().legacy.lists_get_value_allow_return_undefined) {
          block_result = {kind:'value', value:undefined};
        }

        // Report results of running the block if we're force running blocks
        // (e.g. by single clicking on them in the IDE.)
        if (!is_result_empty(block_result) && block_result.value !== undefined) {
          if (!block.parent_block) {
            this.event_bus.runtime_data.block_run_result.send({
              root_block_id,
              block_id: block.id,
              result: block_result.value,
            });
          }
        }

        return block_result;
      }

    } catch (e) {
      // Append known meta data to any caught errors
      const error_metadata = {
        block: block,
        block_id: block.id,
        block_type: block.type,
        source_entity_id: original_identities.source_map_entity,
      };

      if (e instanceof Catastrophe) {
        e.annotation = _defaultsDeep(e.annotation, error_metadata);
        throw e;
      }

      throw this.ohno.user.unknown_run_block_error(e, error_metadata);
    }
  }

  private run_conditional(
      original_identities:Identities,
      metadata:InterpreterMetadata,
      root_block_id:ID,
      block:BLK.CondBlock,
      latest_frame?:ResultProcedureCall,
  ) : BlockResult {
    let i = 0;
    for (; i < block.child_block.length - 1; ++i) {
      const condition = block.conditions[i];
      if (condition == undefined) { continue; }
      if (condition.disabled) {
        throw this.ohno.compiler.user.disabled_param(new Error(), {
          root_block_id,
          block_id: condition.id,
          block_type: condition.type,
          block: condition,
        });
      }
      const res = this.run_block(
        original_identities,
        metadata,
        root_block_id,
        condition,
        latest_frame,
      );
      if (is_result_procedure_call(res)) {
        return res;
      }
      if (is_result_value(res) && res.value) {
        // If one of the conditions are true
        const then = block.child_block[i];
        if (then != undefined) {
          return res_run_child(then);
        }
        return res_empty();
      }
    }
    const _else = block.child_block[i];
    if (_else != undefined) {
      // If none of the conditions have been true, and there's an else block
      return res_run_child(_else);
    }
    return res_empty();
  }

  private run_loop(
      root_block_id:ID,
      block:BLK.LoopBlock,
      args:any,
  ) : BlockResult {
    if (this.u.block.is.repeat_forever(block)
        && block.first_evaluation == true) {
      block.first_evaluation = false;
      return res_run_child(block.child_block[0]);
    }

    if (this.u.block.is.repeat_n_times(block)) {
      block.first_evaluation = false;
      block.times_left = args['times'];
      if (block.times_left > 0) {
        return res_run_child(block.child_block[0]);
      }
      block.done_evaluating = true;
      return res_empty();
    }

    if (this.u.block.is.repeat_forever_until(block)) {
      if (args['condition']) {
        block.done_evaluating = true;
        return res_empty();
      }
      return res_run_child(block.child_block[0]);
    }

    if (this.u.block.is.wait_until(block)) {
      return res_value(args['condition']);
    }

    return res_empty();
  }

  // TODO move find_yielding_ancestor to block_util.ts
  private find_yielding_ancestor(block:BLK.ProcBlock) : BLK.CompiledBlock|undefined {
    let yielding_ancestor = block.parent_block;
    while (yielding_ancestor != undefined && yielding_ancestor.output_type != BLK.BlockOutputType.none) {
      yielding_ancestor = yielding_ancestor.parent_block;
    }
    return yielding_ancestor;
  }

  private run_procedure(
      root_block_id:ID,
      block:BLK.ProcBlock,
      args:any,
      latest_frame?:ResultProcedureCall,
  ) : BlockResult {

    if (this.u.block.is.procedures_callnoreturn(block)) {
      const procedure = this.run_mgr.get_procedure(block.procedure_name);
      if (procedure == undefined) {
        throw this.u.ohno.user.call_undefined_procedure({
          block_id: block.id,
        });
      }
      return res_procedure_call(block, procedure.script, args);
    }

    if (this.u.block.is.procedures_callreturn(block)) {
      // The procedure called will have some form of output. This output
      // might be used in combination with other procedure calls' output.
      // The closest non-output ancestor will be the block yielded to
      // after each procedure call. Since it is the block which will in
      // the end make use of the return values, it also keeps track of
      // which return values it has received.
      // If yielding_ancestor is undefined, it means the procedure is
      // called independently, use procedures call block as yielding_ancestor.
      const yielding_ancestor = this.find_yielding_ancestor(block) || block;

      if (block.procedure_return_value != undefined) {
        // Report results of running the procedure block if we're force running blocks
        // (e.g. by single clicking on them in the IDE.)
        if (block.parent_block == undefined) {
          this.event_bus.runtime_data.block_run_result.send({
            root_block_id,
            block_id: block.id,
            result: block.procedure_return_value,
          });
        }
        // Some return value has been obtained, check if it is still valid
        // (Either we are in a loop and need to re-evaluate, or our yielding
        // ancestor is checking for the return value after additional yields).
        const ancestor_call_time = yielding_ancestor.last_call;
        const current_call_time = block.last_call;
        if (ancestor_call_time == undefined || current_call_time == undefined) {
          throw this.ohno.system.procedure_missing_call_timestamps({
            root_block_id,
            args,
            block,
          });
        }
        if (ancestor_call_time <= current_call_time) {
          return res_value(block.procedure_return_value);
        }
        block.last_call = this.run_mgr.get_elapsed_frames();
      } else {
        block.first_evaluation = false;
      }

      const procedure = this.run_mgr.get_procedure(block.procedure_name);
      if (procedure == undefined) {
        throw this.u.ohno.user.call_undefined_procedure({
          block_id: block.id,
        });
      }
      return res_procedure_call(yielding_ancestor, procedure.script, args, block);
    }

    if (this.u.block.is.procedures_return_value(block)) {
      if (args['VALUE'] == undefined) {
        throw this.ohno.user.procedure_return_empty({
          root_block_id,
          args,
          block,
        });
      }
      if (latest_frame == undefined) {
        throw this.ohno.user.procedure_return_outside({
          root_block_id,
          args,
          block,
        });
      }
      return res_procedure_return(args['VALUE']);
    }

    if (this.u.block.is.procedures_parameter(block)) {
      if (latest_frame == undefined) {
        throw this.ohno.user.procedure_parameter_outside({
          root_block_id,
          args,
          block,
        });
      }
      const param_name = args['param_name'];
      if (latest_frame.call_arguments[param_name] == undefined) {
        throw this.ohno.user.procedure_no_such_parameter({
          args,
          param_name,
          root_block_id,
          block,
        });
      }
      return res_value(latest_frame.call_arguments[param_name]);
    }

    return res_empty();
  }

  private run_event(
      root_block_id:ID,
      block:BLK.EventBlock,
      args:any,
  ) : BlockResult {
    const check = this.domain_functions[block.type](
        args,
        root_block_id,
        this.run_mgr.get_entity_id_from_root_block_id(root_block_id),
        {
          runtime_manager: this.run_mgr,
          add_user_procedure_call_to_stack: () => {
            throw this.ohno.system.feature_not_available_in_debug_mode({
              feature: 'Calling user procedures',
            });
          },
          get_action_parameter: (parameter_id:string) => {
            throw this.ohno.system.feature_not_available_in_debug_mode({
              feature: 'Getting action parameters',
            });
          },
        },
    );
    if (check) {
      return res_run_child(block.child_block[0]);
    }
    return res_empty();
  }

  private run_tell(
      original_identities:Identities,
      metadata:InterpreterMetadata,
      root_block_id:ID,
      block:BLK.TellBlock|BLK.SyncTellBlock,
      args:any,
  ) : BlockResult {
    block.first_evaluation = false;

    const child = block.child_block[0];
    if (child == undefined) {
      return res_empty();
    }

    const new_target_entity_id = args.sprite;

    const target_entity_state = this.run_mgr.get_entity_state(new_target_entity_id);
    if (this.tell_should_ensure_entity_exists) {
      if (target_entity_state == EntityState.Destructing) {
        this.run_mgr.report_warning(this.ohno.warning.tell_with_destructing_entity({
          args,
          block,
          root_block_id,
          tell_entity: new_target_entity_id,
        }));
        return res_empty();
      } else if (target_entity_state == EntityState.Disposed) {
        this.run_mgr.report_warning(this.ohno.warning.tell_with_disposed_entity({
          args,
          block,
          root_block_id,
          tell_entity: new_target_entity_id,
        }));
        return res_empty();
      } else if (target_entity_state == EntityState.Unknown) {
        throw this.ohno.user.tell_with_unknown_entity({
          args,
          block,
          root_block_id,
          tell_entity: new_target_entity_id,
        });
      }
    }

    const identities:Identities = {
      typeclass_id: original_identities.typeclass_id,
      interpreter_id: original_identities.interpreter_id,
      target_entity: original_identities.target_entity,
      // It's ok that these are two are wrong if we're in a procedure call,
      // since they are overwritten in RuntimeManager::get_frame_error_metadata
      // when RuntimeStackMetadata::proc_id is undefined.
      source_map_entity: original_identities.source_map_entity,
      source_map_rbid: root_block_id,
    };

    if (this.u.block.is.sync_tell(block)) {
      this.run_mgr.spawn_sync_tell_interpreter(
          identities,
          new_target_entity_id,
          this.block_pool.clone(child),
          metadata.group_id,
      );
      return res_empty();
    }

    this.run_mgr.spawn_async_tell_interpreter(
        identities,
        new_target_entity_id,
        this.block_pool.clone(child),
        metadata.group_id,
    );
    return res_empty();
  }
}

@injectable()
export class BlockInterpreterFactoryImpl implements BlockInterpreterFactory {

  private block_runner?:BlockRunner;
  private should_report_current_running_block!:boolean;
  private max_procedure_calls_per_interpreter_step!:number;
  private max_warp_iterations_per_interpreter_step!:number;

  public constructor(
      @inject(BINDING.Util) private u:Util,
      @inject(BINDING.Ohno) private ohno:Ohno,
      @inject(BINDING.EventBus) private event_bus:EventBusPrivate,
      @inject(BINDING.BlockRegistry) private block_registry:BlockRegistry,
      @inject(BINDING.OptiCompiler) private opti_compiler:OptiCompiler,
      @inject(BINDING.BlockPool) private block_pool:BlockPool,
  ) {
    const configure = () => {
      const conf = u.config.get();
      this.should_report_current_running_block = conf.should_report_current_running_block;
      this.max_procedure_calls_per_interpreter_step = conf.max_procedure_calls_per_interpreter_step;
      this.max_warp_iterations_per_interpreter_step = conf.max_warp_iterations_per_interpreter_step;
    };
    configure();
    this.event_bus.system.config_updated.immediate.sub(configure);
  }

  public create(
    run_mgr:RuntimeManager,
    identities:Identities,
    priorities:InterpreterPriorities,
    compile_cache_id:ID, // not used
    compiled_block:BLK.CompiledBlock,
    script_variable_specs:ScriptVariableSpecDict,
    group_id:ID|undefined,
    is_warped:boolean,
    action_parameters?:Dict<any>, // not used
    on_finished?:OnInterpreterFinished,
  ) : BlockInterpreter {
    if (this.block_runner == undefined) {
      this.block_runner = new BlockRunnerImpl(
          this.u,
          this.u.ohno,
          run_mgr,
          this.block_pool,
          this.event_bus,
          this.block_registry.get_domain_functions(),
      );
    }
    return new BlockInterpreterImpl(
      this.u.block,
      this.ohno,
      run_mgr,
      this.block_pool,
      this.block_runner,
      priorities,
      compiled_block,
      script_variable_specs,
      identities,
      group_id,
      this.should_report_current_running_block,
      this.max_procedure_calls_per_interpreter_step,
      this.max_warp_iterations_per_interpreter_step,
      is_warped,
      on_finished,
    );
  }

  public clear() {}
}
