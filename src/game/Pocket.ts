import { itemById, type ItemDef } from './items';

const SAVE_KEY = 'capybara-island';

interface SaveSlot {
  order: string[];
  counts: Record<string, number>;
  housed: string[];
  heard: string[];
  coconuts?: number;
  harvested?: string[];
}

/** Everything picked up, coconut balance, plus who is home. One localStorage slot. */
export class Pocket {
  readonly row: HTMLUListElement;
  readonly panel: HTMLElement;
  readonly counter: HTMLElement;
  private order: string[] = [];
  private counts: Record<string, number> = {};
  private housed: string[] = [];
  private heard: string[] = [];
  private coconuts = 0;
  private harvested: string[] = [];
  private panelOpen = false;

  constructor(parent: HTMLElement) {
    this.row = document.createElement('ul');
    this.row.id = 'pocket';
    this.panel = document.createElement('aside');
    this.panel.id = 'pocket-open';
    this.panel.hidden = true;
    this.counter = document.createElement('div');
    this.counter.id = 'coconuts';
    parent.append(this.row, this.panel, this.counter);
    this.load();
    this.render();
    this.renderCoconuts(false);
  }

  get coconutCount(): number {
    return this.coconuts;
  }

  has(id: string): boolean {
    return (this.counts[id] ?? 0) > 0;
  }

  isHoused(id: string): boolean {
    return this.housed.includes(id);
  }

  hasHeard(id: string): boolean {
    return this.heard.includes(id);
  }

  isHarvested(palmId: string): boolean {
    return this.harvested.includes(palmId);
  }

  markHarvested(palmId: string): void {
    if (!this.harvested.includes(palmId)) this.harvested.push(palmId);
    this.save();
  }

  addCoconuts(amount: number): void {
    if (amount <= 0) return;
    this.coconuts += amount;
    this.save();
    this.renderCoconuts(true);
  }

  spendCoconuts(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.coconuts < amount) return false;
    this.coconuts -= amount;
    this.save();
    this.renderCoconuts(true);
    return true;
  }

  add(id: string): void {
    this.counts[id] = (this.counts[id] ?? 0) + 1;
    if (!this.order.includes(id)) this.order.push(id);
    this.save();
    this.render(id);
  }

  spend(ids: string[]): void {
    for (const id of ids) {
      const next = (this.counts[id] ?? 0) - 1;
      if (next > 0) this.counts[id] = next;
      else {
        delete this.counts[id];
        this.order = this.order.filter((kept) => kept !== id);
      }
    }
    this.save();
    this.render();
  }

  hear(id: string): void {
    if (!this.heard.includes(id)) this.heard.push(id);
    this.save();
  }

  house(id: string): void {
    if (!this.housed.includes(id)) this.housed.push(id);
    this.save();
  }

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    this.panel.hidden = !this.panelOpen;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw) as SaveSlot;
      this.order = save.order ?? [];
      this.counts = save.counts ?? {};
      this.housed = save.housed ?? [];
      this.heard = save.heard ?? [];
      this.coconuts = typeof save.coconuts === 'number' && save.coconuts >= 0 ? save.coconuts : 0;
      this.harvested = Array.isArray(save.harvested) ? save.harvested : [];
    } catch {
      this.order = [];
    }
  }

  private save(): void {
    const slot: SaveSlot = {
      order: this.order,
      counts: this.counts,
      housed: this.housed,
      heard: this.heard,
      coconuts: this.coconuts,
      harvested: this.harvested,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(slot));
  }

  private renderCoconuts(pop: boolean): void {
    this.counter.innerHTML = `${coconutIcon()}<span class="count">${this.coconuts}</span>`;
    if (pop) {
      this.counter.classList.remove('pop');
      void this.counter.offsetWidth;
      this.counter.classList.add('pop');
    }
  }

  private render(newest?: string): void {
    this.row.replaceChildren(
      ...this.order.map((id) => {
        const item = itemById(id);
        if (!item) return document.createElement('li');
        return chip(item, this.counts[id] ?? 1, id === newest);
      }),
    );
    const title = document.createElement('p');
    title.className = 'who';
    title.textContent = 'Pocket';
    const list = document.createElement('ul');
    for (const id of this.order) {
      const item = itemById(id);
      if (!item) continue;
      const li = document.createElement('li');
      li.innerHTML = `${icon(item.icon)}<span><strong>${item.name}</strong><br>${item.blurb}</span>`;
      list.append(li);
    }
    if (this.order.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Nothing in the pocket yet.';
      this.panel.replaceChildren(title, empty);
      return;
    }
    this.panel.replaceChildren(title, list);
  }
}

function chip(item: ItemDef, count: number, fresh: boolean): HTMLLIElement {
  const li = document.createElement('li');
  if (fresh) li.className = 'pop';
  const countLabel = count > 1 ? `<span class="count">${count}</span>` : '';
  li.innerHTML = `${icon(item.icon)}<span>${item.name}</span>${countLabel}`;
  return li;
}

function coconutIcon(): string {
  return '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="#6b4a32"/><circle cx="13" cy="13" r="1.8" fill="#3a2518"/><circle cx="19" cy="13" r="1.8" fill="#3a2518"/><circle cx="16" cy="18" r="2" fill="#3a2518"/></svg>';
}

function icon(kind: string): string {
  if (kind === 'door') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="8" y="4" width="16" height="24" rx="8" fill="#8d5a32"/><circle cx="20" cy="16" r="1.6" fill="#f3e2c4"/></svg>';
  }
  if (kind === 'lily') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="18" rx="12" ry="8" fill="#6e9a4e"/><circle cx="16" cy="18" r="2" fill="#f2e27a"/></svg>';
  }
  if (kind === 'leaf') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="18" rx="8" ry="12" transform="rotate(-30 16 18)" fill="#3f6b32"/></svg>';
  }
  if (kind === 'stone') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="12" width="20" height="10" rx="2" fill="#9aa094"/></svg>';
  }
  if (kind === 'hut') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="14" width="14" height="12" fill="#c4a06a"/><rect x="6" y="10" width="20" height="5" fill="#c47a4a"/></svg>';
  }
  if (kind === 'table') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="12" width="24" height="4" fill="#8d5a32"/><rect x="8" y="16" width="3" height="8" fill="#6b4632"/><rect x="21" y="16" width="3" height="8" fill="#6b4632"/></svg>';
  }
  if (kind === 'hammock') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 12c8 10 16 10 24 0" fill="none" stroke="#c4a06a" stroke-width="3"/></svg>';
  }
  if (kind === 'cloth') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="8" width="20" height="14" fill="#2f4a38"/></svg>';
  }
  return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 18c0-6 6-10 10-10 4 4 6 8 6 12 0 4-4 8-8 8s-8-4-8-10z" fill="#f3e2c4"/><path d="M14 12c2 2 3 5 3 8" fill="none" stroke="#c4a574" stroke-width="1.4"/></svg>';
}
