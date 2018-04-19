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

    const message:BlockConfigArg = {
      type: 'input_value',
      name: 'message',
      check: 'String',
      align: 'CENTRE',
    };

    const block_config:BlockConfigDict = {

      plan: {
        message0: 'Plan %1 assertions %2',
        args0: [
          {
            type: 'input_value',
            name: 'n_planned_assertions',
            check: 'Number',
            align: 'CENTRE',
          },
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: test_color,
        inputsInline: true,
      },

      fail: {
        message0: 'Fail (%1) %2',
        args0: [
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: '#661515',
        inputsInline: true,
      },

      pass: {
        message0: 'Pass (%1) %2',
        args0: [
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: '#156615',
        inputsInline: true,
      },

      truthy: {
        message0: 'Is truthy: %1 (%2) %3',
        args0: [
          {
            type: 'input_value',
            name: 'value',
          },
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: test_color,
        inputsInline: true,
      },

      falsy: {
        message0: 'Is falsy: %1 (%2) %3',
        args0: [
          {
            type: 'input_value',
            name: 'value',
          },
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: test_color,
        inputsInline: true,
      },

      is: {
        message0: 'Expect %1 to be %2 (%3) %4',
        args0: [
          {
            type: 'input_value',
            name: 'value',
          },
          {
            type: 'input_value',
            name: 'expected',
          },
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: test_color,
        inputsInline: true,
      },

      not: {
        message0: 'Expect %1 to NOT be %2 (%3) %4',
        args0: [
          {
            type: 'input_value',
            name: 'value',
          },
          {
            type: 'input_value',
            name: 'expected',
          },
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: test_color,
        inputsInline: true,
      },

      done: {
        message0: 'Test is done %1',
        args0: [
          icon_config,
        ],
        previousStatement: null,
        nextStatement: undefined,
        tooltip: '',
        colour: test_color,
        inputsInline: true,
      },

      bad_promise: {
        message0: 'Promise: Fail with message %1 %2',
        args0: [
          message,
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.sensing,
        inputsInline: true,
      },

      good_promise: {
        message0: 'Promise: Return %1 in %2 milliseconds %3',
        args0: [
          {
            type: 'input_value',
            name: 'returns',
          },
          {
            type: 'input_value',
            name: 'milliseconds',
            check: 'Number',
            align: 'CENTRE',
          },
          icon_config,
        ],
        previousStatement: undefined,
        nextStatement: undefined,
        tooltip: '',
        colour: block_colors.sensing,
        output: ['String'],
        inputsInline: true,
      },

      call_user_procedure: {
        message0: 'Call user procedure %1 arg one is %2 %3',
        args0: [
          {
            type: 'input_value',
            name: 'function_id',
          },
          {
            type: 'input_value',
            name: 'argone',
          },
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.procedure,
        inputsInline: true,
      },

      send_test_action: {
        message0: 'Send test action with parameter %1 %2',
        args0: [
          {
            type: 'input_value',
            name: 'parameter_value',
          },
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.events,
        inputsInline: true,
      },

      'get_test_action_parameter': {
        message0: 'test action parameter',
        args0: [],
        previousStatement: undefined,
        nextStatement: undefined,
        tooltip: '',
        colour: block_colors.events,
        output: ['String'],
        inputsInline: true,
      },

      'on_test_action': {
        message0: 'On test action %1 %2',
        args0: [
          {
            type: 'input_dummy',
            align: 'CENTRE',
          },
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        tooltip: '',
        colour: block_colors.events,
        inputsInline: true,
      },

      create_entity_instance: {
        message0: 'Create entity instance %1 %2',
        args0: [
          {
            type: 'input_value',
            name: 'typeclass_id',
            check: 'String',
            align: 'CENTRE',
          },
          icon_config,
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: '#156615',
        inputsInline: true,
      },

      'pull_event_test': {
        message0: 'Pull event test %1 %2',
        args0: [
          {
            type: 'input_dummy',
            align: 'CENTRE',
          },
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        colour: block_colors.events,
        inputsInline: true,
      },

    };

    return block_config;
  };
}
