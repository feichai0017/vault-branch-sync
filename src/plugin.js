import {Modal, Notice, Plugin, PluginSettingTab, Setting, TextFileView, TFolder, arrayBufferToBase64, getLanguage, requestUrl} from "obsidian";
import {HeadMoved, synchronize} from "./engine.js";
import {GitHub} from "./github.js";
import {branchName, fileScope, repositoryName, sameTarget} from "./target.js";

const connectionKey = "vault-branch-sync.connection.v1";
const baselineKey = "vault-branch-sync.baseline.v1";
const tokenPage = "https://github.com/settings/personal-access-tokens/new?name=Vault%20Branch%20Sync&contents=write";
const t = (en, zh) => getLanguage().startsWith("zh") ? zh : en;

function vaultFiles(app, scope) {
    const vault = app.vault, disk = vault.adapter;
    const isConfig = path => path === scope.configDir || path.startsWith(scope.configDir + "/");
    return {
        async list(dir) {
            if (isConfig(dir)) return disk.list(dir);
            const folder = dir ? vault.getFolderByPath(dir) : vault.getRoot();
            const files = [], folders = [];
            for (const item of folder?.children || []) (item instanceof TFolder ? folders : files).push(item.path);
            const rule = (dir ? dir + "/" : "") + ".gitignore";
            if (await disk.exists(rule)) files.push(rule);
            if (!dir && scope.settings && !folders.includes(scope.configDir) && await disk.exists(scope.configDir)) folders.push(scope.configDir);
            return {files, folders};
        },
        stat: path => disk.stat(path), exists: path => disk.exists(path),
        read: path => disk.read(path), readBinary: path => disk.readBinary(path),
        async flush(path) {
            const view = app.workspace.getActiveViewOfType(TextFileView);
            if (view?.file && (!path || view.file.path === path)) await view.save(false);
        },
        mkdir: path => isConfig(path) ? disk.mkdir(path) : vault.createFolder(path),
        writeBinary(path, bytes) {
            if (isConfig(path)) return disk.writeBinary(path, bytes);
            const file = vault.getFileByPath(path);
            if (file) return vault.modifyBinary(file, bytes);
            return vault.createBinary(path, bytes);
        },
        trashLocal(path) {
            const file = vault.getFileByPath(path);
            return file ? vault.trash(file, false) : disk.trashLocal(path);
        }
    };
}

class Conflicts extends Modal {
    constructor(app, changes, resolve) { super(app); this.changes = changes; this.resolve = resolve; }
    onOpen() {
        this.setTitle(t("Keep both versions?", "保留两边的版本？"));
        this.contentEl.createEl("p", {text: t(
            "The following files changed on both sides. Keep both saves your local version in “Sync conflicts” and applies the GitHub version at the original path. A remote deletion moves the original to the vault trash.",
            "以下文件在两边都有改动。选择「保留两份」会把本机版本存入「Sync conflicts」，原路径采用 GitHub 版本。GitHub 已删除的原文件会移入本机废纸篓。")});
        const list = this.contentEl.createEl("ul");
        for (const {path} of this.changes) list.createEl("li", {text: path});
        new Setting(this.contentEl)
            .addButton(button => button.setButtonText(t("Cancel", "取消")).onClick(() => this.close()))
            .addButton(button => button.setButtonText(t("Keep both", "保留两份")).setCta().onClick(() => {
                this.resolve(true); this.close();
            }));
    }
    onClose() { this.resolve(false); this.contentEl.empty(); }
}

class Settings extends PluginSettingTab {
    constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
    display() {
        const el = this.containerEl, plugin = this.plugin, current = plugin.connection();
        el.empty();
        let repoInput, branchInput, tokenInput, share = current?.settings ?? false;
        new Setting(el).setName(t("Private GitHub repository", "GitHub 私有仓库"))
            .setDesc(t("Use a repository for your vault. Enter owner/name or its GitHub URL.", "填写笔记仓库的 owner/name 或 GitHub 地址。"))
            .addText(input => {repoInput = input; input.setPlaceholder("owner/my-notes").setValue(current?.repository || "");});
        new Setting(el).setName(t("Branch", "分支"))
            .setDesc(t("Leave blank to use the repository's default branch.", "留空时使用仓库默认分支。"))
            .addText(input => {branchInput = input; input.setPlaceholder(t("Default branch", "默认分支")).setValue(current?.branch || "");});
        const desc = document.createDocumentFragment();
        desc.appendText(t("Choose only your vault repository and grant Contents read and write. ", "只选择自己的笔记仓库，授予 Contents 读写权限。"));
        desc.createEl("a", {text: t("Create a fine-grained token on GitHub", "到 GitHub 创建细粒度令牌"), href: tokenPage});
        new Setting(el).setName(t("GitHub token", "GitHub 令牌")).setDesc(desc)
            .addText(input => {
                tokenInput = input;
                input.inputEl.type = "password"; input.inputEl.autocomplete = "off"; input.inputEl.spellcheck = false;
                input.setPlaceholder(current ? t("Saved on this device", "本设备已保存") : t("Paste token", "粘贴令牌"));
            });
        new Setting(el).setName(t("Include settings and themes", "同步常用设置与主题"))
            .setDesc(t("Also sync appearance, hotkeys, themes and CSS snippets in this vault's configuration folder. Close and reopen the vault to apply downloaded appearance changes.",
                "同时同步外观、快捷键、主题和 CSS 片段。接收后重新打开库即可加载外观。"))
            .addToggle(toggle => toggle.setValue(share).onChange(value => { share = value; }));
        new Setting(el).setName(t("Connect this device", "连接本设备"))
            .setDesc(t("A new repository, branch or file scope starts with a download. After that, Sync can upload existing files in this vault.",
                "更换仓库、分支或同步范围后首次只接收。之后点击同步会上传本库中有改动的文件。"))
            .addButton(button => button.setButtonText(t("Save connection", "保存连接")).setCta().onClick(async () => {
                if (plugin.busy) return;
                button.setDisabled(true);
                try {
                    await plugin.connect(repoInput.getValue(), branchInput.getValue(), tokenInput.getValue(), share);
                    tokenInput.setValue(""); this.display();
                    new Notice(t("Connected. Use Receive changes to download this branch.", "已连接。点「仅接收」下载这个分支。"));
                } catch (error) { new Notice(error.message, 10000); }
                finally {button.setDisabled(false);}
            }));
        new Setting(el).setName(t("Sync vault", "同步笔记"))
            .setDesc(t("Receive remote changes and send local edits in a Git commit.", "接收远端更新，并把本机改动提交到 GitHub。"))
            .addButton(b => b.setButtonText(t("Sync now", "立即同步")).onClick(() => plugin.run(true)))
            .addButton(b => b.setButtonText(t("Receive changes", "仅接收")).onClick(() => plugin.run(false)));
    }
}

