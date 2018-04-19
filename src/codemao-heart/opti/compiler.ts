import _defaults from 'lodash/defaults';
import _sortBy from 'lodash/sortBy';
import _identity from 'lodash/identity';
import _flattenDeep from 'lodash/flattenDeep';
import _isString from 'lodash/isString';
import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import * as BLK from '../block_types';
import * as H from '../di_interfaces';
import * as O from './types';
import { BINDING } from '../di_symbols';
import {
  ID,
} from '../basic_types';

// The motivation behind building this compiler / runner infrastructure
// instead of using Blockly's built in compilation methods is:
//
// * Must not allow user supplied data into calls to eval / new Function
// * Can't afford running within a JSInterpreter sandbox (too slow)
// * This method reduces self time from 5.3% to about 1.3% compared with
//   walking the CompiledBlock AST. (75% reduction, as measured on the
//   "bad_perf_on_phone" project.)
// * This method makes serializing and deserializing state a lot easier
//   compared to making invasive changes in the CompiledBlock AST
//
// We therefore compile everything to JS by ourselves, and put user supplied
// data into the static_data dictionary, which we access from the compiled
// code.
//
// The state of an interpreter is now separated from the compiled function.
// We therefore avoid having to clone trees of CompiledBlock objects.

// NOTE: We use array.join with many individual strings instead of template
// strings or string addition. This is because template strings compile to join
// strings with the addition operator, which quickly becomes too slow when
// you're adding a LOT of strings together, as we do here. (Same memory
// allocation method as when std::vector in C++ needs to allocate new memory)

// This is a hack to encode the recursive `type Str = (string|Str)[]`
// which would match ['one', 'two'], or ['one', ['two', 'three']], or
// ['zero', [['one', two'], 'three'], [[['four']]]]
type Str = string|NestedRecurse;
interface NestedRecurse extends Array<Str> {}

type Statements = {
  state:State;
  statements:Str;
};

interface Expression {
  state:State;
  pre:Str; // this may be any number of statements
  expr:Str; // this may return a value, should be only one statement/expression
}

interface Params {
  state:State;
  dynamic_data_id:string;
  statements:Str;
}

function peek<T>(stack:T[]) : T | undefined {
  if (stack.length == 0) { return undefined; }
  return stack[stack.length - 1];
}

interface Keywords {
  ohno:string;
  call_domain_function:string;
  report_sync_telling:string;
  async_tell:string;

  default_target_entity_id:string;
  identities:string;
  program_counter:string;
  static_data:string;

  proc_parameters:string;
  proc_return_value:string;
  proc_has_return_value:string;
  proc_do_return_value:string;
  proc_yield_after_call:string;

  dynamic_data:string;

  proc_call:string;
  before_expression:string;
  after_potential_blocker:string;
  increment_program_counter:string;
  reset_program_counter:string;
  after_iteration:string;
  finished:string;
}

const SHORT_KEYWORDS:Keywords = {
  ohno: 'X.AA',
  call_domain_function: 'X.AB',
  report_sync_telling: 'X.AC',
  async_tell: 'X.AD',

  default_target_entity_id: 'X.BA',
  identities: 'X.BB',
  static_data: 'X.BC',

  proc_parameters: 'X.CA',
  proc_return_value: 'X.CB',
  proc_has_return_value: 'X.CC',
  proc_do_return_value: 'X.CD',
  proc_yield_after_call: 'X.CE',

  dynamic_data: 'X.DA',
  program_counter: 'X.DB',

  proc_call: 'X.EA',
  before_expression: 'X.EB',
  after_potential_blocker: 'X.EC',
  increment_program_counter: 'X.ED',
  reset_program_counter: 'X.EE',
  after_iteration: 'X.EF',
  finished: 'X.EG',
};

const PRETTY_KEYWORDS:Keywords = {
  // StepInputOutput
  ohno: 'X.ohno',
  call_domain_function: 'X.call_domain_function',
  report_sync_telling: 'X.report_sync_telling',
  async_tell: 'X.async_tell',

  // StepInputs
  default_target_entity_id: 'X.default_target_entity_id',
  identities: 'X.identities',
  static_data: 'X.static_data',

  // Procedure StepInputs
  proc_parameters: 'X.proc_parameters',
  proc_return_value: 'X.proc_return_value',
  proc_has_return_value: 'X.proc_has_return_value',

  // Procedure StepOutputs
  proc_do_return_value: 'X.proc_do_return_value',
  proc_yield_after_call: 'X.proc_yield_after_call',

  // StepState
  dynamic_data: 'X.dynamic_data',
  program_counter: 'X.program_counter',

  // StepOutputs
  proc_call: 'X.proc_call',
  before_expression: 'X.before_expression',
  after_potential_blocker: 'X.after_potential_blocker',
  increment_program_counter: 'X.increment_program_counter',
  reset_program_counter: 'X.reset_program_counter',
  after_iteration: 'X.after_iteration',
  finished: 'X.finished',
};

