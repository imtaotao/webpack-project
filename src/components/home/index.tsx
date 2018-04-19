import * as React from 'react';
import CSSModules from 'react-css-modules';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { ReduxState } from 'refux';
import { jump_to_router } from 'utils';

interface HomeProps {}

interface HomeState {}

@connect()
@CSSModules(require('./style.scss'), { allowMultiple: true })
export class HomeContainer extends React.Component<HomeProps, HomeState> {
  public componentDidMount () {
    jump_to_router('/ide')
  }

  public render () {
  	return (
  		<div styleName="home-container">
        <div styleName="background-img"></div>
        <span styleName="programming-page" onClick={() => jump_to_router('/ide')}>进入编程页面</span>
      </div>
  	)
  }
}