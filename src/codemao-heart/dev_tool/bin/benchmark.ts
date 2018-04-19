import 'reflect-metadata';

import * as fs from 'fs';
import * as html_parser from 'htmlparser2';
import * as path from 'path';
import * as r from 'resul-ts';
import * as shell from 'shelljs';
import _clone from 'lodash/clone';
import now from 'performance-now';

import * as D from '../util';
import * as DT from '../type';
import * as P from '../../public_interfaces';
import { MaybeCompiledEntities, CompiledEntity } from '../../basic_types';
import { new_heart, Heart } from '../..';

// yarn run benchmark <benchmark_id> <method>
// For example: yarn run benchmark hello original
// Runs everything in benchmark/
// puts results in benchmark_result/hello/project_name.json
// with a Method parameter specifying which method (original) was used for each row

const argv = process.argv;
if (argv.length != 4) {
  throw new Error(`Must call on the form 'yarn run benchmark <id> <method>'`);
}

const BENCHMARK_ID = argv[argv.length - 2];
const BENCHMARK_METHOD = argv[argv.length - 1];

const BENCH_DIR = path.join(__dirname, '../../../benchmark/');
const OUT_DIR = path.join(__dirname, '../../../benchmark_result/', BENCHMARK_ID);

type IterationRecord = {
  Method:string;
  Time:number;
  [key:string]:string|number;
};

async function run() {
  console.log(` `);
  const projects = D.get_projects(fs, BENCH_DIR);
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    run_benchmark(p);
  }
}

function run_benchmark(project:DT.HeartTestCurrent) {
  const benchmark_tool = new BenchmarkToolImpl(BENCHMARK_METHOD);

  // Init new heart for each benchmark to avoid any lingering effects from previous runs
  const heart = init_heart(benchmark_tool);
  const compiled = D.compile(project, heart);

  if (r.is_error(compiled)) {
    fail_benchmark(project, 'Could not compile', compiled);
    return;
  }
  const rm = heart.get_runtime_manager();
  const eb = heart.get_event_bus();

  eb.error.all.immediate.sub((e) => {
    fail_benchmark(project, 'Heart threw an error', e);
  });

  let done = false;
  const set_done = () => done = true;
  eb.runtime_data.test_done.immediate.sub(set_done);
  eb.runtime_manager.idle.immediate.sub(set_done);

  rm.load(compiled.result);
  rm.create_entity_instance('main', 'main');
  rm.run();

  let n_iters = 0;
  console.log(` `);
  console.log(`Running benchmark of ${project.test_name}`);
  while (done == false) {
    if (n_iters % 100000 == 0) {
      n_iters = 0;
      process.stdout.write('.');
    }

    rm.update();
  }
  const assert = heart.get_assertion_tool();
  if (assert.get_result().success != true) {
    fail_benchmark(project, 'Test blocks reported failure', assert.get_result().message);
  }

  // Making sure we let the GC clean up old Heart etc
  eb.runtime_data.test_done.immediate.clear();
  eb.runtime_manager.idle.immediate.clear();
  eb.error.all.immediate.clear();

  shell.mkdir('-p', OUT_DIR);

  let sanitized_name = project.test_name;
  sanitized_name = sanitized_name.replace(RE1, '_');
  sanitized_name = sanitized_name.replace(RE2, '_');

  const out_file_path = path.join(OUT_DIR, sanitized_name) + '.json';
  const file_exists = fs.existsSync(out_file_path);

  let result_rows = benchmark_tool.get_rows();
  if (file_exists) {
    const existing_rows = JSON.parse(fs.readFileSync(out_file_path, 'utf-8'));
    result_rows = result_rows.concat(existing_rows);
  }
  fs.writeFileSync(out_file_path, JSON.stringify(result_rows), 'utf-8');
}

const RE1 = /\s/g;
const RE2 = /\//g;

function init_heart(benchmark_tool:P.BenchmarkTool) : Heart {
  const heart = new_heart({
    version: 1,
    compiler_requirements: { html_parser },
    configuration: {
      deterministic: {
        seconds_per_update: 16 / 1000, // pretend 16ms updates
        prng_seed: 23333,
      },
    },
  });

  heart.basic_blocks().load_runtime_provider();
  const assert = heart.get_assertion_tool();
  heart.test_blocks(assert).load_runtime_provider();
  heart.benchmark_blocks(benchmark_tool).load_runtime_provider();

  return heart;
}

function fail_benchmark(project:DT.HeartTestCurrent, reason:string, error:any) {
  console.error(`Failed benchmark ${project.test_name} because: ${reason}`);
  console.error(error);
  throw error;
}

class BenchmarkToolImpl implements P.BenchmarkTool {

  constructor(
      public method:string,
  ) {
    this.row_template = {
      Method: this.method,
      Time: 0,
    };
    this.iterations = [];
  }

  public iterations:IterationRecord[] = [];

  private row_template!:IterationRecord;
  private ms_start:number|undefined;

  public set(col:string, val:string|number) {
    this.row_template[col] = val;
  }

  public start_iteration() {
    this.ms_start = now();
  }

  public finish_iteration() {
    const ms_end = now();
    if (this.ms_start == undefined) {
      throw new Error('Benchmark called finish_iteration without calling start_iteration first!');
    }
    const ms_used = ms_end - this.ms_start;
    this.ms_start = undefined;
    const record = _clone(this.row_template);
    record.Time = ms_used;
    this.iterations.push(record);
  }

  public get_rows() {
    return this.iterations;
  }
}

const _ = run();
