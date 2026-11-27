import {getLanguage, Modal, Setting} from "obsidian";
import {isMarkdownNote} from "./compare.js";

export const t = (en, zh) => getLanguage().startsWith("zh") ? zh : en;

function editLabel(before, after) {
    if (!after) return t("Deleted", "删除");
    return before ? t("Modified", "修改") : t("Added", "新增");
}

function showText(el, text) {
    const paragraph = el.createEl("p");
    for (const [index, line] of text.split("\n").entries()) {
        if (index) paragraph.createEl("br");
        paragraph.appendText(line);
    }
}

function renderComparison(el, comparison) {
    const side = name => name === "local" ? t("This device", "本机") : "GitHub";
    if (comparison.kind === "large" || comparison.kind === "attachment") {
        el.createEl("p", {text: comparison.kind === "large"
            ? t("Paragraph previews support notes up to 512 KiB per version.", "段落对比支持每个版本不超过 512 KiB 的笔记。")
            : t("This is a drawing or binary attachment. Keep both to inspect the two files.", "这是绘图或二进制附件，可保留两份后分别查看。")});
        return;
    }
    if (comparison.kind === "excerpts") {
        el.createEl("p", {text: t("Showing excerpts from the first differing paragraph", "以下节选从两份笔记的首个差异段落开始") + " · " + comparison.number});
        for (const name of ["local", "remote"]) {
            el.createEl("strong", {text: side(name)});
            showText(el, comparison[name]);
        }
        return;
    }
    if (!comparison.changes.length) {
        el.createEl("p", {text: t("Paragraph text matches after normalizing line endings.", "统一换行格式后，两边的段落文字一致。")});
        return;
    }
    for (const item of comparison.changes.slice(0, 80)) {
        el.createEl("strong", {text: side(item.side) + t(" · paragraph ", " · 第 ") + item.number + t("", " 段")});
        showText(el, item.text.length > 3500 ? item.text.slice(0, 3500) + "…" : item.text);
    }
    if (comparison.changes.length > 80) el.createEl("p", {text: t("Showing the first 80 differing paragraphs.", "以上为前 80 个差异段落。")});
}

export class SyncReview extends Modal {
    constructor(app, plan, compare, finish) {
        super(app);
        this.plan = plan;
        this.compare = compare;
        this.finish = finish;
        this.selected = new Set();
        this.conflicts = new Map();
        this.result = null;
    }

    onOpen() {
        this.setTitle(t("Review sync changes", "预览同步改动"));
        const el = this.contentEl;
        if (this.plan.incoming.length) {
            const section = el.createEl("details");
            section.createEl("summary", {text: t("Receive from GitHub", "从 GitHub 接收") + " (" + this.plan.incoming.length + ")"});
            const list = section.createEl("ul");
            for (const change of this.plan.incoming) list.createEl("li", {text: editLabel(change.before, change.there) + " · " + change.path});
        }
        if (this.plan.outgoing.length) this.showOutgoing(el);
        if (this.plan.conflicts.length) {
            el.createEl("h3", {text: t("Conflicts", "冲突文件")});
            el.createEl("p", {text: t("Choose a version for each file. Keep both saves a local copy in Sync conflicts and puts the GitHub version at the original path.",
                "逐个选择要保留的版本。选「保留两份」会把本机副本存入 Sync conflicts，原路径采用 GitHub 版本。")});
            for (const change of this.plan.conflicts) this.showConflict(el, change);
        }
        this.actions = new Setting(el)
            .addButton(b => b.setButtonText(t("Cancel", "取消")).onClick(() => this.close()))
            .addButton(b => b.setButtonText(t("Apply choices", "应用选择")).setCta().onClick(() => {
                this.result = {selected: this.selected, conflicts: this.conflicts};
                this.close();
            }));
        this.actions.descEl.setAttribute("aria-live", "polite");
        this.updateCount();
    }

    updateCount() {
        if (!this.actions || !this.plan.canSend) return;
        const localConflicts = [...this.conflicts.values()].filter(choice => choice === "local").length;
        this.actions.setDesc(t("Files to commit", "本次提交的文件") + " · " + (this.selected.size + localConflicts));
    }

    showOutgoing(el) {
        const toggles = new Map();
        const setAll = value => {
            this.selected.clear();
            for (const [path, toggle] of toggles) {
                if (value) this.selected.add(path);
                toggle.setValue(value);
            }
            this.updateCount();
        };
        new Setting(el).setName(t("Commit to GitHub", "提交到 GitHub")).setHeading()
            .addButton(b => b.setButtonText(t("Select all", "全选")).onClick(() => setAll(true)))
            .addButton(b => b.setButtonText(t("Clear selection", "清空选择")).onClick(() => setAll(false)));
        for (const change of this.plan.outgoing) {
            new Setting(el).setName(change.path).setDesc(editLabel(change.before, change.here)).addToggle(toggle => {
                toggles.set(change.path, toggle);
                toggle.setValue(false).onChange(value => {
                    if (value) this.selected.add(change.path);
                    else this.selected.delete(change.path);
                    this.updateCount();
                });
                toggle.toggleEl.setAttribute("aria-label", t("Commit ", "提交 ") + change.path);
            });
        }
    }

    showConflict(el, change) {
        const group = el.createDiv();
        const states = t("This device", "本机") + " · " + editLabel(change.before, change.here) + " / GitHub · " + editLabel(change.before, change.there);
        new Setting(group).setName(change.path).setDesc(states).addDropdown(input => {
            input.addOption("later", t("Decide later", "稍后处理"));
            input.addOption("both", t("Keep both", "保留两份"));
            input.addOption("remote", change.there ? t("Use GitHub version", "采用 GitHub 版本") : t("Apply GitHub deletion", "采用 GitHub 的删除"));
            if (this.plan.canSend) input.addOption("local", change.here ? t("Commit local version", "提交本机版本") : t("Commit local deletion", "提交本机的删除"));
            else input.addOption("keep-local", t("Keep local change for a later commit", "保留本机改动，稍后提交"));
            input.setValue("later").onChange(value => { this.conflicts.set(change.path, value); this.updateCount(); });
            input.selectEl.setAttribute("aria-label", t("Resolve ", "处理冲突 ") + change.path);
        });
        if (!isMarkdownNote(change.path)) return;
        const details = group.createEl("details");
        details.createEl("summary", {text: t("Compare paragraphs", "比较段落")});
        const body = details.createDiv();
        let loaded = false;
        details.addEventListener("toggle", async () => {
            if (!details.open || loaded) return;
            loaded = true;
            body.setText(t("Loading versions…", "正在读取两个版本…"));
            try {
                const comparison = await this.compare(change);
                body.empty();
                renderComparison(body, comparison);
            } catch (error) {
                loaded = false;
                body.setText(error.message);
            }
        });
    }

    onClose() {
        this.contentEl.empty();
        this.finish(this.result);
    }
}
