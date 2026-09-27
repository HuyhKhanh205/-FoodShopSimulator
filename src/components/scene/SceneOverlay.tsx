import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { questionOf } from '../../game/chat';
import { tutorialTargets } from '../../game/tutorial';
import TutorialGlow from '../kid/TutorialGlow';
import { BURN_FACTOR, PLAYER_PREP_MS, RECIPES } from '../../game/data';
import type { MapLayout, MapStation } from '../../game/layout';
import type { Customer, GameState } from '../../game/types';
import { colors, patienceColor } from '../ui';
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

function OrderBubble({ c, font, onQuestion }: { c: Customer; font: number; onQuestion?: (id: string) => void }) {
  const open = c.items.filter((i) => !i.served);
  const ratio = c.patience / c.maxPatience;
  return (
    <View style={styles.stack} pointerEvents="box-none">
    <ChatBubble c={c} font={font} onQuestion={onQuestion} />
    <View pointerEvents="none" style={styles.bubble}>
      <Text style={{ fontSize: font }} numberOfLines={2}>
        {open.map((i) => RECIPES[i.recipeId].emoji + (i.noGarnish ? '🚫' : '')).join('')}
      </Text>
      <Bar value={ratio} color={patienceColor(ratio)} width={Math.max(30, font * 2.6)} />
    </View>
    </View>
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
}: {
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
  const targets = tutorialTargets(game);

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
      place(`plus-${st.id}`, p(cx, 0.95, cz), <Text style={[styles.plus, { fontSize: font }]}>＋</Text>, 40);
      continue;
    }
    if (st.kind === 'table') {
      const cust = run.customers.find((x) => x.tableIndex === st.tableIndex);
      if (cust)
        place(
          `bubble-${st.id}`,
          p(cx, 1.8, cz),
          <TutorialGlow on={targets.includes('shop.table') && cust.items.some((i) => !i.served)} radius={12}>
            <OrderBubble c={cust} font={font} onQuestion={onQuestion} />
          </TutorialGlow>,
          150
        );
      continue;
    }
    if (st.slotId) {
      const job = run.slots.find((s) => s.id === st.slotId)?.job;
      if (!job) continue;
      const r = RECIPES[job.recipeId];
      const done = job.progress >= job.cookTime;
      const burnRatio = (job.progress - job.cookTime) / (job.cookTime * (BURN_FACTOR - 1));
      const color = !done ? colors.accent : r.burns && burnRatio > 0.5 ? colors.bad : colors.good;
      const value = done && r.burns ? 1 - burnRatio : job.progress / job.cookTime;
      place(
        `job-${st.id}`,
        p(cx, 1.7, cz),
        <View style={[styles.tag, done && { borderColor: color }]}>
          <Text style={{ fontSize: font * 0.9 }}>
            {r.emoji}
            {done && r.burns ? (burnRatio > 0.5 ? '⚠️' : '✅') : ''}
          </Text>
          <Bar value={value} color={color} width={Math.max(28, font * 2.2)} />
        </View>
      );
      continue;
    }
    if (st.kind === 'board') {
      place(
        'board',
        p(cx, 1.35, cz),
        <TutorialGlow on={targets.includes('shop.board')} radius={10}>
        <View style={styles.tag}>
          <Text style={[styles.label, targets.includes('shop.board') && { fontSize: 16 }]}>Thớt</Text>
          {run.playerPrep && <Bar value={1 - (run.playerPrep.endsAt - run.elapsed) / PLAYER_PREP_MS} color={colors.info} width={Math.max(28, font * 2.2)} />}
        </View>
        </TutorialGlow>
      );
    }
    if (st.kind === 'fridge') place('fridge', p(cx, 1.95, cz), <View style={styles.tag}><Text style={styles.label}>Kho</Text></View>);
    if (st.kind === 'pass') {
      const dishes = run.pass.filter((d) => !run.carrying.includes(d.id)).slice(0, 10);
      dishes.forEach((d, i) => {
        place(
          `dish-${d.id}`,
          p(st.x + 0.45 + i * 0.55, 1.3, cz),
          <Text style={{ fontSize: font * 0.85 }}>{d.quality === 'burnt' ? '🔥' : RECIPES[d.recipeId].emoji}</Text>,
          40
        );
      });
    }
    if (st.kind === 'door') {
      const waiting = run.customers.filter((x) => x.tableIndex === undefined);
      waiting.slice(0, 2).forEach((cust, i) => place(`door-${cust.id}`, p(11 - i * 0.9, 2.1, 8.1), <OrderBubble c={cust} font={font * 0.85} onQuestion={onQuestion} />, 150));
    }
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
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
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
  plus: { color: 'rgba(255,255,255,0.9)', fontWeight: '900' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden' },
});
