import {Notice, Platform, Plugin, PluginSettingTab, Setting, TextFileView, TFolder, arrayBufferToBase64, getLanguage, parseLinktext, requestUrl} from "obsidian";
import {relatedFigures} from "./attachments.js";
import {compareNote, isMarkdownNote} from "./compare.js";
import {NoteHistory} from "./history-modal.js";
import {SyncReview, t} from "./review.js";
import {HeadMoved, synchronize} from "./engine.js";
import {GitHub} from "./github.js";
import {branchName, fileScope, repositoryName, sameTarget} from "./target.js";

const connectionKey = "vault-branch-sync.connection.v1";
const baselineKey = "vault-branch-sync.baseline.v1";
const autoKey = "vault-branch-sync.auto-receive";
const statusKey = "vault-branch-sync.last-sync";
const desktopGitKey = "vault-branch-sync.desktop-git";
const tokenPage = "https://github.com/settings/personal-access-tokens/new?name=Vault%20Branch%20Sync&contents=write";

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
        async mergeText(path, original, merged) {
            const file = vault.getFileByPath(path);
            if (!file) throw new Error("Moved during merge: " + path);
            await vault.process(file, current => {
                if (current !== original) throw new Error("Edited during merge: " + path);
                return merged;
            });
        },
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
        const tokenSetting = new Setting(el).setName(t("GitHub token", "GitHub 令牌"));
        tokenSetting.descEl.appendText(t("Choose only your vault repository and grant Contents read and write. ", "只选择自己的笔记仓库，授予 Contents 读写权限。"));
        tokenSetting.descEl.createEl("a", {text: t("Create a fine-grained token on GitHub", "到 GitHub 创建细粒度令牌"), href: tokenPage});
        tokenSetting.addText(input => {
                tokenInput = input;
                input.inputEl.type = "password"; input.inputEl.autocomplete = "off"; input.inputEl.spellcheck = false;
                input.setPlaceholder(current ? t("Saved on this device", "本设备已保存") : t("Paste token", "粘贴令牌"));
            });
        new Setting(el).setName(t("Include settings and themes", "同步常用设置与主题"))
            .setDesc(t("Also sync appearance, hotkeys, themes and CSS snippets in this vault's configuration folder. Close and reopen the vault to apply downloaded appearance changes.",
                "同时同步外观、快捷键、主题和 CSS 片段。接收后重新打开库即可加载外观。"))
            .addToggle(toggle => toggle.setValue(share).onChange(value => { share = value; }));
        new Setting(el).setName(t("Connect this device", "连接本设备"))
            .setDesc(t("A new connection starts with a download. Later you can choose which files to commit.",
                "新连接首次只接收，之后可以选择要提交的文件。"))
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
        const native = plugin.usesDesktopGit();
        if (!Platform.isMobile) {
            new Setting(el).setName(t("Use the Git plugin on this computer", "在本机使用 Git 插件同步"))
                .setDesc(t("For vaults cloned with Git. Sync opens Source Control. Receive runs Git Pull on the checkout's current branch and upstream. The Git plugin manages background pulls.",
                    "适用于用 Git 克隆的笔记库。点同步打开右侧更改面板，点拉取使用本地分支及其上游。自动拉取在 Git 插件中设置。"))
                .addToggle(toggle => toggle.setValue(native).onChange(async value => {
                    try {
                        if (plugin.busy) throw new Error(t("Wait for the current sync to finish.", "请等当前同步完成。"));
                        if (value) await plugin.requireDesktopGit();
                        this.app.saveLocalStorage(desktopGitKey, value);
                        plugin.scheduleReceive();
                    } catch (error) { new Notice(error.message, 9000); }
                    this.display();
                }));
        }
        if (!native) new Setting(el).setName(t("Receive when opening or returning to this vault", "打开笔记库或回到前台时自动接收"))
            .setDesc(t("On this device, download GitHub changes and leave conflicts for review. Uploads are always manual.",
                "此设备会自动接收 GitHub 更新，遇到冲突留待你选择。上传仍由你手动发起。"))
            .addToggle(toggle => toggle.setValue(plugin.autoEnabled()).onChange(value => {
                this.app.saveLocalStorage(autoKey, value);
                plugin.scheduleReceive();
            }));
        this.statusSetting = new Setting(el).setName(t("Sync status on this device", "本设备同步状态"));
        plugin.refreshStatus();
        new Setting(el).setName(t("Sync vault", "同步笔记"))
            .setDesc(native ? t("Select changed files in Source Control, commit staged files, then push.", "在右侧面板查看差异，暂存选中的文件，提交已暂存的改动，再推送。")
                : t("Review incoming changes and choose the local files to commit together.", "预览待接收的改动，并勾选本次一起提交的文件。"))
            .addButton(b => b.setButtonText(native ? t("Open Git changes", "打开 Git 更改") : t("Review changes", "预览同步改动"))
                .onClick(() => { if (native) this.app.setting?.close(); return plugin.run(true); }))
            .addButton(b => b.setButtonText(native ? t("Git pull", "用 Git 拉取") : t("Receive changes", "仅接收")).onClick(() => plugin.run(false)));
    }

    hide() { this.statusSetting = null; }
}

