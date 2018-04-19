import _cloneDeep from 'lodash/cloneDeep';
import _defaults from 'lodash/defaults';
import { Catastrophe } from 'catastrophic';

import * as BLK from '../block_types';
import * as H from '../di_interfaces';
import * as O from './types';
import * as T from '../basic_types';
import { BINDING } from '../di_symbols';
import {
  DomainFunctionArgs,
  DomainFunctionInternals,
  FunctionDict,
  UserProcedureCall,
} from '../block_provider';

function peek<Y>(stack:Y[]) : Y | undefined {
  if (stack.length == 0) { return undefined; }
  return stack[stack.length - 1];
}

const MAIN_PROGRAM_ID = '__main__';

// TODO PERF Remove unused OptiRunner function arguments.
// Should result in smaller code being generated.

export class OptiRunner implements H.BlockInterpreter {

  public readonly metadata:T.InterpreterMetadata;

  private root_block_type:string;
  private root_block_id:T.ID;

  private program_state!:O.State;
  private step_outputs:O.StepOutputs;
  private step_input_outputs:O.StepInputOutput;
  private domain_function_util:DomainFunctionInternals;

  // interpreter-local variables
  private variables:T.VariableStore = {};
  // Apparently each time we step into a procedure,
  // we reset the local variables to their original values
  private variables_stack:T.VariableStore[] = [];
  private original_variables:T.VariableStore;

  private programs:{[proc_id:string]:O.OptiProgram} = {};

  // This variable is always set in the step function, and is used by the
  // functions called by the OptiFun. We assume that it will always be set
  // correctly, and so avoid a lot of try catch and undefined checks, which
  // have a large negative impact on performance. Measured with the fib perf
  // project:
  // * Total time: 19 % vs 0.3% for step_increment_program_counter
  // * Total time: 6.2% vs 0.1% for step_before_expression
  // We make sure to initialize it in the constructor, so it's part of fast hidden class
  private current_frame:O.ProcStackFrame = <any>undefined;

  private n_warp_iterations = 0;

  public constructor(
      private u:H.Util,
      private ohno:H.Ohno,
      private should_pretty_print:boolean,
      private tell_should_ensure_entity_exists:boolean,
      private should_report_current_running_block:boolean,
      private max_procedure_calls_per_interpreter_step:number,
      private max_warp_iterations_per_interpreter_step:number,
      private run_mgr:H.RuntimeManager,
      private block_pool:H.BlockPool,
      private program_cache:H.OptiProgramCache,
      private domain_functions:FunctionDict,

      private original_identities:T.Identities,
      private priorities:T.InterpreterPriorities,
      private program:O.OptiProgram,
      group_id:string|undefined,
      compiled_block:BLK.CompiledBlock,
      variable_specs:T.VariableSpecDict,
      is_warped:boolean,
      private action_parameters?:T.Dict<any>,
      private on_finished?:H.OnInterpreterFinished,
  ) {
    this.metadata = {
      priorities,
      original_identities,
      typeclass_id: original_identities.typeclass_id,
      interpreter_id: original_identities.interpreter_id,
      type: compiled_block.type,
      group_id,
    };
    this.root_block_type = compiled_block.type;
    this.root_block_id = original_identities.interpreter_id;

    for (const var_id in variable_specs) {
      this.variables[var_id] = variable_specs[var_id].value;
    }
    this.original_variables = _cloneDeep(this.variables);

    this.step_input_outputs = {
      ohno: this.ohno,
      call_domain_function: this.step_call_domain_function.bind(this),
      report_sync_telling: this.step_report_sync_telling.bind(this),
      async_tell: this.step_async_tell.bind(this),
    };

    this.step_outputs = {
      proc_call: this.step_call_procedure.bind(this),
      before_expression: this.step_before_expression.bind(this),
      after_potential_blocker: this.step_after_potential_blocker.bind(this),
      increment_program_counter: this.step_increment_program_counter.bind(this),
      reset_program_counter: this.step_reset_program_counter.bind(this),
      after_iteration: this.step_iteration_yield.bind(this),
      finished: this.step_finished.bind(this),
      proc_do_return_value: this.step_return_value.bind(this),
      proc_yield_after_call: this.step_yield_to_procedure.bind(this),
    };

    this.domain_function_util = {
      runtime_manager: this.run_mgr,
      add_user_procedure_call_to_stack: this.step_call_procedure.bind(this),
      get_action_parameter: this.get_action_parameter.bind(this),
    };

    this.programs[MAIN_PROGRAM_ID] = program;

    // reset must be called after this.program has been assigned
    this.reset(is_warped);
  }

