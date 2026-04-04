import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, type EmitterSubscription, type KeyboardEvent } from "react-native";

export interface KeyboardMetrics {
  isVisible: boolean;
  height: number;
  animationDuration: number;
}

const DEFAULT_DURATION_MS = 250;

function getKeyboardHeight(event?: KeyboardEvent): number {
  const next = event?.endCoordinates?.height;
  return typeof next === "number" && next > 0 ? next : 0;
}

export function useKeyboardMetrics(): KeyboardMetrics {
  const [isVisible, setIsVisible] = useState(false);
  const [height, setHeight] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(DEFAULT_DURATION_MS);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const onShow = (event: KeyboardEvent) => {
      if (!isMountedRef.current) return;
      setIsVisible(true);
      setHeight(getKeyboardHeight(event));
      setAnimationDuration(event.duration ?? DEFAULT_DURATION_MS);
    };

    const onFrameChange = (event: KeyboardEvent) => {
      if (!isMountedRef.current) return;
      setIsVisible(true);
      setHeight(getKeyboardHeight(event));
      setAnimationDuration(event.duration ?? DEFAULT_DURATION_MS);
    };

    const onHide = (event?: KeyboardEvent) => {
      if (!isMountedRef.current) return;
      setIsVisible(false);
      setHeight(0);
      setAnimationDuration(event?.duration ?? DEFAULT_DURATION_MS);
    };

    const listeners: EmitterSubscription[] = [];

    if (Platform.OS === "ios") {
      listeners.push(Keyboard.addListener("keyboardWillShow", onShow));
      listeners.push(Keyboard.addListener("keyboardWillChangeFrame", onFrameChange));
      listeners.push(Keyboard.addListener("keyboardWillHide", onHide));
    } else {
      listeners.push(Keyboard.addListener("keyboardDidShow", onShow));
      listeners.push(Keyboard.addListener("keyboardDidHide", onHide));
    }

    return () => {
      isMountedRef.current = false;
      listeners.forEach((listener) => listener.remove());
    };
  }, []);

  return useMemo(
    () => ({
      isVisible,
      height,
      animationDuration,
    }),
    [animationDuration, height, isVisible],
  );
}