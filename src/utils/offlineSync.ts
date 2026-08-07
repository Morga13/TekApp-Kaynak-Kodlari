import { Network, ConnectionStatus } from "@capacitor/network";
import {
  saveMusteri,
  deleteMusteri,
  saveBakim,
  updateBakim,
  deleteBakim,
  saveParca,
  deleteParca,
} from "../db/supabase";

export interface QueueItem {
  id: string;
  type:
    | "SAVE_MUSTERI"
    | "DELETE_MUSTERI"
    | "SAVE_BAKIM"
    | "UPDATE_BAKIM"
    | "DELETE_BAKIM"
    | "SAVE_PARCA"
    | "DELETE_PARCA";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  timestamp: number;
  retryCount: number;
}

const OFFLINE_QUEUE_KEY = "tekapp_offline_queue";

// ─── KUYRUK YÖNETİMİ (OFFLINE QUEUE) ───────────────────────────
export function getOfflineQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueueItem[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* ignore */ }
}

export function addToOfflineQueue(
  type: QueueItem["type"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
): QueueItem {
  const queue = getOfflineQueue();
  const newItem: QueueItem = {
    id: `queue_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(newItem);
  saveOfflineQueue(queue);
  return newItem;
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(queue);
}

// ─── İNTERNET BAĞLANTI DİNLEYİCİSİ ─────────────────────────────
type NetworkChangeCallback = (connected: boolean) => void;

export function initNetworkListener(onStatusChange: NetworkChangeCallback): () => void {
  let isSubscribed = true;

  // Başlangıç durumu kontrolü
  Network.getStatus().then((status: ConnectionStatus) => {
    if (isSubscribed) onStatusChange(status.connected);
  }).catch(() => {
    if (isSubscribed) onStatusChange(navigator.onLine);
  });

  // Capacitor Network Event Listener
  const listenerPromise = Network.addListener("networkStatusChange", (status: ConnectionStatus) => {
    if (isSubscribed) onStatusChange(status.connected);
  });

  // Web Tarayıcı Fallback Dinleyicileri
  const handleOnline = () => { if (isSubscribed) onStatusChange(true); };
  const handleOffline = () => { if (isSubscribed) onStatusChange(false); };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    isSubscribed = false;
    listenerPromise.then((handle) => handle.remove()).catch(() => {});
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// ─── OTOMATİK SENKRONİZASYON MOTORU ───────────────────────────
let isSyncing = false;

export async function processOfflineQueue(onSyncSuccess?: () => void): Promise<{ syncedCount: number; errors: number }> {
  if (isSyncing) return { syncedCount: 0, errors: 0 };
  
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, errors: 0 };

  isSyncing = true;
  let syncedCount = 0;
  let errorCount = 0;

  for (const item of queue) {
    try {
      switch (item.type) {
        case "SAVE_MUSTERI":
          await saveMusteri(item.payload);
          break;
        case "DELETE_MUSTERI":
          await deleteMusteri(item.payload.id);
          break;
        case "SAVE_BAKIM":
          await saveBakim(item.payload);
          break;
        case "UPDATE_BAKIM":
          await updateBakim(item.payload.id, item.payload.updates);
          break;
        case "DELETE_BAKIM":
          await deleteBakim(item.payload.id);
          break;
        case "SAVE_PARCA":
          await saveParca(item.payload);
          break;
        case "DELETE_PARCA":
          await deleteParca(item.payload.id);
          break;
      }

      removeFromOfflineQueue(item.id);
      syncedCount++;
    } catch (err: any) {
      console.error(`Offline queue sync failed for ${item.type}:`, err);
      errorCount++;
      // İnternet veya bağlantı hatası ise sırayı kes, daha sonra tekrar dene
      const isNetworkErr = err?.message?.toLowerCase().includes("fetch") ||
        err?.message?.toLowerCase().includes("network") ||
        !navigator.onLine;
      if (isNetworkErr) break;
    }
  }

  isSyncing = false;

  if (syncedCount > 0 && onSyncSuccess) {
    onSyncSuccess();
  }

  return { syncedCount, errors: errorCount };
}
