import _uniq from 'lodash/uniq';

const var_regex = /<field name="VAR">(\S*)<\/field/g;
export function get_variables_from_xml(xml:string) : string[] {
  const res = [];
  while (true) {
    const match = var_regex.exec(xml);
    if (match === null) {
      break;
    }

    res.push(match[1]);
  }
  return _uniq(res);
}
