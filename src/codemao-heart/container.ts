import _defaultsDeep from 'lodash/defaultsDeep';
import { Container } from 'inversify';

import * as H from './di_interfaces';
import { BINDING } from './di_symbols';

import { ActionStateStoreImpl } from './action_state_store';
import { BasicBlockProviderFactoryImpl } from './basic_blocks';
import { BlockInterpreterFactoryImpl } from './block_interpreter';
import { BlockPoolImpl } from './block_pool';
import { BlockPredicatesImpl } from './block_predicates';
import { BlockRegistryImpl } from './block_registry';
import { BlockUtilImpl } from './block_util';
import { BlockXMLBuilderFactoryImpl } from './block_xml';
import { Blockly } from './blockly_interface';
import { ConfigImpl, PartialHeartConfig } from './config';
import { DEFAULT_DAY_NAMES } from './basic_blocks/day_names';
import { DOMParser } from './dom_parser';
import { DOMParserCompilerImpl } from './dom_compiler';
import { DayNames } from './basic_types';
import { HtmlParserCompilerImpl } from './html_compiler';
import { OptiCompilerImpl } from './opti/compiler';
import { OptiProgramCacheImpl } from './opti/program_cache';
import { OptiRunnerFactory } from './opti/factory';
import { PRNGFactoryImpl } from './prng_factory';
import { RuntimeDataImpl } from './runtime_data';
import { RuntimeManagerImpl } from './runtime_manager';
import { TaskManagerImpl } from './task_manager';
import { TestBlockProviderFactoryImpl } from './test_blocks/index';
import { BenchmarkBlockProviderFactoryImpl } from './benchmark_blocks/index';
import { TestAssertionToolImpl } from './test_blocks/assert';
import { ToolboxFactoryImpl } from './toolbox';
import { UtilImpl } from './util';
import { ohno } from './error_types';

import {
  create_event_bus,
  as_public_event_bus,
} from './event/event_bus';

export interface DomCompilerSpec {
    dom_parser:DOMParser;
}

export interface HtmlCompilerSpec {
    html_parser:any;
}

export interface InstanceSpec {
  configuration:PartialHeartConfig;
  logger:H.Logger;
  compiler_requirements?:DomCompilerSpec|HtmlCompilerSpec;
  workspace_requirements?:{
    blockly:Blockly;
  };
  basic_blocks_requirements?:BasicBlockRequirementsSpec;
}

export interface BasicBlockRequirementsSpec {
  day_names:DayNames;
}

const DEFAULT_BASIC_BLOCKS_REQUIREMENTS = {
  day_names: DEFAULT_DAY_NAMES,
};

