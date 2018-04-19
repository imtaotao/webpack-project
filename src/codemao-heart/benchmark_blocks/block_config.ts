import { Blockly } from '../blockly_interface';
import { BlockConfigArg, BlockConfigDict, namespaced_id } from '../block_provider';
import * as P from '../public_interfaces';

const block_colors:P.BlockColors = {
  green: '#8dca87',
  darkBlue: '#708DD7',
  purple: '#BA93D5',
  blue: '#61c3e2',
  pink: '#ea8fc6',
  yellow: '#fccd77',
  orange: '#f69667',
  red: '#f47270',
  actions: '#F46767',
  control: '#68CDFF',
  appearance: '#E76CEA',
  sensing: '#6BCD47',
  sound: '#A073FF',
  pen: '#2BCAA7',
  operators: '#FBBA9D',
  variables: '#FFC063',
  events: '#608FEE',
  physics: '#C73E3B',
  lists: '#FFDB63',
  procedure: '#F08F63',
  building: '#59B292',
  advanced: '#14B390',
};

const test_color = '#505050';

export function get_block_config(
    test_icon_url:string,
) : (blockly:Blockly) => BlockConfigDict {

  /* tslint:disable:no-null-keyword */
  return function test_block_config(blockly:Blockly) : BlockConfigDict {

    const icon_config:BlockConfigArg = {
      type: 'field_icon',
      src: test_icon_url,
      width: blockly.BlockSvg.TYPE_ICON_WIDTH,
      height: blockly.BlockSvg.TYPE_ICON_HEIGHT,
      is_head: false,
      alt: '*',
    };

    const bench_colour = '#CC4F14';

    const block_config:BlockConfigDict = {

      start_iteration: {
        message0: 'Start iteration %1',
        args0: [
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: bench_colour,
        inputsInline: true,
      },

      finish_iteration: {
        message0: 'Finish iteration %1',
        args0: [
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: bench_colour,
        inputsInline: true,
      },

      set: {
        message0: 'Set row %1 to %2 %3',
        args0: [
          {
            type: 'input_value',
            name: 'key',
            check: 'String',
            align: 'CENTRE',
          },
          {
            type: 'input_value',
            name: 'value',
            check: ['String', 'Number'],
          },
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: bench_colour,
        inputsInline: true,
      },

    };

    return block_config;
  };
}
