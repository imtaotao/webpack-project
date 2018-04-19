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
export class BenchmarkBlockProviderFactoryImpl implements H.BenchmarkBlockProviderFactory {
  constructor(
      @inject(BINDING.BlockXmlBuilderFactory) @optional() private bxbf?:H.BlockXMLBuilderFactory,
  ) {}

  public runtime_provider(benchmark_dependencies:P.BenchmarkTool) : RuntimeProvider {

    return {
      // Namespace is empty so that we play nicely with Blocky's default block ids
      namespace: () => 'BENCHMARK',
      domain_functions: get_domain_functions(
          benchmark_dependencies,
      ),
      action_types: () => [],
    };
  }

  public block_provider_and_xml(
      test_icon_url:string,
      benchmark_dependencies:P.BenchmarkTool,
  ) : H.BlockGetters {

    const runtime_provider = this.runtime_provider(benchmark_dependencies);

    const block_provider:BlockProvider = {
      ...runtime_provider,
      config: get_block_config(test_icon_url),
    };

    return {
      get_block_provider: () => block_provider,
      get_default_block_xml: () => {
        if (this.bxbf == undefined) {
          return r.fail('Heart workspace requirements unfulfilled, cannot get BlockXML for benchmark blocks.');
        }
        const bxml_builder = this.bxbf.create(block_provider);
        apply_test_block_defaults(bxml_builder);
        return r.success(bxml_builder.get_block_xml());
      },
    };
  }
}
