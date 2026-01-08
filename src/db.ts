import Dexie, { Table } from 'dexie';
import { AIImage, LibrarySource, AIImageDB } from './types';

// Generic settings storage - value type can be specified at call site
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SettingDB<T = any> {
    key: string;
    value: T;
}

export class ArchivistDB extends Dexie {
    images!: Table<AIImageDB>;
    sources!: Table<LibrarySource>;
    settings!: Table<SettingDB>;

    constructor() {
        super('AIArchivistDB');

        this.version(1).stores({
            images: 'id, sourceId, date, rating, model, *tags',
            sources: 'id',
            settings: 'key'
        });

        this.version(2).stores({
            images: 'id, sourceId, date, rating, model, *tags, hash'
        });
        this.version(3).stores({
            images: 'id, sourceId, date, rating, model, *tags, hash, src'
        });
    }
}

export const db = new ArchivistDB();

export const clearDatabase = async () => {
    await db.images.clear();
    await db.sources.clear();
};