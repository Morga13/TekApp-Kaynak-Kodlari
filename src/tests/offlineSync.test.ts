import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOfflineQueue,
  saveOfflineQueue,
  addToOfflineQueue,
  removeFromOfflineQueue,
  processOfflineQueue,
  QueueItem,
} from "../utils/offlineSync";

describe("Offline Sync Queue & Engine Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addToOfflineQueue yeni bir öğeyi kuyruğa eklemeli ve localStorage'a kaydetmelidir", () => {
    const item = addToOfflineQueue("SAVE_MUSTERI", { ad: "Test Müşteri", telefon: "0555" });
    expect(item).toBeDefined();
    expect(item.type).toBe("SAVE_MUSTERI");
    expect(item.payload.ad).toBe("Test Müşteri");

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(item.id);
  });

  it("removeFromOfflineQueue belirtilen öğeyi kuyruktan çıkarmalıdır", () => {
    const item1 = addToOfflineQueue("SAVE_MUSTERI", { ad: "Müşteri 1" });
    const item2 = addToOfflineQueue("SAVE_BAKIM", { toplam: 1000 });

    expect(getOfflineQueue().length).toBe(2);

    removeFromOfflineQueue(item1.id);
    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(item2.id);
  });

  it("processOfflineQueue boş kuyruğunda 0 senkronize öğe dönmelidir", async () => {
    const res = await processOfflineQueue();
    expect(res.syncedCount).toBe(0);
    expect(res.errors).toBe(0);
  });
});
