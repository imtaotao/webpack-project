import {
  block_provider,
  basic_types,
  interfaces,
  Heart,
} from 'src/codemao-heart';

export type BlockConfig = block_provider.BlockConfig;
export type BlockConfigDict = block_provider.BlockConfigDict;
export type BlockConfigFactory = block_provider.BlockConfigFactory;
export type FunctionDictFactory = block_provider.FunctionDictFactory;

export type BlockProvider = interfaces.BlockProvider;
export type BlockXML = interfaces.BlockXML;
export type BlockXMLBuilder = interfaces.BlockXMLBuilder;
export type RuntimeManager = interfaces.RuntimeManager;

export type TaskHandle = basic_types.TaskHandle;

export interface Blockly {
  Msg:{[identifier:string]:string};
  [name:string]:any;
}

export interface BlockEvents {
  [name:string]:any;
  get_action_specs:() => any[];
}

export interface BlockGetter<E extends BlockEvents = any> {
  get_block_provider:() => BlockProvider;
  get_block_xml:() => BlockXML;
  get_events:(Heart:() => Heart, Deps?:any) => E;
  init_block_generator:(blockly:Blockly) => void;
}

export interface BlockDependencies {
  get_variables:Function;
  get_entities:Function;
  get_intl() : InjectedIntl;
}

export interface InjectedIntl {
  formatMessage(
    messageDescriptor:MessageDescriptor,
    values?:{[key:string]:string | number | boolean | Date},
  ) : string;
}

export interface MessageDescriptor {
  id:string;
  description?:string;
  defaultMessage?:string;
}

export interface BlockXMLFactory<D extends BlockDependencies> {
  (xml_builder:BlockXMLBuilder, deps?:D) : BlockXML;
}

export type Actor = any;
export type Style = any;

export interface VariableStates {
  [id:string]:Variable;
}

export type Variable = {
  id:string;
  type:string;
  is_global:boolean;
  scale:number;
  visible:boolean;
  theme:string;
  value:(string|number|boolean)|(string|number|boolean)[];
  name:string;
  position?:Point;
  offset:Point;
  current_entity?:string;
};

export interface Point {
  x:number;
  y:number;
}
