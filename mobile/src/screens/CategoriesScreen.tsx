import { Pressable, ScrollView, Text, View } from "react-native";
import { dayKeyOf, formatDayMonth, formatTime } from "@domain/dates";
import { completedPerDay } from "@domain/progress";
import { categoryView } from "@domain/tasks";
import type { Category, MarkedStatus, Task } from "@domain/types";
import { StatusRow } from "../rows";
import { TIME_ZONE, useStore } from "../store";
import { STATUS_HEX, STATUS_LABEL, readableOn, useTheme } from "../theme";
import { Card, Chip, DotMatrix, EmptyState, Muted, SectionTitle, StatTile, StatusSquare, Title, categoryIcon, tap } from "../ui";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

const HISTORY_PAGE = 12;
const HISTORY_DAYS = 56;

/** Horizontal strip of categories; the chosen one is large and filled. */
function CategoryStrip({ categories, index, onIndex }: { categories: readonly Category[]; index: number; onIndex: (index: number) => void }) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, alignItems: "center", paddingVertical: 16, paddingHorizontal: 16 }}
      style={{ backgroundColor: t.well, borderRadius: 28, borderWidth: 1, borderColor: t.edge }}
    >
      {categories.map((category, position) => {
        const active = position === index;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onIndex(position);
            }}
            style={{
              width: active ? 84 : 52,
              height: active ? 84 : 52,
              borderRadius: active ? 42 : 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? category.color : t.surface2,
              borderWidth: 1,
              borderColor: active ? category.color : t.edge,
              shadowColor: category.color,
              shadowOpacity: active ? 0.55 : 0,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Ionicons
              name={categoryIcon(category.icon)}
              size={active ? 34 : 22}
              color={active ? readableOn(category.color) : category.color}
            />
          </Pressable>
        );
      })}
    </ScrollView>
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
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  if (categories.length === 0) {
    return <EmptyState icon="grid-outline" title="No categories yet" />;
  }

  const safeIndex = ((index % categories.length) + categories.length) % categories.length;
  const category = categories[safeIndex];
  const view = categoryView(state.tasks, category.id, now);
  const today = dayKeyOf(now, TIME_ZONE);
  const when = (task: Task) => {
    const day = dayKeyOf(new Date(task.dueAt), TIME_ZONE);
    return day === today ? formatTime(new Date(task.dueAt), TIME_ZONE) : formatDayMonth(day);
  };
  const stats: readonly (readonly [MarkedStatus, number])[] = [
    ["C", view.stats.done],
    ["H", view.stats.hold],
    ["NC", view.stats.missed],
  ];
  const history = view.history.slice(0, historyLimit);

  return (
    <View style={{ gap: 24 }}>
      <Title>Categories</Title>
      <CategoryStrip categories={categories} index={safeIndex} onIndex={onIndex} />

      <View style={{ alignItems: "center", gap: 2 }}>
        <Text style={{ color: t.fg, fontSize: 26, fontWeight: "600", letterSpacing: -0.5 }}>{category.name}</Text>
        <Muted>
          {view.upcoming.length} upcoming · {view.history.length} in history
        </Muted>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {stats.map(([status, value]) => (
          <StatTile
            key={status}
            color={STATUS_HEX[status]}
            leading={<StatusSquare status={status} size={14} />}
            label={STATUS_LABEL[status]}
            value={value}
          />
        ))}
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
              <StatusRow key={task.id} task={task} category={category} meta={when(task)} onStatus={() => onStatus(task)} onEdit={() => onEdit(task)} />
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
                meta={when(task)}
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

      <Card>
        <SectionTitle>Completed in {category.name}</SectionTitle>
        <DotMatrix
          counts={completedPerDay(
            state.tasks.filter((task) => task.categoryId === category.id),
            today,
            HISTORY_DAYS,
            TIME_ZONE,
          )}
        />
      </Card>
    </View>
  );
}
