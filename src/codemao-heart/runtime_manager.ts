import * as rlt from 'resul-ts';
import * as uuid from 'uuid';
import _clone from 'lodash/clone';
import _cloneDeep from 'lodash/cloneDeep';
import _defaults from 'lodash/defaults';
import _filter from 'lodash/filter';
import _identity from 'lodash/identity';
import _includes from 'lodash/includes';
import _remove from 'lodash/remove';
import _some from 'lodash/some';
import _sortBy from 'lodash/sortBy';
import _sortedUniq from 'lodash/sortedUniq';
import _toString from 'lodash/toString';
import _uniq from 'lodash/uniq';
import _assign from 'lodash/assign';
import { Catastrophe } from 'catastrophic';
import { injectable, inject } from 'inversify';

import { BINDING } from './di_symbols';
import { ActionStateQueryParams, InitRunnableResult, List } from './public_interfaces';
import {
  CompiledEntity,
  Dict,
  EntityState,
  EntityVariableStore,
  ID,
  Identities,
  MilliSeconds,
  ProcedureContainer,
  ScriptVariableSpecDict,
  StepResult,
  Task,
  TaskHandle,
  VariableScope,
  VariableSpec,
  VariableSpecDict,
  VariableStore,
  RuntimeStackMetadata,
} from './basic_types';
import {
  CompiledBlock,
  EVENT_BLOCKS,
  ProcedureDefinitionBlock,
  BlockParam,
} from './block_types';
import * as H from './di_interfaces';
import {
  Action,
  ActionSpec,
  ResponderSpec,
  ResponderType,
  namespaced_id,
} from './block_provider';
import { DeterministicConfig } from './config';

// The essential unit of code that we can tell the interpreters
// to run. Contains a script and metadata for how to run it.
export interface Runnable {
  identities:Identities;
  compile_cache_id?:ID;
  script:CompiledBlock;
  on_finished?:H.OnInterpreterFinished;
  action_parameters?:Dict<any>;
  responder_priority?:number; // from InterpreterPriorities
  is_warped?:boolean;
  group_id:ID|undefined;
}

interface Responder extends Runnable {
  namespace:string;
  action_spec:ActionSpec;
  responder_spec:ResponderSpec;
  event_id:string;
  // Optional: Only respond to events if their value and/or sub_type match.
  value_filter?:string;
  sub_type_filter?:string;
}

interface TypeClass {
  constructor?:Runnable;
  destructor?:Runnable;
  runnables:Runnable[];
}

export interface CompiledBlockMap {
  [rbid:string]:CompiledBlock;
}

export interface BlockEventMap {
  [rbid:string]:boolean;
}

// TODO Remove EntityToAdd in favour of instance creation?
export interface EntityToAdd {
  typeclass_id:ID;
  entity_id:ID;
  compiled_block_map:CompiledBlockMap;
  source_map_entity:ID;
  source_rbids:{[compiled_block_map_rbid:string]:string};
  running_group_id:{[compiled_block_map_rbid:string]:ID};
}

interface TellSource {
  block_id:ID;
  entity_id:ID;
  root_block_id:ID;
  parent_stack:RuntimeStackMetadata[];
}

type EntityInterpreterLookup = {[entity_id:string]:{[interpreter_id:string]:true}}; // entity_id -> interp_id -> true
type CompiledBlockLookup = {[entity_id:string]:{[rbid:string]:CompiledBlock}}; //entity-id -> rbid -> compiledBlock

@injectable()
export class RuntimeManagerImpl implements H.RuntimeManager {

  constructor(
      @inject(BINDING.ActionStateStore) private state_store:H.ActionStateStore,
      @inject(BINDING.BlockInterpreterFactory) private bif:H.BlockInterpreterFactory,
      @inject(BINDING.OptiRunnerFactory) private orf:H.BlockInterpreterFactory,
      @inject(BINDING.BlockPool) private block_pool:H.BlockPool,
      @inject(BINDING.BlockRegistry) private block_registry:H.BlockRegistry,
      @inject(BINDING.EventBus) private event_bus:H.EventBusPrivate,
      @inject(BINDING.Log) private log:H.Logger,
      @inject(BINDING.Ohno) private ohno:H.Ohno,
      @inject(BINDING.PRNGFactory) private prng_factory:H.PRNGFactory,
      @inject(BINDING.RuntimeData) private runtime_data:H.RuntimeData,
      @inject(BINDING.TaskManager) private task_manager:H.TaskManager,
      @inject(BINDING.Util) private u:H.Util,
      @inject(BINDING.Config) private config:H.Config,
  ) {
    this.event_bus.clones.dispose_clone.immediate.sub((remove_id:ID) => {
      this.destruct_entity(remove_id);
    });

    const configure_runtime_manager = () => {
      const cfg = config.get();
      this.deterministic = cfg.deterministic;
      this.entity_max_clones_per_frame = cfg.entity_max_clones_per_frame;
      if (this.deterministic == undefined) {
        this.prng = prng_factory.create();
        this.interpreter_sorters = this.get_interpreter_sorters(false);
      } else {
        this.prng = prng_factory.create(this.deterministic.prng_seed);
        this.interpreter_sorters = this.get_interpreter_sorters(true);
      }

      if (this.user_debug_mode != cfg.user_debug_mode && this.runtime_data.is_running()) {
        this.event_bus.warning.all.send({
          error: this.ohno.configuration.tried_to_change_user_debug_mode_while_running(),
        });
        this.stop();
      } else {
        this.user_debug_mode = cfg.user_debug_mode;
        this.interpreter_factory = cfg.user_debug_mode ? this.bif : this.orf;
      }
    };
    configure_runtime_manager();
    this.event_bus.system.config_updated.immediate.sub(configure_runtime_manager);
  }

  // TODO Rename local variables to script variables (local is global per entity, script is per block group)

  private user_debug_mode!:boolean;
  private deterministic:DeterministicConfig|undefined;
  private entity_max_clones_per_frame!:number;

  private prng!:H.PRNG<any>;
  private frames = 0;
  private interpreters_spawned = 0;
  private timer_block_date = 0; // for timer block

  private interpreter_factory!:H.BlockInterpreterFactory;
  private entity_states:{[entity_id:string]:EntityState} = {};
  private interpreters:{[interpreter_id:string]:H.BlockInterpreter} = {};
  private sorted_interpreters:H.BlockInterpreter[] = [];
  private interpreter_sorters!:((i:H.BlockInterpreter) => any)[];

  // A cache for checking after each statement, if the previous statement
  // created a blocking thread. Completely handled (or ignored entirely) by
  // BlockInterpreter or OptiRunner
  private running_interpreter_was_blocked:boolean = false;

  private interpreters_to_restart_when_finished:{[root_id:string]:boolean} = {};

  private action_responders:{[event_id:string]:Responder[]} = {};
  private state_responders:{[event_id:string]:Responder[]} = {};
  private dynamic_responders:{[event_id:string]:Responder[]} = {};

  private action_queue:Action[] = [];
  private action_parameters:{[rbid:string]:any} = {};

  private typeclasses:{[typeclass_id:string]:TypeClass} = {};
  private procedure_compiled_block_map:{[procedure_name:string]:ProcedureContainer} = {};

  private variable_specs:VariableSpecDict = {};
  private script_variable_specs:ScriptVariableSpecDict = {};
  private variables:VariableStore = {};
  private entity_variables:EntityVariableStore = {};

  // Lookup tables
  private entity_id_to_interpreter_id_dict:EntityInterpreterLookup = {};
  private interpreter_id_to_entity_id:{[interpreter_id:string]:ID} = {};
  private entity_id_to_compiled_blocks:CompiledBlockLookup = {};
  private entity_id_to_typeclass_id:{[entity_id:string]:ID} = {};
  // constructor / destructor id -> typeclass_id
  private running_constructor_to_typeclass:{[interpreter_id:string]:ID} = {};
  private running_destructor_to_typeclass:{[interpreter_id:string]:ID} = {};
  // maps spawned tell interpreter rbid to rbid and entity_id of the source/teller
  private tell_source_map:{[rbid:string]:TellSource} = {};

