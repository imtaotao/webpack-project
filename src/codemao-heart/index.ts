import * as r from 'resul-ts';
import { Error as Rerror, Success } from 'resul-ts';
import { Catastrophe } from 'catastrophic';

import { as_public_event_bus } from './event/event_bus';

import { get_instance } from './container';
import { BINDING } from './di_symbols';
import { DOMParser } from './dom_parser';
import * as cfg from './config';
import * as H from './di_interfaces';
import * as P from './public_interfaces';
import * as E from './event/event_types';
import * as BP from './block_provider';

import * as block_provider from './block_provider';
import * as toolbox from './toolbox';
import * as block_xml from './block_xml';
import * as event_types from './event/public_types';
import * as basic_types from './basic_types';
import * as block_types from './block_types';
import * as interfaces from './public_interfaces';
import { Blockly } from './blockly_interface';
import * as dev_tool from './dev_tool';

export {
  Blockly,
  Catastrophe,
  basic_types,
  block_provider, // TODO API only export types
  block_types,
  dev_tool,
  event_types,
  interfaces,
  toolbox, // TODO API only export types
};

export type HeartConfig = H.PartialHeartConfig;

export interface HeartSpec1 {
  // Required
  version:1;
  logger?:basic_types.Logger;
  configuration?:H.PartialHeartConfig;

  // Allows you to get Compiler
  compiler_requirements?:{
    dom_parser:DOMParser;
  } | {
    html_parser:any;
  };

  // Allows you to get Toolbox and BlockXmlBuilder
  workspace_requirements?:{
    blockly:Blockly;
  };

  basic_blocks_requirements?:{
    day_names:basic_types.DayNames;
  };
}

export type HeartSpec = HeartSpec1;
export type MaybeCompiler = r.Result<P.Compiler, void>;
export type MaybeBlockXMLBuilder = r.Result<P.BlockXMLBuilder, void>;

export class Heart {
  private container:Container;

  // Cached items, it seems like lookups via the
  // container can use up to 2ms

  private block_registry?:P.BlockRegistry;
  private compiler?:P.Compiler;
  private event_bus?:P.EventBus;
  private runtime_data?:P.RuntimeData;
  private runtime_manager?:P.RuntimeManager;
  private util?:P.Util;
  private assertion_tool?:P.TestAssertionTool;

  private block_xml_builder_factory?:H.BlockXMLBuilderFactory;
  private toolbox_factory?:H.ToolboxFactory;

  private basic_block_provider_factory?:H.BasicBlockProviderFactory;
  private basic_block_getters?:H.BlockGetters;

  private test_block_provider_factory?:H.TestBlockProviderFactory;
  private test_block_getters?:H.BlockGetters;

  private benchmark_block_provider_factory?:H.BenchmarkBlockProviderFactory;
  private benchmark_block_getters?:H.BlockGetters;

  public constructor(private spec:HeartSpec1) {
    const { basic_blocks_requirements, compiler_requirements, configuration, logger, workspace_requirements } = spec;
    let logger_ = logger;
    console.log(spec);
    if (logger_ == undefined) {
      const cwarn = console.warn.bind(console);
      const cerr = console.error.bind(console);
      const clog = console.log.bind(console);
      logger_ = <any>{
        fatal: cerr,
        error: cerr,
        warn: cwarn,
        info: clog,
        debug: clog,
        trace: clog,
      };
    }
    this.container = get_instance({
      configuration: configuration || {},
      basic_blocks_requirements,
      compiler_requirements,
      logger: <any>logger_,
      workspace_requirements,
    });
    console.log(this.container._bindingDictionary._map);
  }

  public get_event_bus() : P.EventBus {
    if (this.event_bus == undefined) {
      this.event_bus = as_public_event_bus(
          this.container.get<H.EventBusPrivate>(BINDING.EventBus));
    }
    return this.event_bus;
  }

  public get_compiler() : MaybeCompiler {
    if (this.compiler == undefined) {
      if (this.spec.compiler_requirements == undefined) {
        return r.fail('Heart compiler requirements unfulfilled, cannot get compiler');
      }
      this.compiler = this.container.get<H.Compiler>(BINDING.Compiler);
    }
    return r.success(this.compiler);
  }

  public get_util() : P.Util {
    if (this.util == undefined) {
      this.util = this.container.get<H.Util>(BINDING.Util);
    }
    return this.util;
  }

  public get_runtime_data() : P.RuntimeData {
    if (this.runtime_data == undefined) {
      this.runtime_data = this.container.get<H.RuntimeData>(BINDING.RuntimeData);
    }
    return this.runtime_data;
  }

  public get_runtime_manager() : P.RuntimeManager {
    if (this.runtime_manager == undefined) {
      this.runtime_manager = this.container.get<H.RuntimeManager>(BINDING.RuntimeManager);
    }
    return this.runtime_manager;
  }

  public get_block_registry() : P.BlockRegistry {
    if (this.block_registry == undefined) {
      this.block_registry = this.container.get<H.BlockRegistry>(BINDING.BlockRegistry);
    }
    return this.block_registry;
  }

  public get_block_xml_builder(
      _block_provider:BP.BlockProvider,
  ) : MaybeBlockXMLBuilder {
    if (this.block_xml_builder_factory == undefined) {
      if (this.spec.workspace_requirements == undefined) {
        return r.fail('Heart workspace requirements unfulfilled, cannot get xml builder factory.');
      }
      this.block_xml_builder_factory = this.container.get<H.BlockXMLBuilderFactory>(
          BINDING.BlockXmlBuilderFactory);
    }
    return r.success(this.block_xml_builder_factory.create(_block_provider));
  }

