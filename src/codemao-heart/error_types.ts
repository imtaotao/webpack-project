import { Catastrophic, Catastrophe } from 'catastrophic';

import { ID } from './basic_types';

const error_manager = new Catastrophic('HEART.CATASTROPHIC');

const user_category = {
  unique_code: 'HEART.USER',
  description: 'Runtime errors caused by users',
  default_http_code: 400,
};

const user_errors = {
  unknown_user_error: {
    unique_number: 0,
  },
  procedure_no_such_parameter: {
    unique_number: 1,
    description: 'A procedure parameter not belonging to this procedure was used',
  },
  procedure_parameter_outside: {
    unique_number: 2,
    description: 'A procedure parameter block was used outside of a procedure',
  },
  procedure_return_outside: {
    unique_number: 3,
    description: 'The procedure return block was used outside of a procedure',
  },
  procedure_return_empty: {
    unique_number: 4,
    description: 'The procedure return block must not be empty',
  },
  error_constructing_value_from_atomic_block: {
    unique_number: 5,
  },
  unknown_run_block_error: {
    unique_number: 6,
    description: 'Unknown error when attempting to run a block',
  },
  block_bad_math_expression: {
    unique_number: 7,
    description: 'User used a bad expression in the calculate block',
  },
  break_with_bad_parent: {
    unique_number: 8,
    description: 'A break block was used outside of a looping block',
  },
  undefined_code_path_argument: {
    unique_number: 9,
    description: 'This execution path should be impossible, argument is calling a child',
  },
  lists_get_value_bad_index: {
    unique_number: 10,
    description: `The user attempted to access a list index that either didn't exist or contained an undefined value`,
  },
  tell_with_unknown_entity: {
    unique_number: 11,
    description: `The user attempted to tell an entity to do something, but no such entity is known`,
  },
  entity_variable_operation_out_of_scope: {
    unique_number: 12,
    description: `The user attempted to get or set an entity variable with blocks of other entity`,
  },
  clone_unknown_entity: {
    unique_number: 13,
    description: `The user attempted to clone an entity, but no such entity is known`,
  },
  proc_parameter_without_value: {
    unique_number: 14,
    description: `The user attempted to use a procedure parameter that had no value.`,
  },
  call_undefined_procedure: {
    unique_number: 15,
    description: `The user attempted to call a procedure that is not defined.`,
  },
};

const warning_category = {
  unique_code: 'HEART.WARNING',
  description: 'Warnings caused by user code',
  default_http_code: 400,
};

const warning_errors = {
  tell_with_disposed_entity: {
    unique_number: 0,
    description: `The user attempted to tell a disposed entity to do something`,
  },
  clone_with_disposed_entity: {
    unique_number: 1,
    description: `The user attempted to clone an entity after disposed it`,
  },
  tell_with_destructing_entity: {
    unique_number: 2,
    description: `The user attempted to tell a destructing entity to do something`,
  },
  entity_has_no_known_typeclass: {
    unique_number: 3,
    description: `The system tried to do something with an entity, but that entity had no associated typeclass`,
  },
};

const system_category = {
  unique_code: 'HEART.SYSTEM',
  description: 'Internal heart errors not caused by users',
  default_http_code: 500,
};

const system_errors = {
  unknown_system_error: {
    unique_number: 0,
  },
  missing_domain_function: {
    unique_number: 1,
    description: 'No domain function of this type exists',
  },
  procedure_missing_call_timestamps: {
    unique_number: 2,
  },
  procedure_popped_empty_call_stack: {
    unique_number: 3,
  },
  popped_empty_variable_stack: {
    unique_number: 4,
  },
  undefined_or_null_block: {
    unique_number: 5,
    description: 'Tried to run an undefined or null block',
  },
  procedure_can_not_find_yielding_ancestor: {
    unique_number: 6,
  },
  unhandled_run_block_result: {
    unique_number: 7,
    description: 'Called run_block but did not properly handle a possible result type.',
  },
  action_received_without_spec: {
    unique_number: 8,
    description: 'Received an Action with namespace and id that have no associated registered ActionSpec.',
  },
  state_query_received_without_spec: {
    unique_number: 9,
    description: 'Received a State Query with namespace and id that have no associated registered ActionSpec.',
  },
  state_query_for_non_stateful_action: {
    unique_number: 10,
    description: 'Attempted to get State for an Action type that is not stateful.',
  },
  unknown_error_in_domain_function_call: {
    unique_number: 11,
  },
  unknown_action_block_param_type: {
    unique_number: 12,
  },
  feature_not_available_in_debug_mode: {
    unique_number: 13,
  },
  called_set_variable_without_needed_parameters: {
    unique_number: 14,
    description: `If your variable's scope is 'script', you must provide an interpreter_id. If scope is 'entity' then entity_id must be provided.`,
  },
  called_get_variable_without_needed_parameters: {
    unique_number: 15,
    description: `If your variable's scope is 'script', you must provide an interpreter_id. If scope is 'entity' then entity_id must be provided.`,
  },
};