  // Lookup tables for Responder Instances (Interpreters instantiated from Responders)
  // (these are also the source of truth for which Responder Instances exist)
  private responder_id_to_instance_interp_id:{[interp_id:string]:ID[]} = {};
  private instance_interp_id_to_responder_id:{[interp_id:string]:ID} = {};

  // Things deferred to next update
  private just_restart = false;
  private just_stopped = false;
  private interpreters_needing_dispose:{[interp_id:string]:boolean} = {};
  private entities_needing_add:EntityToAdd[] = [];
  private interpreters_needing_spawn:Runnable[] = [];
  private entities_needing_destruct:ID[] = [];
  private entities_needing_dispose:ID[] = [];

  private entities_cloned_times:{[entity_id:string]:number} = {};

  private running_group?:string = undefined;
  private running_group_changed:boolean = false;

  public set_variable_specs(variable_specs:VariableSpec[]) {
    for (let i = 0; i < variable_specs.length; i++) {
      const spec = variable_specs[i];
      this.variable_specs[spec.id] = spec;

      if (spec.scope === VariableScope.script) {
        this.script_variable_specs[spec.id] = spec;
        continue;
      }

      if (spec.scope === VariableScope.entity) {
        if (!this.entity_variables[spec.entity_id]) {
          this.entity_variables[spec.entity_id] = {};
        }
        this.entity_variables[spec.entity_id][spec.id] = spec.value;
        continue;
      }

      this.variables[spec.id] = spec.value;
    }
  }

  public change_running_group(id:string) {
    if (id === this.running_group) {
      return;
    }
    this.running_group = id;
    this.running_group_changed = true;
  }

  public interpreter_out_of_running_group(group_id?:string) : boolean {
    if (group_id === undefined || this.running_group === undefined) {
      return false;
    }
    if (group_id === this.running_group) {
      return false;
    }
    return true;
  }

  public block_finish_out_of_run_group(ns_id:string) : boolean {
    return this.block_registry.block_finish_out_of_run_group(ns_id);
  }

  public clear() : void {

    this.frames = 0;
    this.interpreters_spawned = 0;
    this.timer_block_date = 0;

    this.entity_states = {};
    this.interpreters = {};
    this.sorted_interpreters = [];
    this.interpreters_needing_spawn = [];

    this.interpreters_to_restart_when_finished = {};

    this.action_responders = {};
    this.state_responders = {};
    this.dynamic_responders = {};

    this.action_queue = [];

    this.typeclasses = {};
    this.procedure_compiled_block_map = {};

    this.variable_specs = {};
    this.script_variable_specs = {};
    this.variables = {};
    this.entity_variables = {};

    this.entity_id_to_interpreter_id_dict = {};
    this.interpreter_id_to_entity_id = {};
    this.tell_source_map = {};

    for (const entity_id in this.entity_id_to_compiled_blocks) {
      const compiled_blocks = this.entity_id_to_compiled_blocks[entity_id];
      for (const rbid in compiled_blocks) {
        this.block_pool.release(compiled_blocks[rbid]);
      }
    }
    this.entity_id_to_compiled_blocks = {};

    this.entity_id_to_typeclass_id = {};
    this.running_constructor_to_typeclass = {};
    this.running_destructor_to_typeclass = {};
    this.responder_id_to_instance_interp_id = {};
    this.instance_interp_id_to_responder_id = {};

    this.just_restart = false;
    this.just_stopped = false;
    this.interpreters_needing_dispose = {};
    this.entities_needing_add = [];
    this.entities_needing_destruct = [];
    this.entities_needing_dispose = [];

    this.bif.clear();
    this.orf.clear();
    this.runtime_data.clear();
    this.state_store.clear();
    this.task_manager.clear();

    this.running_group = undefined;
  }

  private do_spawn_interpreter(r:Runnable) : void {
    const target_entity_id = r.identities.target_entity;
    const interp_id = r.identities.interpreter_id;
    if (this.entity_id_to_interpreter_id_dict[target_entity_id] != undefined) {
      this.entity_id_to_interpreter_id_dict[target_entity_id][interp_id] = true;
    } else {
      this.entity_id_to_interpreter_id_dict[target_entity_id] = { [interp_id]: true };
    }

    this.interpreter_id_to_entity_id[interp_id] = target_entity_id;
    const interpreter = this.interpreter_factory.create(
        this,
        r.identities,
        {
          creation_counter: this.interpreters_spawned,
          frame_created: this.frames,
          responder_priority: r.responder_priority != undefined ? r.responder_priority : 50,
        },
        r.compile_cache_id || r.identities.source_map_rbid,
        r.script,
        _cloneDeep(this.script_variable_specs),
        r.group_id,
        r.is_warped || false,
        r.action_parameters,
        r.on_finished,
    );

    this.interpreters_spawned += 1;
    this.interpreters[interp_id] = interpreter;
    this.sorted_interpreters.push(interpreter);

    this.interpreters_to_restart_when_finished[interp_id] = this.block_registry.block_restart_when_finished(r.script.type);
  }

  private spawn_interpreter(r:Runnable) : void {
    if (this.runtime_data.is_running()) {
      this.interpreters_needing_spawn.push(r);
    } else {
      this.do_spawn_interpreter(r);
    }
  }

  private get_responder_filter_value(param:BlockParam) : string | undefined {
    if (param == undefined) {
      return <undefined>param;
    }
    if (!this.u.block.is.compiled_block(param)) {
      return _toString(param);
    } else if (this.u.block.is.atomic_type(param.type)) {
      return _toString(param.params[Object.keys(param.params)[0]]);
    } else {
      throw this.ohno.system.unknown_action_block_param_type({
        caught_at: 'RuntimeManager::get_param_value, unknown action block param type',
      });
    }
  }

  public load(ces:CompiledEntity[]) : rlt.Res[] {
    // TODO Make sure everything is run though compilation AND OptiCompiler on load.
    // So that we can report errors immediately, instead of when the project
    // is being run. This may let us remove Result return values from initialize_runnable,
    // create_singleton_entity_instances, create_entity_instance

    // First load all procedures
    for (let i = 0; i < ces.length; i++) {
      const ce = ces[i];
      for (const proc_name in ce.procedures) {
        const proc = ce.procedures[proc_name];
        this.procedure_load(
          ce.id,
          proc_name,
          proc,
        );
      }
    }

    // Then save all runnables for possible instantiation
    const results:rlt.Res[] = [];
    for (let i = 0; i < ces.length; i++) {
      results.push(this.load_typeclass(ces[i]));
    }
    return results;
  }

  private load_typeclass(ce:CompiledEntity) : rlt.Res {
    const typeclass_id = ce.id;
    const runnables:Runnable[] = [];

    let constructor:Runnable|undefined;
    let destructor:Runnable|undefined;

    // Count number of constructors and destructors
    let n_constructors = 0;
    let n_destructors = 0;

    for (const source_rbid in ce.compiled_block_map) {
      const script = ce.compiled_block_map[source_rbid];
      const type = script.type;
      const resp_info = this.block_registry.get_responder_info(type);
      let constructor_or_destructor = false;
      const group_id = (ce.running_group_id) ? ce.running_group_id[source_rbid] : undefined;

      const runnable:Runnable = {
        identities: {
          typeclass_id,
          source_map_entity: ce.id,
          source_map_rbid: source_rbid,
          target_entity: ce.id,
          interpreter_id: source_rbid,
        },
        script,
        group_id,
      };

      if (resp_info != undefined) {
        const resp_type = resp_info.responder_spec.type;
        if (resp_type == ResponderType.Constructor) {
          constructor = runnable;
          n_constructors += 1;
          constructor_or_destructor = true;
        }
        if (resp_type == ResponderType.Destructor) {
          destructor = runnable;
          n_destructors += 1;
          constructor_or_destructor = true;
        }
      }

      if (constructor_or_destructor == false) {
        runnables.push(runnable);
      }
    }

    if (n_constructors > 1) {
      this.report_error_and_stop(
        this.ohno.compiler.user.defined_multiple_constructors({
          typeclass_id,
          compiled_entity: ce,
        }),
        `RuntimeManager::load_typeclass`,
      );
      return rlt.fail('Typeclass had multiple constructors');
    }
    if (n_destructors > 1) {
      this.report_error_and_stop(
        this.ohno.compiler.user.defined_multiple_destructors({
          compiled_entity: ce,
        }),
        `RuntimeManager::load_typeclass`,
      );
      return rlt.fail('Typeclass had multiple destructors');
    }

    this.typeclasses[typeclass_id] = {
      constructor,
      destructor,
      runnables,
    };
    return rlt.ok();
  }

