import * as React from 'react';
import * as _ from 'lodash';
import * as r from 'resul-ts';
import $ from 'jquery';
import CSSModules from 'react-css-modules';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { InjectedIntl, injectIntl } from 'react-intl';
import { ReduxState, store_manager } from 'refux';
import { set_variables } from 'refux/variables';
import { resolve_intl } from 'src/i18n';
import * as BlocklyBridge from 'src/blockly';

import { WorkspaceComponent } from '@/blockly_workspace';
import { RunBarComponent } from '@/run_bar';

interface IDEProps {
  intl:InjectedIntl;
}

interface IDEState {}

class HeartIDE extends React.Component<IDEProps, IDEState> {
  constructor(props:any, context:any) {
    super(props, context);
    resolve_intl(this.props.intl);
  }

  public componentWillUpdate(nextProps:any) {
    if (nextProps.intl !== this.props.intl) {
      resolve_intl(nextProps.intl);
    }
  }

  public componentWillMount() {
    this.setState({

    });
  }

  private create_trash () {
    const container = document.querySelectorAll('.blocklyToolboxDiv');
    if (!container || !container[0]) { return; }
    const div = document.createElement('div');
    div.className = 'blockly-trashcan hide';
    div.id = 'blocklyTrashcan';
    const trash_icon = `
      <div>
        <i
          class='trash_head' id='trashHead'></i>
        <i class='trash_body'></i>
      </div>
    `;
    div.innerHTML = trash_icon;
    container[0].appendChild(div);
  }

  public componentDidMount() {
    this.create_trash();
  }

  public set_default_workspace() {
    const start_block = "<block type='start_on_click' deletable='false'></block>";
    BlocklyBridge.set_workspace_xml(start_block);
  }

  private handle_workspace_click(e:any) {
    // this.hide_error_block();
  }

  public render() {
    const { intl } = this.props;
    return (
      <div styleName="ide-wrap">
        <div styleName="container"
        onClick={this.handle_workspace_click.bind(this)}
        onTouchEnd={this.handle_workspace_click.bind(this)}>
          <WorkspaceComponent/>
          <RunBarComponent />
        </div>
      </div>
    );
  }
}

function map_states_to_props(state:ReduxState) {
  return {
  };
}
function map_dispatch_to_props(dispatch:Dispatch<ReduxState>) {
  return bindActionCreators(
    {
    },
    dispatch);
}

const ide_style = require('./style.scss');
const ide = injectIntl(CSSModules(HeartIDE, ide_style));
export let HeartIDEContainer:React.ComponentClass<{}> =
  connect(map_states_to_props, map_dispatch_to_props)(ide);