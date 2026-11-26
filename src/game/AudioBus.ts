import { Howl, Howler } from 'howler';
import { Surface, type SurfaceId } from '../island/shape';
import { noise, tone } from './wav';

const MUSIC_VOLUME = 0.35;

export class AudioBus {
  private readonly grass: Howl;
  private readonly sand: Howl;
  private readonly mud: Howl;
  private readonly splash: Howl;
  private readonly thump: Howl;
  private readonly squeak: Howl;
  private readonly pling: Howl;
  private readonly chime: Howl;
  private readonly music: Howl;
  private stepLock = 0;

  constructor() {
    Howler.volume(0.7);
    this.grass = clip(noise(0.07, 0.45, 46), 0.22);
    this.sand = clip(noise(0.1, 0.4, 32), 0.24);
    this.mud = clip(noise(0.12, 0.5, 22), 0.28);
    this.splash = clip(noise(0.16, 0.55, 18), 0.32);
    this.thump = clip(tone(140, 0.12, 0.7), 0.4);
    this.squeak = clip(tone(620, 0.07, 0.35), 0.22);
    this.pling = clip(tone(880, 0.18, 0.4), 0.3);
    this.chime = clip(tone(1046, 0.6, 0.45), 0.35);

    // Relative to BASE_URL so it works under `base: './'` (dev, Pages, itch).
    this.music = new Howl({
      src: [`${import.meta.env.BASE_URL}music/sunny-afternoon.mp3`],
      html5: true,
      loop: true,
      volume: MUSIC_VOLUME,
    });
    // Browsers block autoplay until a gesture; Howler fires 'unlock' after one.
    this.music.once('playerror', () => this.music.once('unlock', () => this.music.play()));
    this.music.play();
  }

  setVolume(amount: number): void {
    Howler.volume(amount);
  }

  step(surface: SurfaceId): void {
    const now = performance.now();
    if (now - this.stepLock < 80) return;
    this.stepLock = now;
    this.voice(surface, false);
  }

  hop(surface: SurfaceId): void {
    this.squeak.play();
    if (surface === Surface.Shallows || surface === Surface.Swim) this.splash.play();
    else this.thump.play();
  }

  land(surface: SurfaceId): void {
    this.voice(surface, true);
  }

  paddle(): void {
    this.splash.play();
  }

  hopOn(): void {
    this.squeak.play();
    this.thump.play();
  }

  found(): void {
    this.pling.play();
  }

  built(): void {
    this.chime.play();
  }

  dispose(): void {
    for (const sound of [this.grass, this.sand, this.mud, this.splash, this.thump, this.squeak, this.pling, this.chime, this.music]) {
      sound.unload();
    }
    Howler.unload();
  }

  private voice(surface: SurfaceId, landing: boolean): void {
    if (surface === Surface.Shallows || surface === Surface.Swim) {
      this.splash.play();
      return;
    }
    if (landing) {
      this.thump.play();
      return;
    }
    if (surface === Surface.Sand) this.sand.play();
    else if (surface === Surface.Mud) this.mud.play();
    else this.grass.play();
  }
}

function clip(src: string, volume: number): Howl {
  return new Howl({ src: [src], format: ['wav'], volume });
}
