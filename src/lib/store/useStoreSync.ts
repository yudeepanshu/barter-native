import { useEffect } from "react";

export function useSyncEntityList<T>(entities: T[] | undefined, sync: (items: T[]) => void) {
  useEffect(() => {
    if (!entities || entities.length === 0) {
      return;
    }

    sync(entities);
  }, [entities, sync]);
}

export function useSyncEntity<T>(entity: T | null | undefined, sync: (item: T) => void) {
  useEffect(() => {
    if (!entity) {
      return;
    }

    sync(entity);
  }, [entity, sync]);
}

export function useSyncNullableEntity<T>(
  entity: T | null | undefined,
  sync: (item: T | null) => void,
) {
  useEffect(() => {
    sync(entity ?? null);
  }, [entity, sync]);
}

export function useSyncValue<T>(value: T, sync: (next: T) => void) {
  useEffect(() => {
    sync(value);
  }, [value, sync]);
}