  public reset(is_warped?:boolean) : void {
    // Apparently we don't reset variables?
    // this.variables = _.cloneDeep(this.original_variables);
    this.program_state = this.empty_state(this.original_identities.target_entity, is_warped || false);
  }

  private get_action_parameter(parameter_id:string) {
    if (this.action_parameters == undefined) {
      return undefined;
    }
    return this.action_parameters[parameter_id];
  }

  private step_call_procedure(
      function_id:T.ID,
      target_entity_id:T.ID,
      parameters:O.AnyStorage,
      proc_call_bid:T.ID,
      is_inside_warp:boolean,
  ) : void {
    // We won't modify the CompiledBlock structure, and want to use the rbid
    // as a canonic name for the procedure, so set do_clone arg to false.
    const procedure_container = this.run_mgr.get_procedure(function_id, false);
    if (procedure_container == undefined) {
      throw this.u.ohno.user.call_undefined_procedure({
        block_id: proc_call_bid,
      });
    }
    let procedure = this.programs[function_id];

    if (procedure == undefined) {
      // TODO pre-load all procedures when the main program is loaded?
      // (by walking the AST and checking for all function calls)
      procedure = this.program_cache.get_program(
          procedure_container.script.id,
          procedure_container.source_entity_id,
          procedure_container.script.id,
          this.original_identities.interpreter_id,
          procedure_container.script,
      );
      this.programs[function_id] = procedure;
    }

    const frame = this.empty_stack_frame(
        function_id,
        target_entity_id,
        procedure,
        is_inside_warp || this.current_frame.is_warped,
        parameters,
        procedure_container.source_entity_id,
        procedure_container.script.id,
        proc_call_bid,
    );
    this.program_state.proc_stack.push(frame);
    this.program_state.did_proc_yield = true;
  }

  private step_yield_to_procedure(
      yield_group_id:number,
      next_statement_id:number,
  ) : void {
    // A function was just called, which has its frame
    // on the top of the stack. We want to increment the
    // program counter for the frame that made that function
    // call.
    const stack = this.program_state.proc_stack;
    const prev_frame = stack[stack.length - 2];
    if (prev_frame != undefined) {
      prev_frame.program_counter[yield_group_id] = next_statement_id;
    }
  }

  private step_iteration_yield(is_inside_warp:boolean) : boolean {
    // This might return false within a warp block
    const is_warped = this.current_frame.is_warped || is_inside_warp;
    const should_yield = this.n_warp_iterations > this.max_warp_iterations_per_interpreter_step || !is_warped;
    if (should_yield == false) {
      this.n_warp_iterations++;
    }
    return should_yield;
  }

  private step_before_expression(
      block_id:T.ID,
      source_map_entity:T.ID,
      source_map_rbid:T.ID,
      yield_group_id:number,
      next_statement_id:number,
  ) : O.ShouldYield {

    if (this.should_report_current_running_block) {
      this.run_mgr.set_running_block(source_map_rbid, block_id);
    }

    this.current_frame.program_counter[yield_group_id] = next_statement_id;
    // should return true during breakpoint debugging
    return false;
  }

  private step_after_potential_blocker(
      block_id:T.ID,
      source_map_entity:T.ID,
      source_map_rbid:T.ID,
      yield_group_id:number,
      next_statement_id:number,
  ) : O.ShouldYield {
    // Same as step_before_expression, but does not have an associated
    // block_id, won't yield during breakpoint debugging, and will check
    // if a blocking task was spawned by the previous expression/statement.

    this.current_frame.program_counter[yield_group_id] = next_statement_id;
    const must_yield = this.run_mgr.current_interpreter_must_yield(this.root_block_id, this.metadata.group_id);
    return must_yield || this.program_state.did_proc_yield;
  }

  private step_increment_program_counter(
      source_map_entity:T.ID,
      source_map_rbid:T.ID,
      yield_group_id:number,
      next_statement_id:number,
  ) : void {
    // Same as step_before_expression, but does not have an associated
    // block_id, won't yield during breakpoint debugging
    this.current_frame.program_counter[yield_group_id] = next_statement_id;
  }

  private step_reset_program_counter(
      source_map_entity:T.ID,
      source_map_rbid:T.ID,
      yield_group_id:number,
  ) : void {
    // Similar to step_before_expression, but does not have an associated
    // block_id, won't yield during breakpoint debugging, sets pc group to 0
    this.current_frame.program_counter[yield_group_id] = 0;
  }

