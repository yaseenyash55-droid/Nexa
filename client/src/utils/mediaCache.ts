/**
 * Nexa Web Media Cache Layer
 * Uses native IndexedDB to cache large media files (images, videos, music/audio) locally.
 * Includes LRU eviction policy to restrict space utilization.
 */

const DB_NAME = 'NexaMediaCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 Megabytes
const MAX_ITEM_COUNT = 100;

interface CacheEntry {
  url: string;
  blob: Blob;
  mimeType: string;
  lastAccessTime: number;
  size: number;
}

class MediaCache {
  private db: IDBDatabase | null = null;
  private isSupported = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.isSupported) {
      this.initDB().catch(err => {
        console.warn('Failed to initialize IndexedDB media cache:', err);
      });
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async getStore(mode: IDBTransactionMode): Promise<{ transaction: IDBTransaction; store: IDBObjectStore }> {
    const db = await this.initDB();
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    return { transaction, store };
  }

  /**
   * Retrieves media from cache and updates access timestamp
   */
  public async getMedia(url: string): Promise<{ objectUrl: string; mimeType: string } | null> {
    if (!this.isSupported) return null;

    try {
      const { store } = await this.getStore('readwrite');
      const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
        const request = store.get(url);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!entry) return null;

      // Update last access time for LRU
      entry.lastAccessTime = Date.now();
      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        objectUrl: URL.createObjectURL(entry.blob),
        mimeType: entry.mimeType
      };
    } catch (err) {
      console.warn('Error reading media from cache:', err);
      return null;
    }
  }

  /**
   * Saves media blob to cache and triggers eviction check
   */
  public async saveMedia(url: string, blob: Blob, mimeType: string): Promise<void> {
    if (!this.isSupported) return;

    try {
      const size = blob.size;
      const entry: CacheEntry = {
        url,
        blob,
        mimeType,
        lastAccessTime: Date.now(),
        size
      };

      const { store } = await this.getStore('readwrite');
      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Run LRU eviction asynchronously
      this.evictIfNecessary().catch(err => {
        console.warn('LRU Eviction warning:', err);
      });
    } catch (err) {
      console.warn('Error writing media to cache:', err);
    }
  }

  /**
   * Clears all cached media
   */
  public async clearCache(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const { store } = await this.getStore('readwrite');
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('Error clearing media cache:', err);
    }
  }

  /**
   * LRU eviction logic
   */
  private async evictIfNecessary(): Promise<void> {
    const { store } = await this.getStore('readwrite');
    const allEntries = await new Promise<CacheEntry[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (allEntries.length === 0) return;

    let totalSize = allEntries.reduce((sum, entry) => sum + (entry.size || 0), 0);
    let itemCount = allEntries.length;

    if (totalSize <= MAX_CACHE_SIZE && itemCount <= MAX_ITEM_COUNT) return;

    // Sort by lastAccessTime ascending (oldest first)
    allEntries.sort((a, b) => a.lastAccessTime - b.lastAccessTime);

    for (const entry of allEntries) {
      if (totalSize <= MAX_CACHE_SIZE && itemCount <= MAX_ITEM_COUNT) {
        break;
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(entry.url);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      totalSize -= entry.size || 0;
      itemCount -= 1;
    }
  }
}

export const mediaCache = new MediaCache();
