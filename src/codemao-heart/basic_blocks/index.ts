import * as r from 'resul-ts';
import { injectable, inject, optional } from 'inversify';

import * as H from '../di_interfaces';
import { BINDING } from '../di_symbols';
import { BlockProvider, BlockXML, BasicBlockConfigDependencies } from '../public_interfaces';
import { DayNames } from '../basic_types';
import { FunctionDict, BlockConfigFactory, RuntimeProvider } from '../block_provider';

import { apply_basic_block_defaults } from './block_xml';
import { get_block_config } from './block_config';
import { get_domain_functions } from './domain_functions';
import { get_action_specs } from './event';

@injectable()
export class BasicBlockProviderFactoryImpl implements H.BasicBlockProviderFactory {
  constructor(
      @inject(BINDING.Config) private config:H.Config,
      @inject(BINDING.DayNames) private day_names:DayNames,
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.RuntimeData) private runtime_data:H.RuntimeData,
      @inject(BINDING.RuntimeManager) private runtime_manager:H.RuntimeManager,
      @inject(BINDING.BlockXmlBuilderFactory) @optional() private bxbf?:H.BlockXMLBuilderFactory,
  ) {}

  public runtime_provider() : RuntimeProvider {

    return {
      // Namespace is empty so that we play nicely with Blocky's default block ids
      namespace: () => '',
      domain_functions: get_domain_functions(
          this.runtime_manager,
          this.runtime_data,
          this.event_bus,
          this.ohno,
          this.day_names,
          this.config,
      ),
      action_types: get_action_specs,
      block_metadata: {
        restart_when_finished: ['self_listen', 'when'],
        finish_out_of_run_group: ['on_running_group_activated'],
      },
    };
  }

  public block_provider_and_xml(
      block_config_deps:BasicBlockConfigDependencies,
  ) : H.BlockGetters {

    const runtime_provider = this.runtime_provider();

    const block_provider:BlockProvider = {
      ...runtime_provider,
      config: get_block_config(block_config_deps),
    };

    return {
      get_block_provider: () => block_provider,
      get_default_block_xml: () => {
        if (this.bxbf == undefined) {
          return r.fail('Heart workspace requirements unfulfilled, cannot get BlockXML for basic blocks.');
        }
        const bxml_builder = this.bxbf.create(block_provider);
        apply_basic_block_defaults(bxml_builder);
        return r.success(bxml_builder.get_block_xml());
      },
    };
  }
}
