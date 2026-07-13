import fs from 'fs/promises';
import path from 'path';
import { Room, SessionReceipt } from 'shared';

class JSONStorage<T> {
  private cache: Map<string, T> = new Map();
  private isLoaded = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private filePath: string;

  constructor(filename: string) {
    this.filePath = path.join(__dirname, '../../../data', filename);
  }

  private async ensureDir() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  private async load() {
    if (this.isLoaded) return;
    await this.ensureDir();
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      for (const [key, value] of Object.entries(parsed)) {
        this.cache.set(key, value as T);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading ${this.filePath}:`, error);
      }
    }
    this.isLoaded = true;
  }

  private async save() {
    const data = Object.fromEntries(this.cache);
    const tmpPath = `${this.filePath}.tmp`;
    
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpPath, this.filePath);
    }).catch(err => {
      console.error(`Error saving ${this.filePath}:`, err);
    });

    return this.writeQueue;
  }

  async get(id: string): Promise<T | undefined> {
    await this.load();
    return this.cache.get(id);
  }

  async getAll(): Promise<T[]> {
    await this.load();
    return Array.from(this.cache.values());
  }

  async set(id: string, value: T): Promise<void> {
    await this.load();
    this.cache.set(id, value);
    await this.save();
  }

  async delete(id: string): Promise<void> {
    await this.load();
    this.cache.delete(id);
    await this.save();
  }
}

export const roomsStorage = new JSONStorage<Room>('rooms.json');
export const settlementsStorage = new JSONStorage<SessionReceipt>('settlements.json');