  private step_finished(
  ) : void {
    this.program_state.proc_stack.pop();
    this.current_frame = <any>undefined;
    this.program_state.proc_has_return_value = false;
    this.program_state.proc_return_value = undefined;
    this.program_state.did_proc_yield = true;

    if (this.program_state.proc_stack.length == 0) {
      this.program_state.did_proc_yield = false;
      this.program_state.finished = true;
      return;
    }
  }

  private step_return_value(
      block_id:T.ID,
      value:any,
  ) : void {
    if (value == undefined) {
      throw this.ohno.user.procedure_return_empty({
        block_id,
        root_block_id: this.current_frame.source_map_rbid,
        entity_id: this.current_frame.source_map_entity,
      });
    }
    const returning_frame = this.program_state.proc_stack.pop();
    this.current_frame = <any>undefined;
    this.program_state.proc_has_return_value = true;
    this.program_state.proc_return_value = value;
    this.program_state.did_proc_yield = true;
  }

  private step_call_domain_function(
      return_value_storage_id:string,
      function_id:string,
      block_id:T.ID,
      args:any,
      target_entity:T.ID,
  ) : any {
    if (this.domain_functions[function_id] == undefined) {
      throw this.ohno.system.missing_domain_function({
        block_id,
        block_type: function_id,
        root_block_id: this.current_frame.source_map_rbid,
        entity_id: this.current_frame.source_map_entity,
      });
    }
    let res:any;
    try {
      res = this.domain_functions[function_id](
          args,
          this.original_identities.interpreter_id,
          target_entity,
          this.domain_function_util,
      );
    } catch (e) {
      throw this.extend_domain_function_call_error(
          e,
          block_id,
          function_id,
          this.current_frame.source_map_rbid,
          this.current_frame.source_map_entity,
      );
    }
    if (res == undefined) { return; }
    if (typeof res.then == 'function') {
      // Got a promise
      const lock_handle = this.run_mgr.get_thread_lock(target_entity, this.original_identities.interpreter_id);
      const current_frame = this.current_frame;
      const run_mgr = this.run_mgr;
      const on_success = (res_val:any) => {
        current_frame.dynamic_data[return_value_storage_id] = res_val;
        lock_handle.stop();
      };
      const on_fail = (e:Error|Catastrophe) => {
        const error = this.extend_domain_function_call_error(
            e,
            block_id,
            function_id,
            current_frame.source_map_rbid,
            current_frame.source_map_entity,
        );
        run_mgr.report_error_and_stop(
            error,
            'OptiRunner domain function promise result handler',
        );
      };
      (<Promise<any>>res).then(on_success, on_fail);
    }
    this.current_frame.dynamic_data[return_value_storage_id] = res;
  }

  private extend_domain_function_call_error(
      e:Error|Catastrophe,
      block_id:T.ID,
      function_id:string,
      source_map_rbid:T.ID,
      source_map_entity:T.ID,
  ) : Catastrophe {
    const metadata = {
      block_id,
      block_type: function_id,
    };
    if (e instanceof Catastrophe) {
      e.annotation = e.annotation || {};
      _defaults(e.annotation, metadata);
      return e;
    }
    return this.ohno.system.unknown_error_in_domain_function_call(e, metadata);
  }

  private ensure_tell_target_ok(
    block_id:T.ID,
    target_entity:T.ID,
  ) : boolean {
    const entity_state = this.run_mgr.get_entity_state(target_entity);
    if (this.tell_should_ensure_entity_exists) {
      if (entity_state == T.EntityState.Destructing) {
        this.run_mgr.report_warning(this.ohno.warning.tell_with_destructing_entity({
          root_block_id: this.current_frame.source_map_rbid,
          entity_id: this.current_frame.source_map_entity,
          block_id,
          tell_entity: target_entity,
        }));
        return false;
      } else if (entity_state == T.EntityState.Disposed) {
        this.run_mgr.report_warning(this.ohno.warning.tell_with_disposed_entity({
          root_block_id: this.current_frame.source_map_rbid,
          entity_id: this.current_frame.source_map_entity,
          block_id,
          tell_entity: target_entity,
        }));
        return false;
      } else if (entity_state == T.EntityState.Unknown) {
        throw this.ohno.user.tell_with_unknown_entity({
          root_block_id: this.current_frame.source_map_rbid,
          entity_id: this.current_frame.source_map_entity,
          block_id,
          tell_entity: target_entity,
        });
      }
    }
    return true;
  }

