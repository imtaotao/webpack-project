export interface Entity {
  id:string;
  workspace_xml:string;
  variables:string[];
}

export interface HeartTest0 {
  version:0;
  test_name:string;
  main_entity:Entity;
  optional_entities:Entity[];
  global_variables:string[];
}

export type HeartTestCurrent = HeartTest0;
export type HeartTest = HeartTest0; // add 0,1,... here
