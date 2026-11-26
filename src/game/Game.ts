import * as THREE from 'three';
import { Surface, heightAt } from '../island/shape';
import { AudioBus } from './AudioBus';
import type { PalmTree } from './Foliage';
import { Friend, createFriends } from './Friend';
import { FriendHouse } from './House';
import { attachInput, consumeDrop, consumePause, consumePocket, consumeTalk, readMove } from './Input';
import { Island } from './Island';
import { IslandLife } from './IslandLife';
import { IsoCamera } from './IsoCamera';
import { itemById } from './items';
import { Pickups } from './Pickups';
import { Pocket } from './Pocket';
import { Stack } from './Stack';
import { Traveler } from './Traveler';

type Act = 'talk' | 'stack' | 'take' | 'palm' | 'build' | 'wait';

const SETTINGS_KEY = 'capybara-island-settings';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly island = new Island();
  private readonly traveler: Traveler;
  private readonly friends: Friend[];
  private readonly houses = new Map<string, FriendHouse>();
  private readonly view: IsoCamera;
  private readonly audio: AudioBus;
  private readonly detachInput: () => void;
  private readonly hud: HTMLDivElement;
  private readonly prompt: HTMLButtonElement;
  private readonly talk: HTMLButtonElement;
  private readonly wish: HTMLElement;
  private readonly pocket: Pocket;
  private readonly pickups: Pickups;
  private readonly life: IslandLife;
  private readonly stack = new Stack();
  private readonly pause: HTMLElement;
  private talking: Friend | null = null;
  private card: Friend | null = null;
  private actFriend: Friend | null = null;
  private actPalm: PalmTree | null = null;
  private talkIndex = -1;
  private paused = false;
  private act: Act | null = null;
  private readonly hintPoint = new THREE.Vector3();
  private hintLeft = 0;
  private readonly marker: THREE.Mesh;
  private readonly clock = new THREE.Clock();
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0xcfe6f4);
    container.appendChild(this.renderer.domElement);

    this.view = new IsoCamera(container.clientWidth / Math.max(container.clientHeight, 1));
    this.audio = new AudioBus();
    this.audio.setVolume(loadSettings().volume);
    this.traveler = new Traveler(this.island, this.audio);
    this.friends = createFriends(this.island.group);
    this.pocket = new Pocket(container);
    this.pickups = new Pickups(
      this.island.group,
      this.pocket,
      this.traveler.group.getObjectByName('head') ?? null,
    );
    this.life = new IslandLife(this.island.group);
    for (const friend of this.friends) {
      const house = new FriendHouse(this.island.group, friend, this.pocket.isHoused(friend.id));
      this.houses.set(friend.id, house);
      if (this.pocket.isHoused(friend.id)) friend.moveHome();
    }
    for (const palm of this.island.palms) {
      if (this.pocket.isHarvested(palm.id)) palm.setHarvested();
    }
    this.reveal();
    this.life.sync(this.pocket);
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 18),
      new THREE.MeshBasicMaterial({
        color: 0xfff1c2,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.island.group.add(this.marker);

    const hemi = new THREE.HemisphereLight(0xd7ecf8, 0xc4b48a, 0.62);
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
    sun.position.set(-14, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadow = sun.shadow.camera;
    shadow.left = -48;
    shadow.right = 48;
    shadow.top = 48;
    shadow.bottom = -48;
    shadow.near = 1;
    shadow.far = 90;
    sun.shadow.bias = -0.00035;

    this.scene.add(hemi, sun, this.island.group, this.traveler.group);
    this.hud = this.buildHud();
    const cards = this.buildCards();
    this.prompt = cards.prompt;
    this.talk = cards.talk;
    this.wish = cards.wish;
    this.pause = this.buildPause();
    this.card =
      this.friends.find((friend) => this.pocket.hasHeard(friend.id) && !this.pocket.isHoused(friend.id)) ??
      [...this.friends].reverse().find((friend) => this.pocket.isHoused(friend.id)) ??
      null;
    if (this.card) this.showCard(this.card);
    this.detachInput = attachInput(window);
    window.addEventListener('resize', this.onResize);

    if (import.meta.env.DEV) {
      Object.assign(window, {
        __capy: {
          traveler: this.traveler,
          island: this.island,
          view: this.view,
          friends: this.friends,
          houses: this.houses,
          life: this.life,
          pocket: this.pocket,
        },
      });
    }

    this.clock.start();
    this.renderer.setAnimationLoop(this.frame);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.detachInput();
    window.removeEventListener('resize', this.onResize);
    this.audio.dispose();
    this.hud.remove();
    this.prompt.remove();
    this.talk.remove();
    this.wish.remove();
    this.pocket.row.remove();
    this.pocket.panel.remove();
    this.pocket.counter.remove();
    this.pause.remove();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  private frame = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    if (consumePause()) {
      this.paused = !this.paused;
      this.pause.hidden = !this.paused;
      if (this.paused) this.showMenuPage('main');
    }
    if (consumePocket()) this.pocket.togglePanel();
    this.reveal();
    const here = this.traveler.position;
    const found = this.pickups.nearest(here.x, here.z);
    const stake = this.nearestStake(here.x, here.z);
    const friend = this.nearestFriend(here.x, here.z);
    const palm = this.nearestPalm(here.x, here.z);
    const ready = stake !== null && stake.itemIds.every((id) => this.pocket.has(id));
    const heard = stake !== null && this.pocket.hasHeard(stake.id);
    const hasCoconuts = stake !== null && this.pocket.coconutCount >= stake.coconutCost;
    if (found) {
      this.act = 'take';
      this.actFriend = null;
      this.actPalm = null;
    } else if (stake && ready && heard && hasCoconuts) {
      this.act = 'build';
      this.actFriend = stake;
      this.actPalm = null;
    } else if (friend) {
      this.act = this.pocket.isHoused(friend.id) ? 'stack' : 'talk';
      this.actFriend = friend;
      this.actPalm = null;
    } else if (palm) {
      this.act = 'palm';
      this.actFriend = null;
      this.actPalm = palm;
    } else if (stake) {
      this.act = 'wait';
      this.actFriend = stake;
      this.actPalm = null;
    } else {
      this.act = null;
      this.actFriend = null;
      this.actPalm = null;
    }
    if (consumeTalk() && !this.paused) this.interact();
    const talking = this.talkIndex >= 0;
    if (consumeDrop() && !this.paused && !talking) this.stack.dropTop(this.traveler.group);
    const move = readMove();
    if ((move.x !== 0 || move.z !== 0) && this.hintLeft > 0) this.clearHint();
    if (talking || this.paused) {
      move.x = 0;
      move.z = 0;
      move.hurry = false;
      move.hop = false;
    }
    this.traveler.update(dt, move, this.view);
    this.stack.update(dt, time, this.traveler.group);
    const swimming = this.traveler.sample?.travel === Surface.Swim;
    this.view.follow(this.traveler.position, dt, swimming ? 0.85 : 0);
    if (this.hintLeft > 0) {
      this.hintLeft -= dt;
      this.marker.visible = true;
      this.marker.position.set(this.hintPoint.x, this.hintPoint.y + 0.08, this.hintPoint.z);
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      this.marker.scale.setScalar(pulse);
      if (this.hintLeft <= 0) this.clearHint();
    }
    this.island.update(time, dt);
    for (const one of this.friends) one.update(time, dt);
    this.pickups.update(time, dt);
    for (const house of this.houses.values()) house.update(dt);
    this.prompt.hidden = talking || this.paused || this.act === null;
    this.writePrompt(found?.name ?? '');
    this.writeHud();
    this.renderer.render(this.scene, this.view.camera);
  };

  private interact(): void {
    if (this.talkIndex >= 0) {
      this.advanceTalk();
      return;
    }
    if (this.act === 'take') {
      const found = this.pickups.nearest(this.traveler.position.x, this.traveler.position.z);
      if (!found) return;
      this.pickups.take(found);
      this.audio.found();
      this.refreshWish();
      return;
    }
    if (this.act === 'palm' && this.actPalm) {
      if (this.stack.count < this.actPalm.neededFriends) return;
      this.actPalm.harvest();
      this.pocket.markHarvested(this.actPalm.id);
      this.pocket.addCoconuts(this.actPalm.count);
      this.audio.found();
      this.refreshWish();
      return;
    }
    const friend = this.actFriend;
    if (this.act === 'build' && friend) {
      this.pocket.spend(friend.itemIds);
      this.pocket.spendCoconuts(friend.coconutCost);
      this.pocket.house(friend.id);
      this.stack.remove(friend);
      this.houses.get(friend.id)?.show(false);
      friend.moveHome();
      this.reveal();
      this.life.sync(this.pocket);
      this.pickups.refresh();
      this.audio.built();
      this.showCard(friend);
      return;
    }
    if (this.act === 'stack' && friend) {
      this.stack.add(friend);
      this.audio.hopOn();
      return;
    }
    if (this.act === 'talk' && friend) this.onTalk(friend);
  }

  private onTalk(friend: Friend): void {
    this.talking = friend;
    this.talkIndex = 0;
    this.talk.hidden = false;
    this.talk.textContent = `${friend.name}: ${friend.line(0)}`;
  }

  private advanceTalk(): void {
    const friend = this.talking;
    if (!friend) return;
    this.talkIndex += 1;
    if (this.talkIndex >= friend.lineCount()) {
      this.talkIndex = -1;
      this.talk.hidden = true;
      this.pocket.hear(friend.id);
      this.showCard(friend);
      return;
    }
    this.talk.textContent = `${friend.name}: ${friend.line(this.talkIndex)}`;
  }

  private reveal(): void {
    const housed = (id: string) => this.pocket.isHoused(id);
    for (const friend of this.friends) {
      const on = friend.needsMet(housed);
      friend.setPresent(on);
      this.houses.get(friend.id)?.setPresent(on);
    }
  }

  private nearestFriend(x: number, z: number): Friend | null {
    let found: Friend | null = null;
    let best = 2.15;
    for (const friend of this.friends) {
      if (friend.riding) continue;
      const distance = friend.distanceTo(x, z);
      if (distance < best) {
        best = distance;
        found = friend;
      }
    }
    return found;
  }

  private nearestPalm(x: number, z: number): PalmTree | null {
    let found: PalmTree | null = null;
    let best = 2.35;
    for (const palm of this.island.palms) {
      if (palm.harvested) continue;
      const distance = Math.hypot(x - palm.x, z - palm.z);
      if (distance < best) {
        best = distance;
        found = palm;
      }
    }
    return found;
  }

  private nearestStake(x: number, z: number): Friend | null {
    let found: Friend | null = null;
    let best = Infinity;
    for (const friend of this.friends) {
      if (this.pocket.isHoused(friend.id)) continue;
      const house = this.houses.get(friend.id);
      if (!house?.near(x, z)) continue;
      const distance = Math.hypot(x - friend.houseAt.x, z - friend.houseAt.z);
      if (distance < best) {
        best = distance;
        found = friend;
      }
    }
    return found;
  }

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = Math.max(this.container.clientHeight, 1);
    this.view.resize(width / height);
    this.renderer.setSize(width, height);
  };

  private buildHud(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <p class="credit">Capybara Island · Meryl Meston</p>
      <p id="surface">Grass</p>
      <p class="hint">WASD or arrows · Shift · Space hops · E uses · Q drops a friend · I pocket</p>
    `;
    this.container.appendChild(hud);
    return hud;
  }

  private buildCards(): { prompt: HTMLButtonElement; talk: HTMLButtonElement; wish: HTMLElement } {
    const prompt = document.createElement('button');
    prompt.id = 'prompt';
    prompt.type = 'button';
    prompt.hidden = true;
    prompt.textContent = 'E  Talk to Puddle';
    prompt.addEventListener('click', () => {
      if (!this.paused) this.interact();
    });

    const talk = document.createElement('button');
    talk.id = 'talk';
    talk.type = 'button';
    talk.hidden = true;
    talk.addEventListener('click', () => this.advanceTalk());

    const wish = document.createElement('aside');
    wish.id = 'wish';
    wish.hidden = true;
    wish.innerHTML = `<p class="who"></p><p class="wish-line"></p><ul></ul><button type="button" id="wish-hint">Show me</button><p class="home" hidden></p>`;
    wish.querySelector('#wish-hint')?.addEventListener('click', () => this.showHint());

    this.container.append(prompt, talk, wish);
    return { prompt, talk, wish };
  }

  private buildPause(): HTMLElement {
    const pause = document.createElement('div');
    pause.id = 'pause';
    pause.hidden = true;
    pause.innerHTML = `
      <div class="panel">
        <h2>Paused</h2>
        <div data-page="main">
          <button type="button" data-act="resume">Resume</button>
          <button type="button" data-act="options">Options</button>
          <button type="button" data-act="controls">Controls</button>
          <button type="button" data-act="restart">Restart</button>
          <button type="button" data-act="new">New game</button>
        </div>
        <div data-page="options" hidden>
          <label class="volume">Sound
            <input id="menu-volume" type="range" min="0" max="100" value="${Math.round(loadSettings().volume * 100)}" />
          </label>
          <button type="button" data-act="back">Back</button>
        </div>
        <div data-page="controls" hidden>
          <p>WASD or arrows move. Shift hurries. Space hops. E talks, picks up, or builds. I or Tab opens the pocket. Esc opens this menu.</p>
          <button type="button" data-act="back">Back</button>
        </div>
        <div data-page="confirm" hidden>
          <p>Start over? The houses and the pocket will be cleared.</p>
          <button type="button" data-act="confirm-new">Yes, start over</button>
          <button type="button" data-act="back">Back</button>
        </div>
      </div>
    `;
    pause.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const act = target.dataset.act;
      if (act === 'resume') {
        this.paused = false;
        pause.hidden = true;
      } else if (act === 'options') this.showMenuPage('options');
      else if (act === 'controls') this.showMenuPage('controls');
      else if (act === 'restart') window.location.reload();
      else if (act === 'new') this.showMenuPage('confirm');
      else if (act === 'confirm-new') {
        localStorage.removeItem('capybara-island');
        window.location.reload();
      } else if (act === 'back') this.showMenuPage('main');
    });
    const volume = pause.querySelector('#menu-volume');
    volume?.addEventListener('input', () => {
      if (!(volume instanceof HTMLInputElement)) return;
      const amount = Number(volume.value) / 100;
      this.audio.setVolume(amount);
      saveSettings(amount);
    });
    this.container.append(pause);
    return pause;
  }

  private showMenuPage(page: string): void {
    for (const section of this.pause.querySelectorAll('[data-page]')) {
      if (section instanceof HTMLElement) section.hidden = section.dataset.page !== page;
    }
  }

  private showHint(): void {
    const friend = this.card;
    if (!friend || this.pocket.isHoused(friend.id)) return;
    const missing = friend.itemIds.find((id) => !this.pocket.has(id));
    const item = missing ? itemById(missing) : undefined;
    const needCoconuts = !item && this.pocket.coconutCount < friend.coconutCost;
    const palm = needCoconuts ? this.hintPalm() : null;
    const x = item ? item.x : palm ? palm.x : friend.houseAt.x;
    const z = item ? item.z : palm ? palm.z : friend.houseAt.z;
    this.hintPoint.set(x, Math.max(heightAt(x, z), 0.05) + 0.4, z);
    this.hintLeft = 3.4;
    this.view.glanceAt(this.hintPoint, 3.4);
    const button = this.wish.querySelector('#wish-hint');
    if (button) {
      button.textContent = item
        ? `Look: ${item.name}`
        : palm
          ? 'Look: coconuts'
          : `Look: ${friend.name}'s stake`;
    }
  }

  private hintPalm(): PalmTree | null {
    const here = this.traveler.position;
    let best: PalmTree | null = null;
    let bestDist = Infinity;
    for (const palm of this.island.palms) {
      if (palm.harvested) continue;
      if (palm.neededFriends > this.stack.count) continue;
      const d = Math.hypot(here.x - palm.x, here.z - palm.z);
      if (d < bestDist) {
        bestDist = d;
        best = palm;
      }
    }
    if (best) return best;
    for (const palm of this.island.palms) {
      if (palm.harvested) continue;
      const d = Math.hypot(here.x - palm.x, here.z - palm.z);
      if (d < bestDist) {
        bestDist = d;
        best = palm;
      }
    }
    return best;
  }

  private clearHint(): void {
    this.hintLeft = 0;
    this.marker.visible = false;
    this.view.cancelGlance();
    const button = this.wish.querySelector('#wish-hint');
    if (button) button.textContent = 'Show me';
  }

  private writePrompt(itemName: string): void {
    const friend = this.actFriend;
    const palm = this.actPalm;
    if (this.act === 'take') this.prompt.textContent = `E  Pick up ${itemName}`;
    else if (this.act === 'build' && friend) this.prompt.textContent = `E  Build ${friend.name}'s house`;
    else if (this.act === 'palm' && palm) {
      if (this.stack.count >= palm.neededFriends) {
        this.prompt.textContent = `E  Pick ${palm.count} coconuts`;
      } else {
        const who = palm.neededFriends === 1 ? '1 friend' : `${palm.neededFriends} friends`;
        this.prompt.textContent = `Too high — stack ${who} to reach`;
      }
    } else if (this.act === 'wait' && friend) this.prompt.textContent = this.waitLine(friend);
    else if (this.act === 'stack' && friend) this.prompt.textContent = `E  ${friend.name} hops on`;
    else if (friend) this.prompt.textContent = `E  Talk to ${friend.name}`;
  }

  private waitLine(friend: Friend): string {
    if (!this.pocket.hasHeard(friend.id)) return `Talk to ${friend.name} first`;
    const missing = friend.itemIds
      .filter((id) => !this.pocket.has(id))
      .map((id) => `the ${(itemById(id)?.name ?? id).toLowerCase()}`);
    const needCoconuts = friend.coconutCost - this.pocket.coconutCount;
    if (needCoconuts > 0) {
      missing.push(`${needCoconuts} more ${needCoconuts === 1 ? 'coconut' : 'coconuts'}`);
    }
    if (missing.length === 0) return `Talk to ${friend.name} first`;
    if (missing.length === 1) return `Bring ${missing[0]}`;
    const last = missing.pop();
    return `Bring ${missing.join(', ')} and ${last}`;
  }

  private showCard(friend: Friend): void {
    this.card = friend;
    this.wish.hidden = false;
    const who = this.wish.querySelector('.who');
    const line = this.wish.querySelector('.wish-line');
    const list = this.wish.querySelector('ul');
    const note = this.wish.querySelector('.home');
    if (who) who.textContent = friend.name;
    if (line) line.textContent = friend.wish;
    if (list) {
      const rows = friend.itemIds.map((id) => {
        const item = itemById(id);
        return `<li data-id="${id}"><span class="box"></span>${item?.name ?? id}</li>`;
      });
      if (friend.coconutCost > 0) {
        rows.push(`<li data-coconuts="${friend.coconutCost}"><span class="box"></span>${friend.coconutCost} coconuts</li>`);
      }
      list.innerHTML = rows.join('');
    }
    if (note) note.textContent = `${friend.name} is home.`;
    this.refreshWish();
  }

  private refreshWish(): void {
    const friend = this.card;
    if (!friend) return;
    const home = this.pocket.isHoused(friend.id);
    for (const id of friend.itemIds) {
      const box = this.wish.querySelector(`[data-id="${id}"] .box`);
      box?.classList.toggle('on', home || this.pocket.has(id));
    }
    if (friend.coconutCost > 0) {
      const box = this.wish.querySelector('[data-coconuts] .box');
      box?.classList.toggle('on', home || this.pocket.coconutCount >= friend.coconutCost);
    }
    const note = this.wish.querySelector('.home');
    if (note instanceof HTMLElement) note.hidden = !home;
    const hint = this.wish.querySelector('#wish-hint');
    if (hint instanceof HTMLElement) hint.hidden = home;
  }

  private writeHud(): void {
    const sample = this.traveler.sample;
    const surface = this.hud.querySelector('#surface');
    if (!sample || !surface) return;
    const depth = sample.depth > 0.02 ? ` · water ${sample.depth.toFixed(2)}` : '';
    surface.textContent = `${sample.label} · ${this.traveler.gait}${depth}`;
  }
}

function loadSettings(): { volume: number } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { volume: 0.7 };
    const parsed = JSON.parse(raw) as { volume?: number };
    const volume = parsed.volume;
    if (typeof volume !== 'number') return { volume: 0.7 };
    return { volume: Math.min(1, Math.max(0, volume)) };
  } catch {
    return { volume: 0.7 };
  }
}

function saveSettings(volume: number): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume }));
}
