import { forwardRef } from "react";
import { ScrollView as RNScrollView, type ScrollViewProps } from "react-native";

export const CustomScrollView = forwardRef<RNScrollView, ScrollViewProps>((props, ref) => (
  <RNScrollView
    showsHorizontalScrollIndicator={false}
    showsVerticalScrollIndicator={false}
    {...props}
    ref={ref}
  />
));

CustomScrollView.displayName = "CustomScrollView";