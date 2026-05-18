import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Input } from "@/components/ui/Input";

export function SearchInput({
  leftAdornment,
  placeholder = "Try bicycle, books, guitar...",
  ...rest
}: ComponentProps<typeof Input>) {
  const { theme } = useAppTheme();

  return (
    <Input
      placeholder={placeholder}
      leftAdornment={
        leftAdornment ?? (
          <Feather name="search" size={18} color={theme.colors.textMuted} />
        )
      }
      {...rest}
    />
  );
}
