import { Ionicons } from "@expo/vector-icons";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { dayKeyOf, formatDayLabel, formatTime } from "@domain/dates";
import { categoryView } from "@domain/tasks";
import type { Category, MarkedStatus, Task } from "@domain/types";
import { CategoryEditor } from "../editors/CategoryEditor";
import { StatusRow } from "../rows";
import { TIME_ZONE, useStore } from "../store";
import { STATUS_LABEL, readableOn, useTheme } from "../theme";
import { Card, Chip, EmptyState, SectionTitle, StatusSquare, Title, categoryIcon, tap } from "../ui";

const HISTORY_PAGE = 12;
/** Five positions on screen: the centre one, two beside it, two at the edges. */
const VISIBLE = 5;
const SIDE_SLOTS = 2;
const MAX_CIRCLE = 84;
/** Corner radius as a share of the tile size: a rounded square, not a circle. */
const TILE_RADIUS = 0.28;
const SCREEN_PADDING = 20;
const OFFSETS = [-2, -1, 0, 1, 2];
const SCALES = [0.5, 0.72, 1, 0.72, 0.5];
const OPACITIES = [0.45, 0.8, 1, 0.8, 0.45];

interface CarouselProps {
  categories: readonly Category[];
  index: number;
  onIndex: (index: number) => void;
  onAdd: () => void;
}

/**
 * Swipeable category wheel of rounded squares: the centre tile is largest and filled, the two
 * beside it smaller, the two at the edges smaller still. A "+" tile at the end adds a category.
 */
