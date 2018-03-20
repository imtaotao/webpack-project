import { MockerRouter } from './router';

// 必须放到 worker 的环境之中
export class MockerServer {
  router = null;

  constructor (baseUrl) {
    this.router = new MockerRouter(baseUrl);
  }

  use (fn) {
    this.router.use(fn);
    return this;
  }
};

self.addEventListener('fetch', event => {
  MockerRouter.router.some(router => router._match(event));
});