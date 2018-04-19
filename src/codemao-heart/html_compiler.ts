import * as r from 'resul-ts';
import _isString from 'lodash/isString';
import _last from 'lodash/last';
import _unescape from 'lodash/unescape';
import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import * as B from './block_types';
import { Compiler, Ohno, BlockUtil, BlockPool, BlockRegistry } from './di_interfaces';
import {
  CompiledEntity,
  Entity,
  EntityCompileResult,
  MaybeCompiledEntities,
  UncompiledEntity,
  ForcedBlockIds,
} from './basic_types';
import { HAT_BLOCKS, PROCEDURE_BLOCKS, CompiledBlock } from './block_types';
import { BINDING } from './di_symbols';

interface ChildNodes {
  named:{[key:string]:HtmlParserJson};
  tagged:{[key:string]:HtmlParserJson};
}

interface HtmlParserJson {
  type:string;
  name:string;
  attribs:{[key:string]:string};
  children:HtmlParserJson[];
  next:HtmlParserJson|null;
  startIndex:number;
  prev:any;
  parent:HtmlParserJson|null;
  endIndex:number;
  data?:any;   //only exit when element is innerHtml
}

@injectable()
export class HtmlParserCompilerImpl implements Compiler {

  constructor(
    @inject(BINDING.BlockPool) private block_pool:BlockPool,
    @inject(BINDING.HtmlParser) private html_parser:any,
    @inject(BINDING.Ohno) private ohno:Ohno,
    @inject(BINDING.BlockUtil) private block:BlockUtil,
    @inject(BINDING.BlockRegistry) private block_registry:BlockRegistry,
  ) {}

  private is_hat_block(block_type:string) : boolean {
    return <any>HAT_BLOCKS[<any>block_type]
          || this.block.is.responder_type(block_type)
          || this.block_registry.block_restart_when_finished(block_type);
  }

  private compile_entity(
      entity:UncompiledEntity,
      force_compile_block_ids?:ForcedBlockIds,
  ) : CompiledEntity {
    const xml = entity.blocksXML.trim(); // sometimes breaks without trim
    const w_json = this.compile_from_workspace_xml(xml, force_compile_block_ids);
    return {
      ...entity,
      procedures: w_json.procedures,
      compiled_block_map: w_json.compiled_block_map,
    };
  }

  public compile(
      entities:UncompiledEntity[],
      force_compile_block_ids?:ForcedBlockIds,
      compile_all_blocks?:boolean,
  ) : MaybeCompiledEntities {
    try {
      return r.success(entities.map((e) => this.compile_entity(e, force_compile_block_ids)));
    } catch (e) {
      const err_msg = 'Heart could not compile one or more entities';
      if (e instanceof Catastrophe) {
        return r.error(err_msg, e);
      } else {
        return r.error(err_msg, this.ohno.compiler.system.unknown_compiler_error(e));
      }
    }
  }

  private compile_from_workspace_xml(
      xml_string:string,
      force_compile_block_ids?:ForcedBlockIds,
  ) : EntityCompileResult {
    const res:EntityCompileResult = {
      procedures: {},
      compiled_block_map: {},
    };

    if (!xml_string) {
      return res;
    }
    const handler = new this.html_parser.DomHandler((error:any, dom_list:HtmlParserJson[]) : any => {
      if (error) {
        return r.error('htmlparser2 compile error', error);
      }
      dom_list.forEach((dom) => {
        const j = this.xml_to_json(dom);

        if (j === undefined) { return; }

        if (force_compile_block_ids) {
          // We're running some individual block, and might not want to skip this one
          if (!force_compile_block_ids[j.id]) {
            // It wasn't in the force list, skip it
            return;
          }
        } else {
          // We're running normally, skip any block that isn't a hat block
          if (!this.is_hat_block(j.type)) {
            return;
          }
        }

          // Save the compiled block
        if (this.block.is.procedures_defnoreturn(j)) {
          // Place procedure definition blocks in their own dict
          res.procedures[j.procedure_name] = j;
        } else {
          // Place normal hat blocks in the compiled_block_map
          res.compiled_block_map[j.id] = j;
        }
      });
    });
    const parser = new this.html_parser.Parser(handler);
    parser.write(xml_string);
    parser.end();
    return res;
  }

  private parse_xml_field(xml_dom:HtmlParserJson) : string | number {
    const innerHtml = (xml_dom.children.length) ? xml_dom.children[0].data : '';
    if (xml_dom.attribs.name == 'NUM') {
      return parseFloat(innerHtml);
    }
    return _unescape(innerHtml);
  }

