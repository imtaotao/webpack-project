import 'reflect-metadata';

import * as r from 'resul-ts';
import { test } from 'ava';
import * as html_parser from 'htmlparser2';

import { new_heart } from '../../';

import * as H from '../../public_interfaces';
import { get as bb_cfg_deps } from '../mocks/basic_block_config_dependencies';

test(async function load_basic_blocks_runtime_provider(t) {
  t.plan(0);

  const h = new_heart({
    version: 1,
    workspace_requirements: {
      blockly: <any>undefined,
    },
    compiler_requirements: {
      dom_parser: <any>undefined,
    },
  });

  h.basic_blocks().load_runtime_provider();
});

test(async function assertion_tool_fail(t) {
  const heart = new_heart({
    version: 1,
    compiler_requirements: {
      html_parser,
    },
  });
  const assert = heart.get_assertion_tool();
  assert.plan(0);
  assert.fail('This should fail with the fail assertion.');
  assert.falsy(true);
  assert.truthy(false);
  assert.is('something', 'other thing');
  assert.not('same', 'same');
  const test_result = assert.get_result();
  t.false(test_result.success);
  const num_of_message = test_result.message.split('\n').length;
  t.is(num_of_message, 6);
});

test(async function assertion_tool_plan(t) {
  const heart = new_heart({
    version: 1,
    compiler_requirements: {
      html_parser,
    },
  });
  const assert = heart.get_assertion_tool();
  // plan 0 assertion.
  assert.plan(0);
  const plan0 = assert.get_result();
  t.true(plan0.success, plan0.message);
  // plan will fail.
  assert.reset();
  assert.plan(3);
  assert.truthy(true);
  assert.is('same', 'same');
  const plan_fail = assert.get_result();
  t.false(plan_fail.success, plan_fail.message);
  // plan will pass.
  assert.reset();
  assert.plan(2);
  assert.truthy(true);
  assert.is('same', 'same');
  const plan_pass = assert.get_result();
  t.true(plan_pass.success, plan_pass.message);
});

test(async function can_get_loaded_block_configs(t) {
  t.plan(3);

  const blockly:any = {
    Msg: {},
    Blocks: {},
    BlockSvg: {
      START_HAT_ICON_WIDTH: 5,
      START_HAT_ICON_HEIGHT: 5,
      TYPE_ICON_WIDTH: 5,
      TYPE_ICON_HEIGHT: 5,
    },
  };

  const h = new_heart({
    version: 1,
    workspace_requirements: {
      blockly,
    },
    compiler_requirements: {
      dom_parser: <any>undefined,
    },
  });

  const deps:H.BasicBlockConfigDependencies = bb_cfg_deps();

  // Init to ensure the basic blocks are loaded
  const basic_blocks = h.basic_blocks().init(deps);
  const bb_provider = basic_blocks.get_block_provider();
  h.get_block_registry().register_provider(bb_provider);

  const block_configs = h.get_block_registry().get_loaded_block_configs();
  const by_json = block_configs.defined_by_json;
  const basic_blocks_by_json = by_json[''];

  t.is(Object.keys(basic_blocks_by_json).length, 38);

  t.deepEqual(basic_blocks_by_json['start_on_click'], {
    message0: '%1 When Start clicked',
    args0: [{
        type: 'field_icon',
        src: 'block_start_icon.png',
        width: 10,
        height: 10,
        is_head: true,
        alt: '*',
      },
    ],
    nextStatement: true,
    tooltip: '',
    colour: '#608FEE',
    inputsInline: true,
  });

  /* tslint:disable:no-null-keyword */

  t.deepEqual(basic_blocks_by_json['lists_insert_value'], {
      message0: 'Insert %3 at %2 of %1 %4',
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
        {
          type: 'field_icon',
          src: 'block_list_icon.png',
          width: 5,
          height: 5,
          is_head: false,
          alt: '*',
        },
      ],
      colour: '#FFDB63',
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      tooltip: '',
      helpUrl: '',
  });
});