  public create_singleton_entity_instances() : InitRunnableResult[] {
    let results:InitRunnableResult[] = [];
    for (const typeclass_id in this.typeclasses) {
      const res = this.create_entity_instance(
        typeclass_id,
        typeclass_id, // entity_id == typeclass_id in all singleton mode
        undefined, // no constructor params in all singleton mode
      );
      results = results.concat(res);
    }
    return results;
  }

  public create_entity_instance(
      typeclass_id:ID,
      entity_id:ID,
      params?:Dict<any>,
  ) :  InitRunnableResult[] {
    if (this.entity_id_to_typeclass_id[entity_id] != undefined) {
      return [rlt.fail('An entity with that id already exists')];
    }
    const typeclass = this.typeclasses[typeclass_id];
    if (typeclass == undefined) {
      return [rlt.fail(`No typeclass with id ${typeclass_id}`)];
    }
    const {constructor, runnables} = this.typeclasses[typeclass_id];

    this.entity_id_to_typeclass_id[entity_id] = typeclass_id;

    // TODO PERF LEAK set_entity_known may cause memory leaks if many entity instances created
    // e.g. if used for projectiles or particles.
    this.set_entity_known(entity_id);

    if (constructor != undefined) {
      const specialized = this.specialize_runnable(constructor, entity_id, params);
      const init_res = this.initialize_runnable(specialized, undefined, true, false);
      if (rlt.is_ok(init_res)) {
        this.running_constructor_to_typeclass[init_res.result] = typeclass_id;
      }
      return [
        init_res,
      ];
    }

    return this.initialize_entity_runnables(typeclass_id, entity_id);
  }

  private initialize_entity_runnables(typeclass_id:ID, entity_id:ID) : InitRunnableResult[] {
    const {runnables} = this.typeclasses[typeclass_id];
    const results = [];
    for (let i = 0; i < runnables.length; i++) {
      const r = runnables[i];
      results.push(this.initialize_runnable(r, entity_id));
    }
    return results;
  }

  /**
   * Prepares a runnable before it's instantiated as an interpreter.
   * Gives it a unique interpreter_id and sets the target_entity id
   *
   * @param {Runnable} r The runnable to specialize
   * @return {Runnable} A copy of the specialized runnable
   */
  private specialize_runnable(r:Runnable, target_entity:ID, action_parameters?:any) : Runnable {
    const typeclass_id = r.identities.typeclass_id;
    const source_map_rbid = r.identities.source_map_rbid;
    const verbose_id = `__typeclass-${typeclass_id}__instance-${target_entity}__srbid-${source_map_rbid}__`;
    return {
      identities: {
        typeclass_id,
        source_map_entity: r.identities.source_map_entity,
        source_map_rbid,
        target_entity,
        interpreter_id: this.generate_random_id(verbose_id),
      },
      script: r.script,
      action_parameters,
      group_id: r.group_id,
    };
  }

  public initialize_runnable(
        r:Runnable,
        target_entity?:ID,
        is_constructor?:boolean,
        is_destructor?:boolean,
  ) : InitRunnableResult {
    if (target_entity != undefined) {
      r = this.specialize_runnable(r, target_entity);
    }

    const res_info = this.block_registry.get_responder_info(r.script.type);

    const source_map_entity = r.identities.source_map_entity;

    const original_id = this.runtime_data.clone_id_2_original_id(r.identities.target_entity);
    if (original_id == undefined) {
      // This is not a clone

      if (is_destructor == false) {
        this.set_entity_known(source_map_entity);
      }

      if (!this.entity_id_to_compiled_blocks[source_map_entity]) {
        this.entity_id_to_compiled_blocks[source_map_entity] = {};
      }
      // We must clone the AST, or we might modify data that the environment may
      // expect to be able to hold on to. It might also happen that the environment
      // mutates this data while we're running, which would also be bad.
      this.entity_id_to_compiled_blocks[source_map_entity][r.identities.source_map_rbid] = this.block_pool.clone(r.script);
    }

    if (res_info == undefined || is_constructor || is_destructor) {
      // if res_info == undefined, then the Runnable is a legacy pull event

      if (this.user_debug_mode) {
        // BlockInterpreter will modify its AST, clone it
        r.script = this.block_pool.clone(r.script);
      } else {
        // Otherwise no need to clone the AST.
        // Get the script from the global AST storage (don't use r.script, in case we're a clone)
        r.script = this.entity_id_to_compiled_blocks[r.identities.source_map_entity][r.identities.source_map_rbid];
      }
      try {
        this.spawn_interpreter(r);
      } catch (e) {
        this.report_error_and_stop(
            e,
            'RuntimeManager::initialize_runnable, spawning interpreter',
        );
        return rlt.fail('Error while spawning interpreter');
      }
      return rlt.success(r.identities.interpreter_id);
    }

    // The Runnable is a Responder

    const {action_spec, responder_spec, namespace} = res_info;

    const ar = r as Responder;
    ar.action_spec = action_spec;
    ar.responder_spec = responder_spec;
    ar.namespace = namespace;
    ar.event_id = action_spec.id;

    let value_filter_arg_name = 'filter_value';
    let sub_type_filter_arg_name = 'filter_sub_type';

    if (responder_spec.filter_arg_names != undefined) {
      value_filter_arg_name = responder_spec.filter_arg_names.value;
      sub_type_filter_arg_name = responder_spec.filter_arg_names.sub_type;
    }

    // Save filters for this Responder

    const value = this.get_responder_filter_value(r.script.params[value_filter_arg_name]);
    if (value) {
      ar.value_filter = value;
    }
    const sub_type = this.get_responder_filter_value(r.script.params[sub_type_filter_arg_name]);
    if (sub_type) {
      ar.sub_type_filter = sub_type;
    }

    // Save the Responder to either the action- , state- or dynamic responder list

    let collection = this.action_responders;
    if (ar.responder_spec.type == ResponderType.State) {
      collection = this.state_responders;
    }
    if (ar.responder_spec.type == ResponderType.Dynamic) {
      collection = this.dynamic_responders;
    }

    const action_id = namespaced_id(ar.namespace, ar.event_id);

    if (collection[action_id] == undefined) {
      collection[action_id] = [];
    }
    collection[action_id].push(ar);
    return rlt.success('responder'); // TODO return a better structure from initialize_runnable
  }

  /**
   * Called from the environment to inform the RuntimeManager that an action has
   * occurred, and that it should execute any ActionRunnables that have been
   * registered to react to this Action.
   *
   * An ActionSpec matching this Action's id and namespace must have been provided
   * to Heart using a BlockProvider.
   *
   * @param {Action} action A description of the event that occurred.
   */
  public send_action(action:Action) : void {
    if (this.runtime_data.is_stopped()) { return; }
    this.action_queue.push(action);
  }

  private runnable_should_respond_to_action(
      r:Responder,
      action:Action,
  ) : boolean {
    if (r.action_spec.entity_specific) {
      if (action.entity_id == undefined
          || r.identities.target_entity != action.entity_id) {
        // the ActionRunnable is entity specific, and the event was triggered for
        // another entity than this one
        return false;
      }
    }

    if (r.sub_type_filter != undefined
        && r.sub_type_filter != action.sub_type) {
      // the ActionRunnable should only react to events with a certain subtype,
      // and this one does not match
      return false;
    }

    if (r.value_filter != undefined) {
      let event_value = action.value;
      if (event_value == undefined) {
        if (r.action_spec.statefulness != undefined) {
          event_value = r.action_spec.statefulness.default_value;
        }
      }
      if (r.value_filter != event_value) {
        // the ActionRunnable should only react to events with a certain value,
        // and this one does not match
        return false;
      }
    }

    return true;
  }

