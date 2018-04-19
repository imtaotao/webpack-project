import { injectable, inject } from 'inversify';

import { ID } from './basic_types';
import { BlockXML, Toolbox, ToolboxFactory, Util } from './di_interfaces';
import { BINDING } from './di_symbols';

export type XMLString = string;
export type HTMLElement = any; // TODO Fix better xml types

export interface ToolboxConfig {
  id:ID;
  type:string;
  categories:ToolboxCategoryConfig[];
}

export interface ToolboxCategoryConfig {
  category_name:string;
  color:string;
  icon:IconConfig;
  blocks?:XMLString[];
  custom?:string;
}

export interface IconConfig {
  normal_icon_css:string;
  selected_icon_css:string;
}

// TODO Remove Toolbox scope, id and other things that are unrelated to Heart,
// let clients themselves manage these

class ToolboxImpl implements Toolbox {

  private _id:ID;
  private _scope?:string;
  private _type:string;
  private _xml:string;
  private _colors:{[category_name:string]:string} = {};
  private _icons:{[category_name:string]:IconConfig} = {};

  private block_array:string[] = [];

  constructor(
      private u:Util,
      toolbox_config:ToolboxConfig,
      private _block_xml:BlockXML,
  ) {

    this._id = toolbox_config.id;
    this._type = toolbox_config.type;

    // Metadata
    toolbox_config.categories.forEach((c) => {
      const { category_name } = c;
      this._colors[category_name] = c.color;
      this._icons[category_name] = c.icon;
      this.block_array.push(category_name);
      if (c.blocks == undefined) { return; }
      c.blocks.forEach((block_name) => { this.block_array.push(block_name); });
    });

    this._xml = `<xml id="blockly-toolbox-xml-${this._id}" style="display: none">`;

    toolbox_config.categories.forEach((category_config) => {
      const custom = category_config.custom || '';
      let $category = `<category name="${category_config.category_name}" custom="${custom}">`;

      if (category_config.blocks != undefined) {

        category_config.blocks.forEach((block_name) => {
          const block_xml = _block_xml[block_name];
          if (!block_xml) {
            // TODO throw on missing xml definition of block when creating toolbox?
            this.u.log.warn(`xml definition of block "${block_name}" is not found`);
          }
          $category += block_xml;
        });

      }
      $category += `</category>`;
      this._xml += $category;
    });
    this._xml += `</xml>`;
  }

  public get_styles() : string[] {
    const icons = this._icons;
    const styles:string[] = [];
    for (const category_name in this._colors) {
      const color = this._colors[category_name];
      let str = `<style type="text/css">`;
      str += `
          .blocklyToolboxDiv [role="treeitem"][category-name="${category_name}"] {
            border-color: ${color};
          }

          .blocklyToolboxDiv [role="treeitem"][category-name="${category_name}"][aria-selected="true"] {
            background-color: ${color};
          }

          .blocklyToolboxDiv [role="treeitem"][category-name="${category_name}"] .blocklyTreeIcon {
            ${icons[category_name].normal_icon_css}
          }

          .blocklyToolboxDiv [role="treeitem"][category-name="${category_name}"][aria-selected="true"] .blocklyTreeIcon {
            ${icons[category_name].selected_icon_css}
          }
        `;
      str += `</style>`;
      styles.push(str);
    }
    return styles;
  }

  public set_id(id:ID) : void {
    this._id = id;
  }

  public set_scope(scope:string) : void {
    this._scope = scope;
  }

  public get_id() : ID {
    return this._id;
  }

  public get_xml() : string {
    return this._xml;
  }

  public get_type() : string {
    return this._type;
  }

  public get_block_array() : string[] {
    return this.block_array;
  }

  public get_scope() : string | undefined {
    return this._scope;
  }
}

@injectable()
export class ToolboxFactoryImpl implements ToolboxFactory {
  public constructor(
      @inject(BINDING.Util) private u:Util,
  ) {}

  public create(
    toolbox_config:ToolboxConfig,
    block_xml:BlockXML,
  ) : Toolbox {
    return new ToolboxImpl(
        this.u,
        toolbox_config,
        block_xml,
    );
  }
}
