import * as I from './interfaces';
import { BLOCK_COLOUR } from '../blockly/block_data';
import { get_block_icons } from '../blockly/block_data';

function create_icon_config(blockly:any, src:any, is_head = false) {
  return {
    type: 'field_icon',
    src: src,
    width: is_head ? blockly.BlockSvg.START_HAT_ICON_HEIGHT * 2 : blockly.BlockSvg.TYPE_ICON_WIDTH,
    height: is_head ? blockly.BlockSvg.START_HAT_ICON_HEIGHT * 2 : blockly.BlockSvg.TYPE_ICON_HEIGHT,
    is_head: is_head,
    alt: '*',
  };
}

export function get_block_config(blockly:I.Blockly) : (blockly:I.Blockly) => I.BlockConfigDict {
  const icon_urls = get_block_icons();

  const control_icon = icon_urls.block_control_icon;
  const list_icon = icon_urls.block_list_icon;
  const variable_icon = icon_urls.block_variables_icon;
  const sensing_icon = icon_urls.block_sensing_icon;
  const event_icon = icon_urls.block_events_icon;
  const msg_icon = icon_urls.block_msg_icon;
  const procedure_icon = icon_urls.block_procedure_icon;
  const actions_icon = icon_urls.block_actions_icon;
  const appearance_icon = icon_urls.block_appearance_icon;

  return (blockly:I.Blockly) => ({
    // 'wait': {
    //   message0: blockly.Msg['wait'],
    //   args0: [
    //   ],
    //   previousStatement: null,
    //   nextStatement: null,
    //   colour: BLOCK_COLOUR.control,
    //   inputsInline: true,
    // }
  } as I.BlockConfigDict);
}
