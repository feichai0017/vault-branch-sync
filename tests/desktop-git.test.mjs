import test from "node:test";
import assert from "node:assert/strict";
import {runInNewContext} from "node:vm";
import {build} from "esbuild";

const bundle = await build({entryPoints: ["src/plugin.js"], bundle: true, write: false, format: "cjs", external: ["obsidian"]});

function device({mobile = false, enabled = true, installed = true, checkout = true} = {}) {
    const commands = [], notices = [], storage = new Map([["vault-branch-sync.desktop-git", enabled]]);
    const module = {exports: {}};
    const obsidian = {
        Platform: {isMobile: mobile}, Plugin: class {}, Modal: class {}, PluginSettingTab: class {},
        getLanguage: () => "en", Notice: class { constructor(message) { notices.push(message); } }
    };
    runInNewContext(bundle.outputFiles[0].text, {module, require: () => obsidian, TextEncoder, TextDecoder});
    const plugin = new module.exports.default();
    plugin.active = true;
    plugin.app = {
        loadLocalStorage: key => storage.get(key), vault: {adapter: {exists: async path => path === ".git" && checkout}},
        commands: {listCommands: () => installed ? [{id: "obsidian-git:open-git-view"}] : [],
            executeCommandById: id => { commands.push(id); return true; }}
    };
    return {plugin, commands, notices, storage};
}

test("desktop review opens Git without committing and delegates only explicit pulls", async () => {
    const {plugin, commands} = device();
    plugin.connection = () => { throw Error("A desktop Git operation should not open an API connection"); };
    await plugin.run(true);
    await plugin.run(false, true);
    await plugin.run(false);
    assert.deepEqual(commands, ["obsidian-git:open-git-view", "obsidian-git:pull"]);
    assert.match(plugin.statusText(), /Desktop Git/);
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
