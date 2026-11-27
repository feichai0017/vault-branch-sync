import ignore from "ignore";
import {fileScope, sameTarget} from "./target.js";

const utf8 = new TextEncoder();
export const validOid = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);

export async function blobOid(data) {
    const bytes = new Uint8Array(data);
    const header = utf8.encode("blob " + bytes.length + "\0");
    const blob = new Uint8Array(header.length + bytes.length);
    blob.set(header);
    blob.set(bytes, header.length);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", blob));
    return Array.from(digest, n => n.toString(16).padStart(2, "0")).join("");
}

export function fromState(state, target, scope) {
    if (!state || state.version !== 1 || !sameTarget(state, target) ||
        state.settings !== scope.settings || state.configDir !== scope.configDir || !Array.isArray(state.files)) return null;
    if (!state.files.every(pair => Array.isArray(pair) && pair.length === 2 &&
        scope.allowed(pair[0]) && validOid(pair[1]))) return null;
    return new Map(state.files);
}

function parent(path) {
    const index = path.lastIndexOf("/");
    return index === -1 ? "" : path.slice(0, index);
}

function prefixes(paths) {
    const dirs = new Set();
    for (const path of paths) {
        for (let dir = parent(path); dir && !dirs.has(dir); dir = parent(dir)) dirs.add(dir);
    }
    return dirs;
}

export function scopedRules(sources) {
    const result = new Map();
    for (const [file, source] of sources) result.set(parent(file), ignore().add(source));
    return (path, isFolder) => {
        let ignored = false;
        const pieces = path.split("/");
        for (let depth = 0; depth < pieces.length; depth++) {
            const set = result.get(pieces.slice(0, depth).join("/"));
            if (!set) continue;
            const match = set.test(pieces.slice(depth).join("/") + (isFolder ? "/" : ""));
            if (match.ignored) ignored = true;
            if (match.unignored) ignored = false;
        }
        return ignored;
    };
}

async function readLocal(adapter, path) {
    try { return await adapter.readBinary(path); }
    catch (err) {
        if (!(await adapter.exists(path))) throw new Error("A file moved during sync. Run sync again.");
        throw err;
    }
}

async function localManifest(adapter, tracked, ignored, blocked, scope) {
    const files = new Map();
    const directories = prefixes(tracked);
    async function visit(dir, localRules) {
        const list = await adapter.list(dir);
        const ownIgnore = (dir ? dir + "/" : "") + ".gitignore";
        if (list.files.includes(ownIgnore)) localRules = new Map([...localRules, [ownIgnore, await adapter.read(ownIgnore)]]);
        const ignoredHere = scopedRules(localRules);
        for (const path of list.files) {
            if (scope.allowed(path) && !blocked.has(path) && (tracked.has(path) || (!ignored(path, false) && !ignoredHere(path, false)))) {
                files.set(path, await blobOid(await readLocal(adapter, path)));
            }
        }
        for (const path of list.folders) {
            if (scope.allowed(path, true) && !blocked.has(path) && (directories.has(path) || (!ignored(path, true) && !ignoredHere(path, true)))) await visit(path, localRules);
        }
    }
    await visit("", new Map());
    // A provider may leave hidden folders out of a directory listing. A tracked
    // file is deleted only if its own path is also absent.
    for (const path of tracked) {
        if (files.has(path)) continue;
        const hash = await currentOid(adapter, path);
        if (hash) files.set(path, hash);
    }
    return files;
}

export function planChanges(base, local, remote, send) {
    const incoming = [], outgoing = [], conflicts = [];
    const paths = new Set([...base.keys(), ...local.keys(), ...remote.keys()]);
    for (const path of paths) {
        const before = base.get(path), here = local.get(path), there = remote.get(path);
        if (here === there) continue;
        const change = {path, before, here, there};
        if (here === before) incoming.push(change);
        else if (there === before) { if (send) outgoing.push(change); }
        else conflicts.push(change);
    }
    return { incoming, outgoing, conflicts };
}

