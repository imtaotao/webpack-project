import { injectable, inject } from 'inversify';

import * as H from './di_interfaces';
import { BINDING } from './di_symbols';
import { MersenneTwister } from './algorithm/mersenne_twister';

@injectable()
export class PRNGFactoryImpl implements H.PRNGFactory {
  public create(seed?:number|number[]) {
    return new MersenneTwister(seed);
  }
}
