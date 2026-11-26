import items from '../data/items.json';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  wish: string | null;
  x: number;
  z: number;
}

export const ITEMS: ItemDef[] = items;

export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((item) => item.id === id);
}