  private create_action_responder_interpreters(actions:Action[]) {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const action_id = namespaced_id(action.namespace, action.id);
      if (this.action_responders[action_id] == undefined) { continue; }

      for (let j = 0; j < this.action_responders[action_id].length; j++) {
        const r = this.action_responders[action_id][j];

        // Synchronous Responders don't want to have multiple responder
        // instances spawned at the same time
        if (r.responder_spec.async == false) {
          if (this.responder_id_to_instance_interp_id[r.identities.interpreter_id] != undefined) {
            continue;
          }
        }

        if (!this.runnable_should_respond_to_action(r, action)) {
          continue;
        }

        this.do_add_responder_interpreters(r, 'action', action.parameters);
      }
    }
  }

  private create_state_responder_interpreters() {
    for (const event_id in this.state_responders) {
      const responders = this.state_responders[event_id];

      for (let i = 0; i < responders.length; i++) {
        const r = responders[i];

        // Synchronous Responders don't want to have multiple responder
        // instances spawned at the same time
        if (r.responder_spec.async == false) {
          if (this.responder_id_to_instance_interp_id[r.identities.interpreter_id] != undefined) {
            continue;
          }
        }

        // For each state responder, check if the present state matches its preference
        const query:ActionStateQueryParams = {
          action_namespace: r.namespace,
          action_id: r.action_spec.id,
          sub_type: r.sub_type_filter,
        };
        if (r.action_spec.entity_specific) {
          query.entity_id = r.identities.interpreter_id;
        }
        const state_value = this.state_store.get_action_state_value(query);
        if (r.value_filter != undefined && state_value != r.value_filter) {
          continue;
        }

        // If so, initialize a new BlockInterpreter with its responding code
        this.do_add_responder_interpreters(r, 'state');
      }
    }
  }

  private is_stateful_action(action_id:string) : boolean {
    const action_spec = this.block_registry.get_action_spec(action_id);
    if (action_spec == undefined) {
      return false;
    }
    return action_spec.statefulness != undefined;
  }

  private create_dynamic_responder_interpreters(actions:Action[]) {
    // Filter dynamic_responders, only run responder whose relative action is
    // stateful or have received new action in this frame.
    const filtered_action_id = _filter(Object.keys(this.dynamic_responders), (action_id:string) => {
      return _some(actions, {id: action_id}) || this.is_stateful_action(action_id);
    });

    for (let i = 0; i < filtered_action_id.length; i++) {
      const responders = this.dynamic_responders[filtered_action_id[i]];
      for (let j = 0; j < responders.length; j++) {
        const r = responders[j];

        if (r.responder_spec.trigger_function == undefined) {
          continue;
        }

        // Synchronous Responders don't want to have multiple responder
        // instances spawned at the same time
        if (r.responder_spec.async == false) {
          if (this.responder_id_to_instance_interp_id[r.identities.interpreter_id] != undefined) {
            continue;
          }
        }

        const should_trigger = r.responder_spec.trigger_function(
            actions,
            r.value_filter,
            r.sub_type_filter,
            r.identities.target_entity,
        );
        if (!should_trigger) {
          continue;
        }
        // If so, initialize a new BlockInterpreter with its responding code
        this.do_add_responder_interpreters(r, 'dynamic');
      }
    }
  }

  private do_add_responder_interpreters(r:Responder, type:string, action_parameters?:Dict<any>) {
    if (this.interpreter_out_of_running_group(r.group_id)) {
      return;
    }

    const new_interpreter_id = this.generate_random_id(`__${type}_responder_interpreter__`);
    const new_identities = _clone(r.identities);
    new_identities.interpreter_id = new_interpreter_id;

    // Add lookups
    const responder_id = r.identities.interpreter_id;
    this.instance_interp_id_to_responder_id[new_interpreter_id] = responder_id;
    if (this.responder_id_to_instance_interp_id[responder_id] == undefined) {
      this.responder_id_to_instance_interp_id[responder_id] = [new_interpreter_id];
    } else {
      this.responder_id_to_instance_interp_id[responder_id].push(new_interpreter_id);
    }

    let script;
    if (this.user_debug_mode) {
      script = this.block_pool.clone(r.script);
      script.id = new_interpreter_id;
    } else {
      // No need for cloning AST if we're using the optimizer
      script = r.script;
    }

    this.spawn_interpreter({
      identities: new_identities,
      script,
      action_parameters,
      responder_priority: r.responder_priority,
      group_id: r.group_id,
    });
  }

  private update_actions() : void {
    // The order of these function calls is important

    // Should add interpreters first, so that they are prioritized
    // higher than other new interpreters
    this.create_action_responder_interpreters(this.action_queue);

    this.state_store.update(this.action_queue); // Modifies state store
    this.create_state_responder_interpreters(); // Uses state store
    // May access arbitrary state
    this.create_dynamic_responder_interpreters(this.action_queue);
    this.action_queue = [];
  }

  private do_add_entity(e:EntityToAdd) : void {
    let compiled_block_rbids = Object.keys(e.compiled_block_map);
    if (this.deterministic != undefined) {
      compiled_block_rbids = _sortBy(compiled_block_rbids, _identity);
    }
    this.entity_id_to_typeclass_id[e.entity_id] = e.typeclass_id;
    for (let i = 0; i < compiled_block_rbids.length; i++) {
      const rbid = compiled_block_rbids[i];
      this.initialize_runnable({
          identities: {
            typeclass_id: e.typeclass_id,
            source_map_entity: e.source_map_entity,
            source_map_rbid: e.source_rbids[rbid],
            target_entity: e.entity_id,
            interpreter_id: rbid,
          },
          script: e.compiled_block_map[rbid],
          group_id: e.running_group_id[rbid],
      });
    }
  }

  public add_entity(e:EntityToAdd) : void {
    if (this.runtime_data.is_running()) {
      this.entities_needing_add.push(e);
    } else {
      this.do_add_entity(e);
    }
  }

  private get_cloned_entity_data(entity_id:ID, is_mirror:boolean) {
    let compiled_block_map = this.entity_id_to_compiled_blocks[entity_id];

    // If compiled_block_map of a known entity is undefined, it indicates that the entity have no compiled block.
    if (compiled_block_map === undefined) {
      compiled_block_map = {};
    }

    const new_entity_id = this.generate_random_id(`_clone_${entity_id}_random_id`);

    const entity_to_add:EntityToAdd = {
      // Cloning is only done in singleton-only projects, where the
      // typeclass_id is equal to the source_map_entity id
      typeclass_id: entity_id,
      entity_id: new_entity_id,
      source_map_entity: entity_id,
      compiled_block_map: {},
      source_rbids: {},
      // Clone won't inherit the running group id from initial block so far,
      // so leave it an empty object.
      running_group_id: {},
    };

    const rbids = Object.keys(compiled_block_map);
    for (let i = 0; i < rbids.length; i++) {

      const root_block_id = rbids[i];
      const compiled_block = compiled_block_map[root_block_id];
      if (is_mirror && (<any>EVENT_BLOCKS)[compiled_block.type] != EVENT_BLOCKS.start_as_a_mirror) {
        continue;
      }
      const new_block_id = root_block_id + this.generate_random_id('_random_block_id');

      let script;
      if (this.user_debug_mode) {
        script = this.block_pool.clone(compiled_block);
        script.id = new_block_id;
      } else {
        script = compiled_block;
      }

      entity_to_add.source_rbids[new_block_id] = root_block_id;
      entity_to_add.compiled_block_map[new_block_id] = script;
    }
    return entity_to_add;
  }

  public clone_entity(entity_id:ID, is_mirror:boolean)  : ID|undefined {
    if (this.entity_states[entity_id] === EntityState.Unknown) {
      throw this.ohno.user.clone_unknown_entity({
        entity_id,
      });
    }

    if (this.entities_cloned_times[entity_id] == undefined) {
      this.entities_cloned_times[entity_id] = 0;
    }
    if (this.entities_cloned_times[entity_id] > this.entity_max_clones_per_frame) {
      return;
    }
    this.entities_cloned_times[entity_id]++;

    // This function supports legacy Clients that do not know about
    // typeclasses. For them, the typeclass_id is the entity_id.
    const typeclass_id = entity_id;

    const entity_to_add = this.get_cloned_entity_data(entity_id, is_mirror);

    // Clone entity variables
    const cloned_variables = _cloneDeep(this.entity_variables[entity_id]);
    this.entity_variables[entity_to_add.entity_id] = cloned_variables;

    // Update runtime data
    // this update must happen before do_add_entity/add_entity are called,
    // because they query RuntimeData to see if they're adding a clone
    // or a non-clone.
    this.runtime_data.clone_created(entity_id, entity_to_add.entity_id);
    if (is_mirror) {
      const rbids = Object.keys(entity_to_add.compiled_block_map);
      for (let i = 0; i < rbids.length; i++) {
        this.runtime_data.set_mirror(rbids[i]);
      }
    }
    this.add_entity(entity_to_add);
    return entity_to_add.entity_id;
  }

  public run() : void {
    this.timer_block_date = new Date().valueOf();
    this.runtime_data.set_running();
    this.event_bus.runtime_manager.start.send();
  }

  public delete_other_interpreters(interpreter_id:ID) {
    const other_interpreters = Object.keys(this.interpreters)
        .filter((i) => i != interpreter_id);

    for (let i = 0; i < other_interpreters.length; i++) {
      this.dispose_block_group(other_interpreters[i]);
    }
  }

  public stop() : void {
    if (this.runtime_data.is_stopped()) {
      return;
    }
    this.runtime_data.set_stopped();
    this.just_stopped = true;
  }

  public restart() : void {
    this.just_restart = true;
  }

  private sort_interpreters() : void {
    // Interpreters are prioritized and sorted for determinism
    this.sorted_interpreters = _sortBy<H.BlockInterpreter>(
      this.sorted_interpreters,
      this.interpreter_sorters,
    );
  }

  // TODO Refactor RuntimeManager::update to easily defer actions to next tick?

  public update() : void {

    this.event_bus.runtime_manager.before_update.send();

    // Do not add entities if they've already been declared for disposal. This
    // can happen when clones are being added rapidly when the clones per
    // entity limit config value is defined. E.g. if clone is called 500 times
    // with a limit of 300, 200 of those entities to add will already have been
    // marked as to be removed.
    if (this.entities_needing_add.length !== 0
        && this.entities_needing_destruct.length !== 0) {
      _remove(this.entities_needing_add, (e) => _includes(this.entities_needing_destruct, e.entity_id));
    }

    try {
      // It is important that update_dispose is run early in this function,
      // as we might otherwise run code that has faulty references inside it.
      this.update_dispose();
    } catch (e) {
      this.report_error_and_stop(e, 'RuntimeManager::update, update_dispose');
      return;
    }

    // Stop signal has to happen after update_dispose
    if (this.just_stopped || this.just_restart) {
      // this.clear() clears this.just_*, so to_stop is needed
      const to_stop = this.just_stopped;
      this.clear();

      // Since we expect clients to reset all relevant states
      // in reaction to the stop and restart signals, we will
      // clear (not flush) our runtime event_bus buffers before
      // sending the signal. Otherwise we're liable to have
      // events remaining in the buffers, which might then be
      // dispatched on the next update after the next call to
      // RuntimeManager::run
      // FIXME BUG? I think nekobasu clear() removes subscribers, not buffered events
      this.event_bus.runtime_data._meta.clear();
      this.event_bus.runtime_manager._meta.clear();
      if (to_stop) {
        this.event_bus.runtime_manager.stop.send();
      } else {
        this.event_bus.runtime_manager.restart.send();
      }
      return;
    }

    if (this.runtime_data.is_running()) {

      try {
        const n_interpreters = this.sorted_interpreters.length;

        // Add new entities (adds Responders and may add Runnables to
        // interpreters_needing_spawn)
        for (let i = 0; i < this.entities_needing_add.length; i++) {
          this.do_add_entity(this.entities_needing_add[i]);
        }
        this.entities_needing_add = [];

        // Add new interpreters as needed
        this.update_actions();

        for (let i = 0; i < this.interpreters_needing_spawn.length; i++) {
          this.do_spawn_interpreter(this.interpreters_needing_spawn[i]);
        }
        this.interpreters_needing_spawn = [];

        if (this.sorted_interpreters.length != n_interpreters) {
          // If new interpreters were added
          this.sort_interpreters();
        }

      } catch (e) {
        this.report_error_and_stop(
            e,
            'RuntimeManager::update, adding and sorting interpreters',
        );
        return;
      }

      // Step code
      try {
        this.step_code();
      } catch (e) {
        this.report_error_and_stop(e, 'RuntimeManager::update, stepping code');
        return;
      }

      this.task_manager.update();
      this.frames++;

      this.event_bus.runtime_manager.after_update.send();
    }
  }

  public set_current_interpreter_not_blocked() : void {
    this.running_interpreter_was_blocked = false;
  }

  public current_interpreter_must_yield(interpreter_id:ID, group_id?:ID) : boolean {
    const needs_dispose = this.interpreters_needing_dispose[interpreter_id] != undefined &&
                          this.interpreters_needing_dispose[interpreter_id];
    const out_of_run_group = this.running_group_changed && this.interpreter_out_of_running_group(group_id);
    return this.running_interpreter_was_blocked || needs_dispose || out_of_run_group;
  }

  public add_task(t:Task) : TaskHandle {
    if (t.blocking) {
      this.running_interpreter_was_blocked = true;
    }
    return this.task_manager.add_task(this.generate_random_id('runtime_task'), t);
  }

  /**
   * Blocks the current JS Interpreter thread until lock is released
   *
   * @param {ID} ownder_id Id of the entity that owns this thread
   * @param {ID} rbid Id of the root block that this thread represents
   *
   * @return {TaskHandle} A handle to the lock, calling it's end function releases the lock.
   */
  public get_thread_lock(entity_id:ID, interpreter_id:ID) : TaskHandle {
    return this.add_task({
      entity_id: entity_id,
      interpreter_id,
      blocking: true,
    });
  }

  public thread_wait(entity_id:ID, interpreter_id:ID, lifetime:MilliSeconds) : void {
    this.add_task({
      entity_id: entity_id,
      interpreter_id,
      lifetime: lifetime,
      blocking: true,
    });
  }

  public procedure_load(
      source_entity_id:ID,
      procedure_name:string,
      compiled_block:ProcedureDefinitionBlock,
  ) : void {
    this.procedure_compiled_block_map[procedure_name] = {
      name: procedure_name,
      script: compiled_block,
      source_entity_id,
    };
  }

  public get_procedure(p_name:string, do_clone=true) : ProcedureContainer|undefined {
    const procedure_container = this.procedure_compiled_block_map[p_name];
    if (procedure_container == undefined) {
      return;
    }
    if (do_clone) {
      procedure_container.script = <any>this.block_pool.clone(procedure_container.script);
      procedure_container.script.id = this.generate_random_id('procedure_id');
    }
    return procedure_container;
  }

  public get_elapsed_frames() : number {
    return this.frames;
  }

  public reset_timer() : void {
    this.timer_block_date = new Date().valueOf();
  }

  public get_timer_elapsed_s() : number {
    return (new Date().valueOf() - this.timer_block_date) / 1000;
  }

  private do_dispose_of_interpreter(interp_id:ID, force_dispose=false) {
    if (this.interpreters[interp_id] == undefined) {
      this.u.log.warn(`Attempted to dispose non-existing interpreter.`);
      return;
    }

    const interpreter = this.interpreters[interp_id];

    if (!force_dispose && this.interpreters_to_restart_when_finished[interp_id]) {
      interpreter.reset();
      this.runtime_data.dispose_interpreter_data(interp_id);
      this.task_manager.dispose_tasks_given({interpreter_id: interp_id});
      return;
    }

    const entity_id:ID = this.interpreter_id_to_entity_id[interp_id];
    const responder_rbid = this.instance_interp_id_to_responder_id[interp_id];
    if (responder_rbid != undefined) {
      // Remove Responder Instance RBID lookups
      const responder_instances = this.responder_id_to_instance_interp_id[responder_rbid];
      if (responder_instances.length == 1) {
        delete(this.responder_id_to_instance_interp_id[responder_rbid]);
      } else {
        _remove(responder_instances, (r) => r == interp_id);
      }
      delete(this.instance_interp_id_to_responder_id[interp_id]);
    }

    interpreter.dispose(); // free to object pools
    delete(this.interpreters[interp_id]);
    delete(this.entity_id_to_interpreter_id_dict[entity_id][interp_id]);
    delete(this.interpreters_to_restart_when_finished[interp_id]);
    _remove(this.sorted_interpreters, (i) => i === interpreter);
    delete(this.interpreter_id_to_entity_id[interp_id]);
    delete(this.tell_source_map[interp_id]);

    this.runtime_data.dispose_interpreter_data(interp_id);
    this.task_manager.dispose_tasks_given({interpreter_id: interp_id});

    // If this was a constructor, now is the time to initialize runnables for the entity
    const ctor_typeclass_id = this.running_constructor_to_typeclass[interp_id];
    if (ctor_typeclass_id != undefined) {
      // The disposed entity was a constructor
      delete(this.running_constructor_to_typeclass[interp_id]);
      this.initialize_entity_runnables(ctor_typeclass_id, entity_id);
      return;
    }

    // If this was a destructor, now is the time to dispose of the entity
    const dtor_typeclass_id = this.running_destructor_to_typeclass[interp_id];
    if (dtor_typeclass_id != undefined) {
      delete(this.running_destructor_to_typeclass[interp_id]);
      this.entities_needing_dispose.push(entity_id);
    }
  }

  private do_dispose_of_entity(entity_id:ID) {
    if (this.entity_states[entity_id] !== undefined) {
      // Only set states for entities we keep track of. This avoids
      // growing this dictionary by one for every disposed clone.
      this.entity_states[entity_id] = EntityState.Disposed;
    }
    this.runtime_data.entity_disposed(entity_id);

    delete(this.entity_id_to_interpreter_id_dict[entity_id]);
    delete(this.entity_variables[entity_id]);
    delete(this.entity_id_to_typeclass_id[entity_id]);
    // TODO PERF Disposing tasks given entity_id might not be necessary,
    // considering the disposals in do_dispose_of_interpreter
    this.task_manager.dispose_tasks_given({entity_id: entity_id});
  }

  private do_destruct_entity(entity_id:ID) {
    if (this.entity_states[entity_id] !== undefined) {
      // Only set states for entities we keep track of. This avoids
      // growing this dictionary by one for every disposed clone.
      this.entity_states[entity_id] = EntityState.Destructing;
    }

    // First we dispose of all of the entity's existing interpreters
    const rbids_dict = this.entity_id_to_interpreter_id_dict[entity_id];
    if (rbids_dict !== undefined) {
      const rbids_to_dispose = Object.keys(rbids_dict);
      for (let i = 0; i < rbids_to_dispose.length; i++) {
        const rbid = rbids_to_dispose[i];
        this.do_dispose_of_interpreter(rbid, true);
      }
    }

    // Then we dispose of all the entity's responders
    const matches_entity_to_dispose = (r:Responder) => r.identities.target_entity == entity_id;
    for (const r in this.action_responders) {
      _remove(this.action_responders[r], matches_entity_to_dispose);
    }
    for (const r in this.state_responders) {
      _remove(this.state_responders[r], matches_entity_to_dispose);
    }
    for (const r in this.dynamic_responders) {
      _remove(this.dynamic_responders[r], matches_entity_to_dispose);
    }

    // We either need to run a destructor interpreter and then dispose, or
    // we need to dispose immediately.
    let destructor:Runnable|undefined;

    const typeclass_id = this.entity_id_to_typeclass_id[entity_id];
    const typeclass = this.typeclasses[typeclass_id];
    if (typeclass_id == undefined || typeclass == undefined) {
      this.report_warning(
          this.ohno.warning.entity_has_no_known_typeclass({
            typeclass_id,
            entity_id,
            caught_at: `RuntimeManager::do_destruct_entity`,
          }),
      );
    } else {
      if (typeclass != undefined) {
        destructor = typeclass.destructor;
      }
    }

    if (destructor == undefined) {
      this.do_dispose_of_entity(entity_id);
      return;
    }

    const init_res = this.initialize_runnable(destructor, entity_id, false, true);
    if (rlt.is_ok(init_res)) {
      // The do_dispose_of_entity code will be called when the destructor interpreter is disposed
      this.running_destructor_to_typeclass[init_res.result] = typeclass_id;
    }
  }

  private update_dispose() : void {
    // The order of disposals in this function is important:
    // * Disposing of interpreters may cause entities to be flagged for destruction
    // * Disposing of destructor interpreters may cause entities to be flagged for disposal
    // * Destruction of entities may flag them for disposal
    // * Disposal of interpreters may cause tasks to be flagged for disposal
    // * Disposal of entities may cause tasks to be flagged for disposal

    for (const rbid in this.interpreters_needing_dispose) {
      this.do_dispose_of_interpreter(rbid);
    }
    this.interpreters_needing_dispose = {};

    // Entity destruction
    if (this.deterministic != undefined) {
      this.entities_needing_destruct = _sortBy(this.entities_needing_destruct, _identity);
      this.entities_needing_destruct = _sortedUniq(this.entities_needing_destruct);
    } else {
      this.entities_needing_destruct = _uniq(this.entities_needing_destruct);
    }
    for (let i = 0; i < this.entities_needing_destruct.length; i++) {
      this.do_destruct_entity(this.entities_needing_destruct[i]);
    }
    this.entities_needing_destruct = [];

    // Entity disposal
    if (this.deterministic != undefined) {
      this.entities_needing_dispose = _sortBy(this.entities_needing_dispose, _identity);
      this.entities_needing_dispose = _sortedUniq(this.entities_needing_dispose);
    } else {
      this.entities_needing_dispose = _uniq(this.entities_needing_dispose);
    }
    for (let i = 0; i < this.entities_needing_dispose.length; i++) {
      this.do_dispose_of_entity(this.entities_needing_dispose[i]);
    }
    this.entities_needing_dispose = [];

    // TODO add an on dispose event and let external things do their disposals here?

    this.task_manager.update_dispose();
  }

  private get_interpreter_sorters(is_deterministic:boolean) {
    const responders_early = (i:H.BlockInterpreter) => {
      // put these blocks in the end of the stack
      // as early as possible
      return i.metadata.type ==  'self_listen' ||
             <any>EVENT_BLOCKS[<any>i.metadata.type] == EVENT_BLOCKS.mouse_on_emit;
    };

    const box_break_block_last = (i:H.BlockInterpreter) => {
      // put these blocks in the top of the stack
      // as lately as possible
      return <any>EVENT_BLOCKS[<any>i.metadata.type] != EVENT_BLOCKS.block_on_break;
    };

    const frame_order = (i:H.BlockInterpreter) => i.metadata.priorities.frame_created;

    const responder_order = (i:H.BlockInterpreter) => i.metadata.priorities.responder_priority;

    const creation_order = (i:H.BlockInterpreter) => 0 - i.metadata.priorities.creation_counter;

    if (is_deterministic) {
      return [
        box_break_block_last, // hack from Patrick
        frame_order, // recent frames first
        responder_order, // higher priority first
        creation_order, // first created (first action received) runs first
      ];
    }

    // TODO PERF Use a Binary Heap or Priority Queue for interpreter sorting

    // TODO PERF check if these sorters are really necessary for non-deterministic execution
    // (creation_order is necessary, because we need to guarantee to Box3 that when
    // Actions occur, we run the interpreters in the same order as the incoming Actions.)
    return [
      box_break_block_last, // hack from Patrick
      frame_order,
      responder_order,
      creation_order,
    ];
  }

  private step_code() : void {

    this.running_group_changed = false;
    this.entities_cloned_times = {};

    const to_step_stack = this.sorted_interpreters;
    const finished_stepping_stack = [];

    if (to_step_stack.length === 0) {
      this.event_bus.runtime_manager.idle.send();
      return;
    }

    while (true) {
      const interpreter = to_step_stack.pop();
      if (interpreter == undefined) {
        break;
      }

      finished_stepping_stack.push(interpreter);

      const interpreter_id = interpreter.metadata.interpreter_id;
      if (this.interpreters_needing_dispose[interpreter_id]) {
        continue;
      }
      if (this.interpreter_out_of_running_group(interpreter.metadata.group_id)) {
        if (this.block_finish_out_of_run_group(interpreter.metadata.type)) {
          this.dispose_block_group(interpreter_id);
        }
        continue;
      }
      // One step per interpreter per frame
      if (this.is_blocking(interpreter_id)) {
        continue;
      }
      this._step(interpreter_id, interpreter);
    }

    while (true) {
      const interp = finished_stepping_stack.pop();
      if (interp == undefined) { break; }
      this.sorted_interpreters.push(interp);
    }
  }

  public is_blocking(interpreter_id:ID) : boolean {
    return this.task_manager.is_blocking(interpreter_id);
  }

  private _step(interpreter_id:ID, interpreter:H.BlockInterpreter) : void {
    let step_result:StepResult;

    try {
      step_result = interpreter.step();

    } catch (e) {
      const error_metadata = {
        root_block_id: interpreter_id,
      };

      if (e instanceof Catastrophe) {
        e.annotation = _defaults(e.annotation, error_metadata);

      } else {
        e = this.ohno.system.unknown_system_error(e, {
          caught_at: 'RuntimeManager::_step',
          ...error_metadata,
        });
      }
      throw(e); // Will be caught and handled at ::update()
    }

    if (step_result == StepResult.finished) {
      this.dispose_block_group(interpreter_id);
    }
    if (this.interpreter_out_of_running_group(interpreter.metadata.group_id)
        && this.block_finish_out_of_run_group(interpreter.metadata.type)
      ) {
        this.dispose_block_group(interpreter_id);
    }
  }

  // TODO API delete
  public dispose_sprite(entity_id:string) : void {
    this.entities_needing_destruct.push(entity_id);
  }

  public destruct_entity(entity_id:string) : void {
    this.entities_needing_destruct.push(entity_id);
  }

  // TODO API rename s/block_group/interpreter/
  public dispose_block_group(interpreter_id:ID) : void {
    const interpreter = this.interpreters[interpreter_id];
    if (!interpreter) {
      this.u.log.warn(`Can't dispose block group (rbid: ${interpreter_id}) without associated interpreter`);
      return;
    }

    this.interpreters_needing_dispose[interpreter_id] = true;
  }

  public dispose_all() : void {
    for (const entity_id in this.entity_id_to_interpreter_id_dict) {
      const interp_id_dict = this.entity_id_to_interpreter_id_dict[entity_id];
      for (const interp_id in interp_id_dict) {
        this.dispose_block_group(interp_id);
      }
    }
  }

  // TODO API rename s/block_group/interpreter/
  public dispose_other_block_groups_of_entity(entity_id:ID, interpreter_to_keep_id:ID) : void {
    const interp_id_dict = this.entity_id_to_interpreter_id_dict[entity_id];
    if (interp_id_dict == undefined) { return; }
    for (const interp_id in interp_id_dict) {
      if (interp_id == interpreter_to_keep_id) { continue; }
      this.dispose_block_group(interp_id);
    }
  }

  // TODO API rename s/block_group/interpreter/
  public dispose_block_groups_of_other_entities(entity_id:ID) : void {
    for (const _entity_id in this.entity_id_to_interpreter_id_dict) {
      if (entity_id === _entity_id) { continue; }
      const interp_id_dict = this.entity_id_to_interpreter_id_dict[_entity_id];
      for (const interp_id in interp_id_dict) {
        this.dispose_block_group(interp_id);
      }
    }
  }

  private get_var_or_list(var_id:string, default_value:any, interpreter_id?:ID, entity_id?:ID) : any {
    const var_spec = this.variable_specs[var_id];
    if (!var_spec) {
      if (!this.variables[var_id]) {
        this.variables[var_id] = default_value;
      }
      return this.variables[var_id];
    }

    if (var_spec.scope === VariableScope.script) {
      // It's a local variable
      if (interpreter_id == undefined) {
        throw this.ohno.system.called_get_variable_without_needed_parameters({
          var_id,
        });
      }
      return this.interpreters[interpreter_id].get_variable(var_id);
    }

    if (var_spec.scope === VariableScope.entity) {
      // It's a entity variable
      if (entity_id == undefined) {
        throw this.ohno.system.called_get_variable_without_needed_parameters({
          var_id,
        });
      }
      if (this.entity_variables[entity_id] && (this.entity_variables[entity_id][var_id] !== undefined)) {
        return this.entity_variables[entity_id][var_id];
      }
      throw this.ohno.user.entity_variable_operation_out_of_scope({
        target_entity_id: entity_id,
        entity_variable_spec: var_spec,
      });
    }

    // adapt for old project
    if (this.variables[var_id] == undefined) {
      this.variables[var_id] = default_value;
    }
    return this.variables[var_id];
  }

  public get_list_id(list:List, entity_id:ID) {
    const global_vars = this.variables;
    for (const id in global_vars) {
      const val = global_vars[id];
      if (val === list) {
        return id;
      }
    }
    const entity_vars = this.entity_variables[entity_id];
    for (const id in entity_vars) {
      const val = entity_vars[id];
      if (val === list) {
        return id;
      }
    }
    return;
  }

  public set_variable(var_id:string, val:any, interpreter_id?:ID, entity_id?:ID) : void {
    const var_spec = this.variable_specs[var_id];
    if (var_spec == undefined || var_spec.scope == VariableScope.global) {
      this.variables[var_id] = val;
      this.runtime_data.report_variable_updated(var_id, val);
      return;
    }

    if (var_spec.scope === VariableScope.script) {
      // It's a local variable
      if (interpreter_id == undefined) {
        throw this.ohno.system.called_set_variable_without_needed_parameters({
          var_id,
          val,
        });
      }
      this.interpreters[interpreter_id].set_variable(var_id, val);
      this.runtime_data.report_variable_updated(var_id, val);
      return;
    }

    if (var_spec.scope === VariableScope.entity) {
      // It's a entity variable
      if (entity_id == undefined) {
        throw this.ohno.system.called_set_variable_without_needed_parameters({
          var_id,
          val,
        });
      }
      if (this.entity_variables[entity_id] && (this.entity_variables[entity_id][var_id] !== undefined)) {
        this.entity_variables[entity_id][var_id] = val;
        this.runtime_data.report_entity_variable_updated(var_id, val, entity_id);
        return;
      }
      throw this.ohno.user.entity_variable_operation_out_of_scope({
        target_entity_id: entity_id,
        entity_variable_spec: var_spec,
      });
    }

    this.variables[var_id] = val;
    this.runtime_data.report_variable_updated(var_id, val);
  }

  public get_variable(var_id:string, interpreter_id?:ID, entity_id?:ID) : any {
    return this.get_var_or_list(var_id, 0, interpreter_id, entity_id);
  }

  public lists_get(var_id:string, interpreter_id?:ID, entity_id?:ID) : any[] {
    return this.get_var_or_list(var_id, [], interpreter_id, entity_id);
  }

  public get_global_variable(var_id:string) : any {
    return this.variables[var_id];
  }

  public is_entity_variable(var_id:string) : boolean {
    const spec = this.variable_specs[var_id];
    if (!spec) {
      return false;
    }
    return spec.scope === VariableScope.entity;
  }

  public get_entity_id_from_root_block_id(interp_id:ID) : ID {
    return this.interpreter_id_to_entity_id[interp_id];
  }

  public spawn_async_tell_interpreter(
      teller_identities:Identities,
      new_target_entity:ID,
      script:CompiledBlock, // already cloned by caller
      group_id:ID|undefined,
      is_warped?:boolean,
  ) : void {
    this.do_spawn_tell_interpreter(
        teller_identities,
        new_target_entity,
        script,
        group_id,
        undefined,
        is_warped,
    );
  }

  // Only used by BlockInterpreter - OptiRunner just changes target_entity dynamically
  public spawn_sync_tell_interpreter(
      teller_identities:Identities,
      new_target_entity:ID,
      script:CompiledBlock, // already cloned by caller
      group_id:ID|undefined,
  ) : void {
    const sync_lock = this.get_thread_lock(
        teller_identities.target_entity,
        teller_identities.interpreter_id,
    );
    const on_finished = () => {
      sync_lock.stop();
    };
    this.do_spawn_tell_interpreter(
        teller_identities,
        new_target_entity,
        script,
        group_id,
        on_finished,
    );
  }

  private do_spawn_tell_interpreter(
      teller_identities:Identities,
      new_target_entity:ID,
      script:CompiledBlock, // already cloned by caller
      group_id:ID|undefined,
      on_finished?:H.OnInterpreterFinished,
      is_warped?:boolean,
  ) : void {
    // We must record the entity_id and rbid of the teller, so that we
    // can use them when reporting debug mode errors.

    const parent_interpreter = this.interpreters[teller_identities.interpreter_id];

    // BlockInterpreter can not pass is_warped as parameter when spawn async tell, update is_warped here.
    if (is_warped == undefined && parent_interpreter.is_inside_warp != undefined) {
      is_warped = parent_interpreter.is_inside_warp();
    }

    const our_tell_source = {
      block_id: script.id,
      entity_id: teller_identities.source_map_entity,
      root_block_id: teller_identities.source_map_rbid,
      parent_stack: parent_interpreter.get_current_stack(),
    };

    const new_interpreter_id = this.generate_random_id('__tell_root_block__');

    this.tell_source_map[new_interpreter_id] = our_tell_source;

    if (this.user_debug_mode) {
      script.id = new_interpreter_id;
    }

    this.spawn_interpreter({
      compile_cache_id: script.id,
      identities: {
        // typeclass_id may be incorrect/misleading if tell block used in a called proc of other entity
        // luckily the typeclass_id is only used when disposing constructors and destructors, which are
        // not async tell interpreters
        typeclass_id: teller_identities.typeclass_id,
        source_map_entity: our_tell_source.entity_id,
        source_map_rbid: our_tell_source.root_block_id,
        target_entity: new_target_entity,
        interpreter_id: new_interpreter_id,
      },
      script: script,
      on_finished,
      is_warped,
      group_id,
    });
  }

  private get_error_stack(e:Catastrophe) : RuntimeStackMetadata[] {
    if (e.category.unique_code === 'HEART.COMPILER.SYSTEM'
        || e.category.unique_code === 'HEART.COMPILER.USER'
        || e.annotation.interpreter_id === undefined
        || e.annotation.interpreter_stack == undefined) {
      // Opti compile error or error don't have interpreter data, just return the origin error as a fake frame.
      return [{
        block_id: e.annotation.block_id,
        source_entity_id: e.annotation.source_entity_id,
        source_map_rbid: e.annotation.root_block_id,
        interpreter_id: e.annotation.interpreter_id,
        proc_id: e.annotation.proc_id,
      }];
    }

    // Get the whole stack from teller parent;
    let stack = _cloneDeep(e.annotation.interpreter_stack);
    let walk_interpreter = e.annotation.interpreter_id;
    while (true) {
      const tell_source = this.tell_source_map[walk_interpreter];
      if (tell_source === undefined) {
        break;
      }
      walk_interpreter = tell_source.root_block_id;
      const parent_stack = tell_source.parent_stack;
      // Because Tell Blocks are in-line (unlike procedures) an Async Tell Block call should not create a new stack frame,
      // similar to how a while-block does not have its own stack frame. The way they are implemented, however, gives each
      // Async Tell Block it's own stack, with it's own main frame. We merge all Async Tell Block stacks into their parent's stacks.

      // When we merge two stacks, we remove the second (top) stack's main (first) frame, since a proper stack only has one
      // main frame. The removed frame's data is still important, so it is put into the preceding frame (the last frame of the
      // first, bottom, stack) - which was pointing to an Async Block Call anyway.
      const main_frame = stack.shift();
      parent_stack[parent_stack.length - 1].block_id = main_frame.block_id;
      parent_stack[parent_stack.length - 1].interpreter_id = main_frame.interpreter_id;
      stack = parent_stack.concat(stack);
    }
    stack[stack.length - 1].block_id = e.annotation.block_id;
    return stack;
  }

  private get_frame_error_metadata = (error_metadata:RuntimeStackMetadata) : RuntimeStackMetadata => {
    // We clone to ensure we don't modify any stored stack traces, e.g.
    // the ones in this.tell_source_map
    error_metadata = _cloneDeep(error_metadata);

    const error_rbid = error_metadata.source_map_rbid;
    const source_interpreter_id = error_metadata.interpreter_id;

    // Translate potentail Tell Interpreter's rbid to source entity_id and rbid
    // This must come before the Responder Instance RBID check, since the source
    // rbid might be a responder instance rbid (whereas a tell interpreter's rbid
    // can never be a responder instance rbid).
    let source_rbid:ID = error_metadata.source_map_rbid;
    let source_entity_id:ID|undefined = error_metadata.source_entity_id;
    let source_block_id:ID|undefined = error_metadata.block_id;

    if (source_interpreter_id !== undefined) {
      const tell_source = this.tell_source_map[source_interpreter_id];
      if (tell_source !== undefined) {
        source_block_id = tell_source.block_id;
        source_entity_id = tell_source.entity_id;
        source_rbid = tell_source.root_block_id;
      }
    }

    if (error_metadata.block_id != undefined
        && error_metadata.block_id == source_interpreter_id
        && source_block_id != undefined) {
      // This block was the child block of a tell block. It had its block_id
      // changed to its new rbid because it's used by a BlockInterpreter.
      // We'll use the original block_id so that the error handler can
      // identify the correct source block
      error_metadata.block_id = source_block_id;
    }

    // Translate potential Responder Instance RBID to Responder RBID
    const responder_rbid = this.instance_interp_id_to_responder_id[source_rbid];
    if (responder_rbid != undefined) {
      source_rbid = responder_rbid;
    }

    // Translate procedure RBID and entity_id
    if (error_metadata.proc_id !== undefined) {
      const procedure_container = this.get_procedure(error_metadata.proc_id);
      if (procedure_container !== undefined) {
        source_rbid = procedure_container.script.id;
        source_entity_id = procedure_container.source_entity_id;
      }
    }

    error_metadata.source_map_rbid = source_rbid;
    if (source_entity_id != undefined) {
      error_metadata.source_entity_id = source_entity_id;
    }

    return error_metadata;
  }

  public report_error_and_stop(e:Catastrophe|Error, caught_at:string) : void {
    let wrapped_error:Catastrophe;
    if (e instanceof Catastrophe) {
      wrapped_error = e;
    } else {
      wrapped_error = this.ohno.system.unknown_system_error(e, {
        caught_at,
      });
    }

    const error_stack = this.get_error_stack(wrapped_error)
        .map(this.get_frame_error_metadata);

    wrapped_error.annotation.stack = error_stack;

    this.event_bus.error.runtime.send({
      error: wrapped_error,
      error_stack: error_stack,
    });

    this.stop();
  }

  public report_warning(e:Catastrophe) {
    const error_stack = this.get_error_stack(e)
        .map(this.get_frame_error_metadata);

    e.annotation.stack = error_stack;
    this.event_bus.warning.runtime.send({
      error: e,
      error_stack: error_stack,
    });
  }

  public set_entity_known(entity_id:ID) {
    this.entity_states[entity_id] = EntityState.Known;
  }

  public get_entity_state(entity_id:ID) : EntityState {
    const state = this.entity_states[entity_id];
    if (state == undefined) {
      return EntityState.Unknown;
    }
    return state;
  }

  public get_random_number() : number {
    return this.prng.random();
  }

  private generate_random_id(prefix='', entropy_size=9) : string {
    // Generated IDs must be deterministic, because they are often
    // used to sort interpreters and such, in order to make their
    // order of execution deterministic.
    const id_array:(string|number)[] = [prefix];
    for (let i = 0; i < entropy_size; i++) {
      id_array.push(Math.round(10 * this.prng.random()));
    }
    return id_array.join('');
  }

  public get_compiled_block_by_interpreter_id(rbid:ID) : CompiledBlock {
    const entity_id = this.interpreter_id_to_entity_id[rbid];
    const original_compiled_block = this.entity_id_to_compiled_blocks[entity_id][rbid];
    return original_compiled_block;
  }

  public set_running_block(rbid:ID, block_id:ID) {
    this.runtime_data.set_running_block(rbid, block_id);
  }
}
