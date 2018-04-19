import $ from 'jquery';
import * as _ from 'lodash';
import * as r from 'resul-ts';

import { CmBlockly } from 'cmblockly';
import * as Procedure from './procedure';

import {
  heart,
  BlockXML,
  get_basic_blocks,
  register_provider,
  get_toolbox,
  compile_xml,
} from '../heart';

import {
  init_codemon_provider,
  init_codemon_xml,
} from '../codemao';

import {
  get_block_icons,
  BLOCK_COLOUR,
  actor_toolbox_config,
  blockly_en_US,
} from './block_data';

import {
  blockly_zh_CN,
} from '../i18n/blockly_zh_CN';

export interface BlocklyInitConfig {
  get_variables:Function;
  language:number;
}

export function init(selector:string, config:BlocklyInitConfig) {
  set_blockly_language(config.language);
  const blocks_xml = init_blocks(config.get_variables);
  const toolbox = get_toolbox(blocks_xml, actor_toolbox_config());
  const styles = toolbox.get_styles();
  append_styles_to_head(styles);
  inject_workspace(selector, toolbox.get_xml());
  set_toolbox_category_styles();
  // add change listener
  CmBlockly.mainWorkspace.addChangeListener(workspace_on_change);
}

function append_styles_to_head(styles:string[]) {
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    $(style).appendTo('head');
  }
}

function set_blockly_language(language:number) {
  // TODO en
  if (language == 0) {
    CmBlockly.Msg = _.assign(CmBlockly.Msg, blockly_zh_CN);
  }
}

function init_blocks(get_variables:Function) {
  const basic_block_conf_dependencies = {
    get_icon_urls: get_block_icons,
    get_variables,
    get_entities: () => {},
    get_block_colors: () => BLOCK_COLOUR,
    get_procedure_parameters: Procedure.get_procedure_parameters,
  };
  const basic_block_data = get_basic_blocks(basic_block_conf_dependencies as any);
  const codemon_provider = init_codemon_provider();
  const get_codemon_builder = heart().get_block_xml_builder(codemon_provider) as any;
  const codemon_xml = init_codemon_xml(get_codemon_builder.result);
  register_provider(basic_block_data.provider);
  register_provider(codemon_provider);
  return _.assign(basic_block_data.xml, codemon_xml);
}

function inject_workspace(selector:string, toolbox_xml:string) {
  const scale = 1
  CmBlockly.inject(
      selector,
      {
        toolbox: toolbox_xml,
        zoom: {
          controls: false,
          wheel: false,
          startScale: scale,
          maxScale: scale,
          minScale: scale,
          scaleSpeed: 1.2,
        },
        trashcan: false,
      },
      {
        procedures_callback: {
          show_input_dialog: Procedure.show_input_dialog,
          classify_procedures: Procedure.classify_procedures,
          get_project: Procedure.get_project,
          get_workspace_panel: Procedure.get_workspace_panel,
          get_prevent_flag: Procedure.should_prevent_procedure_rename,
        },
      },
  );
}

function set_toolbox_category_styles() {
  const $treeitems = $('.blocklyToolboxDiv [role="treeitem"]');
  $treeitems.each((n:number, item:Element) => {
    const category_name = $(item).find('.blocklyTreeLabel').text();
    $(item).attr('category-name', category_name);
  });
}

export function get_workspace_xml() {
  let str = (<any>CmBlockly).Xml.domToText((<any>CmBlockly).Xml.workspaceToDom(CmBlockly.mainWorkspace));
  str = str.substr(str.indexOf('</variables>') + 12);
  str = str.substr(0, str.lastIndexOf('</xml>'));
  return str;
}

export function set_workspace_xml(xml:string) {
  reset_workspace();
  const new_xml = $('<div></div>').html(xml).get(0);
  Procedure.set_prevent_procedure_rename(true);
  (<any>CmBlockly).Xml.domToWorkspace(new_xml, CmBlockly.mainWorkspace);
  Procedure.set_prevent_procedure_rename(false);
}

function workspace_on_change() {
  Procedure.delete_all_procedures();
  const xml = get_workspace_xml();
  const compiled = compile_xml(xml);
  Procedure.set_compiled_data(compiled[0]);
}

function check_block_exist(blockType:string) {
  const blocks = CmBlockly.mainWorkspace.getAllBlocks();
  console.log(`target delete block: ${blockType}, block length: ${blocks.length}`);
  for (const b of blocks) {
    // console.log(`block: ${b.type}`);
    if (b.type === blockType) {
      return true;
    }
    if (check_child_blocks_exist(b, blockType)) {
      return true;
    }
  }
  return false;
}

function check_child_blocks_exist(block:any, blockType:string) : any {
  const blocks = block.getChildren();
  console.log(`block: ${block.type} child blocks length: ${blocks.length}`);
  for (const b of blocks) {
    console.log(`child block: ${b.type}`);
    if (b.type === blockType) {
      return true;
    }
    if (b.getChildren().length === 0) { continue; }
    if (check_child_blocks_exist(b, blockType)) { return true; }
  }
}

export function clean_up_workspace() {
  CmBlockly.mainWorkspace.cleanUp();
}

export function reset_workspace() {
  Procedure.delete_all_procedures();
  CmBlockly.mainWorkspace.clear();
}

export function unhighlight_error_block(blockId:string) {
  const error_block = Blockly.mainWorkspace.getBlockById(blockId);
  if (error_block) {
    error_block.removeError();
  }
}