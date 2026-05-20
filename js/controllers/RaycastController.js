// Detects a click (as opposed to an drag motion for viewing the object) on the 3D model and toggles
// its animation.
export class RaycastController {
  constructor(canvas, sceneView, appState) {
    let downX = 0;
    let downY = 0;

    canvas.addEventListener('pointerdown', (event) => {
      downX = event.clientX;
      downY = event.clientY;
    });

    canvas.addEventListener('pointerup', (event) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      if (sceneView.pickModel(x, y)) appState.toggleAnimation();
    });
  }
}
