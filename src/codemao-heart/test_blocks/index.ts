import * as r from 'resul-ts';
import { injectable, inject, optional } from 'inversify';

import * as H from '../di_interfaces';
import * as P from '../public_interfaces';
import { BINDING } from '../di_symbols';
import { BlockProvider, BlockXML } from '../public_interfaces';
import { FunctionDict, BlockConfigFactory, RuntimeProvider, ResponderType } from '../block_provider';

import { apply_test_block_defaults } from './block_xml';
import { get_block_config } from './block_config';
import { get_domain_functions } from './domain_functions';

@injectable()
export class TestBlockProviderFactoryImpl implements H.TestBlockProviderFactory {
  constructor(
      @inject(BINDING.Config) private config:H.Config,
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.RuntimeData) private runtime_data:H.RuntimeData,
      @inject(BINDING.RuntimeManager) private runtime_manager:H.RuntimeManager,
      @inject(BINDING.BlockXmlBuilderFactory) @optional() private bxbf?:H.BlockXMLBuilderFactory,
  ) {}

  public runtime_provider(ava_like_test_object:P.AvaTestLike) : RuntimeProvider {

    return {
      // Namespace is empty so that we play nicely with Blocky's default block ids
      namespace: () => 'AUTOMATEDTESTS',
      domain_functions: get_domain_functions(
          this.runtime_manager,
          this.runtime_data,
          this.event_bus,
          this.ohno,
          this.config,
          ava_like_test_object,
      ),
      action_types: () => [{
        id: 'testaction',
        entity_specific: false,
        responder_blocks: [{
          id: 'on_test_action',
          type: ResponderType.Action,
          async: true,
        }],
      }],
      block_metadata: {
        restart_when_finished: ['pull_event_test'],
      },
    };
  }

  public block_provider_and_xml(
      test_icon_url:string,
      ava_like_test_object:P.AvaTestLike,
  ) : H.BlockGetters {

    const runtime_provider = this.runtime_provider(ava_like_test_object);

    const block_provider:BlockProvider = {
      ...runtime_provider,
      config: get_block_config(test_icon_url),
    };

    return {
      get_block_provider: () => block_provider,
      get_default_block_xml: () => {
        if (this.bxbf == undefined) {
          return r.fail('Heart workspace requirements unfulfilled, cannot get BlockXML for basic blocks.');
        }
        const bxml_builder = this.bxbf.create(block_provider);
        apply_test_block_defaults(bxml_builder);
        return r.success(bxml_builder.get_block_xml());
      },
    };
  }
}
