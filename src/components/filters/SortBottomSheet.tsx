import { useAppTheme } from "@/hooks/useAppTheme";
import { FloatingModal } from "@/components/ui/FloatingModal";
import type { ContextMenuAnchor } from "@/components/ui/AnchoredContextMenu";
import { OptionPillMenu } from "./OptionPillMenu";

export type SortOrder = "nearest" | "newest" | "oldest";

interface SortBottomSheetProps {
  visible: boolean;
  anchor?: ContextMenuAnchor | null;
  value: SortOrder;
  onClose: () => void;
  onChange: (value: SortOrder) => void | Promise<void>;
  canUseNearest?: boolean;
  title?: string;
}

export function SortBottomSheet({
  visible,
  anchor,
  value,
  onClose,
  onChange,
  canUseNearest = true,
  title = "Sort by",
}: SortBottomSheetProps) {
  const { theme } = useAppTheme();

  return (
    <FloatingModal visible={visible} title={title} onClose={onClose} anchor={anchor}>
      <OptionPillMenu
        items={[
          { key: "nearest", label: "Nearest first", value: "nearest", disabled: !canUseNearest },
          { key: "newest", label: "Newest first", value: "newest" },
          { key: "oldest", label: "Oldest first", value: "oldest" },
        ]}
        selectedValue={value}
        onSelect={(nextSort: string) => {
          void onChange(nextSort as SortOrder);
          onClose();
        }}
      />
    </FloatingModal>
  );
}

