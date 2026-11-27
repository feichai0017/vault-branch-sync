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

test("a missing ref update acknowledgement is reconciled against the actual GitHub branch", async t => {
    const before = "a".repeat(40), after = "b".repeat(40), other = "c".repeat(40);
    const refused = {status: 200, json: {errors: [{message: "Changes must be made through a pull request."}]}};
    for (const [name, reply, current, expected] of [
        ["lost response after success", new Error("offline"), after, null],
        ["incomplete reply after success", {status: 200, json: {data: {updateRefs: null}}}, after, null],
        ["earlier competing push", refused, other, HeadMoved],
        ["rejected branch rule", refused, before, /through a pull request/],
        ["ref and follow-up offline", new Error("could not reach GitHub"), null, /could not reach GitHub/]
    ]) await t.test(name, async () => {
        let headReads = 0, refWrites = 0;
        const api = new GitHub({repository: "example/notes", branch: "main"}, "test", async req => {
            if (req.url.endsWith("/graphql")) {
                refWrites++;
                const input = JSON.parse(req.body).variables.input;
                assert.equal(input.clientMutationId, after);
                assert.deepEqual(input.refUpdates, [{name: "refs/heads/main", beforeOid: before, afterOid: after, force: false}]);
                if (reply instanceof Error) throw reply;
                return reply;
            }
            if (req.url.includes("/git/ref/")) {
                headReads++;
                if (!current) throw new Error("second network failure");
                return {status: 200, json: {ref: "refs/heads/main", object: {sha: current}}};
            }
            return {status: 201, json: {sha: after}};
        }, () => "");
        const operation = api.commit({tree: before, head: before, node: "fixture"}, []);
        if (expected) await assert.rejects(operation, expected);
        else assert.equal(await operation, after);
        assert.equal(headReads, 1);
        assert.equal(refWrites, 1);
    });
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

const choose = (paths = [], conflicts = []) => ({selected: new Set(paths), conflicts: new Map(conflicts)});

test("automatic receive merges separate edits locally and a later selection commits only the reviewed result", async t => {
    const [r, d] = await setup(t);
    r.set("Paper.md","Formula"); await d.sync(r);
    await d.file("Paper.md","Formula\n\nMy thoughts"); await d.file("draft.md","unselected");
    r.set("Paper.md","Fixed formula");
    const head = await r.head();
    const merged = await d.sync(r, {send:false, fastReceive:true, review:() => {throw Error("clean receive needs no dialog");}});
    assert.equal(merged.merged,1); assert.equal(merged.sent,0); assert.equal(merged.pending,2);
    assert.equal(await r.head(),head); assert.equal(await d.text("Paper.md"),"Fixed formula\n\nMy thoughts");
    assert.equal(new Map(d.state.files).get("Paper.md"),oid("Fixed formula"));
    await d.sync(r, {review:plan => {assert.equal(plan.conflicts.length,0); return choose(["Paper.md"]);}});
    assert.equal(r.files.get("Paper.md"),oid("Fixed formula\n\nMy thoughts")); assert(!r.files.has("draft.md"));
});

test("manual merge supports per-hunk choices, cancellation and receive-only restrictions", async t => {
    const [r, d] = await setup(t);
    r.set("N.md","one\n\nnext"); await d.sync(r);
    await d.file("N.md","my one\n\nnext\n\nend"); r.set("N.md","their one\n\nnext");
    const head = await r.head();
    assert((await d.sync(r, {review:() => null})).canceled);
    await assert.rejects(d.sync(r, {review:() => choose([], [["N.md",{kind:"merge",sides:[]} ]])}), /every/);
    await assert.rejects(d.sync(r, {send:false,review:() => choose([], [["N.md",{kind:"merge",sides:["remote"],send:true}]])}), /Invalid/);
    assert.equal(await r.head(),head); assert.equal(await d.text("N.md"),"my one\n\nnext\n\nend");
    const result=await d.sync(r, {review:plan => {
        assert.equal(plan.merges.get("N.md").overlaps,1);
        return choose([], [["N.md",{kind:"merge",sides:["remote"],send:true}]]);
    }});
    assert.equal(result.sent,1); assert.equal(await d.text("N.md"),"their one\n\nnext\n\nend");
    assert.equal(r.files.get("N.md"),oid(await d.text("N.md")));
});

test("failed commit after a local merge is retryable and newer typing or head changes invalidate review", async t => {
    const [r,d]=await setup(t);
    r.set("N.md","one\n\nbase"); await d.sync(r);
    await d.file("N.md","one\n\nmine"); r.set("N.md","two\n\nbase");
    const decision=()=>choose([], [["N.md",{kind:"merge",send:true}]]);
    await assert.rejects(d.sync(r, {review:() => {r.set("Other.md","someone pushed"); return decision();}}), HeadMoved);
    await assert.rejects(d.sync(r, {review:async () => {await d.file("N.md","one\n\nnew typing"); return decision();}}), /Edited/);
    assert.equal(await d.text("N.md"),"one\n\nnew typing");
    const commit=r.commit.bind(r);
    r.commit=async () => {throw Error("offline");};
    await assert.rejects(d.sync(r, {review:decision}), /offline/);
    assert.equal(await d.text("N.md"),"two\n\nnew typing");
    assert.equal(new Map(d.state.files).get("N.md"),r.files.get("N.md"));
    r.commit=commit;
    const result=await d.sync(r, {review:plan => {assert.equal(plan.conflicts.length,0); return choose(["N.md"]);}});
    assert.equal(result.sent,1);assert.equal(r.files.get("N.md"),oid("two\n\nnew typing"));
});

test("review commits only the chosen note, index and image and still receives other changes", async t => {
    const [r, mac, phone] = await setup(t, 2);
    r.set("Index.md", "old"); r.set("Archive.md", "keep"); r.set("Updates.md", "old");
    await mac.sync(r); await phone.sync(r);
    await mac.file("Paper.md", "new"); await mac.file("Index.md", "with paper");
    await mac.file("Attachments/figure.png", Buffer.from([0, 255]));
    await mac.file("Personal/draft.md", "private draft"); await mac.adapter.trashLocal("Archive.md");
    r.set("Updates.md", "from phone");
    const selected = ["Paper.md", "Index.md", "Attachments/figure.png"];
    const writes = [];
    const upload = r.putBlob.bind(r);
    r.putBlob = async (bytes, sha) => { writes.push(sha); return upload(bytes, sha); };
    const before = r.revision;
    const result = await mac.sync(r, {review: plan => {
        assert(plan.canSend);
        assert.deepEqual(plan.incoming.map(c => c.path), ["Updates.md"]);
        assert.equal(plan.outgoing.find(c => c.path === "Archive.md").here, undefined);
        return choose(selected);
    }});
    assert.equal(r.revision, before + 1);
    assert.equal(result.sent, 3); assert.equal(result.pending, 2); assert.equal(result.received, 1);
    assert(!writes.includes(oid("private draft"))); assert(!r.files.has("Personal/draft.md"));
    assert(r.files.has("Archive.md")); assert.equal(await mac.text("Updates.md"), "from phone");
    await phone.sync(r, {send: false});
    assert.equal(await phone.text("Paper.md"), "new");
    const next = await mac.sync(r, {review: plan => {
        assert.deepEqual(plan.outgoing.map(x => x.path).sort(), ["Archive.md", "Personal/draft.md"]);
        return choose(["Archive.md"]);
    }});
    assert.equal(next.sent, 1); assert(!r.files.has("Archive.md")); assert(!r.files.has("Personal/draft.md"));
});

test("canceling the preview or selecting nothing does not publish local changes", async t => {
    const [r, d] = await setup(t);
    r.set("remote.md", "before"); await d.sync(r);
    r.set("remote.md", "after"); await d.file("local.md", "mine");
    const start = r.revision;
    assert((await d.sync(r, {review: () => null})).canceled);
    assert.equal(await d.text("remote.md"), "before");
    assert.equal((await d.sync(r, {review: () => choose()})).sent, 0);
    assert.equal(await d.text("remote.md"), "after"); assert.equal(start, r.revision);
});

test("an empty repository continues only with approved paths and approved bytes", async t => {
    const [r, d] = await setup(t);
    const existingHead = r.head.bind(r);
    r.head = () => r.files.size ? existingHead() : Promise.resolve(null);
    r.initialize = async (path, bytes) => {
        r.set(path, Buffer.from(bytes)); await d.file("late.md", "arrived after approval"); return r.head();
    };
    for (const name of ["a.md", "b.md", "draft.md"]) await d.file(name, name);
    await d.sync(r);
    let previews = 0;
    const result = await d.sync(r, {review: () => { previews++; return choose(["a.md", "b.md"]); }});
    assert.equal(result.sent, 2); assert.equal(previews, 1);
    assert.deepEqual([...r.files.keys()].sort(), ["a.md", "b.md"]);
});

test("per-file conflict choices support either version, both copies, and postponement across receives", async t => {
    const [r, d] = await setup(t);
    for (const path of ["local.md", "remote.md", "image.png", "later.md", "delete.md"]) r.set(path, "base");
    await d.sync(r);
    for (const path of r.files.keys()) { r.set(path, "remote"); await d.file(path, "local"); }
    await d.adapter.trashLocal("delete.md");
    await d.file("new-on-both.md", "local new"); r.set("new-on-both.md", "remote new");
    const result = await d.sync(r, {review: plan => {
        assert.equal(plan.conflicts.length, 6);
        return choose([], [["local.md","local"], ["delete.md","local"], ["remote.md","remote"], ["image.png","both"]]);
    }});
    assert.equal(result.sent, 2); assert.equal(result.copies, 1); assert.equal(result.deferred, 2);
    assert.equal(r.files.get("local.md"), oid("local")); assert(!r.files.has("delete.md"));
    assert.equal(await d.text("remote.md"), "remote"); assert.equal(await d.text("image.png"), "remote");
    assert.equal(await d.text((await d.adapter.list("Sync conflicts")).files[0]), "local");
    assert.equal(await d.text("later.md"), "local"); assert.equal(r.files.get("later.md"), oid("remote"));
    r.set("another.md", "separate change");
    const head = await r.head();
    const auto = await d.sync(r, {send: false, review: plan => {
        assert(!plan.canSend); assert.deepEqual(plan.outgoing, []);
        assert.deepEqual(plan.conflicts.map(x => x.path).sort(), ["later.md", "new-on-both.md"]);
        return choose();
    }});
    assert.equal(auto.deferred, 2); assert.equal(auto.received, 1); assert.equal(await r.head(), head);
    const again = await d.sync(r, {review: plan => {
        assert.equal(plan.conflicts.length, 2); return choose([], [["new-on-both.md", "remote"]]);
    }});
    assert.equal(again.deferred, 1); assert.equal(await d.text("new-on-both.md"), "remote new");
});

test("an automatic first receive defers collisions without uploading, and cannot commit a local resolution", async t => {
    const [r, d] = await setup(t);
    await d.file("conflict.md", "draft"); r.set("conflict.md", "other"); r.set("incoming.md", "receive");
    const head = await r.head();
    const result = await d.sync(r, {send: false, review: () => choose()});
    assert(result.first); assert.equal(result.deferred, 1); assert.equal(await d.text("conflict.md"), "draft");
    assert.equal(await d.text("incoming.md"), "receive");
    await assert.rejects(d.sync(r, {send: false, review: () => choose([], [["conflict.md", "local"]])}), /Invalid conflict decision/);
    assert.equal(await r.head(), head); assert.equal(r.files.get("conflict.md"), oid("other"));
    const kept = await d.sync(r, {send:false, review:() => choose([], [["conflict.md", "keep-local"]])});
    assert.equal(kept.deferred, 0); assert.equal(kept.sent, 0); assert.equal(await r.head(), head);
    assert.equal(await d.text("conflict.md"), "draft");
    await d.sync(r, {review:plan => {
        assert.equal(plan.conflicts.length, 0); assert.deepEqual(plan.outgoing.map(c => c.path), ["conflict.md"]);
        return choose(["conflict.md"]);
    }});
    assert.equal(r.files.get("conflict.md"), oid("draft"));
});

test("a moving head or edited selection invalidates the user's preview before publishing", async t => {
    const [r, d] = await setup(t);
    r.set("shared.md", "old"); await d.sync(r); await d.file("note.md", "selected");
    r.set("shared.md", "one");
    await assert.rejects(d.sync(r, {review: () => {
        r.set("shared.md", "two"); return choose(["note.md"]);
    }}), HeadMoved);
    assert.equal(await d.text("shared.md"), "old"); assert(!r.files.has("note.md"));
    await assert.rejects(d.sync(r, {review: async () => {
        await d.file("note.md", "edited while previewing"); return choose(["note.md"]);
    }}), /Edited during upload/);
    assert.equal(await d.text("note.md"), "edited while previewing"); assert(!r.files.has("note.md"));
});

test("foreground checks skip file reads only for a completely received unchanged revision", async t => {
    const [r, d] = await setup(t);
    const snapshot = r.snapshot.bind(r);
    const hints = [];
    r.snapshot = async known => {
        hints.push(known);
        return known && known === await r.head() ? {unchanged:true,head:known} : snapshot();
    };
    r.set("note.md", "old");
    const auto = {send:false, fastReceive:true, review:() => choose()};
    await d.sync(r, auto);
    const list = d.adapter.list;
    d.adapter.list = () => { throw Error("Unnecessary vault scan"); };
    assert.equal((await d.sync(r, auto)).received, 0); assert.equal(hints.at(-1), await r.head());
    d.adapter.list = list;
    await d.file("note.md", "local"); r.set("note.md", "remote");
    assert.equal((await d.sync(r, auto)).deferred, 1);
    assert.equal((await d.sync(r, auto)).deferred, 1);
    assert.equal(hints.at(-1), undefined);
    await d.sync(r, {review:() => choose([], [["note.md","remote"]])});
    // Old 1.0.1 baselines lack the completeness flag and must get a full first comparison.
    delete d.state.settled;
    assert.equal((await d.sync(r, auto)).received, 0); assert.equal(hints.at(-1), undefined);
});
