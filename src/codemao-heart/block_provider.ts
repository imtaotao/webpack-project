import _includes from 'lodash/includes';

import { Blockly } from './blockly_interface';
import { ID, Dict } from './basic_types';
import * as P from './public_interfaces';

export interface DomainFunctionArgs {
  [k:string]:any;
}

export interface DomainFunctionInternals {
  runtime_manager:P.RuntimeManager;
  add_user_procedure_call_to_stack(
    function_id:ID,
    target_entity_id:string,
    paramaters:{[param_id:string]:any},
  ) : void;
  get_action_parameter(parameter_id:string) : undefined|any;
}

export type UserProcedureCall = DomainFunctionInternals['add_user_procedure_call_to_stack'];

export type DomainFunction = (
    args:DomainFunctionArgs,
    interpreter_id:ID,
    target_entity:ID,
    internals:DomainFunctionInternals,
) => any;

export interface FunctionDict {
  [function_name:string]:DomainFunction;
}

export interface BlockConfig {

  message0:string;
  args0:BlockConfigArg[];
  lastDummyAlign0?:BCAAlignment;

  // More of these may be added as needed
  message1?:string;
  args1?:BlockConfigArg[];
  lastDummyAlign1?:BCAAlignment;
  message2?:string;
  args2?:BlockConfigArg[];
  lastDummyAlign2?:BCAAlignment;
  message3?:string;
  args3?:BlockConfigArg[];
  lastDummyAlign3?:BCAAlignment;
  message4?:string;
  args4?:BlockConfigArg[];
  lastDummyAlign4?:BCAAlignment;
  message5?:string;
  args5?:BlockConfigArg[];
  lastDummyAlign5?:BCAAlignment;
  message6?:string;
  args6?:BlockConfigArg[];
  lastDummyAlign6?:BCAAlignment;

  colour:string|number;
  helpUrl?:string;
  init?:Function;
  inputsInline?:boolean;
  mutator?:string;
  nextStatement?:boolean|null;
  output?:string|string[]|null; // null indicates untyped output
  previousStatement?:boolean|null;
  tooltip?:string;
  type?:string;
  extensions?:string[];
}

export interface BlockConfigDict {
  [block_name:string]:BlockConfig;
}

export interface BlockConfigArgBase {
  align?:BCAAlignment;
  check?:string|string[];
  variableTypes?:string[];

  // An alternative BlockConfigArg may be specified for clients that may
  // not support this BlockConfigArg type. This is `alt?:BlockConfigArg;`
  // for all field types, except field_image and field_icon where it may also
  // be string to specify the image's alt text.
}

export type BCAOptionTuple = [string, string];
export type BCAOptionList = BCAOptionTuple[];
export type BCAOptionFunction = () => BCAOptionList;

export type BCAAlignment = 'LEFT'|'CENTRE'|'RIGHT';

export type BlockConfigArg = InputValue
    | InputDummy
    | InputStatement
    | FieldInput
    | FieldDropdown
    | FieldCheckbox
    | FieldColour
    | FieldNumber
    | FieldAngle
    | FieldVariable
    | FieldDate
    | FieldLabel
    | FieldImage
    | FieldIcon; // icon seems to be blockly internal?

export interface InputValue extends BlockConfigArgBase {
  name:string;
  type:'input_value';
  alt?:BlockConfigArg;
}
export interface InputDummy extends BlockConfigArgBase {
  type:'input_dummy';
  alt?:BlockConfigArg;
}
export interface InputStatement extends BlockConfigArgBase {
  name:string;
  type:'input_statement';
  alt?:BlockConfigArg;
}
export interface FieldInput extends BlockConfigArgBase {
  name:string;
  type:'field_input';
  spellcheck?:boolean;
  text:string;
  alt?:BlockConfigArg;
}
export interface FieldDropdown extends BlockConfigArgBase {
  name:string;
  type:'field_dropdown';
  options:BCAOptionList|BCAOptionFunction;
  alt?:BlockConfigArg;
}
export interface FieldCheckbox extends BlockConfigArgBase {
  name:string;
  type:'field_checkbox';
  checked:boolean;
  alt?:BlockConfigArg;
}
export interface FieldColour extends BlockConfigArgBase {
  name:string;
  type:'field_colour';
  colour:string;
  alt?:BlockConfigArg;
}
export interface FieldNumber extends BlockConfigArgBase {
  name:string;
  type:'field_number';
  value:number;
  min?:number;
  max?:number;
  precision?:number;
  alt?:BlockConfigArg;
}
export interface FieldAngle extends BlockConfigArgBase {
  name:string;
  type:'field_angle';
  angle:string;
  alt?:BlockConfigArg;
}
export interface FieldVariable extends BlockConfigArgBase {
  name:string;
  type:'field_variable';
  variable:string;
  alt?:BlockConfigArg;
}
export interface FieldDate extends BlockConfigArgBase {
  name:string;
  type:'field_date';
  date:string;
  alt?:BlockConfigArg;
}
export interface FieldLabel extends BlockConfigArgBase {
  type:'field_label';
  text:string;
  class:string;
  alt?:BlockConfigArg;
}
export interface FieldImage extends BlockConfigArgBase {
  type:'field_image';
  src:string;
  width:number;
  height:number;
  alt?:BlockConfigArg|string;
}
// Can't find this in the docs, but used in kitten/cmblocks
export interface FieldIcon extends BlockConfigArgBase {
  type:'field_icon';
  src:string;
  width:number;
  height:number;
  is_head:boolean;
  alt?:BlockConfigArg|string;
}
/**
 * Actions are events the user's code may respond to.
 *
 * When Actions are fired, the RuntimeManager will automatically
 * create a new interpreter and run the relevant code in it. As such,
 * many of these can be running for the same event at the same time.
 *
 * For sync events, the RuntimeManager will only start one BlockInterpreter
 * per block group at a time.
 */
