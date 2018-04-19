import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';
import { BlockProvider, BlockConfig, namespaced_id } from './block_provider';
import { BlockXMLBuilderFactory, BlockXMLBuilder, BlockXML } from './di_interfaces';
import { Blockly } from './blockly_interface';

class BlockXMLBuilderImpl implements BlockXMLBuilder {

  private block_xml:BlockXML = {};
  private namespace:string;

  public constructor(block_provider:BlockProvider, blockly:Blockly) {
    this.namespace = block_provider.namespace();
    const config = block_provider.config(blockly);
    for (const block_type in config) {
      this.define_block_xml(block_type);
    }
  }

  public define_block_xml(block_type:string, xml='', gap?:string, real_block_type?:string) : void {
    const ns_id = namespaced_id(this.namespace, block_type);
    real_block_type = real_block_type || ns_id;
    gap = gap || '10';
    this.block_xml[ns_id] = `<block type="${real_block_type}" gap="${gap}">` + xml + `</block>`;
  }

  public get_block_xml() : BlockXML {
    return this.block_xml;
  }

}

@injectable()
export class BlockXMLBuilderFactoryImpl implements BlockXMLBuilderFactory {
  public constructor(
      @inject(BINDING.Blockly) private blockly:Blockly,
  ) {}

  public create(block_provider:BlockProvider) : BlockXMLBuilder {
    return new BlockXMLBuilderImpl(block_provider, this.blockly);
  }
}
