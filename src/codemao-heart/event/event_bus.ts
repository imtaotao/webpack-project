import * as nbus from 'nekobasu';
import { Catastrophe } from 'catastrophic';

import * as E from './event_types';
import * as custom from './custom';
import { ID } from '../basic_types';

export function create_event_bus() {
  const event_bus = nbus.event_bus.categorized({

    error: nbus.event_bus.create({
      runtime: nbus.builtin.event<E.RuntimeError>(),
      all: nbus.builtin.event<E.GeneralError>(),
    }),

    warning: nbus.event_bus.create({
      runtime: nbus.builtin.event<E.RuntimeError>(),
      all: nbus.builtin.event<E.GeneralError>(),
    }),

    runtime_manager: nbus.event_bus.create({
      after_update: nbus.builtin.signal(),
      before_update: nbus.builtin.signal(),
      restart: nbus.builtin.signal(),
      stop: nbus.builtin.signal(),
      start: nbus.builtin.signal(),
      idle: nbus.builtin.signal(),
    }),

    runtime_data: nbus.event_bus.create({
      variable_update: custom.create_variable_neko(),
      list_update: custom.create_list_neko(),
      entity_variable_update: custom.create_entity_variable_neko(),
      entity_list_update: custom.create_entity_list_neko(),
      entity_dispose: nbus.builtin.event<E.EntityDisposed>(),
      block_run_result: nbus.builtin.event<E.BlockResult>(),
      test_done: nbus.builtin.signal(),
      block_running: nbus.builtin.event<ID>(),
      block_finished: nbus.builtin.event<ID>(),
    }),

    system: nbus.event_bus.create({
      config_updated: nbus.builtin.signal(),
    }),

    clones: nbus.event_bus.create({
      dispose_clone: nbus.builtin.event<ID>(),
    }),

  });
  bind_flush_events(event_bus);
  bind_collectors(event_bus);
  return event_bus;
}

function bind_collectors(eb:EventBusPrivate) {
  eb.error.runtime.immediate.sub((e) => {
    eb.error.all.send({error: e.error});
  });
  eb.warning.runtime.immediate.sub((e) => {
    eb.warning.all.send({error: e.error});
  });
}

function bind_flush_events(eb:EventBusPrivate) {
  eb.runtime_manager.after_update.immediate.sub(() => {
    eb.error._meta.flush();
    eb.warning._meta.flush();
    eb.runtime_manager._meta.flush();
    eb.runtime_data._meta.flush();
    eb.system._meta.flush();
    eb.clones._meta.flush();
  });
}

// PERF might want to set these as the standard buffering modes?
// this.buf_block_run_result.set_mode(BufMode.immediate);
// this.buf_entity_disposed.set_mode(BufMode.list_buffered);
// this.buf_error.set_mode(BufMode.immediate);
// this.buf_variable_update.set_mode(BufMode.custom_reducer);

export function as_public_event_bus(eb:EventBusPrivate) {
  const ev_pub = nbus.util.builtin_event_as_public;
  const s_pub = nbus.util.builtin_signal_as_public;
  return {
    error: {
      runtime: ev_pub(eb.error.runtime),
      all: ev_pub(eb.error.all),
    },
    warning: {
      runtime: ev_pub(eb.warning.runtime),
      all: ev_pub(eb.warning.all),
    },
    runtime_manager: {
      after_update: s_pub(eb.runtime_manager.after_update),
      before_update: s_pub(eb.runtime_manager.before_update),
      restart: s_pub(eb.runtime_manager.restart),
      stop: s_pub(eb.runtime_manager.stop),
      start: s_pub(eb.runtime_manager.start),
      idle: s_pub(eb.runtime_manager.idle),
    },
    runtime_data: {
      variable_update: {
        merged: <ISimpleEvent<E.VariableReduction>>eb.runtime_data.variable_update.merged,
        last: <ISimpleEvent<E.VariableUpdate>>eb.runtime_data.variable_update.last,
        list: <ISimpleEvent<E.VariableUpdate[]>>eb.runtime_data.variable_update.list,
        immediate: <ISimpleEvent<E.VariableUpdate>>eb.runtime_data.variable_update.immediate,
      },
      list_update: {
        merged: <ISimpleEvent<E.ListUpdateReduction>>eb.runtime_data.list_update.merged,
        last: <ISimpleEvent<E.ListUpdate>>eb.runtime_data.list_update.last,
        list: <ISimpleEvent<E.ListUpdate[]>>eb.runtime_data.list_update.list,
        immediate: <ISimpleEvent<E.ListUpdate>>eb.runtime_data.list_update.immediate,
      },
      entity_variable_update: {
        merged: <ISimpleEvent<E.EntityVariableReduction>>eb.runtime_data.entity_variable_update.merged,
        last: <ISimpleEvent<E.EntityVariableUpdate>>eb.runtime_data.entity_variable_update.last,
        list: <ISimpleEvent<E.EntityVariableUpdate[]>>eb.runtime_data.entity_variable_update.list,
        immediate: <ISimpleEvent<E.EntityVariableUpdate>>eb.runtime_data.entity_variable_update.immediate,
      },
      entity_list_update: {
        merged: <ISimpleEvent<E.EntityListReduction>>eb.runtime_data.entity_list_update.merged,
        last: <ISimpleEvent<E.EntityListUpdate>>eb.runtime_data.entity_list_update.last,
        list: <ISimpleEvent<E.EntityListUpdate[]>>eb.runtime_data.entity_list_update.list,
        immediate: <ISimpleEvent<E.EntityListUpdate>>eb.runtime_data.entity_list_update.immediate,
      },
      entity_dispose: ev_pub(eb.runtime_data.entity_dispose),
      block_running: ev_pub(eb.runtime_data.block_running),
      block_finished: ev_pub(eb.runtime_data.block_finished),
      block_run_result: ev_pub(eb.runtime_data.block_run_result),
      test_done: s_pub(eb.runtime_data.test_done),
    },
  };
}

// Forced imports for EventBus
import {
  EventBuffer,
  EventBus,
  EventCategories,
  Neko,
  SignalNeko,
} from 'nekobasu/build/interfaces';
import {
  ISimpleEvent,
} from 'nekobasu/build/util';
import {
  BuiltinEventNeko,
} from 'nekobasu/build/builtin';
import {
  InstrumentedLast,
} from 'nekobasu/build/builtin_event_buffers';

export const DO_NOT_USE__TYPE_INFERENCE_HACK__EB = create_event_bus();
export type EventBusPrivate = typeof DO_NOT_USE__TYPE_INFERENCE_HACK__EB;

export const DO_NOT_USE__TYPE_INFERENCE_HACK__EB_PUB = as_public_event_bus(create_event_bus());
export type EventBusPublic = typeof DO_NOT_USE__TYPE_INFERENCE_HACK__EB_PUB;
