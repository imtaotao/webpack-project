import { MockerServer } from './server';

export function createServer (baseUrl = '/') {
  return new MockerServer(baseUrl)
}