  public get_toolbox(
      toolbox_config:toolbox.ToolboxConfig,
      _block_xml:P.BlockXML,
  ) : P.Toolbox {
    if (this.toolbox_factory == undefined) {
      this.toolbox_factory = this.container.get<H.ToolboxFactory>(BINDING.ToolboxFactory);
    }
    return this.toolbox_factory.create(
        toolbox_config,
        _block_xml,
    );
  }

  public get_assertion_tool() : P.TestAssertionTool {
    if (this.assertion_tool == undefined) {
      this.assertion_tool = this.container.get<H.TestAssertionTool>(BINDING.TestAssertionTool);
    }
    return this.assertion_tool;
  }

  public basic_blocks() {
    if (this.basic_block_provider_factory == undefined) {
      this.basic_block_provider_factory =
          this.container.get<H.BasicBlockProviderFactory>(BINDING.BasicBlockProviderFactory);
    }

    const bbpf = this.basic_block_provider_factory;

    return {
      // Asking Heart to load the RuntimeProvider for Basic Blocks has no
      // requirements, so can be done here. This will be called by non-IDE
      // environments.
      load_runtime_provider: () => {
        this.get_block_registry().register_runtime_provider(bbpf.runtime_provider());
      },
      // Asking Heart for the BlockProvider and BlockXML for Basic Blocks§ does
      // which the get_block_provider and get_block_xml functions are availalbe.
      init: (basic_block_config_deps:P.BasicBlockConfigDependencies) => {
        if (this.basic_block_getters == undefined) {
          // have requirements. So the init() function must be called first, after
          this.basic_block_getters = bbpf.block_provider_and_xml(basic_block_config_deps);
        }
        const bbg = this.basic_block_getters;
        return {
          get_block_provider: () => {
            return bbg.get_block_provider();
          },
          get_block_xml: () => {
            return bbg.get_default_block_xml();
          },
        };
      },
    };
  }

  public test_blocks(
    ava_like_test_object:P.AvaTestLike,
  ) {
    if (this.test_block_provider_factory == undefined) {
      this.test_block_provider_factory =
          this.container.get<H.TestBlockProviderFactory>(BINDING.TestBlockProviderFactory);
    }

    const bbpf = this.test_block_provider_factory;

    return {
      load_runtime_provider: () => {
        this.get_block_registry().register_runtime_provider(bbpf.runtime_provider(ava_like_test_object));
      },
      init: (test_icon_url:string) => {
        if (this.test_block_getters == undefined) {
          this.test_block_getters = bbpf.block_provider_and_xml(
            test_icon_url,
            ava_like_test_object,
          );
        }
        const bbg = this.test_block_getters;
        return {
          get_block_provider: () => {
            return bbg.get_block_provider();
          },
          get_block_xml: () => {
            return bbg.get_default_block_xml();
          },
        };
      },
    };
  }

  public benchmark_blocks(
    benchmark_tool:P.BenchmarkTool,
  ) {
    if (this.benchmark_block_provider_factory == undefined) {
      this.benchmark_block_provider_factory =
          this.container.get<H.BenchmarkBlockProviderFactory>(BINDING.BenchmarkBlockProviderFactory);
    }

    const bbpf = this.benchmark_block_provider_factory;

    return {
      load_runtime_provider: () => {
        this.get_block_registry().register_runtime_provider(bbpf.runtime_provider(benchmark_tool));
      },
      init: (benchmark_icon_url:string) => {
        if (this.benchmark_block_getters == undefined) {
          this.benchmark_block_getters = bbpf.block_provider_and_xml(
            benchmark_icon_url,
            benchmark_tool,
          );
        }
        const bbg = this.benchmark_block_getters;
        return {
          get_block_provider: () => {
            return bbg.get_block_provider();
          },
          get_block_xml: () => {
            return bbg.get_default_block_xml();
          },
        };
      },
    };
  }

  public create_domain_function_error(error_properties:basic_types.ClientErrorProperties) : Catastrophe {
    const util = this.container.get<H.Util>(BINDING.Util);
    const annotation = {
      client_annotation: error_properties,
    };
    if (error_properties.native_error != undefined) {
      return util.ohno.client.domain_function_error(
          error_properties.native_error,
          annotation,
      );
    }
    return util.ohno.client.domain_function_error(annotation);
  }

  public set_config(config:H.PartialHeartConfig) {
    this.container.get<H.Config>(BINDING.Config).set(config);
  }
}

export function new_heart(spec:HeartSpec) : Heart {
  // Migrating heart spec can happen here
  // TODO consider if we will return different
  // types or if we will be backwards compatible
  // always
  return new Heart(spec);
}

// Forced imports from EventBus
import { Container } from 'inversify';
import {
  EventBuffer,
  EventBus,
  EventCategories,
  Neko,
  SignalNeko,
} from 'nekobasu/build/interfaces';
import {
  ISimpleEvent,
} from 'nekobasu/build/util';
import {
  BuiltinEventNeko,
} from 'nekobasu/build/builtin';
import {
  InstrumentedLast,
} from 'nekobasu/build/builtin_event_buffers';
