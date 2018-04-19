import React from 'react';
import $ from 'jquery';
import _ from 'lodash';
import CSSModules from 'react-css-modules';
import { Dispatch, bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Runner from 'runner';
import * as BlocklyBridge from 'src/blockly';
import { ReduxState } from 'refux';
import { set_run_state, RunState } from 'refux/run_state';

const runbar_style = require('./style.scss');

export interface RunbarProps {
  run_states:RunState;
  set_run_state:typeof set_run_state;
  variables:any;
}

export interface RunBarStates {
  vars:any[];
}

class RunBar extends React.Component<RunbarProps, RunBarStates> {

  constructor() {
    super();
    this.state = {
      vars:[],
    };
  }
  public componentDidMount() {
    Runner.init(
      this.listen_on_start.bind(this),
      this.listen_on_stop.bind(this),
      this.listen_on_restart.bind(this),
      this.listen_on_variables.bind(this),
    );
  }

  public componentWillReceiveProps(nextProps:any) {
    const vars = _.map(nextProps.variables, (item) => {
      return {
        var_id: item,
        value: 0,
      };
    });
    this.setState({
      vars,
    });
  }

  public render() {
    return (
      <div styleName={this.get_run_bar_class()} id="run_bar">
        <div styleName="run_btn" onClick={this.toggle_run.bind(this)}>
          <div styleName={this.get_run_icon_class()}></div>
        </div>
      </div>
    );
  }

  private get_run_icon_class() {
    return this.props.run_states.is_running ? 'run_icon stop' : 'run_icon';
  }

  private get_run_bar_class() {
    return this.props.run_states.is_running ? 'run_bar running' : 'run_bar';
  }

  public listen_on_stop() {
    this.props.set_run_state({is_running: false});
  }

  public listen_on_start() {
    this.props.set_run_state({is_running: true});
  }

  public listen_on_variables(val:any) {
    const vars = _.map(this.state.vars, (item) => {
      if (item.var_id == val.var_id) {
        item.value = val.new_value;
      }
      return item;
    });
    this.setState({
      vars,
    });
  }

  public toggle_run() {
    if (this.props.run_states.is_running) {
      Runner.stop();
      return;
    } else {
      const xml = BlocklyBridge.get_workspace_xml();
      Runner.start(xml, 33);
    }
  }

  public listen_on_restart() {
    this.props.set_run_state({is_running: true});
    const xml = BlocklyBridge.get_workspace_xml();
    Runner.start(xml, 33);
  }
}

function map_states_to_props(state:ReduxState) {
  return {
    run_states: state.run_states,
    variables: state.variable_states.variables,
  };
}
function map_dispatch_to_props(dispatch:Dispatch<ReduxState>) {
  return bindActionCreators(
    {
      set_run_state,
    },
    dispatch);
}

export let RunBarComponent:React.ComponentClass<{}> = connect(map_states_to_props, map_dispatch_to_props)(CSSModules(RunBar, require('./style.scss'), {allowMultiple: true}) as any);