  private xml_to_json(
      xml_dom:HtmlParserJson|undefined,
      parent?:B.PreBlock,
  ) : B.CompiledBlock | undefined {
    if (!xml_dom) {
      return undefined;
    }

    // Lookup tables for child nodes, this includes the "next" node
    const child_nodes:ChildNodes = {
      named: {},
      tagged: {},
    };

    xml_dom.children.forEach((child) => {
      const tag_name = child.name;
      child_nodes.tagged[tag_name] = child;

      const name = child.attribs.name;
      if (name) {
        child_nodes.named[name] = child;
      }
    });

    const next_block = child_nodes.tagged['next'];
    const next_block_json = next_block ? this.xml_to_json(next_block.children[0], parent) : undefined;

    const pre_block:B.PreBlock = this.block_pool.get();

    pre_block.params = {};
    pre_block.kind = xml_dom.attribs.type;
    pre_block.type = xml_dom.attribs.type;
    pre_block.disabled = !!xml_dom.attribs.disabled;
    pre_block.id = xml_dom.attribs.id;
    pre_block.parent_block = <B.CompiledBlock>parent; // Will become a CompiledBlock after compilation is done
    pre_block.next_block = next_block_json;
    pre_block.child_block = [];
    pre_block.first_evaluation = true;
    pre_block.done_evaluating = false;
    pre_block.output_type = (xml_dom.parent && xml_dom.parent.name == 'value') ? B.BlockOutputType.number : B.BlockOutputType.none;

    xml_dom.children.forEach((child) => {
      const child_name = child.attribs.name;
      if (child.name == 'value') {
        const param = this.xml_to_json(_last(child.children), pre_block);
        if (param != undefined) {
          pre_block.params[child_name] = param;
        }
      } else if (child.name == 'field') {
        pre_block.params[child_name] = this.parse_xml_field(child);
      }
    });

    if (this.block.is.loop_block(pre_block)) {
      return this.loop_to_json(pre_block, child_nodes);

    } else if (this.block.is.cond_block(pre_block)) {
      return this.conditional_to_json(pre_block, child_nodes);

    } else if (this.block.is.event_block(pre_block)) {
      return this.event_to_json(pre_block, child_nodes);

    } else if (this.block.is.responder_block(pre_block)) {
      return this.responder_to_json(pre_block, child_nodes);

    } else if (this.block.is.proc_block(pre_block)) {
      return this.procedure_to_json(pre_block, child_nodes);

    } else if (this.block.is.async_tell(pre_block) || this.block.is.sync_tell(pre_block)) {
      return this.tell_to_json(pre_block, child_nodes);

    } else if (this.block.is.warp(pre_block)) {
      return this.warp_to_json(pre_block, child_nodes);
    }

    // Block type is some domain specific block, e.g. a stage2d or minecraft block.
    pre_block.kind = 'domain_block';
    return <B.DomainBlock>pre_block;
  }

  private responder_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.ResponderBlock {
    // There are many push event block types but only one push event block kind
    pre_block.kind = 'action_block';
    const result = <B.ResponderBlock>pre_block;
    if (child_nodes.tagged['statement']) {
      const statement_child = _last(child_nodes.tagged['statement'].children);
      result.child_block.push(this.xml_to_json(statement_child, result));
    }
    return result;
  }

  private event_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.EventBlock {
    // There are many event block types but only one event block kind
    pre_block.kind = 'event_block';
    const result = <B.EventBlock>pre_block;
    if (child_nodes.tagged['statement']) {
      const statement_child = _last(child_nodes.tagged['statement'].children);
      result.child_block.push(this.xml_to_json(statement_child, result));
    }
    return <B.EventBlock>result;
  }

  private loop_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.LoopBlock {
    const {named, tagged} = child_nodes;
    const result = <B.LoopBlock>pre_block;
    if (this.block.is.repeat_n_times(result)
        || this.block.is.repeat_forever(result)
        || this.block.is.repeat_forever_until(result)) {
      result.child_block.push(named['DO'] ? this.xml_to_json(named['DO'].children[0], result) : undefined);
    }
    return result;
  }

  private tell_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.TellBlock {
    const {named, tagged} = child_nodes;
    const result = <B.TellBlock>pre_block;
    result.child_block.push(named['DO'] ? this.xml_to_json(named['DO'].children[0], result) : undefined);
    return result;
  }

  private warp_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.WarpBlock {
    const {named, tagged} = child_nodes;
    const result = <B.WarpBlock>pre_block;
    result.child_block.push(named['DO'] ? this.xml_to_json(named['DO'].children[0], result) : undefined);
    return result;
  }

