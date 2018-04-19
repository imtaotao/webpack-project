import 'reflect-metadata';
import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { IntlProvider } from 'react-intl';
import { Route } from 'react-router';
import { Provider, connect } from 'react-redux';
import { ConnectedRouter } from 'react-router-redux';
import FadeIn from 'react-fade-in';
import { store_manager } from './redux/store';
import { ReduxState } from './redux/reducer';

import './overrides'
import './index.css';
import { language_dict } from 'src/i18n/def';
import {
  load_locale_data,
  get_system_language,
  language_list,
} from './i18n';
import './gt';

import { HomeContainer } from '@/home';
import { HeartIDEContainer } from '@/ide'


interface HotSwappingIntlProps {
  language:number;
}

interface HotSwappingIntlStates {
  locale:string;
  message:{ [id:string]:string };
}

class HotSwappingIntlProvider extends React.Component<
  HotSwappingIntlProps, HotSwappingIntlStates
> {
  constructor() {
    super();
    const system_lang = get_system_language();
    const init_language = sessionStorage.language || system_lang;
    const init_locale = language_list[init_language].intl_lang_name;
    const init_message = language_list[init_language].heartide_language;
    this.state = {
      locale: init_locale,
      message: init_message,
    };
  }

  public componentWillReceiveProps (nextProps:any) {
    if (nextProps.language == this.props.language) { return; }
    const new_lang = language_dict[nextProps.language];
    const locale = language_list[new_lang].intl_lang_name;
    const message = language_list[new_lang].heartide_language;
    this.setState({
      locale: locale,
      message: message,
    });
  }

  public render () {
    const history = store_manager.get_history();
    return (
      <IntlProvider locale={this.state.locale} messages={this.state.message}>
        <ConnectedRouter history={history}>
        <div>
          <Route exact path="/" render={(props) => (
            <FadeIn>
              <HomeContainer {...props} />
            </FadeIn>
          )} />
          <Route exact path="/ide" render={(props) => (
            <FadeIn >
              <HeartIDEContainer {...props} />
            </FadeIn >
          )} />
         </div>
        </ConnectedRouter>
      </IntlProvider>
    )
  }
}

function map_states_to_props(state:ReduxState) {
  return {
    language: state.cloud_states.language,
  };
}

export let HotSwappingIntlProviderComponent:React.ComponentClass<{}> = connect(
  map_states_to_props, {}
)(HotSwappingIntlProvider);

// init
async function on_loaded() {
  await init_intl();
  const store = store_manager.get_store();
  load_locale_data((locale, msg) => {
    ReactDOM.render(
      <Provider store={store}>
        <HotSwappingIntlProviderComponent />
      </Provider>,
      document.getElementById('app')
    );
  });
}

async function init_intl() {
  return new Promise((resolve, reject) => {
    if (global.Intl) {
      resolve();
      return;
    }

    require.ensure(
      [
        'intl',
        'intl/locale-data/jsonp/en.js',
      ],
      function (require) {
        require('intl');
        require('intl/locale-data/jsonp/en.js');
        resolve();
      },
    );
  });
}
on_loaded();