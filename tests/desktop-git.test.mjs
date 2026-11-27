import test from "node:test";
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdtemp, mkdir, rename, rm, writeFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {runInNewContext} from "node:vm";
import {build} from "esbuild";

const bundle = await build({entryPoints: ["src/plugin.js"], bundle: true, write: false, format: "cjs", external: ["obsidian"]});
const exec = promisify(execFile);

function device({mobile = false, enabled = true, installed = true, checkout = true, provider} = {}) {
    const commands = [], notices = [], storage = new Map([["vault-branch-sync.desktop-git", enabled]]);
    const module = {exports: {}};
    const obsidian = {
        Platform: {isMobile: mobile}, Plugin: class {}, Modal: class {}, PluginSettingTab: class {},
        getLanguage: () => "en", Notice: class { constructor(message) { notices.push(message); } }
    };
    runInNewContext(bundle.outputFiles[0].text, {module, require: () => obsidian, TextEncoder, TextDecoder, crypto: webcrypto});
    const plugin = new module.exports.default();
    plugin.active = true;
    plugin.app = {
        loadLocalStorage: key => storage.get(key), saveLocalStorage: (key, value) => storage.set(key, value),
        vault: {adapter: {exists: async path => path === ".git" && checkout}}, workspace: {trigger() {}},
        plugins: {getPlugin: name => installed && name === "obsidian-git" ? provider : null},
        commands: {listCommands: () => installed ? [{id: "obsidian-git:open-git-view"}] : [],
            executeCommandById: id => { commands.push(id); return true; }}
    };
    return {plugin, commands, notices, storage};
}

test("desktop background receive stays idle and explicit receive delegates to Git Pull", async () => {
    const {plugin, commands} = device();
    plugin.connection = () => { throw Error("A desktop Git operation should not open an API connection"); };
    await plugin.run(false, true);
    await plugin.run(false);
    assert.deepEqual(commands, ["obsidian-git:pull"]);
    assert.match(plugin.statusText(), /Desktop Git/);
});

async function checkout(t) {
    const root = await mkdtemp(join(tmpdir(), "staged-vault-"));
    t.after(() => rm(root, {recursive: true, force: true}));
    const folder = join(root, "notes"), upstream = join(root, "remote.git");
    await mkdir(folder);
    const git = async (...args) => (await exec("git", ["-C", folder, ...args])).stdout;
    const file = (name, body) => writeFile(join(folder, name), body);
    await git("init", "--bare", "-b", "main", upstream);
    await git("init", "-b", "main");
    await git("config", "user.name", "Notes Test");
    await git("config", "user.email", "notes@example.invalid");
    await git("config", "commit.gpgsign", "false");
    await file("Paper.md", "base\n");
    await git("add", "--", "Paper.md");
    await git("commit", "-m", "Base");
    await git("remote", "add", "origin", upstream);
    await git("push", "-u", "origin", "main:refs/heads/reading/main");
    const pushCalls = [];
    const provider = {
        settings: {commitMessage: "Reviewed notes"}, promiseQueue: {addTask: task => void task()},
        gitManager: {
            status: async () => ({conflicted: [], staged: (await git("diff", "--cached", "--name-only", "-z")).split("\0").filter(Boolean)}),
            formatCommitMessage: async value => value,
            git: {
                raw: args => {
                    if (args[0] !== "push") return git(...args);
                    pushCalls.push(Array.from(args));
                    return git(...args, "--progress");
                },
                commit: async message => { await git("commit", "-m", message); return {commit: (await git("rev-parse", "--short", "HEAD")).trim()}; }
            }
        }
    };
    const remote = (...args) => git("--git-dir=" + upstream, ...args);
    return {...device({provider}), provider, upstream, git, remote, file, pushCalls};
}

test("Sync pushes exactly the index to the tracked branch and ignores later edits, drafts and unrelated refs", async t => {
    const {plugin, git, remote, file, pushCalls, notices} = await checkout(t);
    await file("Paper.md", "base\nselected\n");
    await git("add", "--", "Paper.md");
    await file("Paper.md", "base\nselected\nstill writing\n");
    await file("Draft.md", "private draft");
    await git("branch", "other");
    await git("config", "remote.origin.push", "refs/heads/other:refs/heads/other");
    await plugin.run(true);
    assert.match(notices.at(-1), /Pushed .*origin\/reading\/main/);
    assert.equal(await remote("show", "reading/main:Paper.md"), "base\nselected\n");
    assert.equal((await remote("ls-tree", "--name-only", "reading/main")).trim(), "Paper.md");
    assert.match(await git("diff", "--", "Paper.md"), /\+still writing/);
    assert.equal(await remote("for-each-ref", "refs/heads/other"), "");
    assert.equal((await git("log", "-1", "--format=%s")).trim(), "Reviewed notes");
    await plugin.run(true);
    assert.match(notices.at(-1), /Nothing staged/);
    assert.equal(pushCalls.length, 1);
});

