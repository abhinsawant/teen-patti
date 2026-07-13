"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementsStorage = exports.roomsStorage = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class JSONStorage {
    cache = new Map();
    isLoaded = false;
    writeQueue = Promise.resolve();
    filePath;
    constructor(filename) {
        this.filePath = path_1.default.join(__dirname, '../../../data', filename);
    }
    async ensureDir() {
        await promises_1.default.mkdir(path_1.default.dirname(this.filePath), { recursive: true });
    }
    async load() {
        if (this.isLoaded)
            return;
        await this.ensureDir();
        try {
            const data = await promises_1.default.readFile(this.filePath, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [key, value] of Object.entries(parsed)) {
                this.cache.set(key, value);
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading ${this.filePath}:`, error);
            }
        }
        this.isLoaded = true;
    }
    async save() {
        const data = Object.fromEntries(this.cache);
        const tmpPath = `${this.filePath}.tmp`;
        this.writeQueue = this.writeQueue.then(async () => {
            await promises_1.default.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
            await promises_1.default.rename(tmpPath, this.filePath);
        }).catch(err => {
            console.error(`Error saving ${this.filePath}:`, err);
        });
        return this.writeQueue;
    }
    async get(id) {
        await this.load();
        return this.cache.get(id);
    }
    async getAll() {
        await this.load();
        return Array.from(this.cache.values());
    }
    async set(id, value) {
        await this.load();
        this.cache.set(id, value);
        await this.save();
    }
    async delete(id) {
        await this.load();
        this.cache.delete(id);
        await this.save();
    }
}
exports.roomsStorage = new JSONStorage('rooms.json');
exports.settlementsStorage = new JSONStorage('settlements.json');
