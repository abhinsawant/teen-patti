import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Room } from 'shared';

const DATA_DIR = path.join(__dirname, '../../../../data');

class JSONStorage<T> {
  private cache: Record<string, T> | null = null;
  private filePath: string;
  private isWriting = false;
  private writeQueue: (() => Promise<void>)[] = [];

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
    this.init();
  }

  private async init() {
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(this.filePath)) {
      await fs.writeFile(this.filePath, JSON.stringify({}), 'utf-8');
    }
  }

  private async processQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return;
    this.isWriting = true;
    const task = this.writeQueue.shift();
    if (task) {
      await task();
    }
    this.isWriting = false;
    this.processQueue();
  }

  private async writeAtomic(data: Record<string, T>) {
    return new Promise<void>((resolve, reject) => {
      this.writeQueue.push(async () => {
        try {
          const tempPath = `${this.filePath}.tmp`;
          await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
          await fs.rename(tempPath, this.filePath);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  public async readAll(): Promise<Record<string, T>> {
    if (this.cache) return this.cache;
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(data);
      return this.cache!;
    } catch (e) {
      console.error(`Failed to read ${this.filePath}`, e);
      return {};
    }
  }

  public async get(id: string): Promise<T | null> {
    const all = await this.readAll();
    return all[id] || null;
  }

  public async set(id: string, value: T): Promise<void> {
    const all = await this.readAll();
    all[id] = value;
    this.cache = all;
    await this.writeAtomic(all);
  }

  public async delete(id: string): Promise<void> {
    const all = await this.readAll();
    delete all[id];
    this.cache = all;
    await this.writeAtomic(all);
  }
}

export const roomsStorage = new JSONStorage<Room>('rooms.json');
import { SessionReceipt } from 'shared';
export const settlementsStorage = new JSONStorage<SessionReceipt>('settlements.json');
