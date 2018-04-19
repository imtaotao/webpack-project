import 'reflect-metadata';

import * as fs from 'fs';
import * as html_parser from 'htmlparser2';
import * as path from 'path';
import * as r from 'resul-ts';
import _find from 'lodash/find';

import * as D from '../util';
import * as P from '../../public_interfaces';
import { MaybeCompiledEntities, CompiledEntity } from '../../basic_types';
import { new_heart, Heart } from '../..';

const MAX_RUN_TIME_MS = 3000;
const MS_PER_TICK = 16;

const TEST_DIR = path.join(__dirname, '../../../acceptance_test/');
const project_name = process.argv[process.argv.length - 1];

let done = false;
let success = false;

const heart = new_heart({
  version: 1,
  compiler_requirements: {
    html_parser,
  },
});

heart.basic_blocks().load_runtime_provider();
const assert = heart.get_assertion_tool();
heart.test_blocks(assert).load_runtime_provider();

const projects = D.get_projects(fs, TEST_DIR);
const project = _find(projects, (p) => p.test_name == project_name);
if (project == undefined) {
  throw new Error(`Can't find any test named ${project_name}`);
}

const compiled_result = D.compile(project, heart);
if (r.is_error(compiled_result)) {
  throw compiled_result;
}
const entities = compiled_result.result;

const rm = heart.get_runtime_manager();

let timer:NodeJS.Timer;

function finish(_success:boolean, fail_message?:string) {
  clearInterval(timer);
  done = true;
  success = _success;
  if (success == false) {
    console.log(`Test failed: ${fail_message}`);
    return;
  }
  console.log(`Test succeeded! ヽ(' ▽' )ノ !`);
}

heart.get_event_bus().runtime_data.variable_update.immediate.sub((value) => {
  if (value.new_value === 666) {
    finish(true);
  }
});

heart.get_event_bus().runtime_data.test_done.immediate.sub(() => {
  const res = assert.get_result();
  finish(res.success, res.message);
});

heart.get_event_bus().error.all.immediate.sub(
    (e) => { throw e.error; },
);

rm.clear();
rm.load(entities);
rm.create_entity_instance('main', 'main');
rm.run();

const max_ticks = Math.ceil(MAX_RUN_TIME_MS / MS_PER_TICK);
let n_ticks = 0;
const tick = () => {
  if (done == true) {
    return;
  }
  if (n_ticks > max_ticks) {
    finish(false, 'timeout, test took too long');
    return;
  }

  n_ticks++;
  rm.update();
};
timer = setInterval(tick, MS_PER_TICK);
