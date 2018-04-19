import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';

import {
  BlockRegistry,
  BlockUtil,
  Logger,
  Ohno,
  BlockPredicates,
} from './di_interfaces';

import * as B from './block_types';

// Only pure functions with no state allowed in this file.

const check_domain_block_optimization:{[key:string]:boolean} = {domain_block: true};

@injectable()
export class BlockPredicatesImpl implements BlockPredicates {

  constructor(
      @inject(BINDING.BlockRegistry) private block_registry:BlockRegistry,
      @inject(BINDING.Ohno) private ohno:Ohno,
      @inject(BINDING.Log) private log:Logger,
  ) {}

  public responder_block(b:B.Block) : b is B.ResponderBlock {
    return this.block_registry.has_responder_type(b.type);
  }

  public responder_type(t:string) : boolean {
    return this.block_registry.has_responder_type(t);
  }

  public atomic_type(t:string) : boolean {
    return B.ATOMIC_BLOCKS[<any>t] !== undefined;
  }

  public async_tell(b:B.Block) : b is B.TellBlock {
    return <any>B.SPECIAL_BLOCKS.tell == B.SPECIAL_BLOCKS[<any>b.type];
  }

  public sync_tell(b:B.Block) : b is B.SyncTellBlock {
    return <any>B.SPECIAL_BLOCKS.sync_tell == B.SPECIAL_BLOCKS[<any>b.type];
  }

  public warp(b:B.Block) : b is B.WarpBlock {
    return <any>B.SPECIAL_BLOCKS.warp == B.SPECIAL_BLOCKS[<any>b.type];
  }

  public logic_empty(b:B.Block) : b is B.LogicEmptyBlock {
    return <any>B.SPECIAL_BLOCKS.logic_empty == B.SPECIAL_BLOCKS[<any>b.type];
  }

  public special_block(b:B.Block) : b is B.SpecialBlock {
    return <any>B.SPECIAL_BLOCKS[<any>b.kind];
  }

  public domain_block(b:B.Block) : b is B.DomainBlock {
    return check_domain_block_optimization[<any>b.kind];
  }

  public loop_block(b:B.Block) : b is B.LoopBlock {
    return <any>B.LOOP_BLOCKS[<any>b.kind];
  }

  public cond_block(b:B.Block) : b is B.CondBlock {
    return <any>B.IF_BLOCKS[<any>b.kind];
  }

  public proc_block(b:B.Block) : b is B.ProcBlock {
    return <any>B.PROCEDURE_BLOCKS[<any>b.kind];
  }

  public controls_if(b:B.Block) : b is B.IfBlock {
    return B.IF_BLOCKS[<any>'controls_if'] == B.IF_BLOCKS[<any>b.type];
  }

  public controls_if_no_else(b:B.Block) : b is B.IfNoElseBlock {
    return <any>B.IF_BLOCKS.controls_if_no_else == B.IF_BLOCKS[<any>b.type];
  }

  public event_block(b:B.Block) : b is B.EventBlock {
    return <any>B.EVENT_BLOCKS[<any>b.type] || this.block_registry.block_restart_when_finished(b.type);
  }

  public repeat_n_times(b:B.Block) : b is B.RepeatNTimesBlock {
    return <any>B.LOOP_BLOCKS.repeat_n_times == B.LOOP_BLOCKS[<any>b.type];
  }

  public repeat_forever(b:B.Block) : b is B.RepeatForeverBlock {
    return <any>B.LOOP_BLOCKS.repeat_forever == B.LOOP_BLOCKS[<any>b.type];
  }

  public repeat_forever_until(b:B.Block) : b is B.RepeatForeverUntilBlock {
    return <any>B.LOOP_BLOCKS.repeat_forever_until == B.LOOP_BLOCKS[<any>b.type];
  }

  public wait_until(b:B.Block) : b is B.WaitUntilBlock {
    return <any>B.LOOP_BLOCKS.wait_until == B.LOOP_BLOCKS[<any>b.type];
  }

  public break(b:B.Block) : b is B.BreakBlock {
    return <any>B.LOOP_BLOCKS.break == B.LOOP_BLOCKS[<any>b.type];
  }

  public procedures_defnoreturn(b:B.Block) : b is B.ProcedureDefinitionBlock {
    return <any>B.PROCEDURE_BLOCKS.procedures_defnoreturn == B.PROCEDURE_BLOCKS[<any>b.type];
  }

  public procedures_callreturn(b:B.Block) : b is B.ProcedureCallReturnBlock {
    return <any>B.PROCEDURE_BLOCKS.procedures_callreturn == B.PROCEDURE_BLOCKS[<any>b.type];
  }

  public procedures_callnoreturn(b:B.Block) : b is B.ProcedureCallNoReturnBlock {
    return <any>B.PROCEDURE_BLOCKS.procedures_callnoreturn == B.PROCEDURE_BLOCKS[<any>b.type];
  }

  public procedures_return_value(b:B.Block) : b is B.ProcedureReturnValueBlock {
    return <any>B.PROCEDURE_BLOCKS.procedures_return_value == B.PROCEDURE_BLOCKS[<any>b.type];
  }

  public procedures_parameter(b:B.Block) : b is B.ProcedureParameterBlock {
    return <any>B.PROCEDURE_BLOCKS.procedures_parameter == B.PROCEDURE_BLOCKS[<any>b.type];
  }

  public compiled_block(b:B.BlockParam) : b is B.CompiledBlock {
    return b !== undefined && (<any>b).id != undefined;
  }

  public atomic(b:B.BlockParam) : b is number | string | boolean | undefined {
    return b !== undefined && !this.compiled_block(b);
  }

}
