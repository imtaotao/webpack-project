import React from 'react';
import dva, { connect } from 'dva';
import { Slide } from 'input-range'

class SlideC extends React.Component<{}, {}> {
  dom: HTMLElement;
  SlideI:any;
  componentDidMount () {
    this.SlideI = new Slide({
      el: this.dom,
      direction: 'X',
      pointerEvents: true,
      pointTouchArea: {
        x: 30,
        y: 30
      }
    })

    setTimeout(() => this.SlideI.init())
    this.SlideI.oninput = this.input
  }

  input (value:any, el:HTMLElement) {
    console.log(value)
  }

  render () {
    return (
      <div className="container">
        <span className="background"></span>
        <span className="progress">
          <i className="dots" ref={ref => {ref && (this.dom = ref)}} id='dd'></i>
        </span>
      </div>
    )
  }
}

export  const SlideCM = connect(() => ({}))(SlideC)