const configuration_category = {
  unique_code: 'HEART.CONFIGURATION',
  description: `Configuration errors, caused by the Client's attempt to configure or set up Heart`,
  default_http_code: 500,
};

const configuration_errors = {
  tried_to_change_user_debug_mode_while_running: {
    unique_number: 0,
    description: 'Tried to change user_debug_mode while running. Heart does not allow this.',
  },
};

const compiler_system_category = {
  unique_code: 'HEART.COMPILER.SYSTEM',
  description: 'Compilation errors caused by Heart or Client setups',
  default_http_code: 500,
};

const compiler_system_errors = {
  unknown_procedure_block_type: {
    unique_number: 0,
    description: 'Entered procedure_to_json without matching data.type',
  },
  procedure_name_not_string: {
    unique_number: 1,
    description: `Given procedure block's NAME param was not name`,
  },
  procedure_call_name_not_string: {
    unique_number: 2,
    description: `Given procedure call block's NAME param was not name`,
  },
  unknown_compiler_error: {
    unique_number: 3,
    description: `Unknown compiler error, sorry`,
  },
  unknown_expression: {
    unique_number: 4,
    description: `Optimizing compiler reached an unknown expression`,
  },
  constructed_bad_javascript: {
    unique_number: 5,
    description: `Optimizing compiler constructed invalid javascript`,
  },
  popped_empty_yield_reset_stack: {
    unique_number: 6,
    description: `Optimizing compiler popped empty yield reset stack`,
  },
  popped_empty_yield_group_stack: {
    unique_number: 7,
    description: `Optimizing compiler popped empty yield group stack`,
  },
  could_not_find_root_block: {
    unique_number: 8,
    description: `Optimizing compiler could not find root block of another block`,
  },
  could_not_find_procedure_parameter_name: {
    unique_number: 9,
    description: `Optimizing compiler could not find the name of a procedure parameter`,
  },
};

const compiler_user_category = {
  unique_code: 'HEART.COMPILER.USER',
  description: 'Compilation errors caused by Users',
  default_http_code: 400,
};

const compiler_user_errors = {
  tried_to_break_outside_of_loop: {
    unique_number: 0,
    description: `Tried using the break (Quit loop) block outside a loop`,
  },
  procedure_parameter_outside: {
    unique_number: 1,
    description: 'A procedure parameter block was used outside of a procedure',
  },
  procedure_return_empty: {
    unique_number: 2,
    description: 'The procedure return block must not be empty',
  },
  error_constructing_value_from_atomic_block: {
    unique_number: 3,
  },
  procedure_no_such_parameter: {
    unique_number: 4,
    description: 'A procedure parameter not belonging to this procedure was used',
  },
  procedure_return_outside: {
    unique_number: 5,
    description: 'The procedure return block was used outside of a procedure',
  },
  defined_multiple_constructors: {
    unique_number: 6,
    description: 'Multiple constructors were defined for a single entity typeclass. Only zero or one is allowed.',
  },
  defined_multiple_destructors: {
    unique_number: 7,
    description: 'Multiple destructors were defined for a single entity typeclass. Only zero or one is allowed.',
  },
  disabled_param: {
    unique_number: 8,
    description: 'There is a disabled expression in code',
  },
};

const client_category = {
  unique_code: 'HEART.CLIENT',
  description: 'Errors created and thrown by the client environment',
  default_http_code: 500,
};

const client_errors = {
  domain_function_error: {
    unique_number: 0,
    description: 'Error which ocurred within a domain function',
  },
};

export const ohno = {
  system: error_manager.new_category(system_category, system_errors),
  user: error_manager.new_category(user_category, user_errors),
  warning: error_manager.new_category(warning_category, warning_errors),
  compiler: {
    system: error_manager.new_category(compiler_system_category, compiler_system_errors),
    user: error_manager.new_category(compiler_user_category, compiler_user_errors),
  },
  configuration: error_manager.new_category(configuration_category, configuration_errors),
  client: error_manager.new_category(client_category, client_errors),
};

export type Ohno = typeof ohno;
