import _defaultsDeep from 'lodash/defaultsDeep';

import { Blockly } from '../blockly_interface';
import { BlockConfigDict } from '../block_provider';
import * as P from '../public_interfaces';

const DEFAULT_BLOCK_COLORS:P.BlockColors = {
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

// TODO Require i18n strings in BasicBlockConfigDependencies

const DEFAULT_MSG:{[int_key:string]:string} = {
  start_on_click: '%1 When Start clicked',
  self_listen: '%1 When I receive %2 %3 %4',
  self_broadcast: 'Broadcast %1 %2',
  on_running_group_activated: '%1 On running group activated',
  repeat_forever: 'Forever %1 %2 %3',
  repeat_n_times: 'Repeat %1 times %2 %3 %4',
  repeat_forever_until: 'Repeat forever until %1 %2 %3 %4',
  break: 'Quit loop %1',
  tell: 'Make %1 run %2 %3 %4',
  sync_tell: 'Make %1 run and wait %2 %3 %4',
  warp: 'Warp %1 %2 %3',
  wait_secs: 'Wait %1 secs %2',
  wait_until: 'Wait until %1 %2',
  destruct: 'Destruct %1',
  get_time: 'Current %1',
  year: 'Year',
  month: 'Month',
  date: 'Date',
  week:  <any>{
    week: 'Week',
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  },
  hour: 'Hour',
  minute: 'Mintue',
  second: 'Second',
  timer: 'Timer',
  reset_timer: 'Reset timer %1',
  random_num: 'Pick random %1 to %2',
  divisible_by: '%1 is divisible by %2',
  calculate: 'Math expression %1',
  CALCULATE_TOOLTIPS: 'Enter math expression and calculate the results quickly',
  text_select: 'Substring of %1 from %2 to %3',
  text_length: 'Length of %1',
  text_contain: '%1 contains %2',
  text_split: 'Split %1 by %2',
  variables_get: '%1',
  variables_set: 'Set variable %1 to %2 %3',
  VARIABLES_SET_TOOLTIP: '',
  VARIABLES_SET_HELPURL: '',
  change_variable: '%2 variable %1 by %3 %4',
  increase: 'Increase',
  decrease: 'Decrease',
  VARIABLES_CHANGE_TOOLTIPS: '',
  lists_get: '%1',
  lists_append: 'Append %1 to the last of list %2 %3',
  LISTS_APPEND_TOOLTIPS: '',
  lists_insert_value: 'Insert %3 at %2 of %1 %4',
  LISTS_INSERT_INDEX_TOOLTIPS: '',
  lists_copy: 'Copy lists %2 to %1 %3',
  lists_length: 'Get the length of list %1',
  LISTS_GET_LENGTH_TOOLTIPS: '',
  lists_is_exist: 'If list %1 contains %2',
  LISTS_IS_EXIST_TOOLTIPS: '',
  lists_index_of: 'Index of %1 in %2',
  procedures_parameter: 'Parameter %1',
  procedures_return_value: 'Return %1 %2',
  days_after_2000: 'days after 2000',
};

function create_icon_config(blockly:Blockly, src:any, is_head = false) {
  return {
    type: 'field_icon',
    src: src,
    width: is_head ? blockly.BlockSvg.START_HAT_ICON_HEIGHT * 2 : blockly.BlockSvg.TYPE_ICON_WIDTH,
    height: is_head ? blockly.BlockSvg.START_HAT_ICON_HEIGHT * 2 : blockly.BlockSvg.TYPE_ICON_HEIGHT,
    is_head: is_head,
    alt: '*',
  };
}

export function get_block_config(
    deps:P.BasicBlockConfigDependencies,
) : (blockly:Blockly) => BlockConfigDict {

  const get_variables = deps.get_variables;
  const get_entities = deps.get_entities;
  const icon_urls = deps.get_icon_urls();
  const block_colors = <P.BlockColors>_defaultsDeep(
    deps.get_block_colors == undefined ? {} : deps.get_block_colors(),
    DEFAULT_BLOCK_COLORS,
  );

  const start_icon = icon_urls.block_start_icon;
  const control_icon = icon_urls.block_control_icon;
  const list_icon = icon_urls.block_list_icon;
  const variable_icon = icon_urls.block_variables_icon;
  const sensing_icon = icon_urls.block_sensing_icon;
  const event_icon = icon_urls.block_events_icon;
  const msg_icon = icon_urls.block_msg_icon;
  const procedure_icon = icon_urls.block_procedure_icon;
  const advanced_icon = icon_urls.block_advanced_icon;

  function to_drop_down_list(arr:string[]) {
    const variableList = (arr || []).map((param) => [param, param]);
    if (variableList.length === 0) {
      return [['?', '?']];
    }
    return variableList;
  }

  function procedures_variables_for_drop_down_list() {
    // const variables:string[] = [];
    // const var_map:any = {};
    // Project.for_each_procedure((name, json) => {
    //   _.forEach(json.params, (v, n:string) => {
    //     if (!var_map[n]) {
    //       variables.push(n);
    //     }
    //   });
    // });
    return to_drop_down_list(deps.get_procedure_parameters());
  }

  /* tslint:disable:no-null-keyword */
  return function basic_block_config(blockly:Blockly) : BlockConfigDict {
    function i18n(str:string) : String {
      return blockly.Msg[str] || DEFAULT_MSG[str];
    }

    return ({
      //events
      'start_on_click': {
        message0: i18n('start_on_click'),
        args0: [
          create_icon_config(blockly, start_icon, true),
        ],
        nextStatement: true,
        tooltip: '',
        colour: block_colors.events,
        inputsInline: true,
      },
      'on_running_group_activated': {
        message0: i18n('on_running_group_activated'),
        args0: [
          create_icon_config(blockly, start_icon, true),
        ],
        nextStatement: true,
        tooltip: '',
        colour: block_colors.events,
        inputsInline: true,
      },
      'self_listen': {
        message0: i18n('self_listen'),
        args0: [
          create_icon_config(blockly, msg_icon, true),
          {
            type: 'input_value',
            name: 'message',
            check: 'String',
          }, {
            type: 'input_dummy',
            align: 'CENTRE',
          }, {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        tooltip: '',
        colour: block_colors.events,
        inputsInline: true,
      },
      'self_broadcast': {
        message0: i18n('self_broadcast'),
        args0: [
          {
            type: 'input_value',
            name: 'message',
            check: 'String',
          },
          create_icon_config(blockly, event_icon),
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.events,
        inputsInline: true,
      },
      'when': {
        message0: i18n('when'),
        args0: [
          create_icon_config(blockly, msg_icon, true),
          {
            type: 'input_value',
            name: 'condition',
            check: 'Boolean',
            align: 'CENTRE',
          }, {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        tooltip: i18n('WHEN_BLOCK_TOOLTIPS'),
        colour: block_colors.events,
        inputsInline: true,
      },
      //control
      'repeat_forever': {
        message0: i18n('repeat_forever'),
        args0: [
          create_icon_config(blockly, control_icon),
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
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.control,
        inputsInline: true,
      },
      'repeat_n_times': {
        message0: i18n('repeat_n_times'),
        args0: [
          {
            type: 'input_value',
            name: 'times',
            check: 'Number',
            align: 'CENTRE',
          },
          create_icon_config(blockly, control_icon),
          {
            type: 'input_dummy',
            align: 'CENTRE',
          },
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.control,
        inputsInline: true,
      },
      'repeat_forever_until': {
        message0: i18n('repeat_forever_until'),
        args0: [
          {
            type: 'input_value',
            name: 'condition',
            check: 'Boolean',
            align: 'CENTRE',
          },
          create_icon_config(blockly, control_icon),
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
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.control,
        inputsInline: true,
      },
      'break': {
        message0: i18n('break'),
        args0: [
          create_icon_config(blockly, control_icon),
        ],
        tooltip: '',
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.control,
        inputsInline: true,
      },
      'tell': {
        message0: i18n('tell'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'sprite',
            options: function () {
              const arr = get_entities();
              if (arr.length > 1) {
                arr.shift();
              }
              return arr;
            },
          },
          create_icon_config(blockly, control_icon),
          {
            type: 'input_dummy',
            align: 'CENTRE',
          },
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.control,
        inputsInline: true,
        extensions: ['disable_inside_warp_loop'],
      },
      'sync_tell': {
        message0: i18n('sync_tell'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'sprite',
            options: function () {
              const arr = get_entities();
              if (arr.length > 1) {
                arr.shift();
              }
              return arr;
            },
          },
          create_icon_config(blockly, control_icon),
          {
            type: 'input_dummy',
            align: 'CENTRE',
          },
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.control,
        inputsInline: true,
        extensions: ['disable_inside_warp_loop'],
      },
      'warp': {
        message0: i18n('warp'),
        args0: [
          create_icon_config(blockly, advanced_icon),
          {
            type: 'input_dummy',
            align: 'CENTRE',
          },
          {
            type: 'input_statement',
            name: 'DO',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.advanced,
        inputsInline: true,
      },
      'wait': {
        message0: i18n('wait_secs'),
        args0: [
          {
            type: 'input_value',
            name: 'time',
            check: 'Number',
            align: 'CENTRE',
          },
          create_icon_config(blockly, control_icon),
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
        colour: block_colors.control,
        inputsInline: true,
      },
      'wait_until': {
        message0: i18n('wait_until'),
        args0: [
          {
            type: 'input_value',
            name: 'condition',
            check: 'Boolean',
            align: 'CENTRE',
          },
          create_icon_config(blockly, control_icon),
        ],
        tooltip: '',
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.control,
        inputsInline: true,
      },
      'destruct': {
        message0: i18n('destruct'),
        args0: [
          create_icon_config(blockly, control_icon),
        ],
        tooltip: '',
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.control,
        inputsInline: true,
      },
      //sensing
      'get_time': {
        message0: i18n('get_time'),
        args0: [{
          type: 'field_dropdown',
          name: 'op',
          options: [
            [i18n('year'), 'year'],
            [i18n('month'), 'month'],
            [i18n('date'), 'date'],
            [(<any>i18n('week'))['week'], 'week'],
            [i18n('hour'), 'hour'],
            [i18n('minute'), 'minute'],
            [i18n('second'), 'second'],
          ],
        }],
        tooltip: '',
        output: 'Number',
        colour: block_colors.sensing,
        inputsInline: true,
      },
      'get_timer': {
        message0: i18n('timer'),
        args0: [],
        output: 'Number',
        tooltip: '',
        colour: block_colors.sensing,
        inputsInline: true,
      },
      'reset_timer': {
        message0: i18n('reset_timer'),
        args0: [
          create_icon_config(blockly, sensing_icon),
        ],
        tooltip: '',
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.sensing,
        inputsInline: true,
      },
      //operation
      'random': {
        message0: i18n('random_num'),
        args0: [
          {
            type: 'input_value',
            name: 'a',
            check: 'Number',
            align: 'CENTRE',
          },
          {
            type: 'input_value',
            name: 'b',
            check: 'Number',
            align: 'CENTRE',
          },
        ],
        tooltip: '',
        output: 'Number',
        colour: '%{BKY_LOGIC_HUE}',
        inputsInline: true,
      },
      'divisible_by': {
        message0: i18n('divisible_by'),
        args0: [
          {
            type: 'input_value',
            name: 'NUMBER_TO_CHECK',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIVISOR',
            check: 'Number',
          },
        ],
        output: 'Boolean',
        colour: '%{BKY_LOGIC_HUE}',
        inputsInline: true,
        tooltip: '',
      },
      'calculate': {
        message0: i18n('calculate'),
        args0: [
          {
            type: 'input_value',
            name: 'input',
            check: ['String', 'Number'],
          },
        ],
        output: 'Number',
        colour: '%{BKY_LOGIC_HUE}',
        inputsInline: true,
        tooltip: i18n('CALCULATE_TOOLTIPS'),
      },
      'text_select': {
        message0: i18n('text_select'),
        args0: [
          {
            type: 'input_value',
            name: 'string',
            check: ['String', 'Number'],
          }, {
            type: 'input_value',
            name: 'char_start_index',
            check: ['Number'],
          }, {
            type: 'input_value',
            name: 'char_end_index',
            check: ['Number'],
          },
        ],
        output: 'String',
        colour: '%{BKY_LOGIC_HUE}',
        tooltip: '',
        inputsInline: true,
      },
      'text_length': {
        message0: i18n('text_length'),
        args0: [
          {
            type: 'input_value',
            name: 'VALUE',
            check: ['String', 'Number'],
          },
        ],
        output: 'Number',
        colour: '%{BKY_LOGIC_HUE}',
        tooltip: '',
        inputsInline: true,
      },
      'text_contain': {
        message0: i18n('text_contain'),
        args0: [
          {
            type: 'input_value',
            name: 'TEXT1',
            check: ['String', 'Number'],
          },
          {
            type: 'input_value',
            name: 'TEXT2',
            check: ['String', 'Number'],
          },
        ],
        output: 'Boolean',
        colour: '%{BKY_LOGIC_HUE}',
        tooltip: '',
        inputsInline: true,
      },
      'text_split': {
        message0: i18n('text_split'),
        args0: [
          {
            type: 'input_value',
            name: 'TEXT_TO_SPLIT',
            check: ['String', 'Number'],
          },
          {
            type: 'input_value',
            name: 'SPLIT_TEXT',
            check: ['String', 'Number'],
          },
        ],
        output: 'Array',
        colour: '%{BKY_LOGIC_HUE}',
        inputsInline: true,
        tooltip: '',
      },
      //data
      'variables_get': {
        message0: i18n('variables_get'),
        args0: [{
          type: 'field_dropdown',
          name: 'VAR',
          options: () => {
            return get_variables('any', true);
          },
        }],
        tooltip: '',
        output: null,
        colour: block_colors.variables,
        inputsInline: true,
      },
      'variables_set': {
        message0: i18n('variables_set'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'VAR',
            options: () => {
              return get_variables('any');
            },
          }, {
            type: 'input_value',
            name: 'VALUE',
            align: 'CENTRE',
            check: ['Number', 'String', 'Boolean', 'Array'],
          },
          create_icon_config(blockly, variable_icon),
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: block_colors.variables,
        tooltip: i18n('VARIABLES_SET_TOOLTIP'),
        helpUrl: i18n('VARIABLES_SET_HELPURL'),
      },
      'change_variable': {
        message0: i18n('change_variable'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'valname',
            options: () => {
              return get_variables('any');
            },
          },
          {
            type: 'field_dropdown',
            name: 'method',
            options: function () {
              return [
                [i18n('increase'), 'increase'],
                [i18n('decrease'), 'decrease'],
              ];
            },
          },
          {
            type: 'input_value',
            name: 'n',
            check: 'Number',
            align: 'CENTRE',
          },
          create_icon_config(blockly, variable_icon),
        ],
        previousStatement: null,
        nextStatement: null,
        tooltip: i18n('VARIABLES_CHANGE_TOOLTIPS'),
        colour: block_colors.variables,
        inputsInline: true,
      },
      'lists_get': {
        message0: i18n('lists_get'),
        args0: [{
          type: 'field_dropdown',
          name: 'VAR',
          options: () => {
            return get_variables('list');
          },
        }],
        tooltip: '',
        output: 'Array',
        colour: block_colors.lists,
        inputsInline: true,
      },
      'lists_append': {
        message0: i18n('lists_append'),
        args0: [
          {
            type: 'input_value',
            name: 'VALUE',
            check: ['String', 'Number', 'Boolean', 'Array'],
          },
          {
            type: 'input_value',
            name: 'VAR',
            check: ['Array'],
          },
          create_icon_config(blockly, list_icon),
        ],
        colour: block_colors.lists,
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        tooltip: i18n('LISTS_APPEND_TOOLTIPS'),
      },
      'lists_insert_value': {
        message0: i18n('lists_insert_value'),
        args0: [
          {
            type: 'input_value',
            name: 'VAR',
            align: 'CENTRE',
            check: 'Array',
          },
          {
            type: 'input_value',
            check: 'Number',
            name: 'INDEX',
            align: 'CENTRE',
          },
          {
            type: 'input_value',
            name: 'VALUE',
            align: 'CENTRE',
          },
          create_icon_config(blockly, list_icon),
        ],
        colour: block_colors.lists,
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        tooltip: i18n('LISTS_INSERT_INDEX_TOOLTIPS'),
        helpUrl: i18n('VARIABLES_SET_HELPURL'),
      },
      'lists_copy': {
        message0: i18n('lists_copy'),
        args0: [
          {
            type: 'input_value',
            name: 'TARGET',
            check: 'Array',
          },
          {
            type: 'input_value',
            name: 'VALUE',
            check: 'Array',
          },
          create_icon_config(blockly, list_icon),
        ],
        colour: block_colors.lists,
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        tooltip: '',
      },
      'lists_length': {
        message0: i18n('lists_length'),
        args0: [
          {
            type: 'input_value',
            name: 'VAR',
            check: 'Array',
          },
        ],
        output: 'Number',
        colour: block_colors.lists,
        inputsInline: true,
        tooltip: i18n('LISTS_GET_LENGTH_TOOLTIPS'),
      },
      'lists_is_exist': {
        message0: i18n('lists_is_exist'),
        args0: [
          {
            type: 'input_value',
            name: 'VAR',
            check: 'Array',
          },
          {
            type: 'input_value',
            name: 'VALUE',
            align: 'CENTRE',
          },
        ],
        colour: block_colors.lists,
        tooltip: i18n('LISTS_IS_EXIST_TOOLTIPS'),
        output: 'Boolean',
        inputsInline: true,
      },
      'lists_index_of': {
        message0: i18n('lists_index_of'),
        args0: [
          {
            type: 'input_value',
            name: 'VALUE',
            align: 'CENTRE',
          },
          {
            type: 'input_value',
            name: 'VAR',
            check: 'Array',
          },
        ],
        colour: block_colors.lists,
        output: 'Number',
        inputsInline: true,
      },
      //procedures
      'procedures_parameter': {
        message0: i18n('procedures_parameter'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'param_name',
            options: procedures_variables_for_drop_down_list,
          },
        ],
        output: null,
        tooltip: '',
        colour: block_colors.procedure,
        inputsInline: true,
      },
      'procedures_return_value': {
        message0: i18n('procedures_return_value'),
        args0: [
          {
            type: 'input_value',
            name: 'VALUE',
          },
          create_icon_config(blockly, procedure_icon),
        ],
        tooltip: '',
        previousStatement: null,
        colour: block_colors.procedure,
        inputsInline: true,
      },
      //no use
      'days_after_2000': {
        message0: i18n('days_after_2000'),
        args0: [],
        output: 'Number',
        tooltip: '',
        colour: '%{BKY_LOGIC_HUE}',
        inputsInline: true,
      },
    } as any);
  };
}
