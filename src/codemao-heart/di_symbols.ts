// We use strings instead of Symbol because we don't
// want problems when running on older JS interpreters

export const BINDING = {

  // General Singletons
  BlockUtil: 'BlockUtil',
  Config: 'Config',
  Log: 'Log', // May also be given by client
  Ohno: 'Ohno',
  Util: 'Util',

  // Singletons
  ActionStateStore: 'ActionStateStore',
  BlockPool: 'BlockPool',
  BlockPredicates: 'BlockPredicates',
  BlockRegistry: 'BlockRegistry',
  Broadcasts: 'Broadcasts',
  Compiler: 'Compiler',
  EventBus: 'EventBus',
  OptiCompiler: 'OptiCompiler',
  OptiProgramCache: 'OptiProgramCache',
  RuntimeData: 'RuntimeData',
  RuntimeManager: 'RuntimeManager',
  TaskManager: 'TaskManager',
  TestAssertionTool: 'TestAssertionTool',
  BenchmarkTool: 'BenchmarkTool',

  // Factories
  BasicBlockProviderFactory: 'BasicBlockProviderFactory',
  BlockInterpreterFactory: 'BlockInterpreterFactory',
  BlockXmlBuilderFactory: 'BlockXmlBuilderFactory',
  EventBufferFactory: 'EventBufferFactory',
  OptiRunnerFactory: 'OptiRunnerFactory',
  PRNGFactory: 'PRNGFactory',
  TestBlockProviderFactory: 'TestBlockProviderFactory',
  BenchmarkBlockProviderFactory: 'BenchmarkBlockProviderFactory',
  ToolboxFactory: 'ToolboxFactory',

  // Dependencies
  Blockly: 'Blockly',
  DOMParser: 'DOMParser',
  HtmlParser: 'HtmlParser',
  DayNames: 'DayNames',

};