  private step_async_tell(
    block_id:T.ID,
    target_entity:T.ID,
    new_target_entity:T.ID,
    is_inside_warp:boolean,
  ) : void {
    if (!this.ensure_tell_target_ok(block_id, target_entity)) { return; }
    this.run_mgr.spawn_async_tell_interpreter(
      {
        typeclass_id: this.original_identities.typeclass_id,
        interpreter_id: this.original_identities.interpreter_id,
        target_entity,
        source_map_entity: this.current_frame.source_map_entity,
        source_map_rbid: this.current_frame.source_map_rbid,
      },
      new_target_entity,
      this.current_frame.async_tell_asts[block_id],
      this.metadata.group_id,
      is_inside_warp,
    );
  }

  private step_report_sync_telling(
    block_id:T.ID,
    target_entity:T.ID,
  ) : void {
    this.ensure_tell_target_ok(block_id, target_entity);
  }

  private empty_stack_frame(
      id:string,
      target_entity_id:T.ID,
      program:O.OptiProgram,
      is_warped:boolean,
      proc_params?:O.AnyStorage,
      source_map_entity?:T.ID,
      source_map_rbid?:T.ID,
      proc_call_bid?:T.ID,
  ) : O.ProcStackFrame {
    // TODO PERF Use an Object Pool for stack frames
    const n_yield_groups = program.n_yield_groups;
    const program_counter:number[] = [];
    for (let i = 0; i < n_yield_groups; i++) {
      program_counter.push(0);
    }
    return {
      proc_id: id,
      proc_parameters: proc_params || {},
      program_counter,
      // It's important to pre-allocate the Array, otherwise we may get a sparse array
      // instead of a dense array, which is much slower on V8 // OliverUv
      dynamic_data: this.should_pretty_print ? {} : new Array(program.dynamic_data_size),
      target_entity_id,
      source_map_entity: source_map_entity || this.original_identities.source_map_entity,
      source_map_rbid: source_map_rbid || this.original_identities.source_map_rbid,
      async_tell_asts: program.async_tell_asts,
      proc_call_bid,
      is_warped,
    };
  }

  private empty_state(target_entity_id:T.ID, is_warped:boolean) : O.State {
    return {
      finished: false,
      proc_stack: [
        this.empty_stack_frame(
            MAIN_PROGRAM_ID,
            target_entity_id,
            this.program,
            is_warped,
        ),
      ],
      proc_has_return_value: false,
      proc_return_value: undefined,
      did_proc_yield: false,
    };
  }

  private get_step_args(
      frame:O.ProcStackFrame,
      static_data:O.AnyStorage,
  ) : O.StepArgs {
    // Read by compiled code
    const inputs:O.StepInputs = {
      identities: this.original_identities,
      default_target_entity_id: frame.target_entity_id,
      static_data,
      proc_parameters: frame.proc_parameters,
      proc_return_value: this.program_state.proc_return_value,
      proc_has_return_value: this.program_state.proc_has_return_value,
    };

    // Inherit source maps from frame
    inputs.identities.source_map_entity = frame.source_map_entity;
    inputs.identities.source_map_rbid = frame.source_map_rbid;

    // Read and potentially written by compiled code
    const state:O.StepState = {
      dynamic_data: frame.dynamic_data,
      program_counter: frame.program_counter,
    };

    // Compiled code may call these functions to signal
    // state changes
    const outputs:O.StepOutputs = this.step_outputs;

    if (this.should_pretty_print) {
      return {
        // StepInputOutput
        ohno: this.step_input_outputs.ohno,
        call_domain_function: this.step_input_outputs.call_domain_function,
        report_sync_telling: this.step_input_outputs.report_sync_telling,
        async_tell: this.step_input_outputs.async_tell,

        // StepInputs
        default_target_entity_id: inputs.default_target_entity_id,
        identities: inputs.identities,
        static_data: inputs.static_data,

        // Procedure StepInputs
        proc_parameters: inputs.proc_parameters,
        proc_return_value: inputs.proc_return_value,
        proc_has_return_value: inputs.proc_has_return_value,

        // Procedure StepOutputs
        proc_do_return_value: outputs.proc_do_return_value,
        proc_yield_after_call: outputs.proc_yield_after_call,

        // StepState
        dynamic_data: state.dynamic_data,
        program_counter: state.program_counter,

        // StepOutputs
        proc_call: outputs.proc_call,
        before_expression: outputs.before_expression,
        after_potential_blocker: outputs.after_potential_blocker,
        increment_program_counter: outputs.increment_program_counter,
        reset_program_counter: outputs.reset_program_counter,
        after_iteration: outputs.after_iteration,
        finished: outputs.finished,
      };
    }
    return <any>{
      // StepInputOutput
      AA: this.step_input_outputs.ohno,
      AB: this.step_input_outputs.call_domain_function,
      AC: this.step_input_outputs.report_sync_telling,
      AD: this.step_input_outputs.async_tell,

      // StepInputs
      BA: inputs.default_target_entity_id,
      BB: inputs.identities,
      BC: inputs.static_data,

      // Procedure StepInputs
      CA: inputs.proc_parameters,
      CB: inputs.proc_return_value,
      CC: inputs.proc_has_return_value,
      // Procedure StepOutputs
      CD: outputs.proc_do_return_value,
      CE: outputs.proc_yield_after_call,

      // StepState
      DA: state.dynamic_data,
      DB: state.program_counter,

      // StepOutputs
      EA: outputs.proc_call,
      EB: outputs.before_expression,
      EC: outputs.after_potential_blocker,
      ED: outputs.increment_program_counter,
      EE: outputs.reset_program_counter,
      EF: outputs.after_iteration,
      EG: outputs.finished,
    };
  }