// An iOS filesystem may identify case or Unicode variants as the same name.
function checkNames(paths) {
    const aliases = new Map(), leaves = new Set(paths);
    for (const path of leaves) {
        let current = "";
        for (const part of path.split("/")) {
            current += (current ? "/" : "") + part;
            const key = current.normalize("NFC").toLowerCase();
            const other = aliases.get(key);
            if ((other && other !== current) || (current !== path && leaves.has(current))) {
                throw new Error("Conflicting file names or case variants. Rename one before syncing: " + current);
            }
            aliases.set(key, current);
        }
    }
}

async function currentOid(adapter, path) {
    const stat = await adapter.stat(path);
    if (!stat) return undefined;
    if (stat.type !== "file") throw new Error("A folder already exists at this file path: " + path);
    return blobOid(await readLocal(adapter, path));
}

async function mkdirs(adapter, path) {
    const dir = parent(path);
    if (!dir) return;
    const stat = await adapter.stat(dir);
    if (stat?.type === "folder") return;
    if (stat) throw new Error("A file is blocking the folder: " + dir);
    await mkdirs(adapter, dir);
    await adapter.mkdir(dir);
}

function copyPath(path, oid) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const dir = parent(path).split("/").map(part => part.startsWith(".") ? "Config-" + part.slice(1) : part).join("/");
    const index = name.lastIndexOf(".");
    const stem = index > 0 ? name.slice(0, index) : name;
    const ext = index > 0 ? name.slice(index) : "";
    return "Sync conflicts/" + (dir ? dir + "/" : "") + stem +  " (local " + oid.slice(0, 10) + ")" + ext;
}

async function saveCopy(adapter, change, remote) {
    if (!change.here) return;
    await adapter.flush?.(change.path);
    const data = await readLocal(adapter, change.path);
    if (await blobOid(data) !== change.here) throw new Error("Edited during sync. Please retry: " + change.path);
    const target = copyPath(change.path, change.here);
    if (remote.has(target) && remote.get(target) !== change.here) throw new Error("A different conflict copy already exists on GitHub: " + target);
    const existing = await currentOid(adapter, target);
    if (existing === change.here) return;
    if (existing) throw new Error("A previous conflict copy has been edited. Rename it before syncing: " + target);
    await mkdirs(adapter, target);
    await adapter.writeBinary(target, data);
    if (await currentOid(adapter, target) !== change.here) throw new Error("Could not verify the local conflict copy: " + target);
}

async function applyRemote(adapter, api, change) {
    const {path, here, there} = change;
    const bytes = there ? await api.readBlob(there) : null;
    // The download may be slow. Recheck the local version immediately before updating it.
    await adapter.flush?.(path);
    if (await currentOid(adapter, path) !== here) throw new Error("Local file changed during download. Run sync again: " + path);
    if (bytes) {
        await mkdirs(adapter, path);
        await adapter.writeBinary(path, bytes);
        if (await currentOid(adapter, path) !== there) throw new Error("The file on disk does not match the downloaded revision: " + path);
    } else if (here) {
        await adapter.trashLocal(path);
        if (await adapter.exists(path)) throw new Error("Could not move the file to the vault trash: " + path);
    }
}

export class HeadMoved extends Error {}

function setRevision(files, path, sha) {
    if (sha) files.set(path, sha);
    else files.delete(path);
}

async function uploadBytes(adapter, change) {
    await adapter.flush?.(change.path);
    const bytes = await readLocal(adapter, change.path);
    if (await blobOid(bytes) !== change.here) throw new Error("Edited during upload. Run sync again: " + change.path);
    return bytes;
}

