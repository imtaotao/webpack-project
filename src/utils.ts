import { store_manager } from 'refux';
import { push } from 'react-router-redux';
import * as _ from 'lodash';

export function download_file(filename:string, data:string) {
  const urlObject = window.URL || (window as any)['webkitURL'] || window;
  const export_blob = new Blob([data]);
  const save_link:any = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
  save_link.href = urlObject.createObjectURL(export_blob);
  save_link.download = filename;
  function fake_click(obj:HTMLAnchorElement) {
    const ev = document.createEvent('MouseEvents');
    ev.initMouseEvent(
      'click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null,
    );
    obj.dispatchEvent(ev);
  }
  fake_click(save_link);
}

export function get_variables_from_xml(xml:string) {
  const res = [];
  const reg = /<field name="VAR">(\S*)<\/field/g;
  while (true) {
    const match = reg.exec(xml);
    if (match === null) {
      break;
    }

    res.push(match[1]);
  }
  return _.uniq(res);
}

export function read_file(file:File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}

export function jump_to_router(addr:string) {
  store_manager.dispatch(push(addr));
}

export function go_back() {
  store_manager.get_history().go(-1);
}

export function before_hook (origin:any, fun:any) {
  return function (...args:any[]) {
    fun.call(this, ...args);
    return origin.apply(this, args);
  }
}

export function after_hook (origin:any, fun:any) {
  return function (...args:any[]) {
    const result = origin.apply(this, args);
    fun.call(this, ...args, result);
    return result;
  }
}