import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {device} from "./device.mjs";
import {HeadMoved, blobOid} from "../src/engine.js";
import {fileScope, branchName, repositoryName} from "../src/target.js";
import {GitHub} from "../src/github.js";

const textBytes = value => Buffer.from(value);
const buffer = value => Uint8Array.from(value).buffer;
const oid = value => {
    const bytes = textBytes(value);
    return createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
};

class Remote {
    target = {repository: "example/notes", branch: "reading/week-one"};
    blobs = new Map();
    files = new Map();
    revision = 1;
    rules = new Map();
    blocked = new Set();
    async head() { return this.revision.toString(16).padStart(40, "0"); }
    set(path, data) {
        const hash = oid(data);
        this.blobs.set(hash, buffer(textBytes(data)));
        this.files.set(path, hash);
        this.revision++;
    }
    delete(path) { this.files.delete(path); this.revision++; }
    async snapshot() {
        return {head: await this.head(), entries: new Map([...this.files].map(([p, sha]) => [p, {sha, mode: "100644"}])),
            blocked: this.blocked, rules: this.rules};
    }
    async readBlob(sha) { assert(this.blobs.has(sha)); return this.blobs.get(sha); }
    async putBlob(bytes, sha) { assert.equal(oid(bytes), sha); this.blobs.set(sha, bytes); }
    async commit(snapshot, changes) {
        if (await this.head() !== snapshot.head) throw new HeadMoved();
        for (const change of changes) {
            if (change.sha) { assert(this.blobs.has(change.sha)); this.files.set(change.path, change.sha); }
            else this.files.delete(change.path);
        }
        this.revision++;
        return this.head();
    }
}

async function setup(t, count = 1) {
    const devices = await Promise.all(Array.from({length: count}, device));
    t.after(() => Promise.all(devices.map(d => d.cleanup())));
    return [new Remote(), ...devices];
}

test("first connection receives existing notes and sends no drafts", async t => {
    const [r, d] = await setup(t);
    const binary = Buffer.from([0, 2, 254, 255]);
    r.set("Index.md", "remote"); r.set("Media/picture.png", binary); await d.file("Draft.md", "mine");
    const revision = r.revision;
    const result = await d.sync(r);
    assert.equal(result.sent, 0); assert.equal(result.received, 2); assert.equal(r.revision, revision);
    assert.equal(await d.text("Index.md"), "remote"); assert.equal(await d.text("Draft.md"), "mine");
    assert.deepEqual(Buffer.from(await d.adapter.readBinary("Media/picture.png")), binary);
});

test("two devices exchange additions, binary attachments, edits, renames and deletions", async t => {
    const [r, a, b] = await setup(t, 2);
    r.set("shared.md", "a"); await a.sync(r); await b.sync(r);
    await a.file("shared.md", "b"); await a.file("Attachments/new.png", Buffer.from([0, 99, 255]));
    const version = await a.sync(r); assert.equal(version.sent, 2);
    await b.file("draft.md", "local"); assert.equal((await b.sync(r, {send: false})).sent, 0);
    assert(!r.files.has("draft.md")); assert.equal(await b.text("shared.md"), "b");
    await b.adapter.trashLocal("shared.md"); await b.file("Renamed.md", "b");
    assert.equal((await b.sync(r)).sent, 3); await a.sync(r);
    assert.equal(await a.text("Renamed.md"), "b"); assert.equal(await a.text(".trash/shared.md"), "b");
    assert.equal((await a.sync(r)).sent, 0);
});

test("two edits, deferred conflict and preservation of both versions", async t => {
    const [r, a, b] = await setup(t, 2);
    r.set("Project/note.md", "base"); await a.sync(r); await b.sync(r);
    await a.file("Project/note.md", "Mac edited"); await b.file("Project/note.md", "phone edited");
    await a.sync(r);
    const veto = await b.sync(r, {confirm: () => false});
    assert(veto.canceled); assert.equal(await b.text("Project/note.md"), "phone edited");
    const resolved = await b.sync(r, {confirm: () => true});
    assert.equal(resolved.copies, 1); assert.equal(await b.text("Project/note.md"), "Mac edited");
    const copy = (await b.adapter.list("Sync conflicts/Project")).files[0];
    assert.equal(await b.text(copy), "phone edited");
    await b.sync(r); await a.sync(r); assert.equal(await a.text(copy), "phone edited");
});

