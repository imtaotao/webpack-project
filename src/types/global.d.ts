declare let require:{
  <T>(path:string) : T;
  (paths:string[], callback:(...modules:any[]) => void) : void;
  ensure:(paths:string[], callback:(require:<T>(path:string) => T) => void) => void;
  context:any;
};

declare let global:any;
declare let Blockly:any;
declare let goog:any;
declare const initGeetest:any;

declare const __STATIC__:boolean;
declare module 'react-fade-in';