export interface ActionSpec {
  // id must be the same id as the block which responds to the event
  // this id is not namespaced, since it is supplid to Heart in a BlockProvider
  // which carries the namespace information
  id:string;
  entity_specific:boolean;
  responder_blocks:ResponderSpec[];
  statefulness?:ActionStateSpec;
}

// TODO divide ResponderSpec into tagged union of responder types

export enum ResponderType {
  Action = 'action',
  State = 'state',
  Dynamic = 'dynamic',
  Constructor = 'constructor',
  Destructor = 'destructor',
}

export type TriggerFunc = (actions:Action[], value?:string, sub_type?:string, entity_id?:ID) => boolean;

export interface ResponderSpec {
  // ID of the responder's block
  id:string;

  // Whether it responds to actions, each tick during a state, or use trigger_function as dynamic responder
  type:ResponderType;

  // Whether multiple BlockInterpreters instantiated by one responder
  // can be instantiated and run simultaneously
  async:boolean;

  // Increase this number to make Interpreters spawned by this Responder
  // run earlier in the tick (compared to other Interpreters that were
  // spawned in the same frame).
  //
  // If not specified, the default priority is 50.
  // Suggested intervals:
  // [-infinity, 1000] - any
  // [1000, 2000] - performance priorities
  // ]2000, 3000] - priorities without which functionality breaks
  priority?:number;

  filter_arg_names?:{
    // Of the blocks' arguments, which args are used to filter which Action
    // values and sub_types which the Responder should react to 'filter_value'
    // and 'filter_sub_type' are the defaults. If no filters are used, the
    // Responder will respond to all events of that type.
    value:string;
    sub_type:string;
  };
  trigger_function?:TriggerFunc;  // Must have trigger_function if responderType is dynamic.
}

export interface ResponderInfo {
  namespace:string;
  action_spec:ActionSpec;
  responder_spec:ResponderSpec;
}

/**
 * An action may encode a state change. Whenever a sent Action has a value,
 * that value will be used as that action id's new state. If the action has
 * sub_types, each sub type has its own state. If the Action is
 * entity_specific, each entity has its own collection of states.
 *
 * If 'one_frame' is specified as value for automatic_transitions, then the
 * state will always be reset to '' (the empty string) after one frame.
 */
export interface ActionStateSpec {
  default_value:string;
  automatic_transitions:StateTransitionTable | 'one_frame';
  use_sub_type:boolean;
}

/**
 * For each key->value pair, specifies that the state
 * shall transition from key to value on tick. No Action
 * is emitted when such automatic state transitions occur.
 *
 * If the current state does not have an entry in the
 * table, no automatic transition takes place.
 *
 * This is useful for something like mouse_up -> null,
 * but not for mouse_down -> mouse_up.
 *
 * It is an error to define a state transition from
 * the default_value to any other state value, because
 * we do not require registration of all possible stateful
 * entities and sub_types before runtime.
 * TODO Enforce no transition from default value at registration time
 */
export interface StateTransitionTable {
  [current_state:string]:string; // current -> next state
}

export interface Action {
  entity_id?:ID;
  id:string;
  namespace:string;
  parameters?:Dict<any>;
  value?:string;
  sub_type?:string;
}

export type BlockConfigFactory = (blockly:Blockly) => BlockConfigDict;
export type FunctionDictFactory = () => FunctionDict;

export interface RuntimeProvider {
  namespace() : string;
  action_types() : ActionSpec[];
  domain_functions:FunctionDictFactory;
  block_metadata?:{
    restart_when_finished?:string[];
    finish_out_of_run_group?:string[];
  };
}

export interface BlockProvider extends RuntimeProvider {
  config:BlockConfigFactory;
}

export interface ParsedFullName {
  namespace:string;
  function_id:string;
}

// TODO Remove references to `this.` from blocks/basic/functions.ts & etc
// and give basic and stage2d namespaces so we can remove the empty namespace
// special case

// This is used by ScriptCraft mod to figure out which events to
// subscribe to. May be possible to remove (and just sub to all
// events).
export function parse_namespaced_id(ns_id:string) : ParsedFullName {
  if (!_includes(ns_id, '__')) {
    return {
      namespace: '',
      function_id: ns_id,
    };
  }
  const ns_length = ns_id.indexOf('__');
  return {
    namespace: ns_id.substring(0, ns_length),
    function_id: ns_id.substring(ns_length + 2),
  };
}

export function namespaced_id(namespace:string, function_name:string) : string {
  if (namespace == '') {
    return function_name;
  }
  return namespace + '__' + function_name;
}
