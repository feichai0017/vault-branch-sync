import {mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {synchronize} from "../src/engine.js";

export async function device() {
    const root = await mkdtemp(join(tmpdir(), "notes-sync-test-"));
    const at = path => join(root, path);
    const adapter = {
        async stat(path) {
            try { return {type: (await stat(at(path))).isDirectory() ? "folder" : "file"}; }
            catch (err) { if (err.code === "ENOENT") return null; throw err; }
        },
        async exists(path) { return Boolean(await this.stat(path)); },
        async list(dir) {
            const files = [], folders = [];
            for (const entry of await readdir(at(dir), {withFileTypes: true})) {
                (entry.isDirectory() ? folders : files).push((dir ? dir + "/" : "") + entry.name);
            }
            return {files, folders};
        },
        read: path => readFile(at(path), "utf8"),
        readBinary: async path => Uint8Array.from(await readFile(at(path))).buffer,
        writeBinary: (path, data) => writeFile(at(path), Buffer.from(data)),
        mkdir: path => mkdir(at(path)),
        async trashLocal(path) {
            const dest = at(".trash/" + path);
            await mkdir(dirname(dest), {recursive: true});
            await rename(at(path), dest);
        }
    };
    let state = null;
    return {
        adapter, get state() { return state; },
        async file(path, data) {
            await mkdir(dirname(at(path)), {recursive: true});
            await writeFile(at(path), Buffer.from(data));
        },
        text: path => adapter.read(path),
        async sync(api, options = {}) {
            return synchronize({adapter, api, target: api.target, state, save: value => { state = value; },
                confirm: async changes => { throw new Error("Unexpected conflict: " + changes.map(x => x.path)); }, ...options});
        },
        cleanup: () => rm(root, {recursive: true, force: true})
    };
}