/**
 * State of the compiler, while it is compiling a single AST.
 * It's passed back and forth between functions, but it actually doesn't need
 * to be passed back. Sorry.
 */
class State {
  public constructor(
    private ohno:H.Ohno,
    public source_map_entity:ID,
    public source_map_rbid:ID,
    private pretty_print_symbols:boolean,
  ) {
    this.keyword = pretty_print_symbols ? PRETTY_KEYWORDS : SHORT_KEYWORDS;
    this.static_data = pretty_print_symbols ? {} : [];
  }

  private keyword:Keywords;

  private current_yield_group:number = 0;
  private top_yield_group_id = 0;
  private top_yield_ids:{[yield_group:number]:number} = {0:0};
  private yield_group_stack:number[] = [];

  /**
   * When we break out of a loop, we are often breaking out
   * of multiple levels of yield groups (one per scope block).
   * We need to reset all of those in case there's an outer
   * loop which makes us re-enter them. For this, we maintain
   * one stack of yield group ids, one list of ids per nested
   * loop.
   */
  private break_yield_reset_stack:(number[])[] = [[]];

  // If empty we are not inside a tell block. Otherwise
  // we're inside some level of tell blocks. Stores the
  // key of the dynamic_data value which holds the
  // id of the entity_target
  private tell_entity_target_stack:Str[] = [];

  private top_break_id = 0;
  private break_id_stack:string[] = [];
  private n_warp_block_parents:number = 0;

  private top_parameter_id = 0;
  private top_static_data_id = 0;
  private static_data:O.AnyStorage;

  private async_tell_asts:{[block_id:string]:BLK.CompiledBlock} = {};

  public gen_parameter_symbol(name:string) : string {
    this.top_parameter_id++;
    const prefix = this.pretty_print_symbols ? name : '';
    return prefix + this.top_parameter_id;
  }

  public set_static(name:string, value:any) : string {
    this.top_static_data_id++;
    if (this.pretty_print_symbols) {
      const symbol = [name, <any>this.top_static_data_id].join('');
      this.static_data[symbol] = value;
      return symbol;
    }
    this.static_data[this.top_static_data_id] = value;
    return this.top_static_data_id.toString();
  }

  public get_static_data() {
    return this.static_data;
  }

  public dynamic_data_size() {
    return this.top_parameter_id + 1;
  }

  public push_yield_level(block:BLK.CompiledBlock) : Str {
    this.yield_group_stack.push(this.current_yield_group);
    this.top_yield_group_id++;
    const next_id = this.top_yield_group_id;
    this.current_yield_group = next_id;
    this.top_yield_ids[next_id] = 0;
    const break_yrs = peek(this.break_yield_reset_stack);
    if (break_yrs == undefined) {
      throw this.ohno.compiler.system.popped_empty_yield_reset_stack({
        block,
      });
    }
    break_yrs.push(next_id);
    return [
      `switch (`, this.keyword.program_counter, `[`,
      next_id.toString(),
      `]) {case 0:`,
    ];
  }

  public pop_yield_level(block:BLK.CompiledBlock) : Str {
    const group_id = this.yield_group_stack.pop();
    if (group_id == undefined) {
      throw this.ohno.compiler.system.popped_empty_yield_group_stack({
        block,
      });
    }
    this.current_yield_group = group_id;
    const break_yrs = peek(this.break_yield_reset_stack);
    if (break_yrs == undefined) {
      throw this.ohno.compiler.system.popped_empty_yield_group_stack({
        block,
      });
    }
    break_yrs.pop();
    return `}`;
  }

  public push_breakable() : string {
    this.break_yield_reset_stack.push([]);
    const n = this.top_break_id++;
    const break_id = 'B' + n;
    this.break_id_stack.push(break_id);
    return break_id;
  }

  public pop_breakable() : void {
    this.break_id_stack.pop();
    this.break_yield_reset_stack.pop();
  }

  public get_current_break_reset_statements(block:BLK.CompiledBlock) : Str {
    const break_yrs = peek(this.break_yield_reset_stack);
    if (break_yrs == undefined) {
      throw this.ohno.compiler.system.popped_empty_yield_reset_stack({
        block,
      });
    }
    const breakers:string[] = [];
    for (let i = 0; i < break_yrs.length; i++) {
      const group = break_yrs[i];
      breakers.push(this.keyword.program_counter, `[`, group.toString(), `] = 0;`);
    }

    return breakers;
  }

  public push_target_entity(accessor:Str) : void {
    this.tell_entity_target_stack.push(accessor);
  }

  public pop_target_entity() : void {
    this.tell_entity_target_stack.pop();
  }

  public current_target_entity() : Str {
    const accessor = peek(this.tell_entity_target_stack);
    if (accessor == undefined) {
      // Default to whatever is the target entity for this stack frame
      return this.keyword.default_target_entity_id;
    }
    // Otherwise we're in a tell block
    return accessor;
  }

  public current_break_id(block:BLK.BreakBlock) : string {
    const id = peek(this.break_id_stack);
    if (id == undefined) {
      throw this.ohno.compiler.user.tried_to_break_outside_of_loop({
        block: block,
      });
    }
    return id;
  }