export async function synchronize({adapter, api, target, state, scope = fileScope(), send = true,
    fastReceive = false, save, review, progress = () => {}}) {
    const previous = fromState(state, target, scope);
    const base = previous || new Map();
    const first = !previous;
    const knownHead = fastReceive && !send && previous && state.settled ? state.head : undefined;
    let snapshot = await api.snapshot(knownHead);
    if (snapshot.unchanged) return {first: false, head: snapshot.head, received: 0, sent: 0, copies: 0, deferred: 0, conflicts: 0};
    const remote = new Map([...snapshot.entries].filter(([path]) => scope.allowed(path)).map(([path, entry]) => [path, entry.sha]));
    for (const path of base.keys()) {
        if ([...snapshot.blocked].some(root => path === root || path.startsWith(root + "/"))) base.delete(path);
    }
    const tracked = new Set([...base.keys(), ...remote.keys()]);
    progress("Comparing local files…");
    await adapter.flush?.();
    const local = await localManifest(adapter, tracked, scopedRules(snapshot.rules), snapshot.blocked, scope);
    checkNames(new Set([...local.keys(), ...remote.keys()]));
    const plan = planChanges(base, local, remote, true);
    const canSend = send && !first;
    let decision = {selected: new Set(), conflicts: new Map()};
    if (plan.conflicts.length || (canSend && (plan.incoming.length || plan.outgoing.length))) {
        decision = await review({
            incoming: plan.incoming,
            outgoing: canSend ? plan.outgoing : [],
            conflicts: plan.conflicts,
            canSend,
            remoteSize: path => snapshot.entries.get(path)?.size
        });
        if (!decision) return {canceled: true};
        if (await api.head() !== snapshot.head) throw new HeadMoved("The remote branch changed during review.");
    }

    const outgoing = canSend ? plan.outgoing.filter(change => decision.selected.has(change.path)) : [];
    let pending = plan.outgoing.length - outgoing.length;
    const inbound = [...plan.incoming], keepBoth = [], intended = new Map(remote);
    let deferred = 0;
    for (const change of plan.conflicts) {
        const choice = decision.conflicts.get(change.path) ?? "later";
        if (choice === "later") {
            // A deferred conflict keeps its common ancestor across syncs, even when the branch advances.
            setRevision(intended, change.path, change.before);
            deferred++;
        } else if (choice === "local" && canSend) {
            setRevision(intended, change.path, change.before);
            outgoing.push(change);
        } else if (choice === "keep-local" && !canSend) {
            // The reviewed remote revision becomes the baseline. The local edit
            // stays eligible for selection on the next manual commit.
            pending++;
        } else if (choice === "remote" || choice === "both") {
            if (choice === "both" && change.here) keepBoth.push(change);
            inbound.push(change);
        } else {
            throw new Error("Invalid conflict decision for " + change.path);
        }
    }
    for (const change of keepBoth) await saveCopy(adapter, change, remote);
    let received = 0;
    const acknowledged = previous && new Map(previous);
    try {
        for (const change of inbound) {
            progress("Receiving " + (received + 1) + "/" + inbound.length + " · " + change.path);
            await applyRemote(adapter, api, change);
            if (acknowledged) setRevision(acknowledged, change.path, change.there);
            received++;
        }
    } finally {
        if (acknowledged && received) await save({...state, settled: false, files: [...acknowledged]});
    }

    const baseline = (head, files, settled) => ({version: 1, ...target, settings: scope.settings,
        configDir: scope.configDir, head, files: [...files], settled});
    let head = snapshot.head;
    const sent = outgoing.length;
    if (sent && !head) {
        // GitHub's Contents API creates the first commit. Continue with the very same
        // approved paths and hashes after bootstrapping the branch.
        const index = outgoing.findIndex(change => change.here);
        if (index < 0) throw new Error("The empty branch has no file to commit.");
        const [initial] = outgoing.splice(index, 1);
        head = await api.initialize(initial.path, await uploadBytes(adapter, initial), initial.here);
        intended.set(initial.path, initial.here);
        await save(baseline(head, intended, false));
        if (outgoing.length) {
            snapshot = await api.snapshot();
            if (snapshot.head !== head) throw new HeadMoved("The branch changed after its first commit.");
        }
    }
    if (outgoing.length) {
        const changes = [];
        for (const change of outgoing) {
            const {path, here} = change;
            progress("Preparing commit · " + path);
            if (here) {
                await api.putBlob(await uploadBytes(adapter, change), here);
            } else {
                await adapter.flush?.(path);
                if (await currentOid(adapter, path)) throw new Error("The deleted file reappeared. Run sync again: " + path);
            }
            setRevision(intended, path, here);
            changes.push({path, mode: snapshot.entries.get(path)?.mode || "100644", type: "blob", sha: here || null});
        }
        head = await api.commit(snapshot, changes);
    } else if (await api.head() !== head) {
        throw new HeadMoved("The remote branch changed.");
    }
    await save(baseline(head, intended, deferred === 0));
    return {first, head, received, sent, pending, copies: keepBoth.length, deferred, conflicts: plan.conflicts.length};
}
