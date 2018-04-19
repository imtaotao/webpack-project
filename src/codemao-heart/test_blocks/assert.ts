import { TestAssertionTool } from '../di_interfaces';
import { AssertionToolResult } from '../public_interfaces';
import { injectable, inject } from 'inversify';

export enum AssertType {
  pass,
  fail,
  truthy,
  falsy,
  is,
  not,
}

export interface Assert {
  type:AssertType;
  params?:{
    value:number|boolean|string;
    expected?:number|boolean|string;
  };
  message:string;
}

@injectable()
export class TestAssertionToolImpl implements TestAssertionTool {

  private passed:Assert[] = [];
  private failed:Assert[] = [];
  private planned:number|undefined;

  public plan(n_tests:number) : void {
    this.planned = n_tests;
  }

  public fail(message?:string) : void {
    this.failed.push({
      type: AssertType.fail,
      message: message || 'TestBlock[fail]',
    });
  }

  public pass(message?:string) : void {
    this.passed.push({
      type: AssertType.pass,
      message: message || 'TestBlock[pass]',
    });
  }

  public truthy(obj:any, message?:string) : void {
    const assert = {
      type: AssertType.truthy,
      params: {
        value: obj,
      },
      message: message || '',
    };
    if (!!obj) {
      this.passed.push(assert);
    } else {
      assert.message = message || `TestBlock[truthy] Value is not truthy: ${obj}`;
      this.failed.push(assert);
    }
  }

  public falsy(obj:any, message?:string) : void {
    const assert = {
      type: AssertType.falsy,
      params: {
        value: obj,
      },
      message: '',
    };
    if (!obj) {
      this.passed.push(assert);
    } else {
      assert.message = message || `TestBlock[falsy] Value is not falsy: ${obj}`;
      this.failed.push(assert);
    }
  }

  public is(value:any, expected:any, message?:string) : void {
    const assert = {
      type: AssertType.is,
      params: {
        value,
        expected,
      },
      message: message || '',
    };
    if (value === expected) {
      this.passed.push(assert);
    } else {
      assert.message = message || `TestBlock[is] Expected [${expected}] but got [${value}]`;
      this.failed.push(assert);
    }
  }

  public not(value:any, expected:any, message?:string) : void {
    const assert = {
      type: AssertType.not,
      params: {
        value,
        expected,
      },
      message: message || '',
    };
    if (value !== expected) {
      this.passed.push(assert);
    } else {
      assert.message = message || `TestBlock[not] Value is the same as: ${value}`;
      this.failed.push(assert);
    }
  }

  public get_result() : AssertionToolResult {
    this.update_planned_result();

    if (this.failed.length > 0) {
      return {
        success: false,
        message: this.failed.map((failure) => failure.message).join('\n'),
      };
    }

    if (this.passed.length === 0 ) {
      return {
        success: false,
        message: `Test finished with no assertion.`,
      };
    }

    return {
      success: true,
      message: `Passed ${this.passed.length} assertion${this.get_plural_by_amt(this.passed.length)}.`,
    };
  }

  public reset() {
    this.failed = [];
    this.passed = [];
    this.planned = undefined;
  }

  private get_plural_by_amt(amt:number) {
    return (amt === 1) ? '' : 's';
  }

  private update_planned_result() {
    if (this.planned === undefined) {
      return;
    }
    const num_of_assertion = this.failed.length + this.passed.length;
    this.is(
        num_of_assertion,
        this.planned,
        `Planned for ${this.planned} assertion${this.get_plural_by_amt(this.planned)} but got ${num_of_assertion}.`,
    );
  }
}
