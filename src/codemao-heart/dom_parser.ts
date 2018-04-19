// TODO Make a nicer interface for, or replace DOMParser
export interface DOMParser {
  parseFromString(xml:string, format:string) : any;
}

export interface XMLDOM {
  children:XMLDOM[];
  getAttribute:(attr:string) => any|undefined;
  tagName:string;
  innerHTML:string;
  parentNode:XMLDOM|undefined;
  lastChild:XMLDOM;
  firstChild:XMLDOM;
}
