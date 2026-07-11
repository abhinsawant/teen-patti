"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsStorage = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '../../../../data');
class JSONStorage {
    cache = null;
    filePath;
    isWriting = false;
    writeQueue = [];
    constructor(filename) {
        this.filePath = path_1.default.join(DATA_DIR, filename);
        this.init();
    }
    async init() {
        if (!(0, fs_1.existsSync)(DATA_DIR)) {
            await promises_1.default.mkdir(DATA_DIR, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(this.filePath)) {
            await promises_1.default.writeFile(this.filePath, JSON.stringify({}), 'utf-8');
        }
    }
    async processQueue() {
        if (this.isWriting || this.writeQueue.length === 0)
            return;
        this.isWriting = true;
        const task = this.writeQueue.shift();
        if (task) {
            await task();
        }
        this.isWriting = false;
        this.processQueue();
    }
    async writeAtomic(data) {
        return new Promise((resolve, reject) => {
            this.writeQueue.push(async () => {
                try {
                    const tempPath = `${this.filePath}.tmp`;
                    await promises_1.default.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
                    await promises_1.default.rename(tempPath, this.filePath);
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }
    async readAll() {
        if (this.cache)
            return this.cache;
        try {
            const data = await promises_1.default.readFile(this.filePath, 'utf-8');
            this.cache = JSON.parse(data);
            return this.cache;
        }
        catch (e) {
            console.error(`Failed to read ${this.filePath}`, e);
            return {};
        }
    }
    async get(id) {
        const all = await this.readAll();
        return all[id] || null;
    }
    async set(id, value) {
        const all = await this.readAll();
        all[id] = value;
        this.cache = all;
        await this.writeAtomic(all);
    }
    async delete(id) {
        const all = await this.readAll();
        delete all[id];
        this.cache = all;
        await this.writeAtomic(all);
    }
}
exports.roomsStorage = new JSONStorage('rooms.json');
