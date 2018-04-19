import React from 'react';
import $ from 'jquery';
import { connect } from 'react-redux';
import CSSModules from 'react-css-modules';
import { bindActionCreators, Dispatch } from 'redux';
import { injectIntl } from 'react-intl';
import { push } from 'react-router-redux';
import { ReduxState } from 'refux';
import * as BlocklyBridge from 'src/blockly';
import { RunState } from 'refux/run_state';
import './blockly.css';

interface BlocklyWorkspaceProps {
  variables:any[];
  language:number;
  intl:any;
  run_states:RunState;
}

let this_:any = undefined;
class BlocklyWorkspace extends React.Component<BlocklyWorkspaceProps, {}> {
  public componentDidMount() {
    this_ = this;
    this_.init_blockly('#workspace');
    this_.resize();
  }

  public init_blockly(selector:string) {
    BlocklyBridge.init(selector, {
      get_variables: this.get_variables,
      language: this.props.language,
    });
    this_.set_default_workspace();
  }

  public set_default_workspace() {
    const start_block = "<block type='start_on_click' deletable='false'></block>";
    BlocklyBridge.set_workspace_xml(start_block);
  }

  public get_variables(type:string, default_word?:boolean) {
    const data = this_.props.variables;
    if (data.length === 0) {
      return [['?', '?']];
    }
    return data.map((variable:string, n:number) => {
      return [variable, variable];
    });
  }

  public render() {
    return (
      <div styleName="workspace">
        <div styleName= {this.props.run_states.is_running === true ? 'mask show_mask' : 'mask'} >
          <div styleName="mask_left" id="mask_left"></div>
          <div styleName="mask_right">
            <i styleName="running_icon"></i>
             <span>开始</span>
          </div>
        </div>
        <div styleName="blockly_workspace" id="workspace">
        </div>
      </div>
    );
  }

  public resize() {
    $('#mask_left').width($('.blocklyToolboxDiv').width() + 2);
  }
}

function map_states_to_props(state:ReduxState) {
  return {
    run_states: state.run_states,
    variables: state.variable_states.variables,
    language: state.cloud_states.language,
  };
}

function map_dispatch_to_props(dispatch:Dispatch<ReduxState>) {
  return bindActionCreators(
    {},
    dispatch);
}

const workspace_style = require('./style.scss');
const workspace = injectIntl<any>(CSSModules(BlocklyWorkspace, workspace_style, {allowMultiple: true}) as any);
export let WorkspaceComponent:React.ComponentClass<any> = connect(map_states_to_props, map_dispatch_to_props)(workspace);