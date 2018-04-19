import * as math_expression from 'math-expression-evaluator';
import _cloneDeep from 'lodash/cloneDeep';
import _isArray from 'lodash/isArray';
import _isEqual from 'lodash/isEqual';
import _isNaN from 'lodash/isNaN';
import _isNumber from 'lodash/isNumber';
import _some from 'lodash/some';
import _toNumber from 'lodash/toNumber';

import { is_prime } from '../algorithm/miller_rabin';

import { ID, DayNames } from '../basic_types';
import { FunctionDict, FunctionDictFactory } from '../block_provider';
import { Ohno } from '../error_types';
import { RuntimeManager, RuntimeData, List } from '../public_interfaces';
import { EventBusPrivate } from '../event/event_bus';
import { Config } from '../di_interfaces';

export function get_domain_functions(
    runtime_manager:RuntimeManager,
    runtime_data:RuntimeData,
    event_bus:EventBusPrivate,
    ohno:Ohno,
    day_names:DayNames,
    config:Config,
) : FunctionDictFactory {

  // I think this was used for supporting user dicts?
  // Or it was an old method for getting data out of
  // lists. Probably written by Patrick.
  // -- Oliver Uvman, 2017-07-26
  // function get_properties(d:any) : any {
  //   if (d.length === 0) {
  //     return [];
  //   }
  //   if (d.length) {
  //     const temp = [];
  //     for (let i = 0; i < d.length; ++i) {
  //       if (d.properties[i].length === 0) {
  //         temp.push([]);
  //       } else if (d.properties[i].length) {
  //         temp.push(get_properties(d.properties[i]));
  //       } else {
  //         temp.push(d.properties[i].data);
  //       }
  //     }
  //     return temp;
  //   }
  //   return d.data;
  // }

  function format_float_number(text:any) {
    if (isNaN(text)) {
      return text;
    }
    const number_txt = parseFloat(text);
    if (Math.floor(number_txt) === number_txt) {
      return number_txt;
    }
    return number_txt.toFixed(2);
  }

  const TIME_FUNCTIONS = {
    year() {
      return new Date().getFullYear();
    },
    month() {
      return new Date().getMonth() + 1;
    },
    date() {
      return new Date().getDate();
    },
    week() {
      return day_names[<0|1|2|3|4|5|6>(new Date().getDay())];
    },
    hour() {
      return new Date().getHours();
    },
    minute() {
      return new Date().getMinutes();
    },
    second() {
      return new Date().getSeconds();
    },

  };

  const LOGIC_FUNCTIONS = {
    // logic compare
    EQ(args:any) {
      return _isEqual(args.A, args.B);
    },
    NEQ(args:any) {
      return !_isEqual(args.A, args.B);
    },
    LT(args:any) {
      return args.A < args.B;
    },
    LTE(args:any) {
      return args.A <= args.B;
    },
    GT(args:any) {
      return args.A > args.B;
    },
    GTE(args:any) {
      return args.A >= args.B;
    },

    // operate
    AND(args:any) {
      return args.A && args.B;
    },
    OR(args:any) {
      return args.A || args.B;
    },

    // map
    TRUE: true,
    FALSE: false,
  };

  function to_fixed_number(num:number, decimals:number) {
    const pow = Math.pow(10, decimals);
    return Math.round( num * pow ) / pow;
  }

  const MATH_FUNCTIONS = {
    ROUND(args:any) {
      return Math.floor(args.NUM + 0.5);
    },
    ROUNDUP(args:any) {
      return Math.ceil(args.NUM);
    },
    ROUNDDOWN(args:any) {
      return Math.floor(args.NUM);
    },

    EVEN(args:any) {
      return args.NUMBER_TO_CHECK % 2 === 0;
    },
    ODD(args:any) {
      return Math.abs(args.NUMBER_TO_CHECK % 2) === 1;
    },
    PRIME(args:any) {
      return is_prime(args.NUMBER_TO_CHECK);
    },
    WHOLE(args:any) {
      return args.NUMBER_TO_CHECK === Math.floor(args.NUMBER_TO_CHECK);
    },
    POSITIVE(args:any) {
      return args.NUMBER_TO_CHECK > 0;
    },
    NEGATIVE(args:any) {
      return args.NUMBER_TO_CHECK < 0;
    },
    DIVISIBLE_BY(args:any) {
      return args.NUMBER_TO_CHECK % args.DIVISOR === 0;
    },

    SIN(args:any) {
      return to_fixed_number(Math.sin(args.NUM * Math.PI / 180), 2);
    },
    ASIN(args:any) {
      return to_fixed_number(Math.asin(args.NUM) / Math.PI * 180, 2);
    },
    COS(args:any) {
      return to_fixed_number(Math.cos(args.NUM * Math.PI / 180), 2);
    },
    ACOS(args:any) {
      return to_fixed_number(Math.acos(args.NUM) / Math.PI * 180, 2);
    },
    TAN(args:any) {
      return to_fixed_number(Math.tan(args.NUM * Math.PI / 180), 2);
    },
    ATAN(args:any) {
      return to_fixed_number(Math.atan(args.NUM) / Math.PI * 180, 2);
    },

    ROOT(args:any) {
      return Math.pow(args.NUM, 0.5);
    },
    ABS(args:any) {
      return Math.abs(args.NUM);
    },
    NEG(args:any) {
      return - args.NUM;
    },
    LN(args:any) {
      return Math.log(args.NUM);
    },
    LOG10: function (args:any) {
      return Math.log(args.NUM) / Math.log(10);
    },
    EXP(args:any) {
      return Math.pow(Math.E, args.NUM);
    },
    POW10: function (args:any) {
      return Math.pow(10, args.NUM);
    },

    ADD(args:any) {
      return args.A + args.B;
    },
    MINUS(args:any) {
      return args.A - args.B;
    },
    MULTIPLY(args:any) {
      return args.A * args.B;
    },
    DIVIDE(args:any) {
      return args.A / args.B;
    },
    POWER(args:any) {
      return Math.pow(args.A, args.B);
    },
  };

  /**
   * A list may have been retrieved from our stored lists, or it
   * may have been created by the block that splits a string by
   * some separator.
   */

  function list_update(block_id:ID, entity_id:ID, list:List) {
    const list_id = runtime_manager.get_list_id(list, entity_id);
    if (!list_id) {
      return;
    }
    if (runtime_manager.is_entity_variable(list_id)) {
      runtime_data.report_entity_list_updated(list_id, list, entity_id);
      return;
    }
    runtime_data.report_list_updated(list_id, list);
  }

  const fns:FunctionDict = {

    text_indexOf(args, rbid, entity_id) {
      if (args.END === 'FIRST') {
        return args.VALUE.indexOf(args.FIND) + 1;
      } else if (args.END === 'LAST') {
        return args.VALUE.lastIndexOf(args.FIND) + 1;
      }
    },
    text_append(args, rbid, entity_id) {
      runtime_manager.set_variable(
          args.VAR,
          runtime_manager.get_variable(args.VAR, rbid, entity_id) + args.TEXT,
          rbid,
          entity_id,
      );
    },
    text_implicit(args, rbid, entity_id) {
      const text = args.TEXT;
      if (text === '') {
        return '';
      }
      return text == Number(text) ? Number(text) : text;
    },
    text_join(args, rbid, entity_id) {
      const n_text = Object.keys(args).length - 1;
      let s = '';
      let i = 0;
      while (true) {
        const str = args['ADD' + i];
        if (str === undefined) {
          break;
        }
        s += format_float_number(str) + '';
        i++;
      }
      return s;
    },
    text_length(args, rbid, entity_id) {
      return (isNaN(args.VALUE)) ? args.VALUE.length : args.VALUE.toString().length;
    },
    text_select(args, rbid, entity_id) {
      const str = (isNaN(args.string)) ? args.string : args.string.toString();
      const start_index = args.char_start_index;
      const end_index = args.char_end_index - 1;
      if (start_index <= end_index) {
        return str.substring(start_index - 1, end_index + 1);
      } else {
        const result = str.substring(end_index, start_index);
        return result.split('').reverse().join('');
      }

    },
    text_contain(args, rbid, entity_id) {
      const text1 = (isNaN(args.TEXT1)) ? args.TEXT1 : args.TEXT1.toString();
      const text2 = (isNaN(args.TEXT2)) ? args.TEXT2 : args.TEXT2.toString();
      return (text1.indexOf(text2) !== -1);
    },
    logic_operation(args, rbid, entity_id) {
      return (<any>LOGIC_FUNCTIONS)[args.OP](args);
    },
    logic_negate(args, rbid, entity_id) {
      return !args.BOOL;
    },
    logic_boolean(args, rbid, entity_id) {
      return (<any>LOGIC_FUNCTIONS)[args.BOOL];
    },
    logic_compare(args, rbid, entity_id) {
      return (<any>LOGIC_FUNCTIONS)[args.OP](args);
    },
    math_arithmetic(args, rbid, entity_id) {
      return (<any>MATH_FUNCTIONS)[args.OP](args);
    },
    math_number_property(args, rbid, entity_id) {
      return (<any>MATH_FUNCTIONS)[args.PROPERTY](args);
    },
    divisible_by(args, rbid, entity_id) {
      return MATH_FUNCTIONS['DIVISIBLE_BY'](args);
    },
    math_modulo(args, rbid, entity_id) {
      return args.DIVIDEND % args.DIVISOR;
    },
    math_trig(args, rbid, entity_id) {
      return (<any>MATH_FUNCTIONS)[args.OP](args);
    },
    math_single(args, rbid, entity_id) {
      return (<any>MATH_FUNCTIONS)[args.OP](args);
    },
    math_round(args, rbid, entity_id) {
      return (<any>MATH_FUNCTIONS)[args.OP](args);
    },
    start_on_click() {
    },
    get_time(args, rbid, entity_id) {
      return (<any>TIME_FUNCTIONS)[args.op](args);
    },
    get_cur_frames(args, rbid, entity_id) {
      return runtime_manager.get_elapsed_frames();
    },
    variables_get(args, rbid, entity_id) {
      // This function is used from the blocks defined in Blockly
      return runtime_manager.get_variable(args.VAR, rbid, entity_id);
    },
    variables_set(args, rbid, entity_id) {
      runtime_manager.set_variable(args.VAR, args.VALUE, rbid, entity_id);
    },
    days_after_2000() {
      const days = (new Date().valueOf() - new Date('2000-01-01').valueOf()) / (1000 * 60 * 60 * 24);
      return Math.floor(days);
    },
    self_broadcast(args, rbid, entity_id) {
      const message = args.message;
      runtime_manager.send_action({
        id: 'broadcast',
        namespace: '',
        parameters: undefined,
        sub_type: message,
        value: 'on',
      });
    },
    self_listen(args, rbid, entity_id) {
      const value = runtime_data.get_action_state_value({
        action_id: 'broadcast',
        action_namespace: '',
        sub_type: args.message,
      });
      return value === 'on';
    },
    when(args) {
      return args.condition;
    },
    wait(args, rbid, entity_id) {
      runtime_manager.thread_wait(entity_id, rbid, args.time * 1000);
    },
    change_variable(args, rbid, entity_id) {
      const var_id = args.valname;
      const method = args.method || 'increase';
      const n = args.n;
      let value = runtime_manager.get_variable(var_id, rbid, entity_id);
      // Only allow Number or String
      if (typeof (value) === 'object') {
        return;
      }
      if (method === 'increase') {
        if (_isNumber(_toNumber(value)) && !_isNaN(_toNumber(value))) {
          value = _toNumber(value);
        }
        runtime_manager.set_variable(var_id, value + n, rbid, entity_id);
      } else {
        runtime_manager.set_variable(var_id, (value - n), rbid, entity_id);
      }
    },
    random(args, rbid, entity_id) {
      const a = args.a;
      const b = args.b;
      const rand = runtime_manager.get_random_number();
      const randomFunc = Math.floor(a + (rand * (b - a + 1)));
      return randomFunc;
    },
    reset_timer(args, rbid, entity_id) {
      runtime_manager.reset_timer();
    },
    destruct(args, interpreter_id, entity_id, internals) {
      internals.runtime_manager.destruct_entity(entity_id);
    },
    get_timer(args, rbid, entity_id) {
      return runtime_manager.get_timer_elapsed_s();
    },
    terminate() {
      runtime_manager.stop();
    },
    restart(args, rbid, entity_id) {
      runtime_manager.restart();
    },
    stop(args, rbid, entity_id) {
      const type = parseInt(args.scope);
      if (type === 0) { // All scripts
        runtime_manager.dispose_all();
      } else if (type === 1) { // Current script
        runtime_manager.dispose_block_group(rbid);
      } else if (type === 2) { // Other scripts of this entity
        runtime_manager.dispose_other_block_groups_of_entity(entity_id, rbid);
      } else if (type === 3) { // Scripts of other entities
        runtime_manager.dispose_block_groups_of_other_entities(entity_id);
      }
    },
    // TODO Add Types to list functions if possible
    lists_get(args, rbid, entity_id) : List {
      return runtime_manager.lists_get(args.VAR, rbid, entity_id);
    },
    lists_append(args, rbid, entity_id) {
      const list = args.VAR;
      list.push(args.VALUE);
      list_update(rbid, entity_id, list);
    },
    lists_delete(args, rbid, entity_id) {
      let index = args.INDEX;
      const list = args.VAR;
      if (index === 0) {
        return;
      }
      if (args.TYPE === 'last') {
        list.pop();
      } else {
        index = index > 0 ? index - 1 : index;
        list.splice(index, 1);
      }
      list_update(rbid, entity_id, list);
    },
    lists_insert_value(args, rbid, entity_id) {
      let index = args.INDEX;
      const list = args.VAR;
      if (index === 0) {
        return;
      }
      if (index === -1) {
        list.push(args.VALUE);
      } else {
        index = index > 0 ? index - 1 : index + 1;
        list.splice(index, 0, args.VALUE);
      }
      list_update(rbid, entity_id, list);
    },
    lists_replace(args, rbid, entity_id) {
      let index = args.INDEX;
      const list = args.VAR;
      if (index === 0) {
        return;
      }
      if (args.TYPE === 'last') {
        index = list.length;
      }
      index = index > 0 ? index - 1 : index;
      list.splice(index, 1, args.VALUE);
      list_update(rbid, entity_id, list);
    },
    lists_get_value(args, rbid, entity_id) {
      let index:number = args.INDEX;
      const list = args.VAR;
      if (args.TYPE === 'last') {
        index = list.length;
      }
      if (index === 0) {
        // index in codemao start from 1
        if (config.get().legacy.lists_get_value_allow_return_undefined == false) {
          throw ohno.user.lists_get_value_bad_index({
            list,
            index: -1,
            args,
          });
        }
        return;
      } else {
        // index < 0 is allowed
        // -2 means the the last but the the second-last item in the list
        index = index > 0 ? index - 1 : list.length + index;
        const result = list[index];
        if (result == undefined && config.get().legacy.lists_get_value_allow_return_undefined == false) {
          throw ohno.user.lists_get_value_bad_index({
            list,
            index: index > 0 ? index : -1,
            args,
          });
        }
        return result;
      }
    },
    lists_is_exist(args, rbid, entity_id) {
      // PERF We might be able to avoid the stringified comparison
      const stringified = args.VALUE.toString();
      const list = args.VAR;
      return _some(list, (e) => e == args.VALUE || e == stringified);
    },
    lists_index_of(args, rbid, entity_id) {
      const text = args.VALUE;
      const list = args.VAR;
      const val = list.indexOf(text);
      return typeof val === 'number' ? val + 1 : 0;
    },
    lists_length(args, rbid, entity_id) {
      const list = args.VAR;
      return list.length;
    },
    calculate(args, rbid, entity_id) {
      try {
        return math_expression.lex(args.input).toPostfix().postfixEval();
      } catch (e) {
        throw ohno.user.block_bad_math_expression({block_args: args});
      }
    },
    lists_copy(args, rbid, entity_id) {
      let value = _cloneDeep(args.VALUE);
      const target_list = args.TARGET;
      target_list.length = 0;
      value = value || [];
      for (let i = 0; i < value.length; i++) {
        const val = value[i];
        target_list.push(val);
      }
      list_update(rbid, entity_id, target_list);
    },
    text_split(args, rbid, entity_id) : List {
      let text_to_split:string|number = args.TEXT_TO_SPLIT;
      if (typeof text_to_split === 'number') {
        text_to_split = text_to_split.toString();
      }
      const split_text = text_to_split.split(args.SPLIT_TEXT) || [];
      return split_text.map((element) => {
        const n = element.indexOf(' ') < 0 && element !== '' ?
                  _toNumber(element) :
                  element;
        return _isNaN(n) ? element : n;
      });
    },
  };
  return () => fns;
}
