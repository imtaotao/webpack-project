import * as r from 'resul-ts';

import { BlockXMLBuilder } from '../public_interfaces';
import { namespaced_id } from '../block_provider';

export function apply_test_block_defaults(block_xml:BlockXMLBuilder) : void {

  const message = `
    <value name="message">
      <shadow type="text">
        <field name="TEXT"></field>
      </shadow>
    </value>
  `;

  block_xml.define_block_xml('plan', `
    <value name="n_planned_assertions">
      <shadow type="math_number">
        <field name="NUM">1</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('fail', message);
  block_xml.define_block_xml('pass', message);

  block_xml.define_block_xml('truthy', message);
  block_xml.define_block_xml('falsy', message);
  block_xml.define_block_xml('is', message);
  block_xml.define_block_xml('not', message);

  block_xml.define_block_xml('good_promise', `
    <value name="returns">
      <shadow type="text">
        <field name="TEXT">success</field>
      </shadow>
    </value>
    <value name="milliseconds">
      <shadow type="math_number">
        <field name="NUM">40</field>
      </shadow>
    </value>
  `);
  block_xml.define_block_xml('bad_promise', message);

  block_xml.define_block_xml('send_test_action', `
    <value name="parameter_value">
      <shadow type="text">
        <field name="TEXT">hello</field>
      </shadow>
    </value>
  `);

  block_xml.define_block_xml('create_entity_instance', `
    <value name="typeclass_id">
      <shadow type="text">
        <field name="TEXT">typeclassid</field>
      </shadow>
    </value>
  `);

}
