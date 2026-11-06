import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CATEGORY_COLORS } from "@domain/defaults";
import { CATEGORY_ICONS, type Category, type CategoryIcon } from "@domain/types";
import { newId, useStore } from "../store";
import { readableOn, useTheme } from "../theme";
import { GhostButton, PrimaryButton, Sheet, Well, categoryIcon, tap } from "../ui";

const MAX_NAME_LENGTH = 32;
const PREVIEW = 72;
const SWATCH = 38;
const ICON_TILE = 50;

interface CategoryEditorProps {
  open: boolean;
  nonce: number;
  onClose: () => void;
  onCreated: (category: Category) => void;
}

/** Sheet for adding a category: name, colour and icon, with a live preview tile. */
export function CategoryEditor({ open, nonce, onClose, onCreated }: CategoryEditorProps) {
  return (
    <Sheet open={open} title="New category" onClose={onClose}>
      {open ? <CategoryForm key={nonce} onClose={onClose} onCreated={onCreated} /> : null}
    </Sheet>
  );
}

function CategoryForm({ onClose, onCreated }: { onClose: () => void; onCreated: (category: Category) => void }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState<CategoryIcon>("star");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the category a name.");
      return;
    }
    if (state.categories.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("You already have a category with that name.");
      return;
    }
    const order = Math.max(-1, ...state.categories.map((item) => item.order)) + 1;
    const category: Category = { kind: "category", id: newId(), name: trimmed, color, icon, order, createdAt: new Date().toISOString() };
    dispatch({ type: "category/save", category });
    onCreated(category);
    onClose();
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: PREVIEW, height: PREVIEW, borderRadius: PREVIEW * 0.3, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={categoryIcon(icon)} size={PREVIEW * 0.45} color={readableOn(color)} />
        </View>
      </View>

      <Well style={{ padding: 14 }}>
        <TextInput
          value={name}
          onChangeText={(next) => {
            setName(next);
            setError(null);
          }}
          placeholder="Category name"
          placeholderTextColor={t.fg3}
          maxLength={MAX_NAME_LENGTH}
          accessibilityLabel="Category name"
          selectionColor={color}
          style={{ color: t.fg, fontSize: 20, fontWeight: "500", padding: 0 }}
        />
      </Well>

      <View style={{ gap: 8 }}>
        <Text style={{ color: t.fg2, fontSize: 12 }}>Colour</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {CATEGORY_COLORS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${option}`}
              accessibilityState={{ checked: option === color }}
              onPress={() => {
                tap();
                setColor(option);
              }}
              style={{
                width: SWATCH,
                height: SWATCH,
                borderRadius: SWATCH * 0.3,
                backgroundColor: option,
                borderWidth: option === color ? 3 : 1,
                borderColor: option === color ? t.fg : t.edge,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: t.fg2, fontSize: 12 }}>Icon</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {CATEGORY_ICONS.map((option) => {
            const active = option === icon;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={option}
                accessibilityState={{ checked: active }}
                onPress={() => {
                  tap();
                  setIcon(option);
                }}
                style={{
                  width: ICON_TILE,
                  height: ICON_TILE,
                  borderRadius: ICON_TILE * 0.3,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? color : t.surface,
                  borderWidth: 1,
                  borderColor: active ? color : t.edge,
                }}
              >
                <Ionicons name={categoryIcon(option)} size={22} color={active ? readableOn(color) : t.fg2} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={{ color: t.accent, fontSize: 14 }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <GhostButton onPress={onClose}>Cancel</GhostButton>
        <PrimaryButton color={color} onPress={save}>
          Add category
        </PrimaryButton>
      </View>
    </View>
  );
}
