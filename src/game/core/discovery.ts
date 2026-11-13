import { create } from 'zustand';
import type { CategoryId } from '../../data/scientific-checklist/categories';
import { useGame, interpFor, type World } from './store';

export interface DiscoveryItem { id: number; world: World; cat: CategoryId }

let seq = 1;
export const useDiscovery = create<{ queue: DiscoveryItem[] }>()(() => ({ queue: [] }));

/** Called when a task's evidence is collected: awards a star and shows the "Did you know?" card. */
export function queueDiscovery(world: World, cat: CategoryId) {
  useGame.getState().addStar(`${world}:${cat}:found`);
  useDiscovery.setState((s) => ({ queue: [...s.queue, { id: seq++, world, cat }] }));
}

/** Records the player's answer as the category interpretation (keeps scoring & report working). */
export function answerDiscovery(item: DiscoveryItem, correct: boolean) {
  const g = useGame.getState();
  if (correct) g.addStar(`${item.world}:${item.cat}:quiz`);
  const set = interpFor(item.world)[item.cat];
  const opt = correct ? set.options[0] : set.options.find((o) => o.quality === 'inconclusive') ?? set.options[set.options.length - 1];
  g.setInterp(item.world, item.cat, { optionId: opt.id, confidence: opt.suggestedConfidence, limitationId: 'l1', note: '' });
}

export function closeDiscovery(id: number) {
  useDiscovery.setState((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
}

export const totalStars = (stars: Record<string, number>) => Object.keys(stars).length;
export const MAX_STARS = 32;