export default class VaultBranchSync extends Plugin {
    onload() {
        this.busy = false;
        this.active = true;
        this.ready = false;
        this.settingsTab = new Settings(this.app, this);
        this.addSettingTab(this.settingsTab);
        if (!Platform.isMobile) this.statusBar = this.addStatusBarItem();
        this.refreshStatus();
        this.addRibbonIcon("refresh-cw", t("Sync vault with GitHub", "同步笔记到 GitHub"), () => this.run(true));
        this.addCommand({id: "sync", name: t("Sync with GitHub", "与 GitHub 同步"), callback: () => this.run(true)});
        this.addCommand({id: "receive", name: t("Receive changes from GitHub", "仅接收 GitHub 更新"), callback: () => this.run(false)});
        if (!Platform.isMobile) this.addCommand({id: "git-diff", name: t("View Git diff for current file", "查看当前文件的 Git 差异"),
            checkCallback: checking => {
                if (!this.usesDesktopGit() || !this.app.workspace.getActiveFile()) return false;
                if (!checking) void this.gitAction("open-diff-view");
                return true;
            }});
        this.addCommand({id: "show-status", name: t("Show sync status", "查看同步状态"), callback: () => new Notice(this.statusText(), 8000)});
        const historyTitle = t("View note history on GitHub", "查看本篇 GitHub 历史");
        this.addCommand({id: "note-history", name: historyTitle, checkCallback: checking => {
            const file = this.app.workspace.getActiveFile();
            if (!file || !isMarkdownNote(file.path)) return false;
            if (!checking) this.openHistory(file);
            return true;
        }});
        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
            if (file.extension && isMarkdownNote(file.path)) menu.addItem(item => item.setTitle(historyTitle)
                .setIcon("history").onClick(() => this.openHistory(file)));
        }));
        this.app.workspace.onLayoutReady(() => {
            if (!this.active) return;
            this.doc = this.app.workspace.containerEl.ownerDocument;
            this.win = this.doc.defaultView;
            this.ready = true;
            this.registerDomEvent(this.doc, "visibilitychange", () => this.scheduleReceive());
            this.registerDomEvent(this.win, "focus", () => this.scheduleReceive());
            this.scheduleReceive();
        });
    }

    onunload() {
        this.active = false;
        this.win?.clearTimeout(this.autoTimer);
        this.reviewModal?.close();
        this.historyModal?.close();
    }

    autoEnabled() { return this.app.loadLocalStorage(autoKey) === true; }

    usesDesktopGit() { return !Platform.isMobile && this.app.loadLocalStorage(desktopGitKey) === true; }

    async requireDesktopGit() {
        if (!this.app.commands?.listCommands?.().some(command => command.id === "obsidian-git:open-git-view")) {
            throw new Error(t("Enable the Git community plugin in this vault.", "请先在本库的第三方插件中启用 Git。"));
        }
        if (!await this.app.vault.adapter.exists(".git")) {
            throw new Error(t("Open a vault whose root is a Git checkout.", "请打开根目录含有 .git 的笔记库。"));
        }
    }

    async gitAction(command) {
        try {
            await this.requireDesktopGit();
            if (!this.app.commands.executeCommandById("obsidian-git:" + command)) {
                throw new Error(t("This Git command is unavailable in the current view.", "当前视图无法执行这个 Git 命令。"));
            }
        } catch (error) { new Notice(error.message, 9000); }
    }

    scheduleReceive() {
        if (!this.ready || !this.active) return;
        this.win.clearTimeout(this.autoTimer);
        if (this.usesDesktopGit() || this.doc.hidden || this.busy || !this.autoEnabled() || !this.connection()) return;
        // iOS can signal both visibility and focus for the same foreground transition.
        this.autoTimer = this.win.setTimeout(() => {
            if (this.active && !this.doc.hidden && !this.busy && this.autoEnabled()) void this.run(false, true);
        }, 300);
    }

    statusText() {
        if (this.usesDesktopGit()) return t("Desktop Git · Open Source Control to see changes, commits and push status.",
            "本机使用 Git · 在右侧更改面板查看文件、提交和推送状态。");
        const status = this.app.loadLocalStorage(statusKey);
        let text = t("No sync recorded on this device yet.", "本设备尚无同步记录。");
        if (status?.lastSuccess) text = t("Last successful sync", "上次成功同步") + " · " + new Date(status.lastSuccess).toLocaleString(getLanguage());
        else if (status) text = t("Last check reached GitHub", "上次检查已连通 GitHub");
        if (status) {
            text += t(" | Last check: received ", " | 上次检查接收 ") + status.received + t(", committed ", "，提交 ") + status.sent;
            if (status.deferred) text += t(", conflicts to review ", "，待处理冲突 ") + status.deferred;
            if (status.merged) text += t(", merged ", "，已合并 ") + status.merged;
        }
        if (this.lastError) text += " | " + this.lastError;
        return text;
    }

    refreshStatus() {
        const text = this.statusText();
        this.settingsTab?.statusSetting?.setDesc(text);
        if (this.statusBar) {
            if (this.usesDesktopGit()) {
                this.statusBar.setText("Git");
                this.statusBar.setAttribute("aria-label", text);
                this.statusBar.title = text;
                return;
            }
            const status = this.app.loadLocalStorage(statusKey);
            const stamp = status?.lastChecked || status?.lastSuccess;
            const time = stamp ? new Date(stamp).toLocaleTimeString(getLanguage(), {hour: "2-digit", minute: "2-digit"}) : "—";
            this.statusBar.setText(this.connection() ? "GitHub · " + time + (status?.deferred || this.lastError ? " ⚠" : "") : "");
            this.statusBar.setAttribute("aria-label", text);
            this.statusBar.title = text;
        }
    }

    connection() { return this.app.loadLocalStorage(connectionKey); }

    openHistory(file) {
        const target = this.connection();
        const token = target && this.app.secretStorage.getSecret(target.secretId);
        if (!token) {
            new Notice(t("Connect this device in Settings → Vault Branch Sync first.", "请先到「设置 → Vault Branch Sync」连接本设备。"));
            return;
        }
        this.historyModal?.close();
        const api = this.client(target, token, fileScope(target.settings, this.app.vault.configDir));
        this.historyModal = new NoteHistory(this.app, file, api);
        this.historyModal.open();
    }

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
            if (!sameTarget(previous, target) || previous?.settings !== settings) {
                this.app.saveLocalStorage(baselineKey, null);
                this.app.saveLocalStorage(statusKey, null);
            }
            this.lastError = null;
            this.refreshStatus();
        } finally {this.busy = false;}
        this.scheduleReceive();
    }

    async run(send, automatic = false) {
        if (this.busy || !this.active) {
            if (!automatic && this.active) new Notice(t("A sync or connection check is already running.", "正在同步或检查连接。"));
            return;
        }
        if (this.usesDesktopGit()) {
            if (!automatic) await this.gitAction(send ? "open-git-view" : "pull");
            return;
        }
        const connection = this.connection();
        if (!connection) {
            if (!automatic) new Notice(t("Open Settings → Vault Branch Sync to connect a private GitHub repository.",
                "请先在「设置 → Vault Branch Sync」连接自己的 GitHub 私有仓库。"), 9000);
            return;
        }
        this.busy = true;
        let notice;
        try {
            const token = this.app.secretStorage.getSecret(connection.secretId);
            if (!token) throw new Error(t("Reconnect in settings to restore this device's token.", "请在设置里重新连接，保存本设备的令牌。"));
            const target = {repository: connection.repository, branch: connection.branch};
            const scope = fileScope(connection.settings, this.app.vault.configDir);
            const api = this.client(target, token, scope), adapter = vaultFiles(this.app, scope);
            if (!automatic) notice = new Notice(t("Reading branch…", "正在读取分支…"), 0);
            const review = plan => {
                if (!this.active) return null;
                if (automatic) return {selected: new Set(), conflicts: new Map()};
                const eligible = new Set(plan.outgoing.filter(change => change.here).map(change => change.path));
                const {metadataCache, vault} = this.app;
                const meta = path => {
                    const file = vault.getFileByPath(path);
                    return file && metadataCache.getFileCache(file);
                };
                return new Promise(resolve => {
                    this.reviewModal = new SyncReview(this.app, plan,
                        change => compareNote(change, adapter, api, plan.remoteSize(change.path)),
                        result => { this.reviewModal = null; resolve(result); },
                        path => relatedFigures(path, eligible, meta(path),
                            (link, source) => metadataCache.getFirstLinkpathDest(parseLinktext(link).path, source)?.path,
                            path => /\.excalidraw(?:\.md)?$/i.test(path) ||
                                Boolean(/\.md$/i.test(path) && meta(path)?.frontmatter?.["excalidraw-plugin"])));
                    this.reviewModal.open();
                });
            };
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await synchronize({adapter, api, scope, target, send: send && !automatic, fastReceive: automatic, review,
                        state: this.app.loadLocalStorage(baselineKey), save: value => this.app.saveLocalStorage(baselineKey, value),
                        progress: message => notice?.setMessage(message)
                    });
                    if (result.canceled) {
                        if (this.active && !automatic) new Notice(t("Sync canceled.", "已取消同步。"));
                        return;
                    }
                    const previous = this.app.loadLocalStorage(statusKey);
                    const {received, sent, deferred} = result;
                    const lastChecked = Date.now();
                    this.app.saveLocalStorage(statusKey, {
                        lastChecked, lastSuccess: received || sent || !deferred ? lastChecked : previous?.lastSuccess ?? null,
                        received, sent, deferred, merged: result.merged || 0
                    });
                    this.lastError = null;
                    this.refreshStatus();
                    if (this.active && (!automatic || received || (deferred && deferred !== previous?.deferred))) {
                        let message = result.first ? t("First download complete", "首次接收完成") : t("Sync finished", "同步完成");
                        message += t(" · Received ", " · 接收 ") + received + t(", committed ", "，提交 ") + sent;
                        if (deferred) message += t(" · Review conflicts: ", " · 待处理冲突 ") + deferred;
                        if (result.merged) message += t(" · Merged ", " · 已合并 ") + result.merged;
                        if (result.copies) message += t(" · Local copies in Sync conflicts", " · 本机副本已存入 Sync conflicts");
                        new Notice(message, 8000);
                    }
                    return;
                } catch (error) {
                    if (!(error instanceof HeadMoved) || attempt || !this.active) throw error;
                    notice?.setMessage(t("Another device pushed. Comparing again…", "另一台设备刚刚推送，正在重新比较…"));
                }
            }
        } catch (error) {
            this.lastError = error.message;
            this.refreshStatus();
            if (this.active && !automatic) new Notice(error.message, 10000);
        } finally {
            notice?.hide();
            this.busy = false;
        }
    }
}
