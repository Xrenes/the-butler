import { useEffect, useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from "react-native";
import { useTheme } from "../theme";
import { tap } from "../ui";

const ITEM = 44;
const VISIBLE = 3;

interface TimeWheelProps {
  values: readonly number[];
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  accent: string;
}

/** A scrolling wheel that snaps to one value at a time; the middle row is the chosen one. */
export function TimeWheel({ values, value, format, onChange, accent }: TimeWheelProps) {
  const t = useTheme();
  const ref = useRef<ScrollViewInstance>(null);
  const index = Math.max(0, values.indexOf(value));
  const last = useRef(index);

  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM, animated: false }), 0);
    return () => clearTimeout(id);
    // Only position the wheel when it first appears; later changes come from the wheel itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.y / ITEM);
    const clamped = Math.max(0, Math.min(values.length - 1, next));
    if (clamped !== last.current) {
      last.current = clamped;
      tap();
      onChange(values[clamped]);
    }
  };

  return (
    <View style={{ height: ITEM * VISIBLE, width: 72 }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM,
          left: 0,
          right: 0,
          height: ITEM,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: accent,
          backgroundColor: t.surface2,
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        nestedScrollEnabled
        onScroll={settle}
        scrollEventThrottle={32}
        onMomentumScrollEnd={settle}
        contentContainerStyle={{ paddingVertical: ITEM }}
      >
        {values.map((item) => (
          <View key={item} style={{ height: ITEM, alignItems: "center", justifyContent: "center" }}>
            <Text
              style={{
                color: item === value ? t.fg : t.fg3,
                fontSize: item === value ? 24 : 18,
                fontWeight: item === value ? "600" : "400",
                fontVariant: ["tabular-nums"],
              }}
            >
              {format(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
