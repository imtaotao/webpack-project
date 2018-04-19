import _endsWith from 'lodash/endsWith';
import * as r from 'resul-ts';

import { Heart } from '..';
import { Entity as HeartEntity, MaybeCompiledEntities, CompiledEntity } from '../basic_types';
import * as mutil from './migration_util';

import {
  Entity,
  HeartTest,
  HeartTest0,
  HeartTestCurrent,
} from './type';

const regex_extract_filename_ext = /([^/]*)\.([^/.]+)$/;
enum Extract {
  Name = 1,
  Ext = 2,
}

export function xml_to_0(xml:string, filename:string) : HeartTest0 {
  const test_name_r = regex_extract_filename_ext.exec(filename);
  let test_name = filename;
  // tslint:disable-next-line
  if (test_name_r != null && test_name_r.length >= 1) {
    test_name = test_name_r[Extract.Name];
  }
  return {
    version: 0,
    test_name,
    main_entity: {
      id: 'main',
      workspace_xml: xml,
      variables: [],
    },
    optional_entities: [],
    global_variables: mutil.get_variables_from_xml(xml),
  };
}

export function migrate_project(p:HeartTest) : HeartTestCurrent {
  return p;
  // if (p.version == 0) {
  //   p = 0_to_1(p);
  // }
  // if (p.version == 1) {
  //   p = 1_to_2(p);
  // }
  // // ... etc ...
  // return p;
}

function ht_to_heart_entity(e:Entity) : HeartEntity {
  return {
    id: e.id,
    blocksXML: e.workspace_xml,
  };
}

export function compile(project:HeartTestCurrent, heart:Heart) : r.Result<CompiledEntity[], any> {
  const maybe_compiler = heart.get_compiler();
  if (r.is_error(maybe_compiler)) {
    return maybe_compiler;
  }
  const compiler = maybe_compiler.result;
  const entities = project.optional_entities.map(ht_to_heart_entity);
  entities.push(ht_to_heart_entity(project.main_entity));
  return compiler.compile(entities);
}

export function get_projects(node_fs:any, dir:string) : HeartTestCurrent[] {
  const xml_filenames = node_fs.readdirSync(dir).filter((file:string) => _endsWith(file, '.xml'));
  const ht_filenames = node_fs.readdirSync(dir).filter((file:string) => _endsWith(file, '.ht'));

  const projects:HeartTest[] = [];

  for (let i = 0; i < xml_filenames.length; i++) {
    const filename = xml_filenames[i];
    const xml = node_fs.readFileSync(dir + filename, 'utf-8');
    projects.push(xml_to_0(xml, filename));
  }

  for (let i = 0; i < ht_filenames.length; i++) {
    const filename = ht_filenames[i];
    const json = node_fs.readFileSync(dir + filename, 'utf-8');
    projects.push(JSON.parse(json));
  }

  return projects.map(migrate_project);
}