export default class VaultBranchSync extends Plugin {
    onload() {
        this.busy = false;
        this.addSettingTab(new Settings(this.app, this));
        this.addRibbonIcon("refresh-cw", t("Sync vault with GitHub", "同步笔记到 GitHub"), () => this.run(true));
        this.addCommand({id: "sync", name: t("Sync with GitHub", "与 GitHub 同步"), callback: () => this.run(true)});
        this.addCommand({id: "receive", name: t("Receive changes from GitHub", "仅接收 GitHub 更新"), callback: () => this.run(false)});
    }

    connection() { return this.app.loadLocalStorage(connectionKey); }

    client(target, token, scope) {
        return new GitHub(target, token, async options => {
            try {return await requestUrl(options);}
            catch {throw new Error(t("Could not reach GitHub. You can keep editing offline and retry later.",
                "暂时连不上 GitHub，可以继续离线记录，联网后再次同步。"));}
        }, arrayBufferToBase64, scope);
    }

    async connect(name, branchValue, tokenValue, settings) {
        this.busy = true;
        try {
            const previous = this.connection(), repository = repositoryName(name);
            const target = {repository, branch: branchValue.trim() ? branchName(branchValue) : ""};
            const sameRepository = previous?.repository?.toLowerCase() === repository.toLowerCase();
            const token = tokenValue.trim() || (sameRepository && this.app.secretStorage.getSecret(previous.secretId));
            if (!token) throw new Error(t("A token is required for this repository.", "请为这个仓库填写访问令牌。"));
            const client = this.client(target, token, fileScope(settings, this.app.vault.configDir));
            const info = await client.repository();
            await client.head();
            target.repository = info.full_name;
            target.branch = client.branch;
            const secretId = previous?.secretId || "vault-branch-sync-" + crypto.randomUUID();
            this.app.secretStorage.setSecret(secretId, token);
            this.app.saveLocalStorage(connectionKey, {...target, secretId, settings});
            if (!sameTarget(previous, target) || previous?.settings !== settings) this.app.saveLocalStorage(baselineKey, null);
        } finally {this.busy = false;}
    }

    async run(send) {
        if (this.busy) {new Notice(t("A sync or connection check is already running.", "正在同步或检查连接。")); return;}
        const connection = this.connection();
        if (!connection) {new Notice(t("Open Settings → Vault Branch Sync to connect a private GitHub repository.",
            "请先在「设置 → Vault Branch Sync」连接自己的 GitHub 私有仓库。"), 9000); return;}
        this.busy = true;
        let notice;
        try {
            const token = this.app.secretStorage.getSecret(connection.secretId);
            if (!token) throw new Error(t("Reconnect in settings to restore this device's token.", "请在设置里重新连接，保存本设备的令牌。"));
            const target = {repository: connection.repository, branch: connection.branch};
            const scope = fileScope(connection.settings, this.app.vault.configDir);
            const api = this.client(target, token, scope), adapter = vaultFiles(this.app, scope);
            notice = new Notice(t("Reading branch…", "正在读取分支…"), 0);
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await synchronize({adapter, api, scope, target, send,
                        state: this.app.loadLocalStorage(baselineKey), save: state => this.app.saveLocalStorage(baselineKey, state),
                        confirm: changes => new Promise(resolve => new Conflicts(this.app, changes, resolve).open()),
                        progress: message => notice.setMessage(message)
                    });
                    if (result.canceled) {new Notice(t("Sync canceled.", "已取消同步。")); return;}
                    const prefix = result.first ? t("First download complete", "首次接收完成") : t("Sync complete", "同步完成");
                    new Notice(prefix + t(" · Received ", " · 接收 ") + result.received + t(", sent ", "，提交 ") + result.sent +
                        (result.copies ? t(". Local copies are in Sync conflicts.", "。本地副本在 Sync conflicts。") : ""), 8000);
                    return;
                } catch (error) {
                    if (!(error instanceof HeadMoved) || attempt) throw error;
                    notice.setMessage(t("Another device pushed. Comparing again…", "另一台设备刚刚推送，正在重新比较…"));
                }
            }
        } catch (error) {new Notice(error.message, 10000);}
        finally {notice?.hide(); this.busy = false;}
    }
}
