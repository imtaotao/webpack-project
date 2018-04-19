import * as I from './interfaces';
import { interfaces as H } from 'src/codemao-heart';

import { get_block_config } from './block_config';
import { get_block_xml } from './block_xml';
import { get_domain_functions } from './functions';
import { get_events } from './events';

import { CmBlockly } from 'cmblockly';
import { heart } from '../heart/index';

export function init_codemon_provider() : any {
  const block_provider = {
    namespace: () => '',
    config: get_block_config(CmBlockly as I.Blockly),
    action_types: get_events(heart, undefined).get_action_specs,
    domain_functions: get_domain_functions(),
  };
  return block_provider;
}

export function init_codemon_xml(block_xml:H.BlockXMLBuilder) : any {
  return get_block_xml(block_xml);
}