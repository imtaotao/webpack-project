import { createStore, Store, applyMiddleware } from 'redux';
import { get_root_reducer, ReduxState } from './reducer';
import createHistory from 'history/createMemoryHistory';
import createSagaMiddleware from 'redux-saga';
import { Route } from 'react-router';
import { routerMiddleware } from 'react-router-redux';
import { saga_root } from './soga_root';

export function create_store(history:any) : Store<ReduxState> {
  const middlewares = [];
  const root_reducer = get_root_reducer();
  const router_middleware = routerMiddleware(history);
  middlewares.push(router_middleware);

  const saga_middleware = createSagaMiddleware();
  middlewares.push(saga_middleware);

  const store = createStore(
      root_reducer,
      (<any>window).__REDUX_DEVTOOLS_EXTENSION__
        && (<any>window).__REDUX_DEVTOOLS_EXTENSION__(),
      applyMiddleware(...middlewares));
  saga_middleware.run(saga_root);
  return store;
}

class StoreManager {
  private store:Store<ReduxState>;
  private history:any;
  constructor() {
    this.history = createHistory();
    this.store = create_store(this.history);
  }
  public get_store() : Store<ReduxState> {
    return this.store;
  }
  public get_history() : any {
    return this.history;
  }
  public get_state() {
    return this.store.getState();
  }
  public get_global_states() {
    return this.store.getState().global_states;
  }
  public subscribe(listener:() => void) {
    this.store.subscribe(listener);
  }
  public dispatch(action:any) {
    return this.store.dispatch(action);
  }
}

export const store_manager = new StoreManager();