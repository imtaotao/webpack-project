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
 * legacy: 与Kitten的旧BCM项目合作的选项。
 *
 * opti_compiler: 优化编译器的选项。.
 *
 * per_entity_clone_limit:如果设置，则限制实体可能的克隆数量
 * 有。 如果限制已经创建，则创建新克隆时会丢弃旧克隆
 * 击中。
 *
 * entity_max_clones_per_frame: 限制每个实体的每个实体的克隆数量。
 * 克隆将不会超过这个数量。
 *
 * reports_all_entities: 如果是 true，环境必须报告所有有效的 entity_ids使用set_entity_known方法到RuntimeManager。
 *  这个信息用于确保tell块不会尝试运行代码与无效的entity_ids。
 *
 * should_report_current_running_block: 如果 true，则使 heart 发送
 * runtime_data.block_running和runtime_data.block_finished事件
 * 它开始并完成评估块。 启用此选项可能导致更糟糕的表现。
 *
 * user_debug_mode:如果属实，将启用允许用户调试的功能他们的运行项目。 这种模式比非易失性存储器显着慢，
 * 调试模式。 使用BlockInterpreter而不是OptiRunner。 特征：
 * * 报告运行块的结果
 * * TODO 断点调试
 * * TODO 能够在执行代码时重新排列代码
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