test("a rejected push persists across restart and an empty-index retry uploads the same commit", async t => {
    const {plugin, provider, storage, upstream, git, remote, file, notices, pushCalls} = await checkout(t);
    await file("Paper.md", "selected");
    await git("add", "--", "Paper.md");
    await rename(upstream, upstream + ".offline");
    try { await plugin.run(true); } finally { await rename(upstream + ".offline", upstream); }
    const sha = (await git("rev-parse", "HEAD")).trim();
    assert.match(notices.at(-1), /Local commit .* was kept/);
    assert.notEqual((await remote("rev-parse", "reading/main")).trim(), sha);
    await file("Paper.md", "new unstaged revision");
    const reopened = device({provider});
    for (const [key, value] of storage) reopened.storage.set(key, value);
    await reopened.plugin.run(true);
    assert.match(reopened.notices.at(-1), /Pushed/);
    assert.equal((await git("rev-parse", "HEAD")).trim(), sha);
    assert.equal((await remote("rev-parse", "reading/main")).trim(), sha);
    assert.equal(await remote("show", "reading/main:Paper.md"), "selected");
    assert.equal(pushCalls.length, 2);
});

test("empty staging never publishes unrelated local commits, and a rejected commit never pushes", async t => {
    const {plugin, provider, git, remote, file, pushCalls, notices} = await checkout(t);
    const base = (await git("rev-parse", "HEAD")).trim();
    await file("Paper.md", "manual commit");
    await git("commit", "-am", "Local only");
    await plugin.run(true);
    assert.match(notices.at(-1), /Nothing staged/);
    await file("Paper.md", "to review");
    await git("add", "--", "Paper.md");
    provider.gitManager.git.commit = async () => {throw new Error("commit hook failed");};
    await plugin.run(true);
    assert.match(notices.at(-1), /commit hook failed/);
    assert.equal(pushCalls.length, 0);
    assert.equal((await remote("rev-parse", "reading/main")).trim(), base);
});

test("a phone push is preserved when Sync's commit is rejected as a non-fast-forward", async t => {
    const {plugin, git, remote, file, notices} = await checkout(t);
    await git("checkout", "-b", "phone");
    await file("Phone.md", "on the phone");
    await git("add", "--", "Phone.md");
    await git("commit", "-m", "From phone");
    await git("push", "origin", "phone:refs/heads/reading/main");
    const phone = (await git("rev-parse", "HEAD")).trim();
    await git("checkout", "main");
    await file("Paper.md", "Mac edit");
    await git("add", "--", "Paper.md");
    await plugin.run(true);
    assert.match(notices.at(-1), /remote rejected the push/);
    assert.equal((await remote("rev-parse", "reading/main")).trim(), phone);
    assert.equal(await remote("show", "reading/main:Phone.md"), "on the phone");
    assert.equal(await git("show", "HEAD:Paper.md"), "Mac edit");
});

test("a pending commit will not be retried to a repointed remote of the same name", async t => {
    const {plugin, git, remote, file, upstream, notices, pushCalls} = await checkout(t);
    await file("Paper.md", "selected");
    await git("add", "--", "Paper.md");
    await rename(upstream, upstream + ".offline");
    try { await plugin.run(true); } finally { await rename(upstream + ".offline", upstream); }
    const other = upstream + ".different";
    await git("clone", "--bare", upstream, other);
    await git("remote", "set-url", "--push", "origin", other);
    await plugin.run(true);
    assert.match(notices.at(-1), /upstream changed/);
    assert.equal(pushCalls.length, 1);
    assert.equal(await git("--git-dir=" + other, "rev-parse", "reading/main"), await remote("rev-parse", "reading/main"));
});

test("repeated Sync clicks while Git is busy run one operation after staging finishes", async t => {
    const {plugin, provider, file, git, pushCalls} = await checkout(t);
    const tasks = [];
    provider.promiseQueue.addTask = task => tasks.push(task);
    await file("Paper.md", "new text");
    const first = plugin.run(true);
    await new Promise(resolve => setImmediate(resolve));
    const second = plugin.run(true);
    await new Promise(resolve => setImmediate(resolve));
    await git("add", "--", "Paper.md");
    for (const task of tasks) await task();
    await Promise.all([first, second]);
    assert.equal(pushCalls.length, 1);
    assert.equal((await git("rev-list", "--count", "HEAD")).trim(), "2");
});

test("an unavailable Git integration leaves the checkout and the GitHub branch alone", async () => {
    for (const missing of [{installed: false}, {checkout: false}]) {
        const {plugin, commands, notices} = device(missing);
        await plugin.run(true);
        assert.equal(commands.length, 0);
        assert.match(notices[0], /Enable the Git|Git checkout/);
    }
});

test("mobile and opted-out desktops use direct sync and distinguish a completed check with conflicts", async () => {
    for (const options of [{mobile: true}, {enabled: false}]) {
        const {plugin, commands, storage} = device(options);
        assert.equal(plugin.usesDesktopGit(), false);
        await plugin.run(false, true);
        assert.equal(commands.length, 0);
        storage.set("vault-branch-sync.last-sync", {lastSuccess: null, received: 0, sent: 0, deferred: 1});
        assert.match(plugin.statusText(), /reached GitHub.*conflicts to review 1/);
    }
});