  public step() : T.StepResult {
    let n_procedure_calls = 0;
    while (true) {
      const step_res = this.do_step();
      if (step_res != undefined) {
        // Yielded or finished
        return step_res;
      }
      // Yielded when making a procedure call, do we just step
      // into it or do we yield to other interpreters?
      n_procedure_calls++;
      if (n_procedure_calls >= this.max_procedure_calls_per_interpreter_step) {
        return T.StepResult.yielding;
      }
    }
  }

  private do_step() : T.StepResult | undefined {

    const frame = peek(this.program_state.proc_stack);
    if (frame == undefined) {
      throw this.ohno.system.procedure_popped_empty_call_stack({
        // best guess, could be wrong if we were in a procedure,
        // or if we're in a tell block, or similar
        root_block_id: this.original_identities.source_map_rbid,
        entity_id: this.original_identities.source_map_entity,
      });
    }
    this.current_frame = frame;

    this.n_warp_iterations = 0;

    this.program_state.did_proc_yield = false;

    const program = this.programs[frame.proc_id];
    const args = this.get_step_args(frame, program.static_data);

    this.run_mgr.set_current_interpreter_not_blocked();
    try {
      program.script(args);
    } catch (e) {
      const metadata = {
        interpreter_id: this.original_identities.interpreter_id,
        interpreter_stack: this.get_current_stack(),
      };
      if (e instanceof Catastrophe) {
        e.annotation = e.annotation || {};
        _defaults(e.annotation, metadata);
        throw e;
      }
      throw this.ohno.system.unknown_system_error(e, metadata);
    }

    if (this.program_state.finished) {
      if (this.on_finished !== undefined) {
        this.on_finished(this.original_identities.source_map_rbid);
      }
      return T.StepResult.finished;
    }
    if (this.program_state.did_proc_yield == false) {
      // We yielded after completing one iteration of a loop
      return T.StepResult.yielding;
    }

    // Script yielded to call a function or return from a
    // function and should therefore continue execution
    // instead of yielding to other runners / env.

    return undefined; // Recurse using the wrapper!
  }

  public get_current_stack() : T.RuntimeStackMetadata[] {
    const frame_stack = this.program_state.proc_stack;
    const stack = [];
    for (let i = 0; i < frame_stack.length; i++) {
      const current_frame = frame_stack[i];
      stack.push({
        interpreter_id: this.original_identities.interpreter_id,
        source_entity_id: current_frame.source_map_entity,
        source_map_rbid: current_frame.source_map_rbid,
        block_id: (i === frame_stack.length - 1) ? undefined : frame_stack[i + 1].proc_call_bid,
        proc_parameters: _cloneDeep(current_frame.proc_parameters),
        proc_id: (current_frame.proc_id === MAIN_PROGRAM_ID) ? undefined : current_frame.proc_id,
      });
    }

    return stack;
  }

  public dispose() {
    // Do nothing, since we don't take ownership of the script ast
  }

  public set_variable(name:string, value:any) : void {
    this.variables[name] = value;
  }

  public get_variable(name:string) : any {
    return this.variables[name];
  }

  public get_variables() : T.VariableStore {
    return this.variables;
  }

}
