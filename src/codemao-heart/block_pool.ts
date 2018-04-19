import _clone from 'lodash/clone';
import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';
import * as H from './di_interfaces';
import * as B from './block_types';

@injectable()
export class BlockPoolImpl implements H.BlockPool {

  private pool:B.PoolBlock[] = [];

  constructor(
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.Log) private log:H.Logger,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.Util) private u:H.Util,
      @inject(BINDING.Config) private config:H.Config,
  ) {
    // Pre-allocate with a bunch of items
    const size = config.get().block_pool_preallocation_size;
    const a:B.PoolBlock[] = [];
    for (let i = 0; i < size; i++) {
      a.push(this.create());
    }
    for (let i = 0; i < size; i++) {
      this.release((<B.PoolBlock>a.pop()));
    }
  }

  private create() : B.PoolBlock {
    // This is probably better than this.reset({});
    // because we don't force a lot of intermediate
    // hidden classes to be created.
    return <any>{
      // base
      params: {},
      kind: '',
      type: '',
      id: '',
      parent_block: undefined,
      next_block: undefined,
      child_block: [],
      first_evaluation: true,
      done_evaluating: false,
      output_type: '',
      last_call: undefined,
      waiting_for_procedure: undefined,
      disabled: false,

      // conditional
      conditions: [],

      // procedure
      procedure_name: '',
      procedure_return_value: undefined,

      // repeat
      times_left: 0,
    };
  }

  private release_block_param(b?:B.BlockParam) {
    if (b == undefined) { return; }
    if (this.u.block.is.compiled_block(b)) {
      this.release(b);
    }
  }

  private reset(block:B.PoolBlock) : void {
    // recursive release
    this.release_block_param(block.next_block);

    for (let i = 0; i < block.child_block.length; i++) {
      this.release_block_param(block.child_block[i]);
    }

    for (let i = 0; i < block.conditions.length; i++) {
      this.release_block_param(block.conditions[i]);
    }

    for (const param in block.params) {
      this.release_block_param(block.params[param]);
    }

    // base
    block.params = {};
    (<any>block).kind = '';
    block.type = '';
    block.id = '';
    block.parent_block = undefined;
    block.next_block = undefined;
    block.child_block = [];
    block.first_evaluation = true;
    block.done_evaluating = false;
    (<any>block).output_type = '';
    block.last_call = undefined;
    block.waiting_for_procedure = undefined;
    block.disabled = false;

    // conditional
    block.conditions = [];

    // procedure
    block.procedure_name = '';
    block.procedure_return_value = undefined;

    // repeat
    block.times_left = 0;
  }

  public clone(
      block:B.CompiledBlock,
      par?:B.PoolBlock,
  ) : B.CompiledBlock {

    const c = this.get();
    const orig:B.PoolBlock = <any>block;

    // -- base
    for (const param_name in orig.params) {
      const param = orig.params[param_name];
      if (param === undefined) {
        c.params[param_name] = undefined;
      } else {
        if (this.u.block.is.compiled_block(param)) {
          c.params[param_name] = this.clone(param, c);
        } else {
          c.params[param_name] = _clone(param);
        }
      }
    }

    c.kind = (<any>orig).kind;
    c.type = orig.type;
    c.id = orig.id;
    c.parent_block = par;

    if (orig.next_block != undefined) {
      c.next_block = this.clone(orig.next_block, par);
    }

    c.child_block = [];
    for (let i = 0; i < orig.child_block.length; i++) {
      const maybe_child = orig.child_block[i];
      if (maybe_child == undefined) {
        c.child_block.push(undefined);
      } else {
        c.child_block.push(this.clone(maybe_child, c));
      }
    }

    c.first_evaluation = orig.first_evaluation;
    c.done_evaluating = orig.done_evaluating;
    c.output_type = (<any>orig).output_type;
    c.last_call = orig.last_call;
    c.waiting_for_procedure = orig.waiting_for_procedure;
    c.disabled = orig.disabled;

    // -- conditional
    for (let i = 0; i < orig.conditions.length; i++) {
      const cond = orig.conditions[i];
      if (cond == undefined) {
        c.conditions.push(undefined);
      } else {
        c.conditions.push(this.clone(<B.PoolBlock>cond, c));
      }
    }

    // -- procedure
    c.procedure_name = orig.procedure_name;
    c.procedure_return_value = orig.procedure_return_value;

    // -- repeat
    c.times_left = orig.times_left;

    return c;
  }

  public get() : B.PoolBlock {
    const block = this.pool.pop();
    if (block == undefined) {
      return this.create();
    }
    return block;
  }

  public release(block:B.CompiledBlock) {
    // TODO Limit block pool size?
    // Maybe only clear Block Pool or prune it to a certain size
    // on RuntimeManager::stop ?
    this.reset(<B.PoolBlock>block);
    this.pool.push(<any>block);
  }
}
