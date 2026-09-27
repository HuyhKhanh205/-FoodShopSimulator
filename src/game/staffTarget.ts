import type { MapLayout, Tile } from './layout';
import type { GameState, Staff } from './types';

/** Nhân viên đứng ở ô nào trên bản đồ: suy ra từ việc họ đang làm. null = không có mặt (nghỉ, đi trễ). */
export function staffTarget(st: Staff, game: GameState, layout: MapLayout): Tile | null {
  const run = game.run!;
  if (st.absent || run.elapsed < st.lateUntil) return null;
  const byId = (id: string) => layout.stations.find((x) => x.id === id);
  const cookingSlot = run.slots.find((sl) => sl.job?.by === st.id);
  const slotId = cookingSlot?.id ?? st.task?.slotId;
  if (slotId) return byId(slotId)?.access[0] ?? layout.restSpot;
  const t = st.task;
  if (t?.kind === 'prep') return { x: 10, y: 2 };
  if (t?.kind === 'serve' || t?.kind === 'fallen') {
    const c = run.customers.find((x) => x.id === t.customerId);
    const table = c?.tableIndex !== undefined ? byId(`table${c.tableIndex}`) : byId('door');
    return table?.access[0] ?? { x: 5, y: 5 };
  }
  if (t?.kind === 'clean') return { x: 6, y: 7 };
  if (st.role === 'cook') return { x: 5, y: 2 };
  if (st.role === 'prep') return { x: 8, y: 2 };
  if (st.role === 'waiter') return { x: 9, y: 5 };
  return layout.restSpot;
}
