import {
  ResponderType,
} from '../block_provider';

export function get_action_specs() {
  return [
    {
      id: 'broadcast',
      entity_specific: false,
      responder_blocks: [],
      statefulness: {
        default_value: '',
        automatic_transitions: <'one_frame'>'one_frame',
        use_sub_type: true,
      },
    },
    {
      id: 'running_group_activated',
      entity_specific: false,
      responder_blocks: [{
        id: 'on_running_group_activated',
        type: ResponderType.Action,
        async: false,
      }],
    },
  ];
}