test("remote delete versus local edit and local delete versus remote edit", async t => {
    const [r, d] = await setup(t);
    r.set("left.md", "base"); r.set("right.md", "base"); await d.sync(r);
    r.delete("left.md"); await d.file("left.md", "mine");
    r.set("right.md", "server"); await d.adapter.trashLocal("right.md");
    const reply = await d.sync(r, {confirm: changes => changes.length === 2});
    assert.equal(reply.copies, 1); assert.equal(await d.text("right.md"), "server");
    assert.equal(await d.text(".trash/left.md"), "mine");
    assert.equal(await d.text((await d.adapter.list("Sync conflicts")).files[0]), "mine");
});

test("first download interruption stays receive-only on retry", async t => {
    const [r, d] = await setup(t);
    r.set("one", "1"); r.set("two", "2"); await d.file("local", "mine");
    const read = r.readBlob.bind(r);
    r.readBlob = async sha => { if (sha === oid("2")) throw Error("offline"); return read(sha); };
    await assert.rejects(d.sync(r), /offline/); assert.equal(d.state, null);
    r.readBlob = read;
    const result = await d.sync(r); assert(result.first); assert(!r.files.has("local"));
    assert.equal(await d.text("two"), "2");
});

test("stale branch after inbound changes retries without false conflicts or overwrites", async t => {
    const [r, d] = await setup(t);
    r.set("remote.md", "original"); await d.sync(r);
    r.set("remote.md", "first"); await d.file("mine.md", "mine");
    const commit = r.commit.bind(r);
    r.commit = async (...args) => { r.set("remote.md", "newer"); r.commit = commit; return commit(...args); };
    await assert.rejects(d.sync(r), HeadMoved); assert(!r.files.has("mine.md"));
    await d.sync(r); assert.equal(await d.text("remote.md"), "newer"); assert.equal(r.files.get("mine.md"), oid("mine"));
});

test("current local edits made during a download are preserved", async t => {
    const [r, d] = await setup(t);
    r.set("note.md", "base"); await d.sync(r); r.set("note.md", "remote change");
    const read = r.readBlob.bind(r);
    r.readBlob = async sha => { await d.file("note.md", "typing"); return read(sha); };
    await assert.rejects(d.sync(r), /changed during/); assert.equal(await d.text("note.md"), "typing");
});

test("file scope, ignore files, blocked paths, and optional portable configuration", async t => {
    const [r, d] = await setup(t);
    const scope = fileScope(true);
    r.rules.set(".gitignore", "*.tmp\nprivate/\n"); r.rules.set("folder/.gitignore", "remote.skip\n");
    r.blocked.add("link"); r.set(".obsidian/appearance.json", "theme"); await d.sync(r, {scope});
    for (const file of [".git/config", ".tools/file", "private/document", "x.tmp", "folder/remote.skip", "folder/local.skip",
        ".obsidian/plugins/dummy/data.json", ".obsidian/plugins/dummy/main.js", ".obsidian/community-plugins.json",
        ".obsidian/secrets.json", ".obsidian/workspace.json", "link"]) await d.file(file, "device only");
    await d.file("folder/.gitignore", "local.skip"); await d.file("folder/ok.md", "hello");
    const list = d.adapter.list.bind(d.adapter);
    d.adapter.list = async dir => { const out = await list(dir); if (!dir) out.folders = out.folders.filter(p => p !== ".obsidian"); return out; };
    assert.equal((await d.sync(r, {scope})).sent, 1);
    assert.deepEqual([...r.files.keys()].sort(), [".obsidian/appearance.json", "folder/ok.md"]);
    for (const bad of ["../outside", "/dir/file", "C:/file", "x\\y", "./a", "sub/.git/a", ".obsidian/.secret"]) assert.equal(scope.allowed(bad), false);
    assert(!fileScope().allowed(".obsidian/appearance.json")); assert(!scope.allowed(".obsidian/plugins/test/main.js"));
    assert(!fileScope(false, "my-config").allowed("my-config/plugins/test/main.js"));
});

