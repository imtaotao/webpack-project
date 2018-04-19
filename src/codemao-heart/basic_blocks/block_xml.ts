import * as r from 'resul-ts';

import { BlockXMLBuilder } from '../public_interfaces';

export function apply_basic_block_defaults(block_xml:BlockXMLBuilder) : void {

  // event
  block_xml.define_block_xml('self_listen', `
    <value name="message">
      <shadow type="text">
        <field name="TEXT">Hi</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml(
    'self_broadcast',
    `
    <value name="message">
      <shadow type="text">
        <field name="TEXT">Hi</field>
      </shadow>
    </value>
    `,
    '50');

  block_xml.define_block_xml(
    'when', `
    <value name="condition">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
    `,
    '50');

  // control
  block_xml.define_block_xml('repeat_forever');

  block_xml.define_block_xml('repeat_n_times', `
    <value name="times">
      <shadow type="math_number">
        <field name="NUM">20</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('repeat_forever_until', `
    <value name="condition">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
  `);

  block_xml.define_block_xml('break', ``, '50');

  block_xml.define_block_xml('controls_if_no_else', `
    <value name="IF0">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
  `);

  block_xml.define_block_xml(
    'controls_if',
    `
    <value name="IF0">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
    `,
    '50');

  block_xml.define_block_xml('tell');
  block_xml.define_block_xml('sync_tell', ``, '50');

  block_xml.define_block_xml('wait', `
    <value name="time">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml(
    'wait_until',
    `
    <value name="condition">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
    `,
    '50');

  // sense
  block_xml.define_block_xml('get_time');

  block_xml.define_block_xml('get_timer');

  block_xml.define_block_xml('reset_timer', ``, '50');

  // operations
  block_xml.define_block_xml('math_number');

  block_xml.define_block_xml('math_arithmetic', `
    <value name="A">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
    <value name="B">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml(
    'random',
    `
    <value name="a">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
    <value name="b">
      <shadow type="math_number">
        <field name="NUM">5</field>
      </shadow>
    </value>
    `,
    '50');

  block_xml.define_block_xml('math_number_property', `
    <mutation divisor_input="false"></mutation>
    <field name="PROPERTY">EVEN</field>
    <value name="NUMBER_TO_CHECK">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml(
    'logic_operation',
    `
    <value name="A">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
    <value name="B">
      <empty type="logic_empty">
        <field name="BOOL"></field>
      </empty>
    </value>
    `,
    '50');

  block_xml.define_block_xml('math_single', `
    <value name="NUM">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('math_modulo', `
    <value name="DIVIDEND">
      <shadow type="math_number">
        <field name="NUM">64</field>
      </shadow>
    </value>
    <value name="DIVISOR">
      <shadow type="math_number">
        <field name="NUM">10</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('math_trig', `
    <field name="OP">SIN</field>
    <value name="NUM">
      <shadow type="math_number">
        <field name="NUM">45</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml(
    'math_round',
    `
    <field name="OP">ROUND</field>
    <value name="NUM">
      <shadow type="math_number">
        <field name="NUM">3.1</field>
      </shadow>
    </value>
    `,
    '50');

  block_xml.define_block_xml('logic_compare', `
    <value name="A">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
    <value name="B">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('logic_boolean');

  block_xml.define_block_xml(
    'logic_negate',
    `
      <value name="BOOL">
        <empty type="logic_empty">
          <field name="BOOL"></field>
        </empty>
      </value>
    `,
    '50');

  block_xml.define_block_xml('text');

  block_xml.define_block_xml('text_join', `
    <mutation items="2"></mutation>
    <value name="ADD0">
      <shadow type="text">
        <field name="TEXT"></field>
      </shadow>
    </value>
    <value name="ADD1">
      <shadow type="text">
        <field name="TEXT"></field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('text_length', `
    <value name="VALUE">
      <shadow type="text">
        <field name="TEXT">abc</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('text_select', `
    <value name="string">
      <shadow type="text">
        <field name="TEXT">abc</field>
      </shadow>
    </value>
    <value name="char_start_index">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
    <value name="char_end_index">
      <shadow type="math_number">
        <field name="NUM">2</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('text_contain', `
    <value name="TEXT1">
      <shadow type="text">
        <field name="TEXT">abc</field>
      </shadow>
    </value>
    <value name="TEXT2">
      <shadow type="text">
        <field name="TEXT">abc</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('text_split', `
    <value name="TEXT_TO_SPLIT">
      <shadow type="text">
        <field name="TEXT">1,2,3,4</field>
      </shadow>
    </value>
    <value name="SPLIT_TEXT">
      <shadow type="text">
        <field name="TEXT">,</field>
      </shadow>
    </value>
  `);

  // data
  block_xml.define_block_xml('variables_get');

  block_xml.define_block_xml('variables_set', `
    <value name="VALUE">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('change_variable', `
    <value name="n">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('lists_insert_value', `
    <value name="VAR">
      <shadow type="lists_get"></shadow>
    </value>
    <value name="INDEX">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
    <value name="VALUE">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('lists_get');

  block_xml.define_block_xml('lists_append', `
    <value name="VALUE">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
    <value name="VAR">
      <shadow type="lists_get">
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('lists_delete');

  block_xml.define_block_xml('lists_replace');

  block_xml.define_block_xml(
    'lists_copy',
    `
    <value name="TARGET">
      <shadow type="lists_get">
      </shadow>
    </value>
    <value name="VALUE">
      <shadow type="lists_get">
      </shadow>
    </value>
    `,
    '50');

  block_xml.define_block_xml('lists_get_value');

  block_xml.define_block_xml('lists_length', `
    <value name="VAR">
      <shadow type="lists_get">
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('lists_index_of', `
    <value name="VALUE">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
    <value name="VAR">
      <shadow type="lists_get">
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('lists_is_exist', `
    <value name="VALUE">
      <shadow type="math_number">
        <field name="NUM">0</field>
      </shadow>
    </value>
    <value name="VAR">
      <shadow type="lists_get">
      </shadow>
    </value>
  `);

  // no use
  block_xml.define_block_xml('text_append', `
      <field name="VAR">item</field>
      <value name="TEXT">
        <shadow type="text">
          <field name="TEXT"></field>
        </shadow>
      </value>
  `);

  block_xml.define_block_xml('text_indexOf', `
      <field name="END">FIRST</field>
      <value name="VALUE">
        <block type="variables_get">
          <field name="VAR">text</field>
        </block>
      </value>
      <value name="FIND">
        <shadow type="text">
          <field name="TEXT">abc</field>
        </shadow>
      </value>
  `);

  block_xml.define_block_xml('math_change', `
      <field name="VAR">item</field>
      <value name="DELTA">
        <shadow type="math_number">
          <field name="NUM">1</field>
        </shadow>
      </value>
  `);

  block_xml.define_block_xml('hide_variable');

  block_xml.define_block_xml('show_variable');

  block_xml.define_block_xml('variables_get');

  block_xml.define_block_xml('calculate', `
   <value name="input">
      <shadow type="text">
        <field name="TEXT">1+2</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('divisible_by', `
    <value name="NUMBER_TO_CHECK">
      <shadow type="math_number">
        <field name="NUM">9</field>
      </shadow>
    </value>
    <value name="DIVISOR">
      <shadow type="math_number">
        <field name="NUM">3</field>
      </shadow>
    </value>
  `);
}
