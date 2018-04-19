import { ToolboxCategoryConfig, namespaced_id } from '../heart';
import { CmBlockly } from 'cmblockly';

export const BLOCK_COLOUR = {
  green: '#8dca87',
  darkBlue: '#708DD7',
  purple: '#BA93D5',
  blue: '#61c3e2',
  pink: '#ea8fc6',
  yellow: '#fccd77',
  orange: '#f69667',
  red: '#f47270',
  actions: '#F46767',
  control: '#68CDFF',
  appearance: '#E76CEA',
  sensing: '#6BCD47',
  sound: '#A073FF',
  pen: '#2BCAA7',
  operators: '#FBBA9D',
  variables: '#FFC063',
  events: '#6388F1',
  physics: '#C73E3B',
  lists: '#FFDB63',
  procedure: '#F08F63',
  building: '#59B292',
  effect: '#E76CEA',
  detect: '#d82dd3',
};

export function get_block_icons() {
  const cdn_path = 'https://static.codemao.cn/';
  return {
    toolbox_icons: `${cdn_path}kitten/ide-icons-latest.svg`,
    block_add_button_icon: `${cdn_path}kitten/blocks/add_button.svg`,
    block_remove_button_icon: `${cdn_path}kitten/blocks/remove_button.svg`,
    block_actions_icon: `${cdn_path}kitten/blocks/block_actions.svg`,
    block_appearance_icon: `${cdn_path}kitten/blocks/block_appearance.svg`,
    block_control_icon: `${cdn_path}kitten/blocks/block_control.svg`,
    block_events_icon: `${cdn_path}kitten/blocks/block_events.svg`,
    block_list_icon: `${cdn_path}kitten/blocks/block_list.svg`,
    block_operators_icon: `${cdn_path}kitten/blocks/block_operators.svg`,
    block_pen_icon: `${cdn_path}kitten/blocks/block_pen.svg`,
    block_physics_icon: `${cdn_path}kitten/blocks/block_physics.svg`,
    block_procedure_icon: `${cdn_path}kitten/blocks/block_procedure.svg`,
    block_procedure_head_icon: `${cdn_path}kitten/blocks/block_procedure_head.svg`,
    block_sensing_icon: `${cdn_path}kitten/blocks/block_sensing.svg`,
    block_sound_icon: `${cdn_path}kitten/blocks/block_sound.svg`,
    block_variables_icon: `${cdn_path}kitten/blocks/block_variables.svg`,
    block_clone_icon: `${cdn_path}kitten/blocks/clone.svg`,
    block_keyboard_icon: `${cdn_path}kitten/blocks/keyboard.svg`,
    block_msg_icon: `${cdn_path}kitten/blocks/msg.svg`,
    block_tab_icon: `${cdn_path}kitten/blocks/tap.svg`,
    procedure_icon: `${cdn_path}kitten/blocks/procedure.svg`,
  };
}

export function actor_toolbox_config() : any[] {
  const blockly = CmBlockly;
  const blockly_icons = get_block_icons();
  const toolbox = [
    {
      category_name: blockly.Msg['control'],
      color: '#68CDFF',
      icon: {
        normal_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
        selected_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
      },
      blocks: [
        'repeat_forever',
        'repeat_n_times',
        'repeat_forever_until',
        'break',
        'controls_if_no_else',
        'controls_if',
        'wait',
        'wait_until',
      ],
    },
    {
      category_name: blockly.Msg['operators'],
      color: '#FBBDA2',
      icon: {
        normal_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
        selected_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
      },
      blocks: [
        'math_number',
        'math_arithmetic',
        'random',

        'math_number_property',
        'divisible_by',
        'logic_operation',

        'calculate',
        'math_single',
        'math_modulo',
        'math_trig',
        'math_round',

        'logic_compare',
        'logic_boolean',
        'logic_negate',

        'text',
        'text_join',
        'text_length',
        'text_select',
        'text_contain',
      ],
    },
    {
      category_name: blockly.Msg['data'],
      color: '#F5B768',
      icon: {
        normal_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
        selected_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
      },
      blocks: [
        'variables_get',
        'variables_set',
        'change_variable',
      ],
    },
    {
      category_name: blockly.Msg['procedures'],
      color: '#F08F63',
      icon: {
        normal_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
        selected_icon_css: `
        width: 0.3rem;
        height: 0.3rem;
        `,
      },
      custom: 'PROCEDURE',
      blocks: [],
    },
  ];
  return toolbox;
}

