type EntityWithId = { id: string };

export type EntityRecord<T extends EntityWithId> = Record<string, T>;

export function upsertMany<T extends EntityWithId>(
  current: EntityRecord<T>,
  entities: T[],
): EntityRecord<T> {
  if (!entities.length) {
    return current;
  }

  const next = { ...current };
  for (const entity of entities) {
    next[entity.id] = entity;
  }

  return next;
}

export function upsertOne<T extends EntityWithId>(
  current: EntityRecord<T>,
  entity: T,
): EntityRecord<T> {
  return {
    ...current,
    [entity.id]: entity,
  };
}

export function patchOne<T extends EntityWithId>(
  current: EntityRecord<T>,
  id: string,
  patch: Partial<T>,
): EntityRecord<T> {
  const existing = current[id];
  if (!existing) {
    return current;
  }

  return {
    ...current,
    [id]: {
      ...existing,
      ...patch,
    },
  };
}

export function removeOne<T extends EntityWithId>(
  current: EntityRecord<T>,
  id: string,
): EntityRecord<T> {
  if (!current[id]) {
    return current;
  }

  const next = { ...current };
  delete next[id];
  return next;
}