function CategoryCarousel({ categories, index, onIndex, onAdd }: CarouselProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const itemWidth = width / VISIBLE;
  const tile = Math.min(itemWidth * 0.92, MAX_CIRCLE);
  const radius = tile * TILE_RADIUS;
  const [scrollX] = useState(() => new Animated.Value(index * itemWidth));
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const addPosition = categories.length;

  // Keep the chosen category centred when it changes from outside (e.g. right after adding one).
  useEffect(() => {
    listRef.current?.scrollTo({ x: index * itemWidth, animated: true });
  }, [index, itemWidth]);

  const settle = (offsetX: number) => {
    const next = Math.max(0, Math.min(addPosition, Math.round(offsetX / itemWidth)));
    if (next === addPosition) {
      // Landing on "+" opens the new-category sheet and slides back to the current category.
      listRef.current?.scrollTo({ x: index * itemWidth, animated: true });
      tap();
      onAdd();
      return;
    }
    if (next !== index) {
      tap();
      onIndex(next);
    }
  };

  const sizing = (position: number) => {
    const inputRange = OFFSETS.map((offset) => (position + offset) * itemWidth);
    return {
      scale: scrollX.interpolate({ inputRange, outputRange: SCALES, extrapolate: "clamp" }),
      opacity: scrollX.interpolate({ inputRange, outputRange: OPACITIES, extrapolate: "clamp" }),
      fill: scrollX.interpolate({ inputRange: inputRange.slice(1, 4), outputRange: [0, 1, 0], extrapolate: "clamp" }),
    };
  };
  const addSizing = sizing(addPosition);

  return (
    <Animated.ScrollView
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={itemWidth}
      decelerationRate="fast"
      contentOffset={{ x: index * itemWidth, y: 0 }}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
      onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
      contentContainerStyle={{ paddingHorizontal: itemWidth * SIDE_SLOTS, alignItems: "center" }}
      style={{ marginHorizontal: -SCREEN_PADDING, flexGrow: 0 }}
    >
      {categories.map((category, position) => {
        const { scale, opacity, fill } = sizing(position);
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityState={{ selected: position === index }}
            onPress={() => {
              listRef.current?.scrollTo({ x: position * itemWidth, animated: true });
              if (position !== index) {
                tap();
                onIndex(position);
              }
            }}
            style={{ width: itemWidth, height: tile + 28, alignItems: "center", justifyContent: "center" }}
          >
            <Animated.View
              style={{
                width: tile,
                height: tile,
                borderRadius: radius,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.surface2,
                borderWidth: 1,
                borderColor: t.edge,
                opacity,
                transform: [{ scale }],
              }}
            >
              <Ionicons name={categoryIcon(category.icon)} size={Math.round(tile * 0.42)} color={category.color} />
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: radius, backgroundColor: category.color, alignItems: "center", justifyContent: "center", opacity: fill },
                ]}
              >
                <Ionicons name={categoryIcon(category.icon)} size={Math.round(tile * 0.42)} color={readableOn(category.color)} />
              </Animated.View>
            </Animated.View>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New category"
        onPress={() => {
          tap();
          onAdd();
        }}
        style={{ width: itemWidth, height: tile + 28, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View
          style={{
            width: tile,
            height: tile,
            borderRadius: radius,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: t.fg3,
            opacity: addSizing.opacity,
            transform: [{ scale: addSizing.scale }],
          }}
        >
          <Ionicons name="add" size={Math.round(tile * 0.45)} color={t.fg2} />
        </Animated.View>
      </Pressable>
    </Animated.ScrollView>
  );
}

interface CategoriesScreenProps {
  now: Date;
  index: number;
  onIndex: (index: number) => void;
  onStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onRepeat: (task: Task) => void;
}

export function CategoriesScreen({ now, index, onIndex, onStatus, onEdit, onRepeat }: CategoriesScreenProps) {
  const t = useTheme();
  const { state } = useStore();
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const [adding, setAdding] = useState({ open: false, nonce: 0 });
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  const openAdd = () => setAdding((current) => ({ open: true, nonce: current.nonce + 1 }));
  const closeAdd = () => setAdding((current) => ({ ...current, open: false }));
  if (categories.length === 0) {
    return <EmptyState icon="grid-outline" title="No categories yet" />;
  }

  const safeIndex = Math.max(0, Math.min(categories.length - 1, index));
  const category = categories[safeIndex];
  const view = categoryView(state.tasks, category.id, now);
  const today = dayKeyOf(now, TIME_ZONE);
  const dateOf = (task: Task) => formatDayLabel(dayKeyOf(new Date(task.dueAt), TIME_ZONE), today);
  const timeOf = (task: Task) => formatTime(new Date(task.dueAt), TIME_ZONE);
  const stats: readonly (readonly [MarkedStatus, number])[] = [
    ["C", view.stats.done],
    ["H", view.stats.hold],
    ["NC", view.stats.missed],
  ];
  const history = view.history.slice(0, historyLimit);

  return (
    <View style={{ gap: 22 }}>
      <Title>Categories</Title>
      <CategoryCarousel categories={categories} index={safeIndex} onIndex={onIndex} onAdd={openAdd} />
      {/* A new category is added at the end, so it becomes the last position in the wheel. */}
      <CategoryEditor open={adding.open} nonce={adding.nonce} onClose={closeAdd} onCreated={() => onIndex(categories.length)} />

      <View style={{ alignItems: "center", gap: 14, marginTop: -6 }}>
        <Text style={{ color: t.fg, fontSize: 26, fontWeight: "600", letterSpacing: -0.5 }}>{category.name}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {stats.map(([status, value]) => (
            <View
              key={status}
              accessible
              accessibilityLabel={`${STATUS_LABEL[status]}: ${value}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: t.edge, backgroundColor: t.surface }}
            >
              <StatusSquare status={status} size={20} />
              <Text style={{ color: t.fg, fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Upcoming</SectionTitle>
        {view.upcoming.length === 0 ? (
          <Card>
            <EmptyState icon="calendar-outline" title="Nothing scheduled" hint="Tap + to add a task." />
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {view.upcoming.map((task) => (
              <StatusRow
                key={task.id}
                task={task}
                category={category}
                meta={dateOf(task)}
                metaSub={timeOf(task)}
                onStatus={() => onStatus(task)}
                onEdit={() => onEdit(task)}
              />
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionTitle>History</SectionTitle>
        {history.length === 0 ? (
          <Card>
            <EmptyState icon="time-outline" title="No history yet" />
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {history.map((task) => (
              <StatusRow
                key={task.id}
                task={task}
                category={category}
                meta={dateOf(task)}
                metaSub={timeOf(task)}
                onStatus={() => onStatus(task)}
                onEdit={() => onEdit(task)}
                onRepeat={() => onRepeat(task)}
              />
            ))}
          </View>
        )}
        {view.history.length > historyLimit ? (
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <Chip onPress={() => setHistoryLimit((limit) => limit + HISTORY_PAGE)}>Show more</Chip>
          </View>
        ) : null}
      </View>
    </View>
  );
}
