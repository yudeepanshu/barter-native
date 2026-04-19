import * as FileSystem from "expo-file-system";
import type { Category, ProductSummary, RequestSummary } from "@barter/types";

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const SNAPSHOT_STORAGE_ROOT = FileSystem.Paths.document.uri || FileSystem.Paths.cache.uri || "";
const SNAPSHOT_BASE_DIR = `${SNAPSHOT_STORAGE_ROOT}startup-feed`;
const SNAPSHOT_MAX_ITEMS = 60;
const CATEGORIES_SNAPSHOT_MAX_ITEMS = 80;
const SENT_REQUESTS_SNAPSHOT_MAX_ITEMS = 80;
const SNAPSHOT_WRITE_THROTTLE_MS = 30_000;

const lastSnapshotWriteByKey = new Map<string, { writtenAt: number; signature: string }>();

interface FeedSnapshotPayload {
  version: number;
  userId: string;
  savedAt: number;
  items: ProductSummary[];
}

interface CategoriesSnapshotPayload {
  version: number;
  userId: string;
  savedAt: number;
  items: Category[];
}

interface SentRequestsSnapshotPayload {
  version: number;
  userId: string;
  savedAt: number;
  items: RequestSummary[];
}

function getSnapshotPath(userId: string) {
  return `${SNAPSHOT_BASE_DIR}/${encodeURIComponent(userId)}.json`;
}

function getCategoriesSnapshotPath(userId: string) {
  return `${SNAPSHOT_BASE_DIR}/${encodeURIComponent(userId)}-categories.json`;
}

function getSentRequestsSnapshotPath(userId: string) {
  return `${SNAPSHOT_BASE_DIR}/${encodeURIComponent(userId)}-sent-requests.json`;
}

function getSnapshotFile(path: string) {
  return new FileSystem.File(path);
}

function createCollectionSignature(items: Array<{ id: string }>) {
  if (items.length === 0) {
    return "empty";
  }

  const first = items[0]?.id ?? "";
  const last = items[items.length - 1]?.id ?? "";
  return `${items.length}:${first}:${last}`;
}

function shouldWriteSnapshot(cacheKey: string, signature: string) {
  const now = Date.now();
  const lastWrite = lastSnapshotWriteByKey.get(cacheKey);

  if (lastWrite?.signature === signature) {
    if (now - lastWrite.writtenAt < SNAPSHOT_WRITE_THROTTLE_MS) {
      return false;
    }

    lastSnapshotWriteByKey.set(cacheKey, { writtenAt: now, signature });
    return true;
  }

  lastSnapshotWriteByKey.set(cacheKey, { writtenAt: now, signature });
  return true;
}

async function ensureBaseDir() {
  if (!SNAPSHOT_STORAGE_ROOT) {
    return false;
  }

  const directory = new FileSystem.Directory(SNAPSHOT_BASE_DIR);
  directory.create({ intermediates: true, idempotent: true });
  return true;
}

export async function readStartupFeedSnapshot(userId: string) {
  try {
    const hasBaseDir = await ensureBaseDir();
    if (!hasBaseDir) {
      return null;
    }

    const file = getSnapshotFile(getSnapshotPath(userId));
    if (!file.exists) {
      return null;
    }

    const raw = await file.text();
    const parsed = JSON.parse(raw) as FeedSnapshotPayload;

    if (parsed.version !== SNAPSHOT_VERSION || parsed.userId !== userId) {
      return null;
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SNAPSHOT_MAX_AGE_MS) {
      return null;
    }

    return parsed.items;
  } catch {
    return null;
  }
}

export async function writeStartupFeedSnapshot(userId: string, items: ProductSummary[]) {
  if (!items.length) {
    return;
  }

  const signature = createCollectionSignature(items);
  if (!shouldWriteSnapshot(`feed:${userId}`, signature)) {
    return;
  }

  try {
    const hasBaseDir = await ensureBaseDir();
    if (!hasBaseDir) {
      return;
    }

    const payload: FeedSnapshotPayload = {
      version: SNAPSHOT_VERSION,
      userId,
      savedAt: Date.now(),
      items: items.slice(0, SNAPSHOT_MAX_ITEMS),
    };

    const file = getSnapshotFile(getSnapshotPath(userId));
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(payload));
  } catch {
    // Best effort cache write only.
  }
}

export async function readStartupCategoriesSnapshot(userId: string) {
  try {
    const hasBaseDir = await ensureBaseDir();
    if (!hasBaseDir) {
      return null;
    }

    const file = getSnapshotFile(getCategoriesSnapshotPath(userId));
    if (!file.exists) {
      return null;
    }

    const raw = await file.text();
    const parsed = JSON.parse(raw) as CategoriesSnapshotPayload;

    if (parsed.version !== SNAPSHOT_VERSION || parsed.userId !== userId) {
      return null;
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SNAPSHOT_MAX_AGE_MS) {
      return null;
    }

    return parsed.items;
  } catch {
    return null;
  }
}

export async function writeStartupCategoriesSnapshot(userId: string, items: Category[]) {
  if (!items.length) {
    return;
  }

  const signature = createCollectionSignature(items);
  if (!shouldWriteSnapshot(`categories:${userId}`, signature)) {
    return;
  }

  try {
    const hasBaseDir = await ensureBaseDir();
    if (!hasBaseDir) {
      return;
    }

    const payload: CategoriesSnapshotPayload = {
      version: SNAPSHOT_VERSION,
      userId,
      savedAt: Date.now(),
      items: items.slice(0, CATEGORIES_SNAPSHOT_MAX_ITEMS),
    };

    const file = getSnapshotFile(getCategoriesSnapshotPath(userId));
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(payload));
  } catch {
    // Best effort cache write only.
  }
}

export async function readStartupSentRequestsSnapshot(userId: string) {
  try {
    const hasBaseDir = await ensureBaseDir();
    if (!hasBaseDir) {
      return null;
    }

    const file = getSnapshotFile(getSentRequestsSnapshotPath(userId));
    if (!file.exists) {
      return null;
    }

    const raw = await file.text();
    const parsed = JSON.parse(raw) as SentRequestsSnapshotPayload;

    if (parsed.version !== SNAPSHOT_VERSION || parsed.userId !== userId) {
      return null;
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SNAPSHOT_MAX_AGE_MS) {
      return null;
    }

    return parsed.items;
  } catch {
    return null;
  }
}

export async function writeStartupSentRequestsSnapshot(userId: string, items: RequestSummary[]) {
  if (!items.length) {
    return;
  }

  const signature = createCollectionSignature(items);
  if (!shouldWriteSnapshot(`sent-requests:${userId}`, signature)) {
    return;
  }

  try {
    const hasBaseDir = await ensureBaseDir();
    if (!hasBaseDir) {
      return;
    }

    const payload: SentRequestsSnapshotPayload = {
      version: SNAPSHOT_VERSION,
      userId,
      savedAt: Date.now(),
      items: items.slice(0, SENT_REQUESTS_SNAPSHOT_MAX_ITEMS),
    };

    const file = getSnapshotFile(getSentRequestsSnapshotPath(userId));
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(payload));
  } catch {
    // Best effort cache write only.
  }
}