export function get_instance(spec:InstanceSpec) {

  spec.basic_blocks_requirements = <BasicBlockRequirementsSpec>_defaultsDeep(
    spec.basic_blocks_requirements,
    DEFAULT_BASIC_BLOCKS_REQUIREMENTS,
  );

  const cont = new Container();

  cont.bind<H.Logger>(BINDING.Log)
      .toConstantValue(spec.logger);

  const event_bus = create_event_bus();
  cont.bind<H.EventBusPrivate>(BINDING.EventBus)
      .toConstantValue(event_bus);

  // Config depends on event_bus, and many other components depend on Config
  cont.bind<H.Config>(BINDING.Config)
      .to(ConfigImpl)
      .inSingletonScope();

  // Assign initial configuration file
  const config = cont.get<H.Config>(BINDING.Config);
  config.set(spec.configuration);

  if (spec.workspace_requirements != undefined) {
    const {blockly} = spec.workspace_requirements;
    cont.bind<Blockly>(BINDING.Blockly)
        .toConstantValue(blockly);
    cont.bind<H.BlockXMLBuilderFactory>(BINDING.BlockXmlBuilderFactory)
        .to(BlockXMLBuilderFactoryImpl)
        .inSingletonScope();
  }

  const has_dom_parser = spec.compiler_requirements && (<DomCompilerSpec>spec.compiler_requirements).dom_parser;
  const has_html_parser = spec.compiler_requirements && (<HtmlCompilerSpec>spec.compiler_requirements).html_parser;

  if (has_dom_parser) {
    cont.bind<DOMParser>(BINDING.DOMParser)
        .toConstantValue((<DomCompilerSpec>spec.compiler_requirements).dom_parser);
    cont.bind<H.Compiler>(BINDING.Compiler)
        .to(DOMParserCompilerImpl)
        .inSingletonScope();
  } else if (has_html_parser) {
    cont.bind<any>(BINDING.HtmlParser)
        .toConstantValue((<HtmlCompilerSpec>spec.compiler_requirements).html_parser);
    cont.bind<H.Compiler>(BINDING.Compiler)
        .to(HtmlParserCompilerImpl)
        .inSingletonScope();
  }

  cont.bind<DayNames>(BINDING.DayNames)
      .toConstantValue(spec.basic_blocks_requirements.day_names);

  cont.bind<H.Ohno>(BINDING.Ohno)
      .toConstantValue(ohno);

  cont.bind<H.ActionStateStore>(BINDING.ActionStateStore)
      .to(ActionStateStoreImpl)
      .inSingletonScope();

  cont.bind<H.RuntimeData>(BINDING.RuntimeData)
      .to(RuntimeDataImpl)
      .inSingletonScope();

  cont.bind<H.BlockInterpreterFactory>(BINDING.BlockInterpreterFactory)
      .to(BlockInterpreterFactoryImpl)
      .inSingletonScope();

  cont.bind<H.OptiProgramCache>(BINDING.OptiProgramCache)
      .to(OptiProgramCacheImpl)
      .inSingletonScope();

  cont.bind<H.BlockInterpreterFactory>(BINDING.OptiRunnerFactory)
      .to(OptiRunnerFactory)
      .inSingletonScope();

  cont.bind<H.BasicBlockProviderFactory>(BINDING.BasicBlockProviderFactory)
      .to(BasicBlockProviderFactoryImpl)
      .inSingletonScope();

  cont.bind<H.PRNGFactory>(BINDING.PRNGFactory)
      .to(PRNGFactoryImpl)
      .inSingletonScope();

  cont.bind<H.TestBlockProviderFactory>(BINDING.TestBlockProviderFactory)
      .to(TestBlockProviderFactoryImpl)
      .inSingletonScope();

  cont.bind<H.BenchmarkBlockProviderFactory>(BINDING.BenchmarkBlockProviderFactory)
      .to(BenchmarkBlockProviderFactoryImpl)
      .inSingletonScope();

  cont.bind<H.TestAssertionTool>(BINDING.TestAssertionTool)
      .to(TestAssertionToolImpl)
      .inSingletonScope();

  cont.bind<H.ToolboxFactory>(BINDING.ToolboxFactory)
      .to(ToolboxFactoryImpl)
      .inSingletonScope();

  cont.bind<H.BlockRegistry>(BINDING.BlockRegistry)
      .to(BlockRegistryImpl)
      .inSingletonScope();

  cont.bind<H.BlockPool>(BINDING.BlockPool)
      .to(BlockPoolImpl)
      .inSingletonScope();

  cont.bind<H.BlockPredicates>(BINDING.BlockPredicates)
      .to(BlockPredicatesImpl)
      .inSingletonScope();

  cont.bind<H.OptiCompiler>(BINDING.OptiCompiler)
      .to(OptiCompilerImpl)
      .inSingletonScope();

  cont.bind<H.RuntimeManager>(BINDING.RuntimeManager)
      .to(RuntimeManagerImpl)
      .inSingletonScope();

  cont.bind<H.TaskManager>(BINDING.TaskManager)
      .to(TaskManagerImpl)
      .inSingletonScope();

  cont.bind<H.BlockUtil>(BINDING.BlockUtil)
      .to(BlockUtilImpl)
      .inSingletonScope();

  cont.bind<H.Util>(BINDING.Util)
      .to(UtilImpl)
      .inSingletonScope();

  return cont;
}
