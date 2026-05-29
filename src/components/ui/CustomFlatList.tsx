import { forwardRef } from "react";
import { FlatList as RNFlatList, type FlatListProps } from "react-native";

export const CustomFlatList = forwardRef<RNFlatList<unknown>, FlatListProps<unknown>>((props, ref) => (
  <RNFlatList
    showsHorizontalScrollIndicator={false}
    showsVerticalScrollIndicator={false}
    {...props}
    ref={ref}
  />
)) as <T>(props: FlatListProps<T> & { ref?: React.Ref<RNFlatList<T>> }) => React.ReactElement;

(CustomFlatList as unknown as { displayName: string }).displayName = "CustomFlatList";