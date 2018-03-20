import { createClient } from 'service-mocker/client';
// import scriptURL from 'sw-loader!./sw.js';
import scriptURL from './lib/sw-loader!./sw';

let register = false;
export function mock(httpCallback) {
  if (!register) {
    // const client = createClient(scriptURL);
    // client.getRegistration().then(res => console.log(res))
    return navigator.serviceWorker.register(scriptURL).then(() => {
      register = true;
      return httpCallback();
    })
  }
  return httpCallback()
}