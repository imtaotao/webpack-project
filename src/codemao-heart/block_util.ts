import _includes from 'lodash/includes';
import _some from 'lodash/some';
import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';

import {
  BlockPredicates,
  BlockRegistry,
  BlockUtil,
  Logger,
  Ohno,
} from './di_interfaces';

import {
  Block,
  CompiledBlock,
  PreBlock,
} from './block_types';
import { EntityCompileResult } from './basic_types';

// Only pure functions with no state allowed in this file.

@injectable()
export class BlockUtilImpl implements BlockUtil {

  constructor(
      @inject(BINDING.BlockPredicates) public is:BlockPredicates,
      @inject(BINDING.BlockRegistry) private block_registry:BlockRegistry,
      @inject(BINDING.Ohno) private ohno:Ohno,
      @inject(BINDING.Log) private log:Logger,
  ) {}

  // TODO move to BlockInterpreter, which is the only place where
  // modifying an AST/IR node is allowed
  public reset_state(block:PreBlock) : void {
    block.first_evaluation = true;
    block.done_evaluating = false;
  }

  public get_first_ancestor_satisfying(
      block:CompiledBlock|PreBlock|undefined,
      assert:(parent:CompiledBlock|PreBlock) => boolean,
  ) : CompiledBlock | undefined {
    if (block == undefined) { return undefined; }
    if (!block.parent_block) { return undefined; }
    if (assert(block.parent_block)) {
      return block.parent_block;
    }
    return this.get_first_ancestor_satisfying(block.parent_block, assert);
  }

  public has_block_of_types(
      cws:EntityCompileResult[],
      block_types:string[],
  ) : boolean {
    function find_in_json(block?:CompiledBlock) : boolean {
      if (!block) {
        return false;
      }
      return _includes(block_types, block.type)
        || _some(block.child_block, find_in_json)
        || find_in_json(block.next_block);
    }

    return _some(cws, (cw) => {
      const found_in_procs = _some(cw.procedures, find_in_json);
      if (cw.compiled_block_map) {
        return found_in_procs || _some(cw.compiled_block_map, find_in_json);
      }
      return found_in_procs;
    });
  }

}
