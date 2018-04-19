import {
  CompiledBlock,
  CompiledEntity,
} from '../heart';
import * as _ from 'lodash';

import { store_manager } from 'refux/store';

let procedures:{[proce_name:string]:CompiledBlock} = {};
let _should_prevent_procedure_rename:boolean = false;

export function show_input_dialog(self:any, hash:any) {
  self.arguments_.push(prompt('请输入：'));
  self.updateParams_();
}

export function classify_procedures(has_return_block:Function, proceduresReturn:any[], proceduresNoReturn:any[]) {
  _.forEach(procedures, (json, name) => {
    const variables:string[] = [];
    _.forEach(json.params, (v, n:string) => {
      variables.push(n);
    });
    const data = [
      name,
      variables,
      false,
    ];
    if (has_return_block(json)) {
      proceduresReturn.push(data);
    }
    proceduresNoReturn.push(data);
  });
  return [proceduresNoReturn, proceduresReturn];
}

export function get_project() {
  return {
    rename_procedure: (old_name:string, new_name:string) => {
      procedures[new_name] = _.cloneDeep(procedures[old_name]);
      delete(procedures[old_name]);
    },
    clone_procedure: (new_name:string, old_name:string) => {
      if (_.isUndefined(procedures[new_name])) {
        procedures[new_name] = _.cloneDeep(procedures[old_name]);
      }
    },
    get_procedure: () => {
      return procedures;
    },
    get_legal_procedure_name: (old_name:string, new_name:string) => {
      const procedure_name_list = _.keys(procedures);
      if (old_name == new_name && old_name !== 'function') {
        return new_name;
      }
      _.remove(procedure_name_list, (name) => {
        return name === old_name;
      });
      procedure_name_list.push('function');
      let index = _.indexOf(procedure_name_list, new_name);
      while (index >= 0) {
        const r = new_name.match(/^(.*?)(\d+)$/);
        if (!r) {
          new_name += '1';
        } else {
          new_name = r[1] + (parseInt(r[2], 10) + 1);
        }
        index = _.indexOf(procedure_name_list, new_name);
      }
      return new_name;
    },
  };
}

export function get_workspace_panel() {
  return {
    rename_entity:() => {},
  };
}

export function should_prevent_procedure_rename() {
  return _should_prevent_procedure_rename;
}

export function set_compiled_data(compiled_entity:CompiledEntity) {
  if (compiled_entity.procedures) {
    _.forEach(compiled_entity.procedures, (compiled_block, name:string) => {
      procedures[name] = compiled_block;
    });
  }
}

export function get_procedure_parameters() {
  const params:string[] = [];
  _.forEach(procedures, (json, name) => {
    if (json === undefined) {
      return;
    }
    _.forEach(json.params, (v, n:string) => {
      params.push(n);
    });
  });
  return _.uniq(params);
}

export function delete_all_procedures() {
  procedures = {};
}

export function set_prevent_procedure_rename(value:boolean) {
  _should_prevent_procedure_rename = value;
}