  public create_yield_point() : Str {
    this.top_yield_ids[this.current_yield_group]++;
    const n = this.top_yield_ids[this.current_yield_group];
    return [
      this.keyword.increment_program_counter, `('`,
      this.source_map_entity,
      `', '`,
      this.source_map_rbid,
      `', `,
      this.current_yield_group.toString(),
      `, `,
      n.toString(),
      `); case `, n.toString(), `: `,
    ];
  }

  public create_before_expression_yield_point(
      ast:BLK.CompiledBlock,
  ) : Str {
    this.top_yield_ids[this.current_yield_group]++;
    const n = this.top_yield_ids[this.current_yield_group];
    return [
      `if (`, this.keyword.before_expression, `('`,
      ast.id,
      `', '`,
      this.source_map_entity,
      `', '`,
      this.source_map_rbid,
      `', `,
      this.current_yield_group.toString(),
      `, `,
      n.toString(),
      `)) { return; }`,
      `case `, n.toString(), `: `,
    ];
  }

  public create_after_potential_blocker_yield_point(
      ast:BLK.CompiledBlock,
  ) : Str {
    this.top_yield_ids[this.current_yield_group]++;
    const n = this.top_yield_ids[this.current_yield_group];
    return [
      `if (`, this.keyword.after_potential_blocker, `('`,
      ast.id,
      `', '`,
      this.source_map_entity,
      `', '`,
      this.source_map_rbid,
      `', `,
      this.current_yield_group.toString(),
      `, `,
      n.toString(),
      `)) { return; }`,
      `case `, n.toString(), `: `,
    ];
  }

  public create_iteration_yield_point() : Str {
    return [
      `if (`, this.keyword.after_iteration, `(`, this.is_inside_warp().toString(), `)) { return; }`,
    ];
  }

  public create_yield_reset_point() : Str {
    return [
      this.keyword.reset_program_counter, `('`,
      this.source_map_entity,
      `', '`,
      this.source_map_rbid,
      `', `,
      this.current_yield_group.toString(),
      `);`,
    ];
  }

  public create_procedure_yield_point() : Str {
    this.top_yield_ids[this.current_yield_group]++;
    const n = this.top_yield_ids[this.current_yield_group];
    return [
      this.keyword.proc_yield_after_call, `(`,
      this.current_yield_group.toString(),
      `, `,
      n.toString(),
      `); return;`,
      `case `, n.toString(), `: `,
    ];
  }

  public get_n_yield_groups() : number {
    return 1 + this.top_yield_group_id;
  }

  public add_async_tell_ast(ast:BLK.CompiledBlock) : void {
    this.async_tell_asts[ast.id] = ast;
  }

  public get_async_tell_asts() {
    return this.async_tell_asts;
  }

  public is_inside_warp() : boolean {
    return this.n_warp_block_parents >= 1;
  }

  public enter_warp_block() : void {
    this.n_warp_block_parents++;
  }

  public exit_warp_block() : void {
    this.n_warp_block_parents--;
  }

}

@injectable()
export class OptiCompilerImpl implements H.OptiCompiler {

  private deterministic:boolean;
  private should_pretty_print!:boolean;
  private keyword!:Keywords;

