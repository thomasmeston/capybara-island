export interface MoveInput {
  x: number;
  z: number;
  hurry: boolean;
  hop: boolean;
}

const held = new Set<string>();
let hopQueued = false;
let hopArmed = true;
let talkQueued = false;
let talkArmed = true;
let pocketQueued = false;
let pocketArmed = true;
let pauseQueued = false;
let pauseArmed = true;
let dropQueued = false;
let dropArmed = true;

export function attachInput(target: Window): () => void {
  const down = (event: KeyboardEvent) => {
    held.add(event.code);
    if (event.code === 'Space' && hopArmed) {
      hopQueued = true;
      hopArmed = false;
    }
    if (event.code === 'KeyE' && talkArmed) {
      talkQueued = true;
      talkArmed = false;
    }
    if ((event.code === 'KeyI' || event.code === 'Tab') && pocketArmed) {
      pocketQueued = true;
      pocketArmed = false;
    }
    if (event.code === 'Escape' && pauseArmed) {
      pauseQueued = true;
      pauseArmed = false;
    }
    if (event.code === 'KeyQ' && dropArmed) {
      dropQueued = true;
      dropArmed = false;
    }
    if (event.code.startsWith('Arrow') || event.code === 'Space' || event.code === 'Tab') {
      event.preventDefault();
    }
  };
  const up = (event: KeyboardEvent) => {
    held.delete(event.code);
    if (event.code === 'Space') hopArmed = true;
    if (event.code === 'KeyE') talkArmed = true;
    if (event.code === 'KeyI' || event.code === 'Tab') pocketArmed = true;
    if (event.code === 'Escape') pauseArmed = true;
    if (event.code === 'KeyQ') dropArmed = true;
  };
  const blur = () => {
    held.clear();
    hopArmed = true;
    hopQueued = false;
    talkArmed = true;
    talkQueued = false;
    pocketQueued = false;
    pocketArmed = true;
    pauseQueued = false;
    pauseArmed = true;
    dropQueued = false;
    dropArmed = true;
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', blur);
    held.clear();
  };
}

export function readMove(): MoveInput {
  let x = 0;
  let z = 0;
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
  if (held.has('KeyW') || held.has('ArrowUp')) z += 1;
  if (held.has('KeyS') || held.has('ArrowDown')) z -= 1;
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }
  const hop = hopQueued;
  hopQueued = false;
  return {
    x,
    z,
    hurry: held.has('ShiftLeft') || held.has('ShiftRight'),
    hop,
  };
}

/** Edge of E. Consumed once, even if nothing was close enough to answer. */
export function consumeTalk(): boolean {
  const talk = talkQueued;
  talkQueued = false;
  return talk;
}

/** Edge of I or Tab. Opens the larger pocket. */
export function consumePocket(): boolean {
  const open = pocketQueued;
  pocketQueued = false;
  return open;
}

/** Edge of Escape. */
export function consumePause(): boolean {
  const pause = pauseQueued;
  pauseQueued = false;
  return pause;
}

/** Edge of Q. Drops the top friend off your back. */
export function consumeDrop(): boolean {
  const drop = dropQueued;
  dropQueued = false;
  return drop;
}
