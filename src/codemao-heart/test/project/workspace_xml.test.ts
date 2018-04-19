import 'reflect-metadata';

import * as fs from 'fs';
import * as html_parser from 'htmlparser2';
import * as path from 'path';
import * as r from 'resul-ts';
import _defaults from 'lodash/defaults';
import _defaultsDeep from 'lodash/defaultsDeep';
import _endsWith from 'lodash/endsWith';
import _every from 'lodash/every';
import _forEach from 'lodash/forEach';
import _includes from 'lodash/includes';
import _some from 'lodash/some';

import * as D from '../../dev_tool/util';
import * as P from '../../public_interfaces';
import { MaybeCompiledEntities, CompiledEntity } from '../../basic_types';
import { new_heart, Heart, HeartConfig, HeartSpec1 } from '../../';
import { test } from 'ava';

type TestResult = r.Result<boolean, any>;

const TEST_DIR = path.join(__dirname, '../../../acceptance_test/');

// The first half of this file deals with configuring Heart because
// we want to run our test file in many possible configurations.

interface FrameTimes {
  ms_per_frame:number;
  frames_per_test:number;
}

const TIMES = {
  time_dependent: <FrameTimes>{
    ms_per_frame: 16,
    frames_per_test: 3000 / 16,
  },
  time_independent: <FrameTimes>{
    ms_per_frame: 0.001,
    frames_per_test: 30000,
  },
};

const base_cfg = {
  version: <any>1,
  compiler_requirements: {
    html_parser,
  },
};

type ConfigSet = {[cfg_name:string]:HeartConfig};

const opti_runner_pretty_printed:HeartConfig = {
  opti_compiler: {
    pretty_print: true,
  },
  user_debug_mode: false,
};
const opti_runner_uglified:HeartConfig = {
  opti_compiler: {
    pretty_print: false,
  },
  user_debug_mode: false,
};
const block_interpreter:HeartConfig = {
  user_debug_mode: true,
};
const interpreter_mode:ConfigSet = {
  opti_runner_pretty_printed,
  opti_runner_uglified,
  block_interpreter,
};

// Deterministic tests must always be time independent
const deterministic:HeartConfig = {
  deterministic: {
    seconds_per_update: 1000 * (TIMES.time_independent.ms_per_frame),
    prng_seed: 666,
  },
};
const nondeterministic:HeartConfig = {
  deterministic: undefined,
};
const determinism_mode:ConfigSet = {
  deterministic,
  nondeterministic,
};

// Adding a new config set with X configurations will multiply
// the amount of tests run by X. Combinatoric explosion, add
// with care, try to keep test times low.
const config_sets:ConfigSet[] = [
  determinism_mode,
  interpreter_mode,
];

// All sets multiplied with each other
let config_permutations:ConfigSet = {};

let first = true;
_forEach(config_sets, (set) => {
  if (first) {
    config_permutations = set;
    first = false;
    return;
  }
  const new_permutations:ConfigSet = {};
  _forEach(config_permutations, (cfg, cfg_name) => {
    _forEach(set, (set_cfg, set_cfg_name) => {
      new_permutations[`${cfg_name} ${set_cfg_name}`] = _defaultsDeep({}, cfg, set_cfg);
    });
  });
  config_permutations = new_permutations;
  return;
});

function permutation_to_spec(perm:HeartConfig) : HeartSpec1 {
  const perm_cfg = {
    configuration: perm,
  };
  return _defaults(perm_cfg, base_cfg);
}

const heart_specs:{[perm_name:string]:HeartSpec1} = {};

_forEach(config_permutations, (perm, perm_name) => {
  heart_specs[perm_name] = permutation_to_spec(perm);
});

// Allows us to mark certain tests so that we can do something special
// with them.
interface TestFilter {
  // filename which must match
  test_name:RegExp;
  // strings which must all be part of the permutation name
  permutation_filters:string[];
}

const known_failures:TestFilter[] = [
  {
    test_name: /^promise_time_and_value$/,
    permutation_filters: ['block_interpreter'],
  },
  {
    test_name: /^promise_value$/,
    permutation_filters: ['block_interpreter'],
  },
  {
    test_name: /^proc_res_in_proc_arg$/,
    permutation_filters: ['block_interpreter'],
  },
  {
    test_name: /^call_user_procedure$/,
    permutation_filters: ['block_interpreter'],
  },
  {
    test_name: /^action.*parameter/,
    permutation_filters: ['block_interpreter'],
  },
];

