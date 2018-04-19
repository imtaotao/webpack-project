import { FunctionDict, FunctionDictFactory, namespaced_id } from '../block_provider';
import { Ohno } from '../error_types';
import { RuntimeManager, RuntimeData, AvaTestLike } from '../public_interfaces';
import { EventBusPrivate } from '../event/event_bus';
import { Config, TestAssertionTool } from '../di_interfaces';

export function get_domain_functions(
    runtime_manager:RuntimeManager,
    runtime_data:RuntimeData,
    event_bus:EventBusPrivate,
    ohno:Ohno,
    config:Config,
    assertion_tool:AvaTestLike | TestAssertionTool,
) : FunctionDictFactory {

  const t = assertion_tool;
  const domain_functions:FunctionDict = {
    plan(args) {
      t.plan(args.n_planned_assertions);
    },

    fail(args) {
      t.fail(args.message);
    },

    pass(args) {
      t.pass(args.message);
    },

    truthy(args) {
      t.truthy(args.value, args.message);
    },

    falsy(args) {
      t.falsy(args.value, args.message);
    },

    is(args) {
      t.is(args.value, args.expected, args.message);
    },

    not(args) {
      t.not(args.value, args.expected, args.message);
    },

    done(args) {
      event_bus.runtime_data.test_done.send();
    },

    async bad_promise(args) {
      throw ohno.client.domain_function_error(
          new Error('Threw error in bad_promise on purpose.'),
          {
            client_annotation: 'Annotation: Threw error in bad_promise on purpose.',
          },
      );
    },

    async good_promise(args) {
      return new Promise<string>((resolve, reject) => {
        setTimeout(() => resolve(args.returns), args.milliseconds);
      });
    },

    call_user_procedure(args, interpreter_id, entity_id, internals) {
      internals.add_user_procedure_call_to_stack(args.function_id, entity_id, {
        argone: args.argone,
      });
    },

    send_test_action(args, interpreter_id, entity_id, internals) {
      internals.runtime_manager.send_action({
        id: 'testaction',
        namespace: 'AUTOMATEDTESTS',
        parameters: {
          test_parameter: args.parameter_value,
        },
      });
    },

    get_test_action_parameter(args, interpreter_id, entity_id, internals) {
      const param_value = internals.get_action_parameter('test_parameter');
      if (param_value == undefined) {
        throw ohno.system.unknown_system_error({
          message: 'Could not get parameter in test block "test action parameter"',
        });
      }
      return param_value;
    },

    create_entity_instance(args, interpreter_id, entity_id, internals) {
      const typeclass_id = args.typeclass_id;
      const rm = internals.runtime_manager;
      // TODO remove this hack for generating random entity ids
      const new_entity_id = (<any>rm).generate_random_id('randomid');
      rm.create_entity_instance(typeclass_id, new_entity_id);
    },

    pull_event_test(args, interpreter_id, entity_id, internals) {
      return true;
    },
  };

  return () => domain_functions;
}