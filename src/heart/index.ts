import * as r from 'resul-ts';
import $ from 'jquery';
import * as _ from 'lodash';
import {
  Heart,
  HeartSpec,
  basic_types as HB,
  block_provider,
  interfaces,
  toolbox,
  new_heart,
} from 'src/codemao-heart';
import { CmBlockly } from 'cmblockly';

export type BlockXML = interfaces.BlockXML;
export type ToolboxCategoryConfig = toolbox.ToolboxCategoryConfig;
export type CompiledBlock = HB.CompiledBlock;
export type CompiledEntity = HB.CompiledEntity;
export type AssertionToolResult = interfaces.AssertionToolResult;
export const namespaced_id = block_provider.namespaced_id;
interface BlockData {
  provider:interfaces.BlockProvider;
  xml:interfaces.BlockXML;
}
let _heart:Heart|undefined;

const ENTITY_ID = 'HeartIDE';

function instantiate_heart() : Heart {
  const HEART_CONFIG:HeartSpec = {
    version: 1,
    logger: <any>{
      fatal: console.error,
      error: console.error,
      warn: console.log,
      info: console.log,
      debug: console.log,
      trace: console.log,
    },
    compiler_requirements: {
      dom_parser: new DOMParser(),
    },
    configuration: {
      should_report_current_running_block: true,
    },
    workspace_requirements: {
      blockly: <any>CmBlockly,
      // j_query: $,
    },
    basic_blocks_requirements: {
      day_names: <any>CmBlockly.Msg['week'],
    },
  };

  const heart_instance:Heart = new_heart(HEART_CONFIG);

  heart_instance.get_event_bus().error.all.immediate.sub((e) => {
    console.error(e);
  });

  heart_instance.get_event_bus().warning.all.immediate.sub((e) => {
    console.warn(e);
  });
  return heart_instance;
}

export function heart() : Heart {
  if (_heart != undefined) { return _heart; }
  _heart = instantiate_heart();
  return <Heart>_heart;
}

export function get_basic_blocks(basic_block_conf_dependencies:interfaces.BasicBlockConfigDependencies) : BlockData {
  const basic_block = heart().basic_blocks().init(
    basic_block_conf_dependencies,
  );
  const maybe_basic_block_xml = basic_block.get_block_xml();
  if (r.is_fail(maybe_basic_block_xml)) {
    throw new Error(maybe_basic_block_xml.message);
  }
  return {
    provider: basic_block.get_block_provider(),
    xml: maybe_basic_block_xml.result,
  };
}

export function register_provider(provider:interfaces.BlockProvider) {
  const block_registry = heart().get_block_registry();
  block_registry.register_provider(provider);
}

export function get_toolbox(blocks_xml:BlockXML, actor_toolbox_config:ToolboxCategoryConfig[]) {
  const toolbox = heart().get_toolbox(
      {
        id: 'empty_actor_id',
        type: 'actor',
        categories: actor_toolbox_config,
      },
      blocks_xml,
  );
  return toolbox;
}

export function compile_xml(xml:string) {
  const maybe_compiler = heart().get_compiler();
  if (r.is_error(maybe_compiler)) {
    throw new Error(maybe_compiler.message);
  }
  const compiler = maybe_compiler.result;
  const maybe_compiled = compiler.compile(
      [{
        id: ENTITY_ID,
        blocksXML: xml,
      }],
      undefined,
  );
  if (r.is_error(maybe_compiled)) {
    throw new Error(maybe_compiled.message);
  }
  return maybe_compiled.result;
}

export function initial_runtime(complied_xml:CompiledEntity) {
  const rm = heart().get_runtime_manager();
  rm.clear();
  const assert = heart().get_assertion_tool();
  assert.reset();
  _.forOwn(complied_xml.procedures, (p_script:any, p_name:any) => {
    rm.procedure_load(ENTITY_ID, p_name, p_script);
  });
  _.forOwn(complied_xml.compiled_block_map, (script:CompiledBlock, code_id:string) => {
    rm.initialize_runnable({
      identities: {
        source_map_entity: ENTITY_ID,
        source_map_rbid: code_id,
        target_entity: ENTITY_ID,
        interpreter_id: code_id,
        typeclass_id: ENTITY_ID,
      },
      script,
      group_id: undefined,
    });
  });
}

export function get_test_result() {
  const assert = heart().get_assertion_tool();
  return assert.get_result();
}
