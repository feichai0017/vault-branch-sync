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
    constructor(app, plan, compare, finish, figures = () => []) {
        super(app);
        this.plan = plan;
        this.compare = compare;
        this.finish = finish;
        this.figures = figures;
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
            .addButton(b => { this.applyButton = b.setButtonText(t("Apply choices", "应用选择")).setCta().onClick(() => {
                this.result = {selected: this.selected, conflicts: this.conflicts};
                this.close();
            }); });
        this.actions.descEl.setAttribute("aria-live", "polite");
        this.updateCount();
    }

    updateCount() {
        if (!this.actions) return;
        const unresolved = [...this.conflicts.values()].some(choice => choice?.kind === "merge" &&
            choice.sides.some(side => !side));
        this.applyButton.setDisabled(unresolved);
        if (unresolved) {
            this.actions.setDesc(t("Choose a version for each highlighted section.", "请为每处重叠修改选择一个版本。"));
            return;
        }
        if (!this.plan.canSend) { this.actions.setDesc(""); return; }
        const localConflicts = [...this.conflicts.values()].filter(choice => choice === "local" || choice?.send).length;
        this.actions.setDesc(t("Files to commit", "本次提交的文件") + " · " + (this.selected.size + localConflicts));
    }

    showOutgoing(el) {
        const toggles = new Map();
        const cache = new Map();
        const suggestions = el.createDiv();
        const refreshFigures = () => {
            suggestions.empty();
            const related = new Set();
            for (const path of this.selected) {
                if (!cache.has(path)) cache.set(path, this.figures(path));
                for (const figure of cache.get(path)) if (!this.selected.has(figure)) related.add(figure);
            }
            if (!related.size) return;
            suggestions.createEl("h4", {text: t("Changed figures linked from selected notes", "已选笔记引用的改动配图")});
            for (const path of [...related].sort()) {
                new Setting(suggestions).setName(path).addButton(b => b.setButtonText(t("Include figure", "勾选配图"))
                    .onClick(() => {
                        this.selected.add(path);
                        toggles.get(path).setValue(true);
                        refreshFigures(); this.updateCount();
                    }));
            }
        };
        const setAll = value => {
            this.selected.clear();
            for (const [path, toggle] of toggles) {
                if (value) this.selected.add(path);
                toggle.setValue(value);
            }
            refreshFigures(); this.updateCount();
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
                    refreshFigures(); this.updateCount();
                });
                toggle.toggleEl.setAttribute("aria-label", t("Commit ", "提交 ") + change.path);
            });
        }
    }

    showConflict(el, change) {
        const group = el.createDiv();
        const model = this.plan.merges?.get(change.path);
        const sides = Array(model?.overlaps || 0).fill(null);
        let mergeControls;
        const states = t("This device", "本机") + " · " + editLabel(change.before, change.here) + " / GitHub · " + editLabel(change.before, change.there);
        new Setting(group).setName(change.path).setDesc(states).addDropdown(input => {
            input.addOption("later", t("Decide later", "稍后处理"));
            if (model) {
                input.addOption("merge", t("Merge on this device", "合并到本机"));
                if (this.plan.canSend) input.addOption("merge-send", t("Merge and commit", "合并并提交"));
            }
            input.addOption("both", t("Keep both", "保留两份"));
            input.addOption("remote", change.there ? t("Use GitHub version", "采用 GitHub 版本") : t("Apply GitHub deletion", "采用 GitHub 的删除"));
            if (this.plan.canSend) input.addOption("local", change.here ? t("Commit local version", "提交本机版本") : t("Commit local deletion", "提交本机的删除"));
            else input.addOption("keep-local", t("Keep local change for a later commit", "保留本机改动，稍后提交"));
            const choose = value => {
                const merging = value === "merge" || value === "merge-send";
                this.conflicts.set(change.path, merging ? {kind: "merge", sides, send: value === "merge-send"} : value);
                if (mergeControls) mergeControls.hidden = !merging;
                this.updateCount();
            };
            const initial = model?.overlaps === 0 ? "merge" : "later";
            input.setValue(initial).onChange(choose);
            choose(initial);
            input.selectEl.setAttribute("aria-label", t("Resolve ", "处理冲突 ") + change.path);
        });
        if (model) {
            mergeControls = group.createDiv();
            mergeControls.hidden = model.overlaps > 0;
            if (!model.overlaps) mergeControls.createEl("p", {text: t("Independent edits will be combined. You can commit the result later.",
                "两端改动可以自动合并。合并到本机后，可在下次预览时勾选提交。")});
            for (const part of model.parts.filter(item => !item.lines)) {
                const hunk = mergeControls.createDiv();
                hunk.createEl("strong", {text: t("Overlapping edit at base line ", "重叠修改，共同版本第 ") + part.line});
                for (const [key, label] of [["base", t("Last synced", "上次同步")], ["local", t("This device", "本机")], ["remote", "GitHub"]]) {
                    hunk.createEl("small", {text: label});
                    hunk.createEl("pre", {text: part[key].length ? part[key].join("\n") : t("(no lines)", "（无内容）")});
                }
                new Setting(hunk).setName(t("Keep in merged note", "此处保留")).addDropdown(control => {
                    control.addOption("", t("Choose a version", "请选择"))
                        .addOption("local", t("This device", "本机")).addOption("remote", "GitHub")
                        .onChange(value => { sides[part.index] = value || null; this.updateCount(); });
                });
            }
        }
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
