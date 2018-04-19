import * as _ from 'lodash';
import {
  heart,
  compile_xml,
  initial_runtime,
  get_test_result,
  AssertionToolResult,
} from './heart';
import { CmBlockly } from 'cmblockly';
import { store_manager } from './redux/store';

export type AssertionToolResult = AssertionToolResult;

const runtime_manager = heart().get_runtime_manager();
let tick_id:number;

export function init(
    start_cb:() => void,
    stop_cb:() => void,
    restart_cb:() => void,
    vars_cb:(vals:any) => void,
) {
  heart().get_event_bus().runtime_manager.idle.immediate.sub(() => {
    // stop_tick();
    // stop_cb();
  });

  heart().get_event_bus().error.runtime.immediate.sub(on_runtime_error);

  heart().get_event_bus().runtime_manager.start.immediate.sub(() => {
    start_cb();
  });
  heart().get_event_bus().runtime_manager.stop.immediate.sub(() => {
    stop_tick();
    stop_cb();
  });

  heart().get_event_bus().runtime_data.variable_update.immediate.sub(vars_cb);
  heart().get_event_bus().runtime_data.block_running.immediate.sub((blockId:string) => {
    highlight_block(blockId);
  });
  heart().get_event_bus().runtime_data.block_finished.immediate.sub((blockId:string) => {
    unhighlight_block(blockId);
  });

  heart().get_event_bus().runtime_manager.restart.immediate.sub(restart_cb);
}

// xml 33ms
export function start(xml:string, ms_per_tick:number) {
  const compiled_xml = compile_xml(xml);
  if (_.isEmpty(compiled_xml[0].compiled_block_map)) {
    console.warn('No blocks to run, please make sure using hat block');
    return;
  }
  initial_runtime(compiled_xml[0]);
  start_tick(ms_per_tick);
}

export function stop() {
  runtime_manager.stop();
}

function start_tick(ms_per_tick:number) {
  runtime_manager.run();

  let n_ticks = 0;
  const tick = () => {

    n_ticks++;
    runtime_manager.update();
  };
  tick_id = setInterval(tick, ms_per_tick);
}

function stop_tick() {
  clearInterval(tick_id);
}

function highlight_block(blockId:string) {
  CmBlockly.mainWorkspace.getBlockById(blockId).select();
  const block = CmBlockly.mainWorkspace.getBlockById(blockId);
  if (block !== null) {
    block.select();
  }
}

function unhighlight_block(blockId:string) {
  const block = CmBlockly.mainWorkspace.getBlockById(blockId);
  if (block !== null) {
    block.unselect();
  }
  CmBlockly.mainWorkspace.getBlockById(blockId).unselect();
}

function on_runtime_error(e:any) {
  stop();
  const error_block_id = e.block_id;
}

export function hide_error_block() {
}