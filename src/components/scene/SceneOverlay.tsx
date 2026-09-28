import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { questionOf } from '../../game/chat';
import { handledCustomers } from '../../game/helpers';
import TutorialGlow, { useTutorialTargets } from '../kid/TutorialGlow';
import { useSettings } from '../../game/settings';
import { burnGrace, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import { passDishOffset } from '../../game/layout';
import type { MapLayout, MapStation } from '../../game/layout';
import type { Customer, GameState } from '../../game/types';
import { GROUP, colors, patienceColor } from '../ui';
import type { GroupKey } from '../ui';
import TimerRing from '../kid/TimerRing';
import { project } from './camera';
import type { CameraCam } from './camera';

function Bar({ value, color, width }: { value: number; color: string; width: number }) {
  return (
    <View style={[styles.track, { width }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

/** Bong bóng trò chuyện (chỉ hình + câu ngắn) hoặc câu hỏi ❓ chạm được để trả lời. */
function ChatBubble({ c, font, onQuestion }: { c: Customer; font: number; onQuestion?: (id: string) => void }) {
  if (c.question) {
    const q = questionOf(c.question.id);
    return (
      <Pressable
        onPress={() => onQuestion?.(c.id)}
        accessibilityRole="button"
        accessibilityLabel={`${c.name} hỏi: ${q?.text ?? ''}`}
        style={({ pressed }) => [styles.ask, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Text style={{ fontSize: font * 1.1 }}>
          {q?.icon ?? '💬'}❓
        </Text>
      </Pressable>
    );
  }
  if (!c.chat) return null;
  return (
    <View pointerEvents="none" style={styles.chat}>
      <Text style={[styles.chatText, { fontSize: Math.max(10, font * 0.6) }]} numberOfLines={2}>
        {c.chat.icon} {c.chat.text}
      </Text>
    </View>
  );
}

/**
 * Món khách gọi: ô to có **vòng đếm giờ** (kiên nhẫn) quanh món đầu, các món còn lại xếp bên cạnh.
 * `handled`: món đang nấu / đã xong (vòng xanh dương, ⏳ — khách chờ thong thả);
 * `wanted`: chủ quán đang cầm đúng món bàn này chờ (viền xanh lá, to hơn, 👇).
 */
function OrderBubble({ c, font, onQuestion, handled, wanted, onPress, label }: { c: Customer; font: number; onQuestion?: (id: string) => void; handled?: boolean; wanted?: boolean; onPress?: () => void; label?: string }) {
  const open = c.items.filter((i) => !i.served);
  const ratio = Math.max(0, c.patience / c.maxPatience);
  const f = Math.max(18, wanted ? font * 1.5 : font * 1.25);
  const ring = f * 1.9;
  const color = handled ? colors.info : patienceColor(ratio);
  const [first, ...rest] = open;
  return (
    <View style={styles.stack} pointerEvents="box-none">
      <ChatBubble c={c} font={font} onQuestion={onQuestion} />
      {first && (
        <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label} style={[styles.bubble, wanted && styles.bubbleWanted]}>
          <TimerRing value={ratio} size={ring} width={Math.max(3, f * 0.18)} color={color}>
            <Text style={{ fontSize: f }}>{RECIPES[first.recipeId].emoji}</Text>
          </TimerRing>
          {(rest.length > 0 || first.noGarnish || handled) && (
            <Text style={{ fontSize: f * 0.85 }} numberOfLines={2}>
              {first.noGarnish ? '🚫' : ''}
              {rest.map((i) => RECIPES[i.recipeId].emoji + (i.noGarnish ? '🚫' : '')).join('')}
              {handled && !wanted ? <Text style={{ fontSize: f * 0.55 }}>⏳</Text> : null}
            </Text>
          )}
        </Pressable>
      )}
      {wanted && <Text style={{ fontSize: font * 1.2 }}>👇</Text>}
    </View>
  );
}

/** Chip cố định trên mỗi trạm: tên + trạng thái ngắn, màu theo nhóm. */
function Chip({ title, status, group, bar, glow, onPress }: { title: string; status?: string; group: GroupKey; bar?: { value: number; color: string } | null; glow?: boolean; onPress?: () => void }) {
  const g = GROUP[group];
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`${title}${status ? ': ' + status : ''}`} style={[styles.chip, { backgroundColor: g.bg, borderColor: g.fg }, glow && styles.chipGlow]}>
      <Text style={[styles.chipTitle, { color: colors.brown }]} numberOfLines={1}>
        {title}
      </Text>
      {status ? (
        <Text style={[styles.chipStatus, { color: g.fg }]} numberOfLines={1}>
          {status}
        </Text>
      ) : null}
      {bar && <Bar value={bar.value} color={bar.color} width={54} />}
    </Pressable>
  );
}

/** Nhãn gọn khi không đứng gần: chỉ 1 biểu tượng tròn (có việc gấp: chín, sắp cháy, có món chờ...). */
function Dot({ icon, name, tone = 'plain', onPress, bar }: { icon: string; name: string; tone?: 'plain' | 'good' | 'bad'; onPress?: () => void; bar?: { value: number; color: string } | null }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.dot, tone === 'good' && styles.dotGood, tone === 'bad' && styles.dotBad, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Text style={styles.dotText}>{icon}</Text>
      {bar && <Bar value={bar.value} color={bar.color} width={30} />}
    </Pressable>
  );
}

/**
 * Lớp chữ nổi trên cảnh 3D (không nhận chạm): món khách gọi, tiến độ nấu,
 * món trên quầy ra món, nhãn đồ vật. Vị trí được chiếu từ toạ độ 3D qua cùng camera.
 */
export default function SceneOverlay({
  game,
  layout,
  cam,
  w,
  h,
  pan,
  onQuestion,
  arrange = false,
  onPlus,
  onStation,
  nearId = null,
}: {
  /** Trạm chủ quán đang đứng / đang đi tới: chỉ trạm này hiện nhãn đầy đủ (còn lại gọn). */
  nearId?: string | null;
  /** Chạm chip trạm: đi tới trạm đó. */
  onStation?: (st: MapStation) => void;
  /** Chế độ Bố trí: hiện "+" ở chỗ chưa mua. */
  arrange?: boolean;
  /** Chạm "+" (mở màn Nâng cấp). */
  onPlus?: () => void;
  game: GameState;
  layout: MapLayout;
  /** Camera gốc (không dời theo nhân vật). */
  cam: CameraCam;
  w: number;
  h: number;
  /** Độ dời màn hình hiện tại của camera đi theo nhân vật. */
  pan: Animated.ValueXY;
  /** Chạm vào câu hỏi ❓ của khách. */
  onQuestion?: (customerId: string) => void;
}) {
  const run = game.run!;
  const p = (x: number, y: number, z: number) => project(cam, x, y, z, w, h);
  // Số px cho 1 ô: dùng để co giãn cỡ chữ theo mức phóng.
  const a = p(0, 0, 0);
  const b = p(1, 0, 0);
  const c2 = p(0, 0, 1);
  const unit = Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c2.x - a.x, c2.y - a.y));
  const font = Math.max(11, Math.min(22, unit * 0.34));
  const center = (st: MapStation): [number, number] => [st.x + st.w / 2, st.y + st.h / 2];
  const targets = useTutorialTargets();
  const settings = useSettings();
  /** Nhãn đầy đủ: luôn hiện (cài đặt), đang đứng gần, hoặc đang được chỉ vào (hướng dẫn / đường sông). */
  const full = (st: MapStation, target?: string) => settings.labels === 'always' || st.id === nearId || arrange || (target ? targets.includes(target) : false);
  const go = (st: MapStation) => (onStation && !arrange ? () => onStation(st) : undefined);
  const handled = handledCustomers(run);
  const carried = new Set(run.carrying.map((id) => run.pass.find((d) => d.id === id)?.recipeId).filter(Boolean));

  const items: React.ReactNode[] = [];
  const place = (key: string, pt: { x: number; y: number }, node: React.ReactNode, width = 90) =>
    items.push(
      <View key={key} pointerEvents="box-none" style={[styles.anchor, { left: pt.x - width / 2, bottom: h - pt.y, width }]}>
        {node}
      </View>
    );

  for (const st of layout.stations) {
    const [cx, cz] = center(st);
    if (!st.active) {
      if (arrange)
        place(
          `plus-${st.id}`,
          p(cx, 0.95, cz),
          <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="Mua thêm chỗ này" style={styles.plusBtn}>
            <Text style={[styles.plus, { fontSize: Math.max(18, font) }]}>＋</Text>
          </Pressable>,
          48
        );
      continue;
    }
    if (st.kind === 'table') {
      const cust = run.customers.find((x) => x.tableIndex === st.tableIndex);
      if (cust)
        place(
          `bubble-${st.id}`,
          p(cx, 1.8, cz),
          <TutorialGlow on={targets.includes('shop.table') && cust.items.some((i) => !i.served)} radius={12}>
            <OrderBubble
              onPress={go(st)}
              label={`Bàn ${st.tableIndex! + 1}: ${cust.name}`}
              c={cust}
              font={font}
              onQuestion={onQuestion}
              handled={handled.has(cust.id)}
              wanted={cust.items.some((i) => !i.served && carried.has(i.recipeId))}
            />
          </TutorialGlow>,
          150
        );
      continue;
    }
    if (st.slotId) {
      const job = run.slots.find((s) => s.id === st.slotId)?.job;
      const idx = Number(st.slotId.replace(/\D/g, '')) + 1;
      const title = st.kind === 'stove' ? `Bếp ${idx}` : `Quầy pha ${idx}`;
      let status = 'trống';
      let bar: { value: number; color: string } | null = null;
      if (job) {
        const r = RECIPES[job.recipeId];
        const done = job.progress >= job.cookTime;
        const burnRatio = (job.progress - job.cookTime) / burnGrace(job.cookTime);
        const color = !done ? colors.accent : r.burns && burnRatio > 0.5 ? colors.bad : colors.good;
        bar = { value: done && r.burns ? 1 - burnRatio : job.progress / job.cookTime, color };
        const who = job.by !== 'player' ? '👤' : '';
        status = `${r.emoji}${who} ${!done ? `${Math.round((job.progress / job.cookTime) * 100)}%` : r.burns && burnRatio > 0.5 ? '⚠️ cháy!' : '✅ chín'}`;
      }
      // Bếp / quầy liền nhau: chip so le trái – phải, cao – thấp cho khỏi chồng lên nhau.
      const pair = layout.stations.filter((x) => x.kind === st.kind && x.active).length > 1;
      if (full(st, 'shop.board')) {
        const at = p(cx, pair && idx % 2 ? 1.6 : 2.4, cz);
        place(`chip-${st.id}`, { x: at.x + (pair ? (idx % 2 ? -34 : 34) : 0), y: at.y }, <Chip title={title} status={status} group={st.kind === 'stove' ? 'meat' : 'egg'} bar={bar} onPress={go(st)} />, 96);
      } else if (job) {
        // Gọn: chỉ hình món + vạch tiến độ; chín ✅, sắp cháy ⚠️.
        const r = RECIPES[job.recipeId];
        const done = job.progress >= job.cookTime;
        const burning = done && r.burns && (job.progress - job.cookTime) / burnGrace(job.cookTime) > 0.5;
        place(
          `dot-${st.id}`,
          p(cx, 1.9, cz),
          <Dot icon={`${r.emoji}${burning ? '⚠️' : done ? '✅' : ''}`} name={`${title}: ${status}`} tone={burning ? 'bad' : done ? 'good' : 'plain'} bar={done ? null : bar} onPress={go(st)} />,
          70
        );
      }
      continue;
    }
    if (st.kind === 'board' && !full(st, 'shop.board')) {
      if (run.playerPrep)
        place('board', p(cx, 1.45, cz), <Dot icon="🔪⏳" name="Thớt: đang thái" onPress={go(st)} bar={{ value: 1 - (run.playerPrep.endsAt - run.elapsed) / PLAYER_PREP_MS, color: colors.info }} />, 70);
    } else if (st.kind === 'board') {
      const prepped = Object.values(run.prepped).reduce((n, v) => n + (v ?? 0), 0);
      place(
        'board',
        p(cx, 1.45, cz),
        <TutorialGlow on={targets.includes('shop.board')} radius={10}>
          <Chip
            title="Thớt"
            onPress={go(st)}
            status={run.playerPrep ? '🔪 đang thái' : prepped ? `🔪 ${prepped} phần` : 'trống'}
            group="veg"
            glow={targets.includes('shop.board')}
            bar={run.playerPrep ? { value: 1 - (run.playerPrep.endsAt - run.elapsed) / PLAYER_PREP_MS, color: colors.info } : null}
          />
        </TutorialGlow>,
        96
      );
    }
    if (st.kind === 'fridge' && full(st)) {
      const total = game.stock.filter((b) => b.expiresOnDay >= game.day).reduce((n, b) => n + b.qty, 0);
      place('fridge', p(cx, 2.45, cz), <Chip title="Kho" status={`📦 ${total}`} group="fish" onPress={go(st)} />, 80);
    }
    if (st.kind === 'trash') {
      const badHeld = run.carrying.some((id) => run.pass.find((d) => d.id === id)?.quality === 'burnt');
      if (full(st)) place('trash', p(cx, 1.3, cz), <Chip title="Rác" group="neutral" onPress={go(st)} />, 60);
      else if (badHeld) place('trash', p(cx, 1.3, cz), <Dot icon="🗑️" name="Rác: bỏ món cháy" tone="bad" onPress={go(st)} />, 50);
    }
    if (st.kind === 'mop') {
      if (full(st)) place('mop', p(cx, 1.25, cz), <Chip title="Rửa · lau" status={`🧽 ${Math.round(game.cleanliness)}%`} group="fish" onPress={go(st)} />, 84);
      else if (game.cleanliness < 60) place('mop', p(cx, 1.25, cz), <Dot icon="🧽❗" name={`Rửa · lau: ${Math.round(game.cleanliness)}%`} tone="bad" onPress={go(st)} />, 60);
    }
    if (st.kind === 'pass') {
      const dishes = run.pass.filter((d) => !run.carrying.includes(d.id)).slice(0, 10);
      if (full(st)) place('pass', p(cx, 1.55, cz - 0.4), <Chip title="Quầy ra món" status={dishes.length ? `🍽️ ${dishes.length} dĩa` : 'trống'} group="egg" onPress={go(st)} />, 110);
      else if (dishes.length) place('pass', p(cx, 1.75, cz - 0.4), <Dot icon={`🛎️${dishes.length}`} name={`Quầy ra món: ${dishes.length} dĩa`} tone="good" onPress={go(st)} />, 60);
      dishes.forEach((d, i) => {
        const [ox, oz] = passDishOffset(i, st.w);
        place(`dish-${d.id}`, p(cx + ox, 1.2, cz + oz), <Text style={{ fontSize: font * 0.85 }}>{d.quality === 'burnt' ? '🔥' : RECIPES[d.recipeId].emoji}</Text>, 40);
      });
    }
    if (st.kind === 'door') {
      const waiting = run.customers.filter((x) => x.tableIndex === undefined);
      waiting.slice(0, 2).forEach((cust, i) => place(`door-${cust.id}`, p(11 - i * 0.9, 2.1, 8.1), <OrderBubble c={cust} font={font * 0.85} onQuestion={onQuestion} handled={handled.has(cust.id)} wanted={cust.items.some((i) => !i.served && carried.has(i.recipeId))} />, 150));
    }
  }

  // Chữ nổi 💥 chỗ nhân viên vấp té.
  for (const inc of run.incidents ?? []) {
    if (inc.kind !== 'trip') continue;
    const table = inc.tableIndex !== undefined ? layout.stations.find((x) => x.id === `table${inc.tableIndex}`) : layout.stations.find((x) => x.id === 'door');
    const acc = table?.access[0];
    if (!acc) continue;
    place(`inc-${inc.id}`, p(acc.x + 0.5, 1.4, acc.y + 0.5), <Text style={{ fontSize: font * 1.6 }}>💥</Text>, 60);
  }

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}>{items}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', alignItems: 'center' },
  stack: { alignItems: 'center', gap: 3 },
  chat: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 150,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  chatText: { color: colors.text, fontWeight: '700', textAlign: 'center' },
  ask: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleWanted: { borderWidth: 3, borderColor: colors.good, backgroundColor: '#F1F8E9' },
  bubble: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    gap: 2,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: '800', color: colors.text },
  plus: { color: '#fff', fontWeight: '900' },
  plusBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(62,47,42,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', borderStyle: 'dashed' },
  chip: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
    gap: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  chipGlow: { borderWidth: 3 },
  dot: { minWidth: 34, minHeight: 34, borderRadius: 17, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: 'rgba(255,246,233,0.95)', borderWidth: 2, borderColor: colors.chunkyShadow, alignItems: 'center', justifyContent: 'center' },
  dotGood: { borderColor: colors.good, backgroundColor: '#F1F8E9' },
  dotBad: { borderColor: colors.bad, backgroundColor: '#FFEBEE' },
  dotText: { fontSize: 15 },
  chipTitle: { fontSize: 12, fontWeight: '900' },
  chipStatus: { fontSize: 11, fontWeight: '800' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden' },
});
