// Keeps the control panel buttons in step with the model state.
export class ControlPanelView {
  constructor(bus) {
    setPressed('camera-perspective', true);

    bus.on('wireframe:changed', (on) => setPressed('toggle-wireframe', on));
    bus.on('spotlight:changed', (on) => setPressed('toggle-spotlight', on));
    bus.on('animation:changed', (on) => setPressed('play-animation', on));
    bus.on('explode:changed', (on) => setPressed('toggle-explode', on));
    bus.on('postfx:changed', (on) => setPressed('toggle-postfx', on));
    bus.on('model:changed', () => {
      setPressed('toggle-explode', false);
      setPressed('play-animation', false);
    });
    bus.on('camera:changed', (mode) => {
      setPressed('camera-perspective', mode === 'perspective');
      setPressed('camera-orthographic', mode === 'orthographic');
    });
  }
}

function setPressed(action, pressed) {
  const button = document.querySelector(`[data-action="${action}"]`);
  if (button) button.setAttribute('aria-pressed', String(pressed));
}