const time_sensitive:TestFilter[] = [
  {
    test_name: /^wait$/,
    permutation_filters: ['nondeterministic'],
  },
  {
    // This one actually breaks in Kitten (where we use times),
    // but the problem seems to disappear when running at 1ms per frame.
    // This is probably due to the ugly procedure call timestamp stuff
    // in BlockRunner::run_procedure
    test_name: /^proc_res_in_proc_arg$/,
    permutation_filters: ['block_interpreter'],
  },
];

function test_matches_any_filter(
    filename:string,
    cfg_name:string,
    filters:TestFilter[],
) : boolean {
  const permutations = cfg_name.split(' ');
  return _some(filters, (kf) => {
    return kf.test_name.test(filename) &&
        _every(kf.permutation_filters, (ftr) => _includes(permutations, ftr));
  });
}

function is_known_failure(filename:string, cfg_name:string) {
  return test_matches_any_filter(filename, cfg_name, known_failures);
}

function is_time_sensitive(filename:string, cfg_name:string) {
  return test_matches_any_filter(filename, cfg_name, time_sensitive);
}

let cfgs_to_test = heart_specs;

// While developing, gotta go fast!
const only_one_cfg = process.env.FASTTEST != undefined;
if (only_one_cfg) {
  cfgs_to_test = {
    opti_uglified_nondeterministic: permutation_to_spec(_defaults(
      {},
      nondeterministic,
      opti_runner_uglified,
    )),
  };
}

_forEach(cfgs_to_test, (cfg, cfg_name) => {
  // We tried saving the Heart instance between tests that have the same
  // configuration, but this provided no noticeable performance improvement.

  const test_projects = D.get_projects(fs, TEST_DIR);

  _forEach(test_projects, (project) => {
    const project_name = project.test_name;
    const time_dependent = is_time_sensitive(project_name, cfg_name);
    const time_cfg = time_dependent ? TIMES.time_dependent : TIMES.time_independent;

    // If we run tests with all cfg permutations, running
    // them in parallel causes the js heap to overflow
    let tester = only_one_cfg ? test : test.serial;
    if (is_known_failure(project_name, cfg_name)) {
      tester = <any>tester.failing;
    }

    let test_name = project_name;
    if (only_one_cfg == false) {
      test_name += ` ${cfg_name}`;
    }
    if (time_dependent) {
      test_name += ` [time sensitive]`;
    }

    tester(test_name, async (t) => {

      const heart = new_heart(cfg);

      heart.basic_blocks().load_runtime_provider();
      heart.test_blocks(t).load_runtime_provider();

      const compiled_entities = D.compile(project, heart);
      if (r.is_error(compiled_entities)) {
        t.fail(compiled_entities.message);
        return;
      }
      const run_result = await run_test(heart, compiled_entities.result, time_cfg);
      if (r.is_error(run_result)) {
        (<any>t).log(run_result.message);
        (<any>t).log(JSON.stringify(run_result.error));
        t.fail(run_result.message);
      } else if (run_result.result == true) {
        // Legacy test with 666 variable, each test
        // requires at least one pass, or a plan(0),
        // this makes up for lack of such.
        t.pass('passed as legacy');
      }
    });
  });
});

async function run_test(
    heart:Heart,
    compile_result:CompiledEntity[],
    time:FrameTimes,
) : Promise<TestResult> {
  return new Promise((resolve:(res:TestResult) => void) => {
    const rm = heart.get_runtime_manager();

    let timer:NodeJS.Timer;

    const test_finished = (add_pass:boolean) => {
      clearInterval(timer);
      resolve(r.success(add_pass));
    };

    heart.get_event_bus().runtime_data.variable_update.immediate.sub((value) => {
      if (value.new_value === 666) { test_finished(true); }
    });

    heart.get_event_bus().runtime_data.test_done.immediate.sub(() => test_finished(false));
    heart.get_event_bus().error.all.immediate.sub(
        (e) => resolve(r.error('Caught error', e.error)),
    );

    rm.clear();
    rm.load(compile_result);
    rm.create_entity_instance('main', 'main');
    rm.run();

    let n_ticks = 0;
    const tick = () => {
      if (n_ticks > time.frames_per_test) {
        clearInterval(timer);
        resolve(r.fail('timeout, test took too long'));
        return;
      }

      n_ticks++;
      rm.update();
    };
    timer = setInterval(tick, time.ms_per_frame);
  });
}
