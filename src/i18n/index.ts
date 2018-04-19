import { addLocaleData, InjectedIntl } from 'react-intl';
import { has } from 'lodash';
import { blockly_en_US } from './blockly_en_US';
import { blockly_zh_CN } from './blockly_zh_CN';
import { blockly_zh_TW } from './blockly_zh_TW';
import { zh_CN } from './zh_CN';
import { zh_TW } from './zh_TW';
import { en_US } from './en_US';
import { language_dict } from './def';

interface LanguageListType {
  [lang:string]:{
    intl_lang_name:string;
    heartide_language:{[id:string]:string};
    blockly_language:{[id:string]:string | {[week:string]:string}};
  };
}

export const language_list:LanguageListType = {
  zh: {
    intl_lang_name: 'zh',
    heartide_language: zh_CN,
    blockly_language: blockly_zh_CN,
  },
  en: {
    intl_lang_name: 'en',
    heartide_language: en_US,
    blockly_language: blockly_en_US,
  },
  tw: {
    intl_lang_name: 'zh-Hant',
    heartide_language: zh_TW,
    blockly_language: blockly_zh_TW,
  },
};

let heartide_language:number;

/**
 * zh,en,tw is used for kitten (for i18n file and config)
 * zh,en,zh-Hant is used for react-intl
*/
export function load_locale_data(cb:(
    locale:string,
    messages:{[id:string]:string}) => void,
) {
  const session_lang:string | null = sessionStorage.getItem('language');
  const system_lang = get_system_language();
  const language = session_lang ?
        language_list[session_lang].heartide_language || language_list[system_lang].heartide_language :
        language_list[system_lang].heartide_language;
  set_heartide_language(session_lang || system_lang);
  // set_blockly_msg(session_lang, system_lang);
  require.ensure([], () => {
    const req_locale = require.context('react-intl/locale-data', false, /(zh|en)/);
    const intl_locale = req_locale('./' + (system_lang == 'en' ? system_lang : 'zh'));
    addLocaleData(intl_locale);
    let locale_lang = session_lang || system_lang;
    if (locale_lang === 'tw') {
      locale_lang = 'zh-Hant';
    }
    cb(locale_lang, language);
  });
}

let blockly_msg:any;

function set_heartide_language(language:string) {
  heartide_language = language_dict.indexOf(language);
}

export function get_heartide_language() {
  return heartide_language;
}

function set_blockly_msg(session_language:string | null, system_lang:string) {
  if (session_language) {
    blockly_msg = language_list[session_language].blockly_language ||
      language_list[system_lang].blockly_language;
  } else {
    blockly_msg = language_list[system_lang].blockly_language;
  }
}

export function get_blockly_msg() {
  return blockly_msg;
}

let INTL:InjectedIntl;
export function resolve_intl(injectd_intl:InjectedIntl) {
  INTL = injectd_intl;
}

export function intl() {
  return INTL;
}

export function get_system_language() : 'tw' | 'en' | 'zh' {
  let system_lang:'tw' | 'en' | 'zh';
  const locale = navigator.language.split('-')[0];
  if (locale == 'zh') {
    switch (navigator.language.split('-')[1]) {
      case 'TW':
      case 'HK':
      case 'MO':
        system_lang = 'tw';
        break;
      case 'CN':
      case 'SG':
        system_lang = 'zh';
        break;
      default:
        system_lang = 'zh';
        break;
    }
  } else {
    system_lang = 'en';
  }
  return system_lang;
}