export const JOYSTICK_MAX_RADIUS = 46;
export const JOYSTICK_DEADZONE = 0.14;
export const JOYSTICK_FOLLOW_RATIO = 1.38;

export interface JoystickSample {
  active: boolean;
  x: number; // -1..1 (analog magnitude included)
  y: number; // -1..1 (analog magnitude included)
  magnitude: number; // 0..1 after deadzone rescaling
  angle: number; // radians
  knobX: number; // clamped px offset from origin
  knobY: number; // clamped px offset from origin
  nextOriginX: number; // dynamic Brawl Stars follow origin X
  nextOriginY: number; // dynamic Brawl Stars follow origin Y
}

/**
 * Computes Brawl Stars-style analog virtual thumbstick output with radial deadzone
 * and dynamic base follow when the thumb drags past the outer rim.
 */
export function computeJoystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  maxRadius = JOYSTICK_MAX_RADIUS,
  deadzone = JOYSTICK_DEADZONE
): JoystickSample {
  let nextOriginX = originX;
  let nextOriginY = originY;

  let dx = currentX - originX;
  let dy = currentY - originY;
  let dist = Math.hypot(dx, dy);

  // Dynamic follow: if thumb pulls well past rim, smoothly slide origin toward thumb
  const followLimit = maxRadius * JOYSTICK_FOLLOW_RATIO;
  if (dist > followLimit && dist > 0.001) {
    const pull = dist - followLimit;
    const ux = dx / dist;
    const uy = dy / dist;
    nextOriginX += ux * pull;
    nextOriginY += uy * pull;
    dx = currentX - nextOriginX;
    dy = currentY - nextOriginY;
    dist = Math.hypot(dx, dy);
  }

  const clampedDist = Math.min(dist, maxRadius);
  const angle = dist > 0.001 ? Math.atan2(dy, dx) : 0;
  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirY = dist > 0.001 ? dy / dist : 0;

  const knobX = dirX * clampedDist;
  const knobY = dirY * clampedDist;

  const rawNorm = maxRadius > 0 ? clampedDist / maxRadius : 0;
  if (rawNorm <= deadzone) {
    return {
      active: false,
      x: 0,
      y: 0,
      magnitude: 0,
      angle,
      knobX,
      knobY,
      nextOriginX,
      nextOriginY,
    };
  }

  const rescaledMag = Math.min(1, (rawNorm - deadzone) / Math.max(0.001, 1 - deadzone));
  return {
    active: true,
    x: dirX * rescaledMag,
    y: dirY * rescaledMag,
    magnitude: rescaledMag,
    angle,
    knobX,
    knobY,
    nextOriginX,
    nextOriginY,
  };
}
