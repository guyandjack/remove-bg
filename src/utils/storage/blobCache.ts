type StoredBlob = {
  key: string;
  blob: Blob;
  createdAt: number;
};

const DB_NAME = "wizpix_cache";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
};

export const blobCache = {
  async set(key: string, blob: Blob) {
    const record: StoredBlob = { key, blob, createdAt: Date.now() };
    await withStore("readwrite", (store) => store.put(record));
  },

  async get(key: string): Promise<StoredBlob | null> {
    const record = await withStore<StoredBlob | undefined>("readonly", (store) =>
      store.get(key)
    );
    return record ?? null;
  },

  async del(key: string) {
    await withStore("readwrite", (store) => store.delete(key));
  },
};

