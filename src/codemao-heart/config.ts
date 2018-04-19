import _defaultsDeep from 'lodash/defaultsDeep';
import { injectable, inject } from 'inversify';

import * as H from './di_interfaces';
import { BINDING } from './di_symbols';

/**
 * deterministic: Is either undefined, for non-deterministic execution, or a
 * DeterministicConfig. This may not be changed at runtime, must be set when a
 * Heart instance is created. This must be set if you want to assume that Heart
 * is deterministic based on inputs.
 *
 * legacy: Options for working with old BCM projects of Kitten.
 *
 * opti_compiler: Options for the optimizing compiler.
 *
 * per_entity_clone_limit: If set, limits the number of clones an entity may
 * have. Old clones are disposed when new clones are created if limit has been
 * hit.
 *
 * entity_max_clones_per_frame: Limits the number of clones of each entity for each frame.
 * Clone will not be create beyond this amount.
 *
 * reports_all_entities: If true, the environment must report all valid
 * entity_ids to the RuntimeManager using the set_entity_known method. This
 * information is used to ensure that the tell block doesn't attempt to run
 * code with invalid entity_ids.
 *
 * should_report_current_running_block: If true, causes Heart to send the
 * runtime_data.block_running and runtime_data.block_finished events whenever
 * it starts and finishes evaluating a block. Enabling this option may
 * cause worse performance.
 *
 * user_debug_mode: If true, will enable features that allow users to debug
 * their running projects. This mode is SIGNIFICANTLY slower than the non-
 * debug mode. Uses BlockInterpreter instead of OptiRunner. Features:
 * * Report the result of running a block
 * * TODO Breakpoint step debugging
 * * TODO Ability to re-arrange code while it is executing
 */
export interface HeartConfig {
  block_pool_preallocation_size:number;
  deterministic?:DeterministicConfig;
  legacy:LegacyConfig;
  max_procedure_calls_per_interpreter_step:number;
  max_warp_iterations_per_interpreter_step:number;
  opti_compiler:OptiCompiler;
  per_entity_clone_limit?:number;
  entity_max_clones_per_frame:number;
  reports_all_entities:boolean;
  should_report_current_running_block:boolean;
  user_debug_mode:boolean;
}

/**
 * list_get_value_allow_return_undefined: Return `undefined` when attempting to
 * access non-existing indices of lists, instead of breaking.
 */
export interface LegacyConfig {
  lists_get_value_allow_return_undefined:boolean;
}

/**
 * seconds_per_update: Heart assumes that RuntimeManager::update is
 * called at a regular interval every `seconds_per_update` second.
 * Each tick brings execution forward `seconds_per_update` seconds.
 */
export interface DeterministicConfig {
  seconds_per_update:number;
  prng_seed:number|number[];
}

/**
 * pretty_print: Tries to make the compiled JS Functions' code human readable.
 */
export interface OptiCompiler {
  pretty_print:boolean;
}

// Partial<T> is not recursive, so to be able to specify a
// partial legacy config, this interface is used instead
export interface PartialHeartConfig {
  block_pool_preallocation_size?:number;
  deterministic?:DeterministicConfig;
  legacy?:Partial<LegacyConfig>;
  max_procedure_calls_per_interpreter_step?:number;
  max_warp_iterations_per_interpreter_step?:number;
  opti_compiler?:Partial<OptiCompiler>;
  per_entity_clone_limit?:number;
  entity_max_clones_per_frame?:number;
  reports_all_entities?:boolean;
  should_report_current_running_block?:boolean;
  user_debug_mode?:boolean;
}

function get_defaults() : HeartConfig {
  return {
    block_pool_preallocation_size: 50,
    deterministic: undefined,
    legacy: {
      lists_get_value_allow_return_undefined: false,
    },
    max_procedure_calls_per_interpreter_step: 50000,
    max_warp_iterations_per_interpreter_step: 30000,
    opti_compiler: {
      pretty_print: false,
    },
    per_entity_clone_limit: 300,
    entity_max_clones_per_frame: 300,
    reports_all_entities: true,
    should_report_current_running_block: false,
    user_debug_mode: false,
  };
}

@injectable()
export class ConfigImpl implements H.Config {
  private config!:HeartConfig;

  public constructor(
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
  ) {}

  public get() : HeartConfig {
    return this.config;
  }

  public set(config:PartialHeartConfig) {
    this.config = _defaultsDeep(
      {},
      config,
      this.config,
      get_defaults(),
    );

    // If you ever cache a config value or data derived from config values,
    // make sure to listen for this event and update when it fires.
    this.event_bus.system.config_updated.send();
  }
}
