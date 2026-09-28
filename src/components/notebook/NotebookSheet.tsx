import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RECIPES } from '../../game/data';
import { useGame } from '../../game/GameContext';
import { MINI_INFO, MINI_TYPES } from '../../game/events/mini';
import { formatMoney } from '../../game/helpers';
import {
  DIARY_TEXT_MAX,
  MOODS,
  STICKERS,
  claimMission,
  claimableCount,
  diarySummary,
  missionProgress,
  missionText,
  rewardText,
  todayMissions,
  writeDiary,
} from '../../game/missions';
import type { DiaryMood, GameState, Mission } from '../../game/types';
import HelpButton from '../kid/HelpButton';
import { tutorialUi, useTutorialUi } from '../kid/tutorialUi';
import type { NotebookTab } from '../kid/tutorialUi';
import { ProgressBar, colors } from '../ui';

const PAPER = '#FFFBF2';
const LINE = '#E7DCCB';
const MARGIN = '#F4B5B5';
const GOLD = '#E0A800';

const TABS: { id: NotebookTab; icon: string; label: string }[] = [
  { id: 'tasks', icon: '📋', label: 'Việc' },
  { id: 'diary', icon: '✍️', label: 'Nhật ký' },
  { id: 'bag', icon: '👛', label: 'Túi' },
];

/** Nút 📒 Sổ có chấm đỏ khi có thưởng chờ nhận. */
export function NotebookButton({ game, style, label = 'Sổ' }: { game: GameState; style?: object; label?: string }) {
  const n = claimableCount(game);
  return (
    <Pressable
      onPress={() => tutorialUi.openNotebook('tasks')}
      style={({ pressed }) => [styles.nbBtn, style, pressed && { transform: [{ translateY: 2 }] }]}
      accessibilityRole="button"
      accessibilityLabel={n ? `Sổ tay, ${n} phần thưởng chờ nhận` : 'Sổ tay chủ quán'}
    >
      <Text style={styles.nbIcon}>📒</Text>
      <Text style={styles.nbLabel} numberOfLines={1}>
        {label}
      </Text>
      {n > 0 && (
        <View style={styles.nbDot}>
          <Text style={styles.nbDotText}>{n}</Text>
        </View>
      )}
    </Pressable>
  );
}

function greeting(game: GameState) {
  const part = game.phase === 'summary' ? 'tối' : game.phase === 'open' ? ((game.run?.elapsed ?? 0) < 300_000 ? 'trưa' : 'chiều') : 'sáng';
  return `Chào buổi ${part}, ${game.profile.name || 'chủ quán'}!`;
}

/**
 * Sổ tay chủ quán (thiết kế 1c): giấy kẻ dòng, gáy lò xo, tab bên phải —
 * 📋 Việc hôm nay (nhiệm vụ + món đặc biệt), ✍️ Nhật ký, 👛 Túi (tiền, 🎟️ vé, ⭐ sao hy vọng).
 * Mở đè lên màn chơi (không phải Modal) để Chú Tư vẫn nói được ở trên; đang bán thì tạm dừng đồng hồ.
 */
