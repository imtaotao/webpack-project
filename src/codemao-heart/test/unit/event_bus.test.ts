import 'reflect-metadata';

import { test } from 'ava';

import { get_instance } from '../../container';
import { BINDING } from '../../di_symbols';
import * as H from '../../di_interfaces';
import * as E from '../../event/event_types';
import { ConfigImpl } from '../../config';

const cwarn = console.warn.bind(console);
const cerr = console.error.bind(console);
const clog = console.log.bind(console);
const logger = <any>{
  fatal: cerr,
  error: cerr,
  warn: cwarn,
  info: clog,
  debug: clog,
  trace: clog,
};

function get_container_with_defaults() {
  return get_instance({
    logger,
    configuration: {},
  });
}

test(async function after_update(t) {
  t.plan(1);
  const c = get_container_with_defaults();
  const eb = c.get<H.EventBusPrivate>(BINDING.EventBus);
  eb.runtime_manager.after_update.immediate.sub(() => t.pass());
  eb.runtime_manager.after_update.send();
});

test(async function update_flush(t) {
  t.plan(2);

  const c = get_container_with_defaults();
  const eb = c.get<H.EventBusPrivate>(BINDING.EventBus);

  let got_event = false;

  eb.runtime_data.entity_dispose.list.sub((unused) => got_event = true);

  eb.runtime_data.entity_dispose.send({entity_id: 'unimportant'});

  t.false(got_event);
  eb.runtime_manager.after_update.send();
  t.true(got_event);
});

test(async function variable_reduced_updates(t) {
  t.plan(1);

  const c = get_container_with_defaults();
  const eb = c.get<H.EventBusPrivate>(BINDING.EventBus);

  const updates = [{
    var_id: 'varone',
    new_value: 'one',
  },
  {
    var_id: 'vartwo',
    new_value: 'one',
  },
  {
    var_id: 'varone',
    new_value: 'two',
  },
  {
    var_id: 'varthree',
    new_value: 'one',
  },
  {
    var_id: 'vartwo',
    new_value: 'two',
  },
  {
    var_id: 'vartwo',
    new_value: 'one',
  },
  ];

  const expected_result = {
    varone: 'two',
    vartwo: 'one',
    varthree: 'one',
  };

  eb.runtime_data.variable_update.merged.one((r) => t.deepEqual(r, expected_result));
  updates.forEach((var_update) => {
    eb.runtime_data.variable_update.send(var_update);
  });

  const last:E.VariableUpdate = {var_id: 'vartwo', new_value: 'one'};
  eb.runtime_data.variable_update.last.one((r) => t.deepEqual(r, last));

  eb.runtime_manager.after_update.send();
});

test(async function dispatch_without_subscriber_is_noop(t) {
  t.plan(2);

  const c = get_container_with_defaults();
  const eb = c.get<H.EventBusPrivate>(BINDING.EventBus);

  const noop_updates = [{
    var_id: 'varone',
    new_value: 'one',
  },
  {
    var_id: 'vartwo',
    new_value: 'one',
  },
  {
    var_id: 'varone',
    new_value: 'two',
  },
  {
    var_id: 'varthree',
    new_value: 'one',
  },
  {
    var_id: 'vartwo',
    new_value: 'two',
  },
  ];

  eb.runtime_data.variable_update.merged.one((r) => t.deepEqual(r, {'mouth words': 'blblblblbl'})); // 1
  eb.runtime_data.variable_update.send({var_id: 'mouth words', new_value: 'blblblblbl'});
  eb.runtime_manager.after_update.send();

  noop_updates.forEach((var_update) => {
    eb.runtime_data.variable_update.send(var_update);
  });

  const used_update = {
    var_id: 'vartwo',
    new_value: 'one',
  };

  eb.runtime_data.variable_update.merged.one((r) => t.deepEqual(r, {vartwo: 'one'})); // 2
  eb.runtime_data.variable_update.send(used_update);
  eb.runtime_manager.after_update.send();
});
