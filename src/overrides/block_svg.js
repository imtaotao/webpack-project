import { CmBlockly } from 'cmblockly';
import { before_hook } from 'utils';

function change_blockly_trash (attr) {
  var trash = document.getElementById('blocklyTrashcan');
  if (!trash) {return};
  trash.classList[attr]('hide')
}

CmBlockly.Gesture.prototype.handleUp = before_hook(
  CmBlockly.Gesture.prototype.handleUp, (...args) => {
    change_blockly_trash('add')
  }
)

CmBlockly.Gesture.prototype.handleMove = function(e) {
  this.updateFromEvent_(e);
  this.isDraggingBlock_ 
    ? change_blockly_trash('remove')
    : change_blockly_trash('add')
  if (this.isDraggingWorkspace_) {
    this.workspaceDragger_.drag(this.currentDragDeltaXY_);
  } else if (this.isDraggingBlock_) {
    this.blockDragger_.dragBlock(this.mostRecentEvent_,
        this.currentDragDeltaXY_);
  }
  e.preventDefault();
  e.stopPropagation();
};