  public constructor(
      @inject(BINDING.BlockPool) private block_pool:H.BlockPool,
      @inject(BINDING.BlockRegistry) private block_registry:H.BlockRegistry,
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.Log) private log:H.Logger,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.PRNGFactory) private prng_factory:H.PRNGFactory,
      @inject(BINDING.Util) private u:H.Util,
      @inject(BINDING.BlockUtil) private block:H.BlockUtil,
      @inject(BINDING.Config) private config:H.Config,
  ) {
    this.deterministic = u.config.get().deterministic != undefined;
    const configure = () => {
      this.should_pretty_print = false;
      const cfg = this.config.get().opti_compiler;
      if (cfg != undefined) {
        this.should_pretty_print = cfg.pretty_print;
      }
      this.keyword = this.should_pretty_print ? PRETTY_KEYWORDS : SHORT_KEYWORDS;
    };
    configure();
    this.event_bus.system.config_updated.immediate.sub(configure);
  }

  private create_catch_all_error(
      location:string,
      error:Error|Catastrophe,
      ast?:BLK.CompiledBlock,
  ) : Catastrophe {
    const metadata:any = {
      caught_at: location,
    };
    if (ast != undefined) { metadata.block = ast; }
    if (error instanceof Catastrophe) {
      error.annotation = error.annotation || {};
      _defaults(error.annotation, metadata);
      return error;
    }
    return this.ohno.compiler.system.unknown_compiler_error(error, metadata);
  }

  public compile(
      source_map_entity:ID,
      source_map_rbid:ID,
      interpreter_id:ID,
      ast:BLK.CompiledBlock,
  ) : O.OptiProgram {
    let code:string;
    let static_data:O.AnyStorage;
    let dynamic_data_size:number;
    let n_yield_groups:number;
    let async_tell_asts:{[block_id:string]:BLK.CompiledBlock};
    try {
      let state = new State(
          this.ohno,
          source_map_entity,
          source_map_rbid,
          this.should_pretty_print,
      );
      const s = this.compile_statement(state, ast);
      const r = this.wrap_with_top_level(s);
      state = r.state;
      code = _flattenDeep(r.statements).join('');
      static_data = state.get_static_data();
      dynamic_data_size = state.dynamic_data_size();
      n_yield_groups = state.get_n_yield_groups();
      async_tell_asts = state.get_async_tell_asts();
    } catch (e) {
      const metadata = {
        block: ast,
        interpreter_id: interpreter_id,
        source_map_rbid,
        source_entity_id: source_map_entity,
        proc_id: (this.block.is.procedures_defnoreturn(ast)) ? ast.procedure_name : undefined,
      };
      if (e instanceof Catastrophe) {
        const annotation = e.annotation || {};
        _defaults(annotation, metadata);
        if (annotation.block_id == undefined && annotation.block != undefined) {
          annotation.block_id = annotation.block.id;
        }
        if (annotation.block_type == undefined && annotation.block != undefined) {
          annotation.block_type = annotation.block.type;
        }
        e.annotation = annotation;
        throw e;
      }
      throw this.ohno.compiler.system.unknown_compiler_error(e, metadata);
    }

    let optifun:O.CompiledAST;

    try {
      optifun = <O.CompiledAST>new Function(
          'X', // :StepArgs
          code,
      )(); // the () comes from the hack to get named function for perf measurement
    } catch (e) {
      throw this.ohno.compiler.system.constructed_bad_javascript(e, {
        root_block_id: source_map_rbid,
        entity_id: source_map_entity,
        invalid_script: code,
      });
    }

    return {
      script: optifun,
      static_data,
      dynamic_data_size,
      n_yield_groups,
      async_tell_asts,
    };
  }

  private wrap_with_top_level(
      program:Statements,
  ) : Statements {
    const program_statements = program.statements;
    const state = program.state;
    // The last yield point is needed to ensure that if the last block is one
    // that spawns a task, which we must wait to finish, then we must not
    // immediately cause finished, which causes the runtime_manager to assume
    // we are done, which disposes all tasks.
    const last_yield = state.create_yield_point();
    // TODO PERF Check if we could gain perf by just referencing a dict in non-pp mode instead
    const statements = [
      `return function optifun(X) {`, // hack to get a named function for perf measurement
      `switch (`, this.keyword.program_counter, `[0]) {`,
      `case 0: `,
      program.statements,
      last_yield,
      this.keyword.finished, `();`,
      `}}`,
    ];
    return {
      statements,
      state,
    };
  }

  private compile_statement(
      state:State,
      ast?:BLK.CompiledBlock,
  ) : Statements {
    try {
      if (ast == undefined) {
        return {
          state,
          statements: '',
        };
      }

      const res:Str = [];
      res.push(state.create_before_expression_yield_point(ast));

      let omit_semicolon = false;
      let omit_next = false;

      if (ast.disabled) {
        if (ast.next_block != undefined && omit_next == false) {
          const r = this.compile_statement(state, ast.next_block);
          state = r.state;
          res.push(r.statements);
        }

        return {
          state: state,
          statements: res,
        };
      }

      if (this.block.is.repeat_forever(ast)) {
        omit_semicolon = true;
        const r = this.compile_repeat_forever(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.repeat_forever_until(ast)) {
        omit_semicolon = true;
        const r = this.compile_repeat_forever_until(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.wait_until(ast)) {
        omit_semicolon = true;
        const r = this.compile_wait_until(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.repeat_n_times(ast)) {
        omit_semicolon = true;
        const r = this.compile_repeat_n_times(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.break(ast)) {
        const r = this.compile_break(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.procedures_defnoreturn(ast)) {
        const body = ast.child_block[0];
        if (body == undefined) {
          // Do nothing if no procedure body
          omit_semicolon = true;
        } else {
          const r = this.compile_statement(state, body);
          state = r.state;
          res.push(r.statements);
        }

      } else if (this.block.is.procedures_callnoreturn(ast)) {
        const r = this.compile_procedure_call(state, ast);
        state = r.state;
        res.push(r.pre);

      } else if (this.block.is.cond_block(ast)) {
        omit_semicolon = true;
        const r = this.compile_conditional(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.async_tell(ast)) {
        omit_semicolon = true;
        const r = this.compile_async_tell(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.sync_tell(ast)) {
        omit_semicolon = true;
        const r = this.compile_sync_tell(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.warp(ast)) {
        omit_semicolon = true;
        const r = this.compile_warp(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.event_block(ast)) {
        omit_semicolon = true;
        const r = this.compile_event(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.responder_block(ast)) {
        omit_semicolon = true;
        const r = this.compile_responder(state, ast);
        state = r.state;
        res.push(r.statements);

      } else if (this.block.is.procedures_return_value(ast)) {
        omit_semicolon = true;
        omit_next = true;
        const r = this.compile_procedure_return_value(state, ast);
        state = r.state;
        res.push(r.statements);

      } else {
        const r = this.compile_expression(state, <any>ast);
        state = r.state;
        res.push(r.pre);
        res.push(r.expr);
      }

      if (res.length != 0 && omit_semicolon == false) {
        res.push(`;`);
      }

      if (ast.next_block != undefined && omit_next == false) {
        const r = this.compile_statement(state, ast.next_block);
        state = r.state;
        res.push(r.statements);
      }

      return {
        state: state,
        statements: res,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_statement',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_expression(
      state:State,
      ast:BLK.Expression,
  ) : Expression {
    // TODO Create a block type for atomic blocks?
    if (ast.disabled) {
      throw this.ohno.compiler.user.disabled_param(new Error(), {
        block: ast,
      });
    }
    try {
      if (this.block.is.atomic_type(ast.type)) {
        // TODO block_interpreter.ts will also check if ast itself is a number|string|x
        const static_value = ast.params[Object.keys(ast.params)[0]];
        const static_symbol = state.set_static(
            `${ast.type}__${ast.id}`,
            static_value,
        );
        return {
          pre: '',
          expr: this.opt_static(static_symbol),
          state,
        };
      }
    } catch (e) {
      throw this.ohno.compiler.user.error_constructing_value_from_atomic_block(e, {
        block: ast,
      });
    }

    try {
      if (this.block.is.logic_empty(ast)) {
        return this.compile_logic_empty(state, ast);
      }

      const before_expression_yield = state.create_before_expression_yield_point(ast);

      let res;

      if (this.block.is.procedures_callreturn(ast)) {
        res = this.compile_procedure_call(state, ast);

      } else if (this.block.is.procedures_parameter(ast)) {
        res = this.compile_procedure_parameter(state, ast);

      } else if (this.block.is.domain_block(ast)) {
        res = this.compile_domain_functions(state, ast);

      } else {
        const block:BLK.CompiledBlock = <any>ast;
        throw this.ohno.compiler.system.unknown_expression({
          unknown_expression_type: block.type,
          block,
        });
      }

      return {
        state: res.state,
        pre: [before_expression_yield, res.pre],
        expr: res.expr,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_expression',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_conditional(
      state:State,
      ast:BLK.CondBlock,
  ) : Statements {
    try {
      if (ast.child_block.length == 0 || ast.conditions.length == 0) {
        return {
          state,
          statements: '',
        };
      }

      const r:Str = [];
      const matched_id = state.gen_parameter_symbol(`if_matched`);
      const matched_param = this.opt_params(matched_id);
      r.push(state.create_yield_point());
      r.push(matched_param, ` = false;`);

      const compile_branch = (branch:BLK.MaybeBlock) : Str => {
        if (branch == undefined) {
          return [];
        }
        const r_branch:Str = [];
        r_branch.push(state.push_yield_level(ast));
        const branch_comp = this.compile_statement(state, branch);
        state = branch_comp.state;
        r_branch.push(branch_comp.statements);
        r_branch.push(state.create_yield_reset_point());
        r_branch.push(state.pop_yield_level(ast));
        return r_branch;
      };

      for (let i = 0; i < ast.conditions.length; i++) {
        const cond = ast.conditions[i];
        const branch = ast.child_block[i];

        if (cond == undefined) { continue; }

        const cond_id = state.gen_parameter_symbol(`if_cond${i}_`);
        const cond_param = this.opt_params(cond_id);

        const cond_push = state.push_yield_level(ast);
        const r_cond = this.compile_expression(state, <any>cond);
        state = r_cond.state;
        const cond_reset = state.create_yield_reset_point();
        const cond_pop = state.pop_yield_level(ast);

        const pre_yield = state.create_yield_point();
        const r_branch = compile_branch(branch); // updates state
        const post_yield = state.create_yield_point();

        r.push(
            `if (!`,
            matched_param,
            `) {`,
            cond_push,
            r_cond.pre,
            cond_reset,
            cond_pop,
            `}`,
        );

        r.push(
            cond_param,
            ` = !`, matched_param, ` && `,
            r_cond.expr,
            `;`);

        r.push(matched_param, ` = `, matched_param, ` || `, cond_param, `;`);

        r.push(pre_yield);

        r.push(
            `if (`, cond_param, `) {`,
            r_branch,
            `}`,
        );

        r.push(post_yield);
      }

      const else_branch = ast.child_block[ast.conditions.length];
      if (else_branch != undefined) {
        const r_branch = compile_branch(else_branch);
        r.push(
            `if (!`, matched_param, `) {`,
            r_branch,
            `}`,
        );
      }

      return {
        state,
        statements: r,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_conditional',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_sync_tell(
      state:State,
      ast:BLK.SyncTellBlock,
  ) : Statements {
    try {
      if (ast.child_block[0] == undefined) {
        return {
          state,
          statements: '',
        };
      }

      const params = this.compile_params(
        state,
        `__sync_tell_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const target_id_param = [this.opt_params(params.dynamic_data_id), `['sprite']`];

      state.push_target_entity(target_id_param);

      const body = this.compile_statement(state, ast.child_block[0]);
      state = body.state;

      state.pop_target_entity();

      const statements = [
        params.statements,
        this.keyword.report_sync_telling, `('`, ast.id, `', `, target_id_param, `);`,
        body.statements,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_sync_tell',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_warp(
      state:State,
      ast:BLK.WarpBlock,
  ) : Statements {
    try {
      if (ast.child_block[0] == undefined) {
        return {
          state,
          statements: '',
        };
      }

      state.enter_warp_block();

      const body = this.compile_statement(state, ast.child_block[0]);
      state = body.state;

      state.exit_warp_block();

      return {
        state,
        statements: body.statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_warp',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_async_tell(
      state:State,
      ast:BLK.TellBlock,
  ) : Statements {
    try {
      const tell_child = ast.child_block[0];
      if (tell_child == undefined) {
        return {
          state,
          statements: '',
        };
      }

      state.add_async_tell_ast(tell_child);

      const params = this.compile_params(
        state,
        `__async_tell_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const target_id_param = [this.opt_params(params.dynamic_data_id), `['sprite']`];

      // TODO in compile_async_tell, instead of tell_child.id, send ast.id
      // it's used to report errors about the tell entity not existing in ensure_tell_target_ok

      const statements = [
        params.statements,
        this.keyword.async_tell,
        `('`,
        tell_child.id,
        `', `,
        state.current_target_entity(),
        `, `,
        target_id_param,
        `, `,
        state.is_inside_warp().toString(),
        `);`,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_async_tell',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_repeat_forever(
      state:State,
      ast:BLK.RepeatForeverBlock,
  ) : Statements {
    try {
      if (ast.child_block[0] == undefined) {
        return {
          state,
          statements: '',
        };
      }
      const break_id = state.push_breakable();
      const push = state.push_yield_level(ast);
      const r = this.compile_statement(state, ast.child_block[0]);
      state = r.state;
      const yield_reset = state.create_yield_reset_point();
      const iter_yield = state.create_iteration_yield_point();
      const pop = state.pop_yield_level(ast);
      state.pop_breakable();
      const statements = [
        break_id, `: while (true) {`,
          push,
          r.statements,
          yield_reset,
          iter_yield,
          pop,
        `}`,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_repeat_forever',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_repeat_forever_until(
      state:State,
      ast:BLK.RepeatForeverUntilBlock,
  ) : Statements {
    try {
      if (ast.child_block[0] == undefined) {
        return {
          state,
          statements: '',
        };
      }
      const break_id = state.push_breakable();
      const push = state.push_yield_level(ast);
      const params = this.compile_params(
        state,
        `__repeat_forever_until_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const cond_param = [this.opt_params(params.dynamic_data_id), `['condition']`];
      const break_reset = state.create_yield_reset_point();

      const r = this.compile_statement(state, ast.child_block[0]);
      state = r.state;
      const yield_reset = state.create_yield_reset_point();
      const iter_yield = state.create_iteration_yield_point();
      const pop = state.pop_yield_level(ast);
      state.pop_breakable();
      const statements = [
        break_id, `: while (true) {`,
        push,
        params.statements,
        `if (`, cond_param, `) {`, break_reset, `break `, break_id, `;}`,
        r.statements,
        yield_reset,
        iter_yield,
        pop,
        `}`,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_repeat_forever_until',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_repeat_n_times(
      state:State,
      ast:BLK.RepeatNTimesBlock,
  ) : Statements {
    try {
      if (ast.child_block[0] == undefined) {
        return {
          state,
          statements: '',
        };
      }
      const params = this.compile_params(
        state,
        `__repeat_n_times_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const break_id = state.push_breakable();
      const push = state.push_yield_level(ast);
      const iter_param = [this.opt_params(params.dynamic_data_id), `['times']`];
      const break_reset = state.create_yield_reset_point();
      const r = this.compile_statement(state, ast.child_block[0]);
      state = r.state;
      const yield_reset = state.create_yield_reset_point();
      const iter_yield = state.create_iteration_yield_point();
      const pop = state.pop_yield_level(ast);
      state.pop_breakable();
      const statements = [
        params.statements,
        break_id, `: while (true) {`,
        push,
        `if (`, iter_param, ` <= 0) {`, break_reset, `break `, break_id, `;}`,
        iter_param, `--;`,
        r.statements,
        yield_reset,
        iter_yield,
        pop,
        `}`,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_repeat_n_times',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_wait_until(
      state:State,
      ast:BLK.WaitUntilBlock,
  ) : Statements {
    try {
      const break_id = state.push_breakable();
      const push = state.push_yield_level(ast);
      const params = this.compile_params(
        state,
        `__wait_until_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const cond_param = [this.opt_params(params.dynamic_data_id), `['condition']`];
      const break_reset = state.create_yield_reset_point();
      const yield_reset = state.create_yield_reset_point();
      const iter_yield = state.create_iteration_yield_point();
      const pop = state.pop_yield_level(ast);
      state.pop_breakable();
      const statements = [
        break_id, `: while (true) {`,
        push,
        params.statements,
        `if (`, cond_param, `) {`, break_reset, `break `, break_id, `;}`,
        yield_reset,
        iter_yield,
        pop,
        `}`,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_wait_until',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_break(
      state:State,
      ast:BLK.BreakBlock,
  ) : Statements {
    try {
      const statements = [
        state.get_current_break_reset_statements(ast),
        state.create_yield_reset_point(),
        `break `, state.current_break_id(ast), `;`,
      ];
      return {
        state,
        statements,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_break',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_logic_empty(
      state:State,
      ast:BLK.LogicEmptyBlock,
  ) : Expression {
    try {
      return {
        state,
        pre: [],
        expr: ['false'],
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_logic_empty',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_domain_functions(
      state:State,
      ast:BLK.DomainBlock,
  ) : Expression {
    try {
      const params = this.compile_params(
        state,
        `__domain_block_${ast.type}_${ast.id}__`,
        ast.params,
      );
      const res_params:Str = [];
      res_params.push(params.statements);
      const wrap_id = state.gen_parameter_symbol(`domain_wrap`);
      const wrap_param = this.opt_params(wrap_id);
      const res_expr:Str = [
        this.keyword.call_domain_function, `('`,
        wrap_id,
        `', '`,
        ast.type,
        `', '`,
        ast.id,
        `', `,
        this.opt_params(params.dynamic_data_id),
        `, `,
        state.current_target_entity(),
        `);`,
      ];

      const res_expr_wrap:Str = [
        res_expr,
        state.create_after_potential_blocker_yield_point(ast),
      ];
      return {
        state: params.state,
        pre: [res_params, res_expr_wrap],
        expr: wrap_param,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_domain_functions',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_event(
      state:State,
      ast:BLK.EventBlock,
  ) : Statements {
    try {
      const triggered_id = state.gen_parameter_symbol(`if_triggered`);
      const triggered_param = this.opt_params(triggered_id);
      const c = this.compile_domain_functions(state, <any>ast);
      state = c.state;
      const yield_after_test = state.create_yield_point();
      const yield_before_enter = state.create_yield_point();
      const push = state.push_yield_level(ast);
      const b = this.compile_statement(state, ast.child_block[0]);
      state = b.state;
      const yield_reset = state.create_yield_reset_point();
      const pop = b.state.pop_yield_level(ast);
      return {
        state,
        statements: [
          c.pre,
          yield_after_test,
          triggered_param, ` = `, c.expr, `;`,
          yield_before_enter,
          `if (`, triggered_param, `) {`,
          push,
          b.statements,
          yield_reset,
          pop,
          `}`,
        ],
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_event',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_responder(
      state:State,
      ast:BLK.ResponderBlock,
  ) : Statements {
    try {
      const b = this.compile_statement(state, ast.child_block[0]);
      state = b.state;
      return {
        state: state,
        statements: [
          b.statements,
        ],
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_responder',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_procedure_call(
      state:State,
      ast:BLK.ProcedureCallReturnBlock|BLK.ProcedureCallNoReturnBlock,
  ) : Expression {
    try {
      const params = this.compile_params(
        state,
        `__${ast.type}_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const res_pre:Str = [];
      res_pre.push(params.statements);
      res_pre.push(state.create_yield_point());
      res_pre.push([
        this.keyword.proc_call, `('`,
        ast.procedure_name,
        `', `,
        state.current_target_entity(),
        `, `,
        // TODO Only push procedure parameters, not all the other
        // things that end up in the compile_params dictionary
        this.opt_params(params.dynamic_data_id),
        `, '`,
        // Call procedure block id, used by locating runtime error.
        ast.id,
        `', `,
        state.is_inside_warp().toString(),
        `);`,
      ]);
      res_pre.push(state.create_procedure_yield_point());
      const res_expr:Str = [
        this.keyword.proc_return_value,
      ];
      return {
        state,
        pre: res_pre,
        expr: res_expr,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_procedure_call',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_procedure_parameter(
      state:State,
      ast:BLK.ProcedureParameterBlock,
  ) : Expression {
    const root_block = this.u.block.get_first_ancestor_satisfying(ast, (cb) => cb.parent_block == undefined);
    if (root_block == undefined) {
      throw this.ohno.compiler.system.could_not_find_root_block({
        block: ast,
      });
    }
    if (!this.u.block.is.procedures_defnoreturn(root_block)) {
      throw this.ohno.compiler.user.procedure_parameter_outside({
        block: ast,
      });
    }

    // We currently get the procedure parameter name in the same way as
    // we get all other parameters of blocks - dynamically using compile_params.
    // (To ensure it goes through the same path as all other user supplied data,
    // through static_data, so that it isn't eval'd)
    // But for compile time validation, we make the assumption that the param
    // name is defined statically, and check to ensure it is in the root block
    // procedure definition's list of acceptable parameters.
    let param_name:string;
    if (ast.params == undefined
        || ast.params.param_name == undefined
        || !_isString(ast.params.param_name)
    ) {
      throw this.ohno.compiler.system.could_not_find_procedure_parameter_name({
        block: ast,
      });
    } else {
      param_name = <string>ast.params.param_name;
    }
    if (!root_block.params[param_name]) {
      throw this.ohno.compiler.user.procedure_no_such_parameter({
        param_name,
        block: ast,
      });
    }

    try {
      const params = this.compile_params(
        state,
        `__${ast.type}_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const proc_param_name = [this.opt_params(params.dynamic_data_id), `['param_name']`];
      const res_expr:Str = [
        this.keyword.proc_parameters, `[`, proc_param_name, `]`,
      ];
      return {
        state,
        pre: [
          params.statements,
          `if (`, res_expr, ` == undefined) {throw `,
          this.keyword.ohno, `.user.proc_parameter_without_value({`,
          `"block_id": '`, ast.id, `'});}`,
        ],
        expr: res_expr,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_procedure_parameter',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_procedure_return_value(
      state:State,
      ast:BLK.ProcedureReturnValueBlock,
  ) : Statements {
    const root_block = this.u.block.get_first_ancestor_satisfying(ast, (cb) => cb.parent_block == undefined);
    if (ast.params['VALUE'] === undefined) {
      throw this.ohno.compiler.user.procedure_return_empty({
        block: ast,
      });
    }

    if (root_block === undefined || !this.u.block.is.procedures_defnoreturn(root_block)) {
      throw this.ohno.compiler.user.procedure_return_outside({
        block: ast,
      });
    }

    try {
      const params = this.compile_params(
        state,
        `__${ast.type}_${ast.id}__`,
        ast.params,
      );
      state = params.state;
      const return_value = [this.opt_params(params.dynamic_data_id), `['VALUE']`];
      const res:Str = [
        params.statements,
        this.keyword.proc_do_return_value, `('`, ast.id, `', `, return_value, `); return;`,
      ];
      return {
        state,
        statements: res,
      };
    } catch (e) {
      throw this.create_catch_all_error(
          'compile_procedure_return_value',
          e,
          <BLK.CompiledBlock>ast,
      );
    }
  }

  private compile_params(
      state:State,
      name:string,
      params:{[p_id:string]:BLK.BlockParam},
  ) : Params {
    try {
      const statements:Str = [state.create_yield_point()];
      const param_collection_id = state.gen_parameter_symbol(
          `${name}_params`);
      statements.push(this.opt_create_params(param_collection_id));

      let param_keys = Object.keys(params);
      if (param_keys.length == 0) {
        return {
          state,
          dynamic_data_id: param_collection_id,
          statements: statements,
        };
      }

      if (this.deterministic) {
        param_keys = _sortBy(param_keys, _identity);
      }

      for (let i = 0; i < param_keys.length; i++) {
        const p_id = param_keys[i];
        const param = params[p_id];

        if (this.block.is.compiled_block(param)) {
          const expr = this.compile_expression(state, <any>param);
          state = expr.state;
          statements.push(expr.pre);
          statements.push(state.create_yield_point());
          statements.push(this.opt_set_param(
              param_collection_id,
              p_id,
              expr.expr,
          ));
        } else {
          // We must never allow user generated text into the new
          // Function() call, so all static data is saved in an external
          // dict.
          statements.push(state.create_yield_point());
          const static_symbol = state.set_static(
              name + '_' + p_id,
              param,
          );
          statements.push(this.opt_set_param(
              param_collection_id,
              p_id,
              this.opt_static(static_symbol),
          ));
        }
      }
      // Since everything that uses params adds another
      // statement or expr after, add the yield point here
      // for their convenience
      statements.push(state.create_yield_point());
      return {
        state,
        dynamic_data_id: param_collection_id,
        statements: statements,
      };
    } catch (e) {
      throw this.create_catch_all_error('compile_params', e);
    }
  }

  private opt_static(key:Str) : Str {
    if (this.should_pretty_print) {
      // index by string
      return [this.keyword.static_data, `['`, key, `']`];
    }
    // If we're not pretty printing, the static data is an array
    // this gives us much faster access
    return [this.keyword.static_data, `[`, key, `]`];
  }

  private opt_params(key:Str) : Str {
    if (this.should_pretty_print) {
      // index by string
      return [this.keyword.dynamic_data, `['`, key, `']`];
    }
    // If we're not pretty printing, the dynamic data is an array
    // this gives us much faster access
    return [this.keyword.dynamic_data, `[`, key, `]`];
  }

  private opt_create_params(key:Str) : Str {
    return [this.opt_params(key), ` = {};`];
  }

  private opt_set_param(key:Str, param:Str, value:Str) : Str {
    return [this.opt_params(key), `['`, param, `'] = `, value, `;`];
  }

}
