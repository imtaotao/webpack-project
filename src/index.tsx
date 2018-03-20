import React from 'react';
import dva, { connect } from 'dva';
import { Router, Route, routerRedux } from 'dva/router';
import CSSModules from 'react-css-modules';
import { SlideCM } from '@/slide'
import createHistory from 'history/createBrowserHistory';
import { mock } from './mock';
import { connect_bluetooth } from './bluetooth';

const app = dva()

app.model({
  namespace: 'index',
  history: createHistory(),
  state: 0,
  reducers: {
    add: (num:number) => ++num,
    minus: (num:number) => --num  
  }
})

function TestTitle (props:any) {
  return <div>Test</div> 
}

function Test (props:any) {
  const add = {
    onClick: () => props.dispatch({type: 'index/add'})
  }
  const minus = {
    onClick: () => props.dispatch({type: 'index/minus'})
  }

  // mock(() => {
  //   fetch('http://localhost:3000/greet').then((res:any) => {
  //     console.log(res)
  //   })
  // })
  mock(() => {
    fetch('http://localhost:3000/greet').then((res:any) => {
      console.log(...res.headers)
    })
  })

  function worker () {
    const worker = new Worker('/oneworker.js')
    const data = {'msg': '来自主线程的消息'}
    worker.postMessage(data);
		for (let i = 0; i < 100000000; i++) {
			1 * 2
    }
    console.log(Date.now())
    console.log('主循环完毕')
    setTimeout(() => {
      for (let i = 0; i < 1000000000; i++) {
        1 * 2
      }
      data.msg = '111';
      console.log('主循环再次完毕')
    }, 300)
  }
  
  return (
    <div>
      <TestTitle />
      <h2>{ props.num }</h2>
      <button {...add}>+</button>
      <button {...minus}>-</button>
      <button onClick={connect_bluetooth}>连接蓝牙</button>
      <SlideCM />
      <div styleName="image"></div>
    </div>
  )
}

const App:React.ComponentClass<{}> = connect(({index}:any) => ({num: index}))(
  CSSModules(Test, require('./index.scss'), { allowMultiple:true })
)

app.router(({ history }: any) => {
  return (
    <Router history={history}>
      <Route path="/" component={App} />
    </Router>
  );
})
app.start('#app')