export default function NotebookSheet() {
  const { game, act, paused, setPaused } = useGame();
  const ui = useTutorialUi();
  const tab = ui.notebook;
  const pausedByUs = useRef(false);
  useEffect(() => {
    if (tab && game?.phase === 'open' && !paused) {
      pausedByUs.current = true;
      setPaused(true);
    } else if (!tab && pausedByUs.current) {
      pausedByUs.current = false;
      setPaused(false);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!game || !tab) return null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.book}>
        {/* Gáy lò xo */}
        <View style={styles.spine} pointerEvents="none">
          {Array.from({ length: 14 }, (_, i) => (
            <View key={i} style={styles.ring} />
          ))}
        </View>
        <View style={styles.page}>
          <View style={styles.head}>
            <Text style={styles.title}>📒 Sổ tay chủ quán</Text>
            <Text style={styles.day}>Ngày {game.day}</Text>
            <HelpButton topic="notebook" autoOpen={false} style={styles.help} />
            <Pressable onPress={() => tutorialUi.closeNotebook()} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng sổ tay">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {tab === 'tasks' && <TasksPage game={game} act={act} />}
          {tab === 'diary' && <DiaryPage game={game} act={act} />}
          {tab === 'bag' && <BagPage game={game} />}
        </View>
        {/* Tab bên mép phải */}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => tutorialUi.openNotebook(t.id)}
              style={[styles.tab, tab === t.id && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              accessibilityLabel={t.label}
            >
              <Text style={styles.tabIcon}>{t.icon}</Text>
              <Text style={[styles.tabLabel, tab === t.id && { color: colors.brown }]}>{t.label}</Text>
              {t.id === 'tasks' && claimableCount(game) > 0 && <View style={styles.tabDot} />}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

type Act = ReturnType<typeof useGame>['act'];

// ================= 📋 Việc hôm nay =================

function TasksPage({ game, act }: { game: GameState; act: Act }) {
  const list = todayMissions(game);
  const special = game.missions?.day === game.day && game.missions.special ? RECIPES[game.missions.special] : null;
  const [pop, setPop] = useState<{ key: number; text: string } | null>(null);
  const scale = useRef(new Animated.Value(0)).current;
  const claim = (m: Mission) => {
    const trial = JSON.parse(JSON.stringify(game)) as GameState;
    const r = claimMission(trial, m.id);
    if (!r) return;
    act((s) => void claimMission(s, m.id));
    setPop({ key: Date.now(), text: `+ ${rewardText(r)}` });
    scale.setValue(0.3);
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    setTimeout(() => setPop((p) => (p && Date.now() - p.key >= 1700 ? null : p)), 1800);
  };
  const doneCount = list.filter((m) => m.claimed || missionProgress(game, m).done).length;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.hello}>{greeting(game)}</Text>
      <View style={styles.sectionRow}>
        <Text style={styles.section}>VIỆC HÔM NAY</Text>
        <Text style={styles.count}>
          {doneCount}/{list.length} ✓
        </Text>
      </View>
      {list.length === 0 && <Text style={styles.muted}>Sáng mai mới có việc mới nha.</Text>}
      {list.map((m) => (
        <MissionRow key={m.id} game={game} m={m} onClaim={() => claim(m)} />
      ))}
      {special && (
        <View style={styles.special} accessibilityLabel={`Món đặc biệt hôm nay: ${special.name}`}>
          <Text style={styles.specialTag}>🌟 MÓN ĐẶC BIỆT HÔM NAY</Text>
          <View style={styles.row}>
            <Text style={styles.specialEmoji}>{special.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.specialName}>{special.name}</Text>
              <Text style={styles.specialSub}>Bán món này: XP ×2 · nhiệm vụ 🌟 thưởng ×2</Text>
              <Text style={styles.specialSub}>Đã bán hôm nay: {game.today.specialServed} phần</Text>
            </View>
          </View>
        </View>
      )}
      {pop && (
        <Animated.View pointerEvents="none" style={[styles.pop, { transform: [{ scale }] }]}>
          <Text style={styles.popText}>{pop.text}</Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

function MissionRow({ game, m, onClaim }: { game: GameState; m: Mission; onClaim: () => void }) {
  const p = missionProgress(game, m);
  const t = missionText(m);
  const hard = m.tier === 'hard';
  const money = m.kind === 'profit';
  const endOfDay = (m.kind === 'noLost' || m.kind === 'profit') && game.phase !== 'summary';
  const check = m.claimed || p.done ? '✓' : p.failed ? '✗' : '';
  return (
    <View style={[styles.mission, hard && styles.missionHard, m.claimed && { opacity: 0.6 }]} accessibilityLabel={`${t.text}. ${Math.min(p.value, p.target)} trên ${p.target}`}>
      <View style={[styles.box, (m.claimed || p.done) && styles.boxDone, p.failed && styles.boxFail]}>
        <Text style={styles.boxText}>{check}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.row}>
          <Text style={[styles.mText, m.claimed && styles.strike]} numberOfLines={2}>
            {t.icon} {t.text}
          </Text>
          {hard && <Text style={styles.hardTag}>KHÓ</Text>}
          {m.kind === 'special' && <Text style={styles.x2Tag}>×2</Text>}
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <ProgressBar value={p.target ? Math.max(0, p.value) / p.target : 0} color={p.failed ? colors.bad : hard ? GOLD : colors.good} height={8} />
          </View>
          <Text style={styles.prog}>
            {money ? `${formatMoney(Math.max(0, p.value))}` : `${Math.min(p.value, p.target)}/${p.target}`}
          </Text>
        </View>
        <Text style={styles.reward}>
          {rewardText(m.reward)}
          {endOfDay ? ' · chốt lúc tổng kết' : ''}
          {p.failed ? ' · hôm nay lỡ rồi' : ''}
        </Text>
      </View>
      {!m.claimed && p.done && (
        <Pressable onPress={onClaim} style={({ pressed }) => [styles.claim, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button" accessibilityLabel={`Nhận thưởng: ${t.text}`}>
          <Text style={styles.claimText}>🎁 Nhận</Text>
        </Pressable>
      )}
    </View>
  );
}

// ================= ✍️ Nhật ký =================

function DiaryPage({ game, act }: { game: GameState; act: Act }) {
  const todayEntry = game.diary.find((d) => d.day === game.day);
  const days = [...new Set([...game.diary.map((d) => d.day).filter((d) => d !== game.day), game.day])].sort((a, b) => a - b);
  const [viewDay, setViewDay] = useState(game.day);
  const [mood, setMood] = useState<DiaryMood>(todayEntry?.mood ?? '🙂');
  const [stickers, setStickers] = useState<string[]>(todayEntry?.stickers ?? []);
  const [text, setText] = useState(todayEntry?.text ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const idx = days.indexOf(viewDay);
  const isToday = viewDay === game.day;
  const past = game.diary.find((d) => d.day === viewDay);

  const save = () => {
    const trial = JSON.parse(JSON.stringify(game)) as GameState;
    const first = writeDiary(trial, mood, text, stickers);
    act((s) => void writeDiary(s, mood, text, stickers));
    setSaved(first ? '📌 Đã lưu trang! +1 🎟️' : '📌 Đã lưu lại trang hôm nay');
  };
  const toggleSticker = (x: string) => setStickers((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : cur.length >= 5 ? cur : [...cur, x]));

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.pager}>
        <Pressable onPress={() => idx > 0 && setViewDay(days[idx - 1])} disabled={idx <= 0} style={[styles.pageBtn, idx <= 0 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Trang trước">
          <Text style={styles.pageBtnText}>◀</Text>
        </Pressable>
        <Text style={styles.pageTitle}>
          ✍️ Nhật ký · ngày {viewDay}
          {isToday ? ' (hôm nay)' : ''}
        </Text>
        <Pressable onPress={() => idx < days.length - 1 && setViewDay(days[idx + 1])} disabled={idx >= days.length - 1} style={[styles.pageBtn, idx >= days.length - 1 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Trang sau">
          <Text style={styles.pageBtnText}>▶</Text>
        </Pressable>
      </View>

      {!isToday && past ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.summary}>📊 {past.summary || '—'}</Text>
          <Text style={styles.bigMood}>
            {past.mood} {(past.stickers ?? []).join(' ')}
          </Text>
          <Lined>
            <Text style={styles.written}>{past.text || '(Không viết gì)'}</Text>
          </Lined>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={styles.summary}>📊 {diarySummary(game, game.day) || '—'}</Text>
          <Text style={styles.ask}>Hôm nay con thấy sao?</Text>
          <View style={styles.row}>
            {MOODS.map((m) => (
              <Pressable key={m} onPress={() => setMood(m)} style={[styles.mood, mood === m && styles.moodOn]} accessibilityRole="radio" accessibilityState={{ selected: mood === m }} accessibilityLabel={`Tâm trạng ${m}`}>
                <Text style={styles.moodText}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.ask}>Dán nhãn (tối đa 5)</Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {STICKERS.map((x) => (
              <Pressable key={x} onPress={() => toggleSticker(x)} style={[styles.sticker, stickers.includes(x) && styles.stickerOn]} accessibilityRole="checkbox" accessibilityState={{ checked: stickers.includes(x) }} accessibilityLabel={`Nhãn ${x}`}>
                <Text style={styles.stickerText}>{x}</Text>
              </Pressable>
            ))}
          </View>
          <Lined>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v.slice(0, DIARY_TEXT_MAX));
                setSaved(null);
              }}
              multiline
              maxLength={DIARY_TEXT_MAX}
              placeholder="Viết vài dòng về ngày hôm nay..."
              placeholderTextColor="#B8A58F"
              style={styles.input}
              accessibilityLabel="Viết nhật ký"
            />
          </Lined>
          <View style={styles.row}>
            <Text style={styles.counter}>
              {text.length}/{DIARY_TEXT_MAX}
            </Text>
            <Pressable onPress={save} style={({ pressed }) => [styles.save, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button" accessibilityLabel="Lưu trang nhật ký">
              <Text style={styles.saveText}>📌 Lưu trang{todayEntry ? '' : ' · +1 🎟️'}</Text>
            </Pressable>
          </View>
          {saved && <Text style={styles.saved}>{saved}</Text>}
          <Text style={styles.privacy}>🔒 Nhật ký chỉ lưu trong máy này.</Text>
        </View>
      )}
    </ScrollView>
  );
}

/** Nền giấy kẻ dòng. */
function Lined({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.lined}>
      <View style={styles.marginLine} pointerEvents="none" />
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} pointerEvents="none" style={[styles.hline, { top: 30 + i * 28 }]} />
      ))}
      {children}
    </View>
  );
}

// ================= 👛 Túi =================

function BagPage({ game }: { game: GameState }) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.section}>TÚI CỦA CHỦ QUÁN</Text>
      <View style={styles.wallet}>
        <Coin icon="💰" label="Tiền" value={formatMoney(game.money)} />
        <Coin icon="🎟️" label="Vé thưởng" value={String(game.tickets)} />
        <Coin icon="⭐" label="Sao hy vọng" value={String(game.hopeStars)} />
      </View>
      <Text style={styles.muted}>🎟️ Vé có khi làm xong việc hôm nay và khi viết nhật ký. ⭐ Sao chỉ có ở việc KHÓ.</Text>
      <Text style={styles.section}>🏆 KỶ LỤC MINI GAME</Text>
      <View style={styles.records}>
        {MINI_TYPES.map((t) => {
          const best = game.miniBest?.[t];
          return (
            <View key={t} style={styles.record} accessibilityLabel={`${MINI_INFO[t].name}: ${best === undefined ? 'chưa chơi' : `${Math.round(best * 100)} điểm`}`}>
              <Text style={styles.recordIcon}>{best === undefined ? '🔒' : MINI_INFO[t].emoji}</Text>
              <Text style={styles.recordName} numberOfLines={1}>
                {MINI_INFO[t].name}
              </Text>
              <Text style={styles.recordScore}>{best === undefined ? '—' : `${Math.round(best * 100)}`}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.soon}>
        <Text style={styles.soonIcon}>🪑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.soonTitle}>Cửa hàng nội thất</Text>
          <Text style={styles.soonSub}>Dùng 🎟️ vé mua bàn ghế, đèn lồng, chậu cây trang trí quán.</Text>
        </View>
        <Text style={styles.soonTag}>SẮP MỞ</Text>
      </View>
      <View style={styles.soon}>
        <Text style={styles.soonIcon}>🎰</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.soonTitle}>Vòng quay may mắn</Text>
          <Text style={styles.soonSub}>Dùng ⭐ sao hy vọng quay ra đồ hiếm.</Text>
        </View>
        <Text style={styles.soonTag}>SẮP MỞ</Text>
      </View>
    </ScrollView>
  );
}

function Coin({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.coin} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.coinIcon}>{icon}</Text>
      <Text style={styles.coinValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.coinLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  records: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  record: { width: '31%', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: LINE, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 2 },
  recordIcon: { fontSize: 22 },
  recordName: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  recordScore: { fontSize: 15, fontWeight: '900', color: colors.text },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(40,25,15,0.45)', padding: 8, paddingTop: 10, justifyContent: 'center' },
  book: { flex: 1, maxHeight: 760, flexDirection: 'row', maxWidth: 640, width: '100%', alignSelf: 'center' },
  spine: { width: 16, paddingVertical: 18, justifyContent: 'space-between', alignItems: 'center', zIndex: 2, marginRight: -8 },
  ring: { width: 16, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#8D8D8D', backgroundColor: '#DADADA' },
  page: { flex: 1, backgroundColor: PAPER, borderRadius: 18, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 6, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 2, borderColor: LINE, backgroundColor: '#FFF3DC' },
  title: { fontSize: 17, fontWeight: '900', color: colors.brown },
  day: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.muted },
  help: { width: 34, height: 34, borderRadius: 17 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.cream, fontSize: 16, fontWeight: '900' },
  tabs: { width: 54, paddingTop: 50, gap: 8, marginLeft: -4 },
  tab: { backgroundColor: '#F1E1C8', borderTopRightRadius: 14, borderBottomRightRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 2, borderLeftWidth: 0, borderColor: colors.chunkyShadow },
  tabOn: { backgroundColor: PAPER, marginLeft: -6, paddingLeft: 6 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '900', color: colors.muted },
  tabDot: { position: 'absolute', top: 4, right: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bad },
  body: { padding: 14, paddingLeft: 18, gap: 10, paddingBottom: 30 },
  hello: { fontSize: 20, fontWeight: '900', color: colors.brown },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 13, fontWeight: '900', color: colors.primaryDark, letterSpacing: 1 },
  count: { fontSize: 13, fontWeight: '900', color: colors.good },
  muted: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mission: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: LINE },
  missionHard: { borderWidth: 2, borderColor: GOLD, borderRadius: 14, backgroundColor: '#FFF8DC' },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.brown, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxDone: { backgroundColor: colors.good, borderColor: colors.good },
  boxFail: { backgroundColor: colors.badBg, borderColor: colors.bad },
  boxText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  mText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.brown },
  strike: { textDecorationLine: 'line-through' },
  hardTag: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  x2Tag: { fontSize: 11, fontWeight: '900', color: '#fff', backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  prog: { minWidth: 44, textAlign: 'right', fontSize: 12, fontWeight: '900', color: colors.brown, fontVariant: ['tabular-nums'] },
  reward: { fontSize: 12, fontWeight: '700', color: colors.muted },
  claim: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 4, borderColor: colors.primaryDark },
  claimText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  special: { marginTop: 6, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: '#FFF1E0', padding: 10, gap: 4 },
  specialTag: { fontSize: 12, fontWeight: '900', color: colors.primaryDark, letterSpacing: 1 },
  specialEmoji: { fontSize: 40 },
  specialName: { fontSize: 17, fontWeight: '900', color: colors.brown },
  specialSub: { fontSize: 12, fontWeight: '700', color: colors.muted },
  pop: { position: 'absolute', alignSelf: 'center', top: 40, backgroundColor: colors.brown, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  popText: { color: '#FFE082', fontSize: 17, fontWeight: '900' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.chunkyShadow, alignItems: 'center', justifyContent: 'center' },
  pageBtnText: { fontSize: 14, color: colors.brown, fontWeight: '900' },
  pageTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '900', color: colors.brown },
  summary: { fontSize: 13, fontWeight: '800', color: colors.primaryDark, backgroundColor: '#FFF3DC', borderRadius: 10, padding: 8, overflow: 'hidden' },
  ask: { fontSize: 14, fontWeight: '900', color: colors.brown },
  mood: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: LINE },
  moodOn: { borderColor: colors.primary, backgroundColor: '#FFE0B2', transform: [{ scale: 1.08 }] },
  moodText: { fontSize: 26 },
  bigMood: { fontSize: 30 },
  sticker: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: LINE, borderStyle: 'dashed' },
  stickerOn: { borderStyle: 'solid', borderColor: colors.accent, backgroundColor: '#FFF8E1', transform: [{ rotate: '-6deg' }] },
  stickerText: { fontSize: 22 },
  lined: { minHeight: 230, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: LINE, overflow: 'hidden' },
  marginLine: { position: 'absolute', left: 30, top: 0, bottom: 0, width: 2, backgroundColor: MARGIN },
  hline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: LINE },
  input: { minHeight: 226, paddingLeft: 38, paddingRight: 10, paddingTop: 6, fontSize: 16, lineHeight: 28, color: colors.brown, textAlignVertical: 'top' },
  written: { paddingLeft: 38, paddingRight: 10, paddingTop: 6, fontSize: 16, lineHeight: 28, color: colors.brown },
  counter: { flex: 1, fontSize: 12, fontWeight: '800', color: colors.muted },
  save: { backgroundColor: colors.good, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 4, borderColor: '#1B5E20' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  saved: { fontSize: 14, fontWeight: '900', color: colors.good },
  privacy: { fontSize: 11, color: colors.muted },
  wallet: { flexDirection: 'row', gap: 8 },
  coin: { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: colors.chunkyShadow, borderBottomWidth: 4, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 2 },
  coinIcon: { fontSize: 28 },
  coinValue: { fontSize: 14, fontWeight: '900', color: colors.brown },
  coinLabel: { fontSize: 11, fontWeight: '800', color: colors.muted },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6EEE2', borderRadius: 16, padding: 10, borderWidth: 2, borderColor: LINE, borderStyle: 'dashed' },
  soonIcon: { fontSize: 30 },
  soonTitle: { fontSize: 15, fontWeight: '900', color: colors.brown },
  soonSub: { fontSize: 12, fontWeight: '600', color: colors.muted },
  soonTag: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: colors.muted, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  nbBtn: { alignItems: 'center', justifyContent: 'center' },
  nbIcon: { fontSize: 20 },
  nbLabel: { fontSize: 12, fontWeight: '900', color: colors.brown },
  nbDot: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.bad, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#fff' },
  nbDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
