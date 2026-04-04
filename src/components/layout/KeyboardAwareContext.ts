import { createContext, useContext } from "react";
import type { TextInput } from "react-native";

export interface KeyboardAwareContextValue {
  notifyInputFocused: (input: TextInput | null) => void;
}

export const KeyboardAwareContext = createContext<KeyboardAwareContextValue | null>(null);

export function useKeyboardAwareInput() {
  return useContext(KeyboardAwareContext);
}