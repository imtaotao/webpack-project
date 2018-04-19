// TODO check if this needs to be changed to a d.ts
export interface Blockly {
  Msg:{[identifier:string]:string};
  JavaScript:any;
  Blocks:any;
  Mutator:any;
  Xml:any;
  Events:any;
  Names:any;
  inject:any;
  Variables:any;
  FieldVariable:any;
  BlockSvg:any;
  genUid:any;
  WorkspaceSvg:any;
  Workspace:any;
  mainWorkspace:any;
  createDom_:any;
  MutationRemoveButton:any;
  MutationAddButton:any;

  FieldIcon:any;
  WidgetDiv:any;
  FieldColour:any;
}
