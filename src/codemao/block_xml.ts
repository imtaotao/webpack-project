import { interfaces as H } from 'src/codemao-heart';

export function get_block_xml(
  block_xml:H.BlockXMLBuilder,
) {
  // block_xml.define_block_xml('', '');

  return block_xml.get_block_xml();
}