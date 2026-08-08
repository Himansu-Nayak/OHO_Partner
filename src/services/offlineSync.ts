import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PartnerDB extends DBSchema {
  actions: {
    key: string;
    value: {
      id: string;
      actionType: string;
      payload: any;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<PartnerDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<PartnerDB>('oho-partner-db', 1, {
      upgrade(db) {
        db.createObjectStore('actions', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
};

export const queueAction = async (actionType: string, payload: any) => {
  const db = await initDB();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  await db.add('actions', {
    id,
    actionType,
    payload,
    timestamp: Date.now(),
  });
  console.log(`[Offline Sync] Action queued: ${actionType}`);
};

export const syncOfflineActions = async () => {
  const db = await initDB();
  const allActions = await db.getAll('actions');
  
  if (allActions.length > 0) {
    console.log(`[Offline Sync] Syncing ${allActions.length} actions to server...`);
    for (const action of allActions) {
      console.log(`[Offline Sync] Synced action: ${action.actionType}`);
      await db.delete('actions', action.id);
    }
    console.log(`[Offline Sync] Sync complete.`);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Back online. Triggering sync...');
    syncOfflineActions();
  });
}
