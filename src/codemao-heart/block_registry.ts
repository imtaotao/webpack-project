import _cloneDeep from 'lodash/cloneDeep';
import _isFunction from 'lodash/isFunction';
import { injectable, inject, optional } from 'inversify';

import { Blockly } from './blockly_interface';
import { FunctionDict } from './block_provider';

import {
  BlockRegistry,
} from './di_interfaces';
import {
  LoadedBlockConfigs,
} from './public_interfaces';
import {
  Action,
  ActionSpec,
  BlockConfig,
  BlockConfigDict,
  BlockProvider,
  ResponderInfo,
  ResponderSpec,
  ResponderType,
  RuntimeProvider,
  namespaced_id,
} from './block_provider';
import { BINDING } from './di_symbols';

export type MaybeActionSpec = ActionSpec|undefined;

export type MaybeResponderInfo = ResponderInfo|undefined;

@injectable()
export class BlockRegistryImpl implements BlockRegistry {

  public constructor(
      @inject(BINDING.Blockly) @optional() private blockly?:Blockly,
  ) {}

  private action_specs:{[ns_event_id:string]:ActionSpec} = {};
  private responder_infos:{[ns_responder_id:string]:ResponderInfo} = {};
  private domain_functions:FunctionDict = {};
  private blocks_need_restart_when_finished:{[ns_id:string]:true} = {};
  private blocks_need_finish_out_of_run_group:{[ns_id:string]:true} = {};

  private loaded_json_block_configs:{[namespace:string]:BlockConfigDict} = {};
  private loaded_init_function_block_configs:{[namespace:string]:string[]} = {};

  /**
   * Registers the BlockProvider with the registry.
   *
   * This will make the block definitions available to the compiler, RuntimeManager,
   * and other components necessary to compile and run programs with blocks provided
   * by the BlockProvider.
   *
   * @param {BlockProvider} p The block provider which defines new blocks
   * @return {type} desc
   */
  public register_provider(
      p:BlockProvider,
  ) : void {
    if (this.blockly != undefined) {
      this.define_blocks(this.blockly, p);
    }
    this.register_runtime_provider(p);
  }

  /**
   * Returns information about loaded block configs. Block configs
   * are either a JSON dictionary or implemented through an init
   * function.
   *
   * For each namespace (block provider), a dictionary with BlockConfigs
   * is provided in defined_by_json, and a list of names of blocks is
   * defined_by_init_function.
   *
   * For the ones implemented through init function, one
   * would have to look in the global Blockly variable to find them.
   * Their names will probably take the form namespace__blockname.
   *
   * Note that the namespace of the basic blocks is the empty string, ''.
   *
   * @return {LoadedBlockConfigs}
   */
  public get_loaded_block_configs() : LoadedBlockConfigs {
    return {
      defined_by_json: _cloneDeep(this.loaded_json_block_configs),
      defined_by_init_function: _cloneDeep(this.loaded_init_function_block_configs),
    };
  }

  public register_runtime_provider(p:RuntimeProvider) : void {
    const namespace = p.namespace();

    const dom_funs = p.domain_functions();
    for (const fun_name in dom_funs) {
      const fun = dom_funs[fun_name];
      this.domain_functions[namespaced_id(namespace, fun_name)] = fun;
    }

    const action_types = p.action_types();
    for (let i = 0; i < action_types.length; i++) {
      const action_spec = action_types[i];
      const ns_action_id = namespaced_id(namespace, action_spec.id);

      this.action_specs[ns_action_id] = action_spec;

      for (let j = 0; j < action_spec.responder_blocks.length; j++) {
        const responder_spec = action_spec.responder_blocks[j];
        const ns_responder_id = namespaced_id(namespace, responder_spec.id);
        this.responder_infos[ns_responder_id] = {
          namespace,
          action_spec,
          responder_spec,
        };
      }
    }

    if (p.block_metadata === undefined) {
      return;
    }

    if (p.block_metadata.restart_when_finished != undefined) {
      for (let i = 0; i < p.block_metadata.restart_when_finished.length; i++) {
        const block_name = p.block_metadata.restart_when_finished[i];
        const ns_id = namespaced_id(namespace, block_name);
        this.blocks_need_restart_when_finished[ns_id] = true;
      }
    }

    if (p.block_metadata.finish_out_of_run_group != undefined) {
      for (let i = 0; i < p.block_metadata.finish_out_of_run_group.length; i++) {
        const block_name = p.block_metadata.finish_out_of_run_group[i];
        const ns_id = namespaced_id(namespace, block_name);
        this.blocks_need_finish_out_of_run_group[ns_id] = true;
      }
    }
  }

  public get_action_spec(ns_event_id:string) : MaybeActionSpec {
    return this.action_specs[ns_event_id];
  }

  public get_spec_of_action(event:Action) : MaybeActionSpec {
    return this.action_specs[namespaced_id(event.namespace, event.id)];
  }

  public has_responder_type(ns_responder_id:string) {
    return this.responder_infos[ns_responder_id] != undefined;
  }

  public get_responder_info(ns_responder_id:string) : MaybeResponderInfo {
    return this.responder_infos[ns_responder_id];
  }

  public get_event_types() : string[] {
    return Object.keys(this.action_specs);
  }

  public get_domain_functions() : FunctionDict {
    return this.domain_functions;
  }

  public block_restart_when_finished(ns_id:string) : boolean {
    return this.blocks_need_restart_when_finished[ns_id] != undefined;
  }

  public block_finish_out_of_run_group(ns_id:string) : boolean {
    return this.blocks_need_finish_out_of_run_group[ns_id] != undefined;
  }

  // TODO Instead of assigning to blockly, provide a function or json to assign
  // Might be needed for native blocklys or future blockly versions
  private define_blocks(blockly:Blockly, p:BlockProvider) : void {
    const config = p.config(blockly);
    for (const name in config) {
      const c = config[name];
      const block_name = namespaced_id(p.namespace(), name);
      if (_isFunction(c.init)) {
        // Block style is defined with an init function

        // Save metadata about loaded block config
        const b_cfg_list = this.loaded_init_function_block_configs[p.namespace()] || [];
        b_cfg_list.push(name);
        this.loaded_init_function_block_configs[p.namespace()] = b_cfg_list;

        // Load into Blockly
        blockly.Blocks[block_name] = {
          name: block_name,
          init: <Function>c.init,
        };

      } else {
        // Block style is defined by json

        // Save metadata about loaded block config
        const b_cfg_dict = this.loaded_json_block_configs[p.namespace()] || {};
        b_cfg_dict[name] = c;
        this.loaded_json_block_configs[p.namespace()] = b_cfg_dict;

        // Load into Blockly
        blockly.Blocks[block_name] = {
          name: block_name,
          /**
           * This function is used to initialize a blocks's style from json
           * data in case no other function for style initialization is
           * supplied.
           *
           * It is bound to the Blockly object, so "this" refers to Blockly
           * itself (or Blockly.Blocks), which has a jsonInit function.
           * TODO check which using inspector
           */
          init: function() : void { this.jsonInit(c); },
        };
      }
    }
  }
}