test("GitHub verifies raw blobs and conditionally moves exactly the expected Git ref", async () => {
    const sha = c => c.repeat(40);
    const calls = [];
    const request = async req => {
        calls.push(req);
        if (req.url.endsWith("/graphql")) return {status: 200, json: {data: {updateRefs: {clientMutationId: null}}}};
        if (req.url.includes("/git/blobs/")) return {status: 200, arrayBuffer: buffer(textBytes("other"))};
        return {status: 201, json: {sha: req.url.endsWith("trees") ? sha("b") : sha("c")}};
    };
    const api = new GitHub({repository: "example/notes", branch: "team/notes"}, "test", request, data => Buffer.from(data).toString("base64"));
    await assert.rejects(api.readBlob(oid("expected")), /integrity/);
    assert.equal(await api.commit({tree: sha("d"), head: sha("a"), node: "fixture"}, []), sha("c"));
    const input = JSON.parse(calls.at(-1).body).variables.input;
    assert.deepEqual(input.refUpdates, [{name:"refs/heads/team/notes", beforeOid:sha("a"), afterOid:sha("c"), force:false}]);
    const data = Buffer.alloc(16 * 1024 * 1024, 74);
    assert.equal(await blobOid(buffer(data)), oid(data));
});

test("a new empty branch downloads first, then creates an initial commit from a real vault file", async t => {
    const [remote, local] = await setup(t);
    let initialized = false;
    const regularHead = remote.head.bind(remote);
    remote.head = async () => initialized ? regularHead() : null;
    remote.initialize = async (path, bytes, expected) => {
        assert.equal(oid(bytes), expected); assert(!initialized);
        remote.set(path, Buffer.from(bytes)); initialized = true;
        return regularHead();
    };
    await local.file("folder/a.md", "a"); await local.file("folder/b.md", "b");
    assert.equal((await local.sync(remote)).sent, 0); assert(!initialized);
    const result = await local.sync(remote);
    assert.equal(result.sent, 2);
    assert.deepEqual([...remote.files.keys()].sort(), ["folder/a.md", "folder/b.md"]);
    assert.equal((await local.sync(remote)).sent, 0);
});

test("changing repository, branch or settings scope starts a new receive-only comparison", async t => {
    const [oldRemote, local] = await setup(t);
    oldRemote.set("shared.md", "same");
    await local.sync(oldRemote);
    const other = new Remote();
    other.target = {...oldRemote.target, branch: "next"};
    other.set("new.md", "new");
    await local.file("local.md", "unpublished");
    assert((await local.sync(other)).first); assert(!other.files.has("local.md"));
    const after = await local.sync(other, {scope: fileScope(true)});
    assert(after.first); assert(!other.files.has("local.md"));
    other.target = {repository: "example/another-repo", branch: "next"};
    assert((await local.sync(other)).first);
});

test("repository and ref validation limits requests to github.com and keeps branch names intact", () => {
    assert.equal(repositoryName("https://github.com/example/notes.git"), "example/notes");
    assert.equal(branchName("reading/notes-中文"), "reading/notes-中文");
    for (const name of ["../private", "https://other.example/owner/notes", "https://x@example.com/a/b", "a/b?ref=main"])
        assert.throws(() => repositoryName(name));
    for (const branch of ["bad..branch", "-option", "a/.b", "a.lock", "a b", "x@{1}", "a//b", "a?", "a[", "a\\b"])
        assert.throws(() => branchName(branch));
});

test("the client rejects public data repositories before downloading or uploading files", async () => {
    const calls = [];
    const api = new GitHub({repository:"example/notes", branch:""}, "test", async options => {
        calls.push(options);
        return {status:200, json:{full_name:"example/notes", private:false, default_branch:"main", node_id:"test"}};
    }, () => "");
    await assert.rejects(api.snapshot(), /private/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.github.com/repos/example/notes");
});

test("selecting the default branch handles empty repositories and escapes nested ref segments", async () => {
    const requests = [];
    const api = new GitHub({repository:"example/notes", branch:""}, "test", async options => {
        requests.push(options.url);
        if (options.url.endsWith("/example/notes")) return {status:200,json:{private:true, full_name:"Example/Notes", default_branch:"team/draft#1",node_id:"fixture"}};
        if (options.url.includes("/git/ref/")) return {status:409};
        if (options.url.endsWith("/branches?per_page=1")) return {status:200,json:[]};
        throw Error("Unexpected request");
    }, () => "");
    const snap = await api.snapshot();
    assert.equal(snap.head, null); assert.equal(api.branch, "team/draft#1");
    assert(requests.includes("https://api.github.com/repos/example/notes/git/ref/heads/team/draft%231"));
});
