import _cloneDeep from 'lodash/cloneDeep';
import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';

import {
  Ohno,
  Logger,
  Util,
  BlockUtil,
  Config,
} from './di_interfaces';
import { CompiledEntity } from './basic_types';
import { CompiledBlock } from './block_types';

@injectable()
export class UtilImpl implements Util {

  public misc = {
    ce_restore_cyclical_references: this.ce_restore_cyclical_references.bind(this),
    ce_without_cyclical_references: this.ce_without_cyclical_references.bind(this),
  };

  constructor(
      @inject(BINDING.Config) public config:Config,
      @inject(BINDING.Ohno) public ohno:Ohno,
      @inject(BINDING.Log) public log:Logger,
      @inject(BINDING.BlockUtil) public block:BlockUtil,
  ) {}

  private ce_without_cyclical_references(ce:CompiledEntity) : CompiledEntity {
    const ce_no_ref:any = _cloneDeep(ce);
    for (const bjs_id in ce_no_ref.compiled_block_map) {
      const cb = ce_no_ref.compiled_block_map[bjs_id];
      this.remove_parent_references(cb);
    }
    for (const p_id in ce_no_ref.procedures) {
      const p_cb = ce_no_ref.procedures[p_id];
      this.remove_parent_references(p_cb);
    }
    return ce_no_ref;
  }

  private ce_restore_cyclical_references(ce:CompiledEntity) : void {
    for (const key in ce.compiled_block_map) {
      const b = ce.compiled_block_map[key];
      this.restore_parents(b);
    }
    for (const key in ce.procedures) {
      const b = ce.compiled_block_map[key];
      this.restore_parents(b);
    }
  }

  private remove_parent_references(b:CompiledBlock) {
    if (!b) {
      // This sometimes happens for child_blocks that are set to null for conditionals
      return;
    }
    b.parent_block = undefined;
    if (b.next_block) {
      this.remove_parent_references(b.next_block);
    }
    for (let i = 0; i < b.child_block.length; i++) {
      const child = b.child_block[i];
      if (child == undefined) { continue; }
      this.remove_parent_references(child);
    }
    for (const p_id in b.params) {
      const param = b.params[p_id];
      if ((<any>param)['parent_block'] != undefined) {
        this.remove_parent_references(<CompiledBlock>param);
      }
    }
    if (this.block.is.cond_block(b)) {
      for (let i = 0; i < b.conditions.length; i++) {
        const condition = b.conditions[i];
        if (condition == undefined) { continue; }
        this.remove_parent_references(condition);
      }
    }
  }

  private restore_parents(b:CompiledBlock, parent_block?:CompiledBlock) {
    if (b == undefined) {
      // This sometimes happens for child_blocks that are set to null for conditionals
      return;
    }
    b.parent_block = parent_block;
    if (b.next_block) {
      this.restore_parents(b.next_block, parent_block);
    }
    for (let i = 0; i < b.child_block.length; i++) {
      const child = b.child_block[i];
      if (child == undefined) { continue; }
      this.restore_parents(child, b);
    }
    for (const p_id in b.params) {
      const param = b.params[p_id];
      if ((<any>param)['parent_block'] != undefined) {
        this.restore_parents(<CompiledBlock>param, b);
      }
    }
    if (this.block.is.cond_block(b)) {
      for (let i = 0; i < b.conditions.length; i++) {
        const condition = b.conditions[i];
        if (condition == undefined) { continue; }
        this.restore_parents(<CompiledBlock>condition, b);
      }
    }
  }

}
