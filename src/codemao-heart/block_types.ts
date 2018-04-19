// The enums (dict lookups) used instead of direct string comparisons for
// tagged unions are much faster according to Patrick's measurements. They
// should be changed when TS allows us to use numbers instead of strings as
// values for recognizing kinds.
//
// We lookup membership in the enum by accessing a key and getting a truthy
// value, so these enums must start counting at 1, not 0.

export enum LOOP_BLOCKS {
  repeat_forever = 1,
  repeat_n_times = 2,
  repeat_forever_until = 3,
  wait_until = 4,
  break = 5,
}

export enum IF_BLOCKS {
  controls_if = 1,
  controls_if_no_else = 2,
}

export enum EVENT_BLOCKS {
  self_listen = 1,
  start_as_a_mirror = 2,
  player_position_on_change = 3,
  mouse_on_emit = 4,
  block_on_break = 5,
  when = 6,
}

export enum PROCEDURE_BLOCKS {
  procedures_defnoreturn = 1,
  procedures_callnoreturn = 2,
  procedures_callreturn = 3,
  procedures_return_value = 4,
  procedures_parameter = 5,
}

export enum MIDI_BLOCKS {
  midi_play_note = 1,
  midi_wait,
}

// TODO Extract most of these into external push event blocks
export enum HAT_BLOCKS {
  start_on_click = 1,
  self_on_tap,
  backdrop_on_change,
  self_listen,
  start_as_a_mirror,
  procedures_defnoreturn,
  on_swipe,
  player_position_on_change,
  mouse_on_emit,
  block_on_break,
  when,
  on_running_group_activated,
}

export enum ATOMIC_BLOCKS {
  math_number = 1,
  text = 2,
}

export enum SPECIAL_BLOCKS {
  tell = 1, // async
  logic_empty,
  sync_tell,
  warp,
}

export enum BlockOutputType {
  none,
  any,
  number,
  list,
  string,
}

// TODO Rename BlockParam to Evaluable or something similar
// TODO Then add export type BlockParam = Expression | string | number | boolean;
export type BlockParam = CompiledBlock | string | number | boolean | undefined;
export type MaybeBlock = CompiledBlock | undefined;

export interface PreBlock {
  // TODO Use enum instead of string for kind, and maybe also for type
  // This should fix the large amount of <any> coercions in the
  // type/kind lookups in this file
  type:string; // Granular
  kind:string; // Higher order, but often same as type
  id:string;
  params:{[p_id:string]:BlockParam};
  parent_block?:CompiledBlock;
  next_block?:CompiledBlock;
  child_block:MaybeBlock[];
  first_evaluation:boolean;
  done_evaluating:boolean;
  disabled:boolean;
  output_type?:BlockOutputType;
}

export interface Block extends PreBlock {
  waiting_for_procedure?:boolean;
  last_call?:number; // current frames
}

export interface ConditionalBlock extends Block {
  conditions:MaybeBlock[];
}

export interface IfBlock extends ConditionalBlock {
  kind:'controls_if';
}

export interface IfNoElseBlock extends ConditionalBlock {
  kind:'controls_if_no_else';
}

export interface EventBlock extends Block {
  kind:'event_block';
}

export interface WhenBlock extends Block {
  kind:'when';
}

export interface RepeatNTimesBlock extends Block {
  kind:'repeat_n_times';
  times_left:number;
}

export interface RepeatForeverBlock extends Block {
  kind:'repeat_forever';
}

export interface RepeatForeverUntilBlock extends Block {
  kind:'repeat_forever_until';
}

export interface WaitUntilBlock extends Block {
  kind:'wait_until';
}

export interface BreakBlock extends Block {
  kind:'break';
}

export interface ProcedureDefinitionBlock extends Block {
  kind:'procedures_defnoreturn';
  procedure_name:string;
}

export interface ProcedureCallReturnBlock extends Block {
  kind:'procedures_callreturn';
  procedure_name:string;
  procedure_return_value?:any;
}

export interface ProcedureCallNoReturnBlock extends Block {
  kind:'procedures_callnoreturn';
  procedure_name:string;
}

export interface ProcedureReturnValueBlock extends Block {
  kind:'procedures_return_value';
}

export interface ProcedureParameterBlock extends Block {
  kind:'procedures_parameter';
}

/**
 * This block lets one entity "tell" another entity what to do. Blocks within
 * this block will be executed as if they were executed by the target entity.
 */
export interface TellBlock extends Block {
  kind:'tell';
}

/**
 * This block lets one entity "tell" another entity what to do. Blocks within
 * this block will be executed as if they were executed by the target entity.
 * The blocks chunks will be blocked until the executing blocks finish.
 */
export interface SyncTellBlock extends Block {
  kind:'sync_tell';
}

export interface WarpBlock extends Block {
  kind:'warp';
}

/**
 * This block is an <empty> type shadow block, the non-modifiable shadow block
 * that's the default content of loop and conditional block's conditionals.
 */
export interface LogicEmptyBlock extends Block {
  kind:'logic_empty';
}

/**
 * A command block given to Heart via a BlockProvider
 */
export interface DomainBlock extends Block {
  kind:'domain_block';
}

/**
 * An event handling block given to Heart via a BlockProvider
 */

export interface ResponderBlock extends Block {
  kind:'responder_block';
}

export type LoopBlock =
  RepeatNTimesBlock
  | RepeatForeverBlock
  | RepeatForeverUntilBlock
  | WaitUntilBlock
  | BreakBlock;

export type CondBlock = IfBlock | IfNoElseBlock;

export type SpecialBlock = TellBlock | SyncTellBlock | LogicEmptyBlock | WarpBlock;

export type ProcBlock =
  ProcedureDefinitionBlock
  | ProcedureCallReturnBlock
  | ProcedureCallNoReturnBlock
  | ProcedureReturnValueBlock
  | ProcedureParameterBlock;

export type CompiledBlock =
  EventBlock
  | ResponderBlock
  | ProcBlock
  | CondBlock
  | LoopBlock
  | DomainBlock
  | SpecialBlock;

// Every block is a statement, only some blocks are expressions
// (expressions return some value, statements can never be used
// in a position where a returned value is needed, e.g. as a
// parameter
export type Expression =
  LogicEmptyBlock
  | ProcedureParameterBlock
  | ProcedureCallReturnBlock
  | DomainBlock;

export type Statement =
  EventBlock
  | ResponderBlock
  | ProcedureDefinitionBlock
  | ProcedureCallNoReturnBlock
  | ProcedureReturnValueBlock
  | CondBlock
  | LoopBlock
  | TellBlock
  | SyncTellBlock
  | WarpBlock
  | Expression
  | WhenBlock;

// A combination of every other block type, used
// to create pooled block objects for the BlockPool
export type PoolBlock =
  EventBlock
  & ResponderBlock
  & DomainBlock

  & IfBlock
  & IfNoElseBlock

  & RepeatNTimesBlock
  & RepeatForeverBlock
  & RepeatForeverUntilBlock
  & WaitUntilBlock
  & BreakBlock

  & ProcedureDefinitionBlock
  & ProcedureCallReturnBlock
  & ProcedureCallNoReturnBlock
  & ProcedureReturnValueBlock
  & ProcedureParameterBlock
  & WhenBlock
  & TellBlock
  & SyncTellBlock
  & WarpBlock
  & LogicEmptyBlock;
