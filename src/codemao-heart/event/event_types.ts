import { Catastrophe } from 'catastrophic';
import { ID, RuntimeStackMetadata } from '../basic_types';

export interface BlockResult {
  root_block_id:ID;
  block_id:ID;
  result:any;
}

export interface EntityDisposed {
  entity_id:ID;
}

export interface VariableUpdate {
  var_id:string;
  new_value:any;
}

export interface VariableReduction {
  [var_id:string]:any;
}

export interface ListUpdate {
  list_id:string;
  new_value:any[];
}

export interface ListUpdateReduction {
  [list_id:string]:any[];
}

export interface EntityVariableUpdate {
  var_id:string;
  new_value:any;
  entity_id:string;
}

export interface EntityVariableReduction {
  [entity_id:string]:VariableReduction;
}

export interface EntityListUpdate {
  list_id:string;
  new_value:any;
  entity_id:string;
}

export interface EntityListReduction {
  [entity_id:string]:ListUpdateReduction;
}

export interface RuntimeError {
  error:Catastrophe;
  error_stack?:RuntimeStackMetadata[];
}

export interface GeneralError {
  error:Catastrophe;
}
