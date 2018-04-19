import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import * as BLK from '../block_types';
import * as H from '../di_interfaces';
import * as O from './types';
import * as T from '../basic_types';
import { BINDING } from '../di_symbols';
import { OptiRunner } from './runner';

@injectable()
export class OptiProgramCacheImpl implements H.OptiProgramCache {

  private programs:{[cache_id:string]:O.OptiProgram} = {};

  public constructor(
      @inject(BINDING.Util) private u:H.Util,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.BlockRegistry) private block_registry:H.BlockRegistry,
      @inject(BINDING.OptiCompiler) private opti_compiler:H.OptiCompiler,
      @inject(BINDING.BlockPool) private block_pool:H.BlockPool,
  ) {}

  public get_program(
      cache_id:T.ID,
      source_map_entity:T.ID,
      source_map_rbid:T.ID,
      interpreter_id:T.ID,
      compiled_block:BLK.CompiledBlock,
  ) : O.OptiProgram {
    const program_id = cache_id;
    const stored_program = this.programs[program_id];
    if (stored_program != undefined) {
      return stored_program;
    }

    const program = this.opti_compiler.compile(
      source_map_entity,
      source_map_rbid,
      interpreter_id,
      compiled_block,
    );
    this.programs[program_id] = program;
    return program;
  }

  public clear() : void {
    this.programs = {};
  }
}
