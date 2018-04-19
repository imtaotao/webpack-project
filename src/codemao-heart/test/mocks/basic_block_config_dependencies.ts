import * as H from '../../public_interfaces';

export function get() : H.BasicBlockConfigDependencies {
  return {
    get_icon_urls() {
      return {
        block_control_icon: 'block_control_icon.png',
        block_list_icon: 'block_list_icon.png',
        block_variables_icon: 'block_variables_icon.png',
        block_sensing_icon: 'block_sensing_icon.png',
        block_events_icon: 'block_events_icon.png',
        block_msg_icon: 'block_msg_icon.png',
        block_procedure_icon: 'block_procedure_icon.png',
        block_start_icon: 'block_start_icon.png',
        block_advanced_icon: 'block_advanced_icon.png',
      };
    },
    get_variables() {
      return [['?', '?']];
    },
    get_entities() {
      return [['?', '?']];
    },
    get_procedure_parameters() {
      return ['procedure_param'];
    },
  };
}
