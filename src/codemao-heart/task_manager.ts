import _filter from 'lodash/filter';
import _includes from 'lodash/includes';
import _remove from 'lodash/remove';
import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';
import * as H from './di_interfaces';
import {
  ID,
  MilliSeconds,
  Task,
  TaskHandle,
} from './basic_types';

@injectable()
export class TaskManagerImpl implements H.TaskManager {

  private ms_per_update!:number;
  private update_function:(t:H.RunningTask) => void;

  private tasks:H.RunningTask[] = [];
  private tasks_needing_dispose:ID[] = [];

  private interpreter_n_blockers_lookup:{[interpreter_id:string]:number} = {};

  public constructor(
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.RuntimeData) private runtime_data:H.RuntimeData,
      @inject(BINDING.Util) private u:H.Util,
  ) {
    // TODO Error out if changing determinism config at runtime
    // We do not support changing deterministic and non-deterministic
    // execution mode at runtime.
    const d = this.u.config.get().deterministic;
    if (d == undefined) {
      this.update_function = this.wall_clock_task_update.bind(this);
    } else {
      this.ms_per_update = d.seconds_per_update * 1000;
      this.update_function = this.deterministic_task_update.bind(this);
    }
  }

  public clear() {
    this.tasks = [];
    this.tasks_needing_dispose = [];
    this.interpreter_n_blockers_lookup = {};
  }

  public update_dispose() {
    // Dispose of finished tasks and tasks belonging to sprites/groups disposed above
    const removed_tasks = _remove(
        this.tasks,
        (t) => _includes(this.tasks_needing_dispose, t.id),
    );
    for (let i = 0; i < removed_tasks.length; i++) {
      const t = removed_tasks[i];
      const interp_id = t.interpreter_id;
      if (t.blocking && this.interpreter_n_blockers_lookup[interp_id] != undefined) {
        this.interpreter_n_blockers_lookup[interp_id]--;
        if (this.interpreter_n_blockers_lookup[interp_id] < 1) {
          delete(this.interpreter_n_blockers_lookup[interp_id]);
        }
      }
    }
    this.tasks_needing_dispose = [];
  }

  public update() : void {
    if (this.runtime_data.is_stopped()) {
      this.clear();
      return;
    }

    for (let i = 0; i < this.tasks.length; i++) {
      this.update_function(this.tasks[i]);
    }
  }

  /**
   * Adds a task that will run for some amount of time.
   *
   * This function may ONLY be called via the RuntimeManager::add_task
   * function, otherwise RuntimeManager's cached value
   * `running_interpreter_was_blocked` becomes invalid, and interpreters may
   * misbehave.
   *
   * @param {ID} id An id that uniquely identifies the task
   * @param {Task} t A spec for the task to be started
   * @return {TaskHandle} A handle with a function that terminates the task
   */
  public add_task(id:ID, t:Task) : TaskHandle {
    const task = <H.RunningTask>t;
    task.id = id;
    this.tasks.push(task);
    if (task.blocking) {
      const interp_id = t.interpreter_id;
      this.interpreter_n_blockers_lookup[interp_id] = this.interpreter_n_blockers_lookup[interp_id] || 0;
      this.interpreter_n_blockers_lookup[interp_id]++;
    }
    return {
      stop: () => this.dispose_task(task.id),
    };
  }

  public is_blocking(rbid:ID) : boolean {
    return this.interpreter_n_blockers_lookup[rbid] != undefined;
  }

  public dispose_task(task_id:ID) : void {
    this.tasks_needing_dispose.push(task_id);
  }

  public dispose_tasks_given(match:Partial<H.RunningTask>) : void {
    const dispose_tasks = _filter(this.tasks, match);
    const dispose_ids:ID[] = [];
    for (let i = 0; i < dispose_tasks.length; i++) {
      dispose_ids.push(dispose_tasks[i].id);
    }
    this.tasks_needing_dispose = this.tasks_needing_dispose.concat(dispose_ids);
  }

  private now() : number {
    if (typeof performance !== 'undefined' && performance.now != undefined) {
      return performance.now();
    }
    return new Date().getTime();
  }

  private deterministic_task_update(t:H.RunningTask) : void {
    const now = this.now();
    if (t.n_ticks == undefined || t.start_tick == undefined) {
      // First tick
      t.n_ticks = 0;
      t.start_tick = now;
      if (t.on_start) {
        t.on_start();
      }
      return;
    }

    const time_delta_ms = this.ms_per_update;

    if (t.lifetime == undefined) {
      // Infinite tasks are handled here
      if (t.on_tick) {
        t.on_tick(time_delta_ms);
      }
      return;
    }

    const ticks_to_live = t.lifetime / this.ms_per_update;
    const amount_done = t.n_ticks / ticks_to_live;

    if (amount_done >= 1) {
      // Last tick
      if (t.on_end) {
        t.on_end(time_delta_ms);
      }
      this.dispose_task(t.id);
      return;
    }

    // Intermediate ticks
    if (t.on_tick) {
      t.on_tick(time_delta_ms, amount_done);
    }
    t.n_ticks += 1;
  }

  private wall_clock_task_update(t:H.RunningTask) : void {
    const now = this.now();
    if (t.start_tick == undefined || t.previous_tick == undefined) {
      // First tick
      t.start_tick = now;
      t.previous_tick = now;
      if (t.on_start) {
        t.on_start();
      }
      return;
    }

    const time_delta_ms = now - t.previous_tick;

    if (t.lifetime == undefined) {
      // Infinite tasks are handled here
      if (t.on_tick) {
        t.on_tick(time_delta_ms);
      }
      t.previous_tick = now;
      return;
    }

    const amount_done = (now - t.start_tick) / t.lifetime;

    if (t.lifetime <= now - t.start_tick) {
      // Last tick
      if (t.on_end) {
        t.on_end(time_delta_ms);
      }
      this.dispose_task(t.id);
      return;
    }

    // Intermediate ticks
    if (t.on_tick) {
      t.on_tick(time_delta_ms, amount_done);
    }
    t.previous_tick = now;
  }
}
