import { CREATE_LISTING_RULES } from "@barter/types";
import { StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ListingTextFieldsProps {
  title: string;
  description: string;
  titleError?: string | null;
  descriptionError?: string | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function ListingTextFields({
  title,
  description,
  titleError,
  descriptionError,
  onTitleChange,
  onDescriptionChange,
}: ListingTextFieldsProps) {
  const { theme } = useAppTheme();

  return (
    <>
      <View style={styles.fieldGroup}>
        <Input
          label="Title"
          placeholder="e.g., Mountain bike in good condition"
          value={title}
          onChangeText={onTitleChange}
          error={titleError ?? null}
          maxLength={CREATE_LISTING_RULES.MAX_TITLE_LENGTH}
        />
        <Text style={[styles.counterText, { color: theme.colors.textMuted }]}>
          {title.length}/{CREATE_LISTING_RULES.MAX_TITLE_LENGTH}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Input
          label="Description"
          placeholder="Add details about condition, usage, and expectations."
          value={description}
          onChangeText={onDescriptionChange}
          error={descriptionError ?? null}
          maxLength={CREATE_LISTING_RULES.MAX_DESCRIPTION_LENGTH}
          multiline
          textAlignVertical="top"
          style={styles.descriptionInput}
        />
        <Text style={[styles.counterText, { color: theme.colors.textMuted }]}>
          {description.length}/{CREATE_LISTING_RULES.MAX_DESCRIPTION_LENGTH}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: 4 },
  counterText: {
    fontSize: 12,
    textAlign: "right",
  },
  descriptionInput: {
    minHeight: 132,
    paddingTop: 14,
    paddingBottom: 14,
  },
});