import * as nbus from 'nekobasu';

import * as E from './event_types';

function create_variable_event_buffer() {
  return nbus.event_buffer.create<E.VariableUpdate, E.VariableReduction>({
    reducer: (acc, next) => {
      acc[next.var_id] = next.new_value;
      return acc;
    },
    start_value: {},
  });
}

function create_list_event_buffer() {
  return nbus.event_buffer.create<E.ListUpdate, E.ListUpdateReduction>({
    reducer: (acc, next) => {
      acc[next.list_id] = next.new_value;
      return acc;
    },
    start_value: {},
  });
}

function create_entity_variable_event_buffer() {
  return nbus.event_buffer.create<E.EntityVariableUpdate, E.EntityVariableReduction>({
    reducer: (acc, next) => {
      if (acc[next.entity_id] === undefined) {
        acc[next.entity_id] = {};
      }
      acc[next.entity_id][next.var_id] = next.new_value;
      return acc;
    },
    start_value: {},
  });
}

function create_entity_list_event_buffer() {
  return nbus.event_buffer.create<E.EntityListUpdate, E.EntityListReduction>({
    reducer: (acc, next) => {
      if (acc[next.entity_id] === undefined) {
        acc[next.entity_id] = {};
      }
      acc[next.entity_id][next.list_id] = next.new_value;
      return acc;
    },
    start_value: {},
  });
}

export function create_variable_neko() {
  const buf_dict = nbus.util.merge_event_buffers(
    nbus.builtin.event_ebs<E.VariableUpdate>(),
    { merged: create_variable_event_buffer() },
  );

  return nbus.neko.create_for_event<E.VariableUpdate, typeof buf_dict>(buf_dict);
}

export function create_list_neko() {
  const buf_dict = nbus.util.merge_event_buffers(
    nbus.builtin.event_ebs<E.ListUpdate>(),
    { merged: create_list_event_buffer() },
  );

  return nbus.neko.create_for_event<E.ListUpdate, typeof buf_dict>(buf_dict);
}

export function create_entity_variable_neko() {
  const buf_dict = nbus.util.merge_event_buffers(
    nbus.builtin.event_ebs<E.EntityVariableUpdate>(),
    { merged: create_entity_variable_event_buffer() },
  );

  return nbus.neko.create_for_event<E.EntityVariableUpdate, typeof buf_dict>(buf_dict);
}

export function create_entity_list_neko() {
  const buf_dict = nbus.util.merge_event_buffers(
    nbus.builtin.event_ebs<E.EntityListUpdate>(),
    { merged: create_entity_list_event_buffer() },
  );

  return nbus.neko.create_for_event<E.EntityListUpdate, typeof buf_dict>(buf_dict);
}

// Forced import / exports
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

export {
  EventBuffer,
  EventBus,
  EventCategories,
  InstrumentedLast,
  BuiltinEventNeko,
  Neko,
  SignalNeko,
  ISimpleEvent,
};