  private conditional_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.CondBlock {
    const {named, tagged} = child_nodes;
    const result = <B.CondBlock>pre_block;

    result.params = {}; // Reset unused params
    result.conditions = [];

    // mutation tag has been removed in new project
    // so we should compute the number of [else],[elseif] and [statement] manually
    function get_n_statements() : number {
      const keys = Object.keys(named);
      let max_if = 0;
      let max_do = 0;
      keys.forEach((key) => {
        if (key.indexOf('IF') >= 0) {
          max_if = Math.max(max_if, parseInt(key.split('IF')[1]));
        } else if (key.indexOf('DO') >= 0) {
          max_do = Math.max(max_do, parseInt(key.split('DO')[1]));
        }
      });
      return Math.max(max_if, max_do) + 1;
    }
    const n_statements = get_n_statements();

    for (let i = 0; i < n_statements; ++i) {
      const condition = named['IF' + i];
      if (condition) {
        result.conditions.push(this.xml_to_json(_last(condition.children), pre_block));
      } else {
        result.conditions.push(undefined);
      }
      const statement = named['DO' + i];
      if (statement) {
        result.child_block.push(this.xml_to_json(_last(statement.children), pre_block));
      } else {
        result.child_block.push(undefined);
      }
    }
    const else_statement = named['ELSE'];
    if (else_statement) {
      result.child_block.push(this.xml_to_json(_last(else_statement.children), pre_block));
    } else {
      result.child_block.push(undefined);
    }

    return result;
  }

  private procedure_to_json(pre_block:B.PreBlock, child_nodes:ChildNodes) : B.ProcBlock {
    switch (<number><any>B.PROCEDURE_BLOCKS[<any>pre_block.type]) {
      case B.PROCEDURE_BLOCKS.procedures_defnoreturn: return this.procedure_definition_to_json(pre_block, child_nodes);
      case B.PROCEDURE_BLOCKS.procedures_callreturn: return this.procedure_call_return_to_json(pre_block, child_nodes);
      case B.PROCEDURE_BLOCKS.procedures_callnoreturn: return this.procedure_call_no_return_to_json(pre_block, child_nodes);
      case B.PROCEDURE_BLOCKS.procedures_return_value: return <B.ProcedureReturnValueBlock>pre_block;
      case B.PROCEDURE_BLOCKS.procedures_parameter: return <B.ProcedureParameterBlock>pre_block;
    }
    throw this.ohno.compiler.system.unknown_procedure_block_type({pre_block, child_nodes});
  }

  private procedure_definition_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.ProcedureDefinitionBlock {
    const {named, tagged} = child_nodes;
    const procedure_name = pre_block.params['NAME'];
    if (!_isString(procedure_name)) {
      throw this.ohno.compiler.system.procedure_name_not_string({pre_block});
    }

    const result = <B.ProcedureDefinitionBlock>pre_block;
    result.procedure_name = procedure_name;
    result.params = {};
    const vars = tagged['mutation'];
    if (vars) {
      vars.children.forEach((var_dom:any) => {
        result.params[var_dom.attribs.name] = true;
      });
    }

    if (tagged['statement']) {
      result.child_block.push(this.xml_to_json(_last(tagged['statement'].children), result));
    }
    return result;
  }

  private procedure_call_return_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.ProcedureCallReturnBlock {
    const {named, tagged} = child_nodes;
    const vars = tagged['mutation'];
    const result = <B.ProcedureCallReturnBlock>pre_block;
    if (vars) {
      vars.children.forEach((child, i) => {
        result.params[child.attribs.name] = result.params['ARG' + i];
        delete(result.params['ARG' + i]);
      });
    }
    result.procedure_name = vars.attribs.name;
    return result;
  }

  private procedure_call_no_return_to_json(
      pre_block:B.PreBlock,
      child_nodes:ChildNodes,
  ) : B.ProcedureCallNoReturnBlock {
    const {named, tagged} = child_nodes;
    const vars = tagged['mutation'];
    const procedure_name = pre_block.params['NAME'];
    if (!_isString(procedure_name)) {
      throw this.ohno.compiler.system.procedure_call_name_not_string({pre_block});
    }

    const result = <B.ProcedureCallNoReturnBlock>pre_block;
    result.procedure_name = procedure_name;
    if (vars) {
      vars.children.forEach((child, i) => {
        result.params[child.attribs.name] = result.params['ARG' + i];
        delete(result.params['ARG' + i]);
        delete(result.params['ARGNAME' + i]);
      });
    }
    delete(result.params['WITH']);
    delete(result.params['NAME']);
    return result;
  }

}
