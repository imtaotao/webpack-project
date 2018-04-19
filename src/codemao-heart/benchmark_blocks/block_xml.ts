import * as r from 'resul-ts';

import { BlockXMLBuilder } from '../public_interfaces';
import { namespaced_id } from '../block_provider';

export function apply_test_block_defaults(block_xml:BlockXMLBuilder) : void {

  function text_field(name:string, default_val='') {
    return `
      <value name="${name}">
        <shadow type="text">
          <field name="TEXT">${default_val}</field>
        </shadow>
      </value>
    `;
  }

  block_xml.define_block_xml('set', `
    ${text_field('key', 'col name')}
    <value name="val">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
  `);

}