export const blockly_en_US = {
  //type
  start: 'Start',
  actions: 'Actions',
  events: 'Events',
  appearance: 'Looks',
  control: 'Control',
  sound: 'Sound',
  pen: 'Pen',
  sensing: 'Sensing',
  operators: 'Operators',
  data: 'Data',
  physics: 'Physics',
  advanced: 'Advanced',
  procedures: 'Procedures',
  effect: 'effect',

  //event
  self_listen: '%1 When I receive %2 %3 %4',
  self_broadcast: 'Broadcast %1 %2',
  start_on_click: '%1 When Start clicked',
  self_on_tap: '%1 When this actor %2 %3 %4',
  on_swipe: '%1 When phone screen slided %2 %3 %4',
  on_keydown: '%1 When %2 %3 %4 %5',
  stop: 'Stop %1 %2',
  terminate: 'Terminate %1',
  restart: 'Restart %1',
  when_backdrop_change_to: '%1 When screen switches to %2 %3 %4',
  switch_backdrop_to: 'Switch backdrop to screen %1 %2',
  start_as_a_mirror: '%1 When I start as a clone %2 %3',
  mirror: 'Clone %1 %2',
  dispose: 'Dispose %1',
  //control
  repeat_forever: 'Forever %1 %2 %3',
  repeat_n_times: 'Repeat %1 times %2 %3 %4',
  repeat_forever_until: 'Repeat forever until %1 %2 %3 %4',
  fast_repeat_n_times: 'fast repeat %1 times %2 %3 %4',
  break: 'Quit loop %1',
  tell: 'Make %1 run %2 %3 %4',
  wait_secs: 'Wait %1 secs %2',
  wait_until: 'Wait until %1 %2',
  clone_to: 'Reproduce %1 to X %2 Y %3 %4',
  //action
  self_go_forward: 'Move %1 steps %2',
  self_rotate: 'Turn %1 degrees %2',
  self_shake: 'Jitter %1 secs %2',
  self_bounce_off_edge: 'If on edge, bounce %1',
  self_point_towards: 'Point in direction %1 degrees %2',
  self_face_to: 'Point towards %1 %2',
  self_move_to: 'Go to X %1 Y %2 %3',
  self_move_specify: 'Go to %1 %2',
  self_set_position: 'Set %1 to %2 %3',
  self_change_position: 'Change %1 by %2 %3',
  self_glide_to: 'Glide to X %1 Y %2 in %3 secs %4',
  self_glide_position: 'Glide to %2 %3 in %1 secs %4',
  self_rotate_around: 'rotate around %1 by %2 degree %3',
  self_set_draggable: '%1 to drag %2',
  self_set_rotation_type: 'Set rotation style %1 %2',
  //appearance
  set_costume_by_id: 'Switch to style %1 %2',
  set_costume_by_index: 'Switch to style #%1 %2',
  self_next_style: 'Next Style %1',
  self_appear: 'Show %1',
  self_disappear: 'Hide %1',
  self_gradually_appear: 'Show in %1 secs %2',
  self_gradually_disappear: 'Hide in %1 secs %2',
  show_stage_dialog: 'Create dialog box %1 %2',
  self_dialog_wait:'%1 %2 %3',
  self_dialog: '%1 %2 for %3 secs %4',
  self_ask: 'Ask %1 and wait %2',
  get_answer: 'Answer',
  ask_and_choose: 'Ask %1 and choose',
  get_choice: 'Get choice',
  get_choice_index: 'Get choice index',
  translate: 'Translate %1 into %2 %3',
  translate_result: '%1 translation of %2',
  set_scale: 'Set size to %1\% %2',
  add_scale: 'Change size by %1 %2',
  set_width_height_scale: 'Set %1 to %2\% %3',
  add_width_height_scale: 'Change %1 by %2 %3',
  self_set_effect: 'Set %1 effect to %2 %3',
  self_change_effect: 'Change %1 effect by %2 %3',
  set_top: 'Go to front %1',
  layer_move_up: 'Go forward %1 layers %2',
  clear_all_effects: 'Clear graphic effects %1',
  self_flip:  'Flip %1 %2',
  //audio
  midi_wait: 'Wait for %1 beats %2',
  midi_play_note: 'Play note %1 for %2 beats %3',
  play_audio_and_wait: 'Play sounds %1 until done %2',
  play_audio: 'Play sound %1 %2',
  stop_all_audios: 'Stop all sounds %1',
  play_words_audio: 'Say %1 %2',
  play_words_audio_wait: 'Say %1 until done %2',
  self_ask_record: 'Ask %1 and record %2',
  play_ask_record: 'Play record %1',
  self_ask_listen: 'Ask %1 and recognize %2 %3',
  get_voice_answer: 'Recognition answer',
  voice_recognition: 'Voice recognition %1 %2',
  enable_voice_detection:  '%1 voice detection %2',
  //pen
  pen_down: 'Pen down %1',
  pen_up: 'Pen up %1',
  clear_drawing: 'Clear %1',
  self_set_pen_size: 'Set pen size to %1 %2',
  self_set_pen_color: 'Set pen color by %1 %2',
  self_change_pen_size: 'Change pen size by %1 %2',
  self_change_pen_color: 'Change pen color by %1 %2',
  self_change_pen_shade: 'Change pen brightness by %1 %2',
  stamp: 'Text stamp %1 with a font size %2 %3',
  //sensing
  mousedown: 'Mouse %1',
  check_key: '%1 key %2',
  bump_into: '%1 touching %2',
  bump_into_color: '%1 touching color %2',
  out_of_boundary: 'Leave screen %1',
  check_sence: '%1 screen %2',
  get_property: '%2 of %1',
  distance_to: 'Distance to %1',
  get_mouse_info: 'Mouse %1',
  get_stage_info: 'Stage %1',
  get_orientation: 'Phone rotation around %1 axis',
  get_time: 'Current %1',
  timer: 'Timer',
  reset_timer: 'Reset timer %1',
  get_voice_volume: 'Current volume',
  //operation
  random_num: 'Pick random %1 to %2',
  divisible_by: '%1 is divisible by %2',
  calculate: 'Math expression %1',
  text_select:  'Substring of %1 from %2 to %3',
  text_length: 'Length of %1',
  text_contain: '%1 contains %2',
  text_split: 'Split %1 by %2',
  //data
  lists_index_of: 'Index of %1 in %2',
  variables_get: '%1',
  variables_set: 'Set variable %1 to %2 %3',
  change_variable: '%2 variable %1 by %3 %4',
  lists_get: '%1',
  lists_append: 'Append %1 to the last of list %2 %3',
  lists_insert_value: 'Insert %3 at %2 of %1 %4',
  lists_copy: 'Copy lists %2 to %1 %3',
  lists_length:  'Get the length of list %1',
  lists_is_exist: 'If list %1 comtains %2',
  show_hide_variable: '%1 variable %2 %3',
  show_hide_list: '%1 %2 %3',
  variable: 'Variable',
  list: 'List',
  //physics
  self_enable_physics: 'Start physics %1',
  self_disable_physics: 'Stop physics %1',
  set_gravity: 'Apply gravition acceleration %1 at %2 degrees %3',
  set_velocity: 'Apply velocity %1 at %2 degrees %3',
  set_force: 'Apply force %1 at %2 degrees %3',
  self_set_friction: 'Set friction to %1 %2',
  self_set_mass: 'Set density to %1 %2',
  self_set_restitution: 'Set restitution to %1 %2',
  allow_rotate:  '%1 collsion %2',
  //procedure
  procedures_parameter: 'Parameter %1',
  procedures_return_value: 'Return %1 %2',
  //for change_variable
  increase: 'Increase',
  decrease: 'Decrease',

  //options parameter
  //for check_sence
  stay: 'stay in',
  not_stay: 'left',
  //for self_set_position, self_change_position, self_glide_position
  x: 'X',
  y: 'Y',
  //for get_stage_info
  height: 'height',
  width: 'width',
  //for self_dialog_wait, self_dialog
  talk: 'Say',
  think: 'Think',
  choice: 'choice',
  //for enable_voice_detection
  open: 'Enable',
  close: 'Disable',
  //for get_time
  year: 'Year',
  month: 'Month',
  date: 'Date',
  week:  {
    'week': 'week',
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  },
  hour: 'Hour',
  minute: 'Mintue',
  second: 'Second',
  //for on_tap
  on_mouse_down: 'mouse down',
  on_mouse_up: 'mouse up',
  on_mouse_click: 'clicked',
  //for on_swipe
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  //for on_keydown
  keydown: 'down',
  keyup: 'up',
  key_space: 'space',
  key_enter: 'enter',
  key_any: 'any',
  //for stop
  all_scripts: 'All scripts',
  current_script: 'Current script',
  other_scripts_of_this_sprite: 'Other scripts of this sprite',
  scripts_of_other_sprites: 'scripts of other sprites',
  //for set_scene
  next_scene: 'next scene',
  previous_scene: 'previous scene',
  //for self_face_to, bump, distance_to
  mouse: 'mouse-pointer',
  //for self_move_specify
  pointer: 'mouse-pointer',
  random: 'random',
  //for self_set_draggable
  draggable:  'Allow',
  undraggable:  'Don\'t allow',
  //for self_set_rotation_type
  free_rotate: 'all around',
  left_right_rotate: 'left-right',
  not_rotate: 'don\'t rotate',
  //for translate, translate_result
  english: 'English',
  chinese: 'Chinese',
  classical_chinese: 'Classical Chinese',
  french: 'French',
  spanish: 'Spanish',
  japanese: 'Japanese',
  //for self_set_effect, self_change_effect, get_property
  hue: 'color',
  alpha: 'transparency',
  brightness: 'brightness',
  //for self_flip
  vertical: 'up-down',
  horizontal: 'left-right',
  //for mousedown
  mouse_down: 'down',
  mouse_up: 'released',
  mouse_click: 'clicked',
  //for bump, bump_into_color, get_property
  self: 'self',
  //for bump, out_of_boundary
  edge: 'edge',
  boundary_top: 'top edge',
  boundary_left: 'left edge',
  boundary_right: 'right edge',
  boundary_bottom: 'bottom edge',
  //for out_of_boundary
  boundary: 'edge',
  //for get_property
  position_x: 'X position',
  position_y: 'Y position',
  style_number: 'Style number',
  rotation: 'rotation',
  style_name: 'Style name',
  size: 'Size',
  volume: 'Volume',
  //for show_hide_variable, show_hide_list
  show: 'Show',
  hide: 'Hide',
  //for allow_rotate
  allow:  'Enable',
  deny:  'Disable',
  //for lists_delete, lists_replace, lists_get_value
  list_first: 'No.',
  list_last: 'last item',
  item: 'of',
  //for lists_delete,
  delete: 'Delete',
  //for lists_replace
  replace: 'Replace',
  is: 'with',

  //tips
  get_orientation_tip: 'To detect phone rotation\'s direction at this moment.',
  CALCULATE_TOOLTIPS: 'Enter math expression and calculate the results quickly',
  when_swipe_tip: 'Take some actions when swipe on the phone',
  LISTS_SHOW_HIDE_TOOLTIPS: 'Show or hide this list',
  VARIABLES_SHOW_HIDE_TOOLTIPS: 'Show or hide this variable',
  SELF_ENABLE_PHYSICS_TOOLTIPS: 'Open physics engine, if you want to use other physics blocks, open physics engine first',
  SELF_DISABLE_PHYSICS_TOOLTIPS: 'Close physics engine',
  SET_GRAVITY_TOOLTIPS: 'Set gravity acceleration, it affects all blocks which opend physics engine',
  SET_VELOCITY_TOOLTIPS: 'Set instantaneous velocity',
  SET_FORCE_TOOLTIPS: 'Set instantaneous force',
  SELF_SET_MASS_TOOLTIPS: 'Set mass, default mass and area are related, the larger the area, the greater the default mass',
  SELF_SET_FRICTION_TOOLTIPS: 'Sets the friction coefficient of the object, valid values are 0 to 1',
  SELF_SET_RESTITUTION_TOOLTIPS: 'The quality and shape are related to rebound effect. The same shape, the smaller the mass, the more obvious rebound effect, valid values are 0 to 1',
  ALLOW_ROTATE_TOOLTIPS: 'Both the shape and quality of the character affect the dumping effect',
  LISTS_DELETE_TOOLTIPS: 'delete one item in this list',
  LISTS_REPLACE_TOOLTIPS: 'replace one item with this value in this list',
  LISTS_GET_VALUE_TOOLTIPS: 'get the item of this position in this list',

  //override
  MATH_SINGLE_OP_ROOT: 'sqrt',
  MATH_SINGLE_OP_ABSOLUTE: 'abs',
  MATH_TRIG: '%1 %2 degrees',
  LOGIC_NEGATE_TITLE: 'not %1',
  PROCEDURES_DEFNORETURN_PROCEDURE: 'function',
  PROCEDURES_DEFNORETURN_TITLE: 'Define function',
  PROCEDURES_DEFNORETURN_TOOLTIP: 'Creates a function.',
  TEXT_JOIN_TITLE_HEAD: 'Put',
  TEXT_JOIN_TITLE_TAIL: 'together',
  PROCEDURES_MUTATORARG_TITLE: 'Procedure name:',
  MATH_ROUND_OPERATOR_ROUND: 'rounding',
  MATH_ROUND_OPERATOR_ROUNDUP: 'round up',
  MATH_ROUND_OPERATOR_ROUNDDOWN: 'round down',
  LOGIC_OPERATION_AND: 'and',
  LOGIC_OPERATION_OR: 'or',
  VARIABLES_DEFAULT_NAME: '?',
  LOGIC_BOOLEAN_TRUE: 'true',
  LOGIC_BOOLEAN_FALSE: 'false',
  MATH_MODULO_TITLE: 'Remainder of %1 ÷ %2',
  MATH_IS_EVEN: 'even',
  MATH_IS_ODD: 'odd',
  MATH_IS_PRIME: 'prime',
  MATH_IS_WHOLE: 'whole',
  MATH_IS_POSITIVE: 'positive',
  MATH_IS_NEGATIVE: 'negative',
  PROCEDURES_DEFNORETURN_DO: '',
  PROCEDURES_DEFRETURN_DO: '',
  PROCEDURES_DEFRETURN_PROCEDURE: 'function_name',
  PROCEDURES_BEFORE_PARAMS: 'Parameter:',
  PROCEDURES_MUTATORCONTAINER_TITLE: 'Parameter',
  PROCEDURES_CALL_BEFORE_PARAMS: 'Parameter：',
  CONTROLS_IF_MSG_IF: 'If',
  CONTROLS_IF_MSG_ELSE: 'else',
  CONTROLS_IF_MSG_ELSEIF: 'else if',
  DUPLICATE_BLOCK: 'Duplicate',
  ADD_COMMENT: 'Add Comment',
  REMOVE_COMMENT: 'Remove Comment',
  EXTERNAL_INPUTS: 'External Inputs',
  INLINE_INPUTS: 'Inline Inputs',
  DELETE_BLOCK: 'Delete Block',
  DELETE_X_BLOCKS: 'Delete %1 Blocks',
  DELETE_ALL_BLOCKS: 'Delete all %1 blocks?',
  CLEAN_UP: 'Clean up Blocks',
  COLLAPSE_BLOCK: 'Collapse Block',
  COLLAPSE_ALL: 'Collapse Blocks',
  EXPAND_BLOCK: 'Expand Block',
  EXPAND_ALL: 'Expand Blocks',
  DISABLE_BLOCK: 'Disable Block',
  ENABLE_BLOCK: 'Enable Block',
  HELP: 'Help',
  UNDO: 'Undo',
  REDO: 'Redo',

  //else
  copy_and_paste: 'Copy and paste',
  paste: 'Paste',

  //To delete
  get_background_name: 'backdrop name',
  self_enable_angle_constraint: 'angle constraint%1',
  self_set_gravity: 'set ravitational acceleration x:%1y:%2%3',
  self_set_air_friction: 'set air friction%1%2',
  self_set_static_friction: 'set static friction%1%2',

};
