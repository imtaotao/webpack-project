import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import * as BLK from '../block_types';
import * as H from '../di_interfaces';
import * as O from './types';
import * as T from '../basic_types';
import { BINDING } from '../di_symbols';
import { OptiRunner } from './runner';

@injectable()
export class OptiRunnerFactory implements H.BlockInterpreterFactory {

  private should_pretty_print!:boolean;
  private tell_should_ensure_entity_exists!:boolean;
  private should_report_current_running_block!:boolean;
  private max_procedure_calls_per_interpreter_step!:number;
  private max_warp_iterations_per_interpreter_step!:number;

  public constructor(
      @inject(BINDING.Util) private u:H.Util,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.BlockRegistry) private block_registry:H.BlockRegistry,
      @inject(BINDING.OptiProgramCache) private program_cache:H.OptiProgramCache,
      @inject(BINDING.BlockPool) private block_pool:H.BlockPool,
  ) {
    const configure = () => {
      const conf = u.config.get();
      const opti_conf = conf.opti_compiler;
      this.should_pretty_print = opti_conf != undefined ? opti_conf.pretty_print : false;
      this.tell_should_ensure_entity_exists = conf.reports_all_entities;
      this.should_report_current_running_block = conf.should_report_current_running_block;
      this.max_procedure_calls_per_interpreter_step = conf.max_warp_iterations_per_interpreter_step;
      this.max_warp_iterations_per_interpreter_step = conf.max_warp_iterations_per_interpreter_step;
    };
    configure();
    this.event_bus.system.config_updated.immediate.sub(configure);
  }

  public create(
    run_mgr:H.RuntimeManager,
    identities:T.Identities,
    priorities:T.InterpreterPriorities,
    compile_cache_id:T.ID,
    compiled_block:BLK.CompiledBlock,
    variable_specs:T.VariableSpecDict,
    group_id:string|undefined,
    is_warped:boolean,
    action_parameters?:T.Dict<any>,
    on_finished?:H.OnInterpreterFinished,
  ) : H.BlockInterpreter {
    // TODO PERF Use an Object Pool for OptiRunners

    return new OptiRunner(
      this.u,
      this.ohno,
      this.should_pretty_print,
      this.tell_should_ensure_entity_exists,
      this.should_report_current_running_block,
      this.max_procedure_calls_per_interpreter_step,
      this.max_warp_iterations_per_interpreter_step,
      run_mgr,
      this.block_pool,
      this.program_cache,
      this.block_registry.get_domain_functions(),
      identities,
      priorities,
      this.program_cache.get_program(
          compile_cache_id,
          identities.source_map_entity,
          identities.source_map_rbid,
          identities.interpreter_id,
          compiled_block,
      ),

      group_id,
      compiled_block,
      variable_specs,
      is_warped,
      action_parameters,
      on_finished,
    );
  }

  public clear() : void {
    this.program_cache.clear();
  }
}
