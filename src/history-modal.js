import {Modal, Notice, Setting} from "obsidian";
import {maxPreviewBytes} from "./compare.js";
import {restoreCopy} from "./history.js";
import {t} from "./review.js";

export class NoteHistory extends Modal {
    constructor(app, file, api) {
        super(app);
        this.path = file.path;
        this.api = api;
        this.previewRequest = 0;
        this.page = 0;
    }

    onOpen() {
        this.historyOpen = true;
        this.setTitle(t("GitHub note history", "单篇 GitHub 历史"));
        this.contentEl.createEl("p", {text: this.path});
        this.list = this.contentEl.createDiv();
        this.more = this.contentEl.createEl("button", {text: t("Load older versions", "加载更早的版本")});
        this.more.addEventListener("click", () => void this.nextPage());
        this.detail = this.contentEl.createDiv();
        void this.nextPage();
    }

    async nextPage() {
        this.more.disabled = true;
        try {
            if (!this.head) {
                await this.api.repository();
                this.head = await this.api.head();
            }
            const rows = this.head ? await this.api.noteHistory(this.path, this.head, this.page + 1) : [];
            if (!this.historyOpen) return;
            if (!this.page && !rows.length) this.list.setText(t("No commits for this path on this branch.", "此分支还没有这个路径的提交。"));
            this.page++;
            for (const revision of rows) {
                new Setting(this.list).setName(revision.message).setDesc(revision.date.slice(0, 10) + " · " + revision.sha.slice(0, 12))
                    .addButton(button => button.setButtonText(t("Preview", "预览")).onClick(() => void this.preview(revision)));
            }
            this.more.hidden = rows.length < 20;
        } catch (error) {
            if (this.historyOpen) new Notice(error.message, 8000);
        } finally { this.more.disabled = false; }
    }

    async preview(revision) {
        const request = ++this.previewRequest;
        this.detail.setText(t("Loading revision…", "正在读取历史版本…"));
        try {
            const item = await this.api.noteRevision(this.path, revision.sha);
            if (!this.historyOpen || request !== this.previewRequest) return;
            if (!item) {
                this.detail.setText(t("The note is absent in this commit. Choose an earlier version.", "该提交中没有此文件，可选择更早的版本。"));
                return;
            }
            let bytes;
            if (item.size <= maxPreviewBytes) bytes = await this.api.readBlob(item.sha);
            if (!this.historyOpen || request !== this.previewRequest) return;
            this.detail.empty();
            this.detail.createEl("h4", {text: revision.message + " · " + revision.sha.slice(0, 12)});
            if (bytes) {
                const text = new TextDecoder().decode(bytes);
                this.detail.createEl("pre", {text: text.slice(0, 24000) + (text.length > 24000 ? "\n…" : "")});
            } else this.detail.createEl("p", {text: t("This revision is too large to preview. The copy will include the entire file.",
                "此版本较大，恢复的副本会包含完整文件。")});
            new Setting(this.detail).setDesc(t("Create a separate file beside the current note.", "在当前笔记旁新建一份副本。"))
                .addButton(button => button.setButtonText(t("Restore as a copy", "恢复为副本")).setCta().onClick(async () => {
                    button.setDisabled(true);
                    try {
                        const data = bytes || await this.api.readBlob(item.sha);
                        if (!this.historyOpen || request !== this.previewRequest) return;
                        const copy = await restoreCopy(this.app.vault, this.path, revision.sha, data);
                        if (!this.historyOpen) return;
                        this.close();
                        new Notice(t("Restored copy: ", "已恢复副本 ") + copy.path);
                        await this.app.workspace.getLeaf("tab").openFile(copy);
                    } catch (error) {
                        if (this.historyOpen) { button.setDisabled(false); new Notice(error.message, 8000); }
                    }
                }));
            this.detail.scrollIntoView({block: "nearest"});
        } catch (error) {
            if (this.historyOpen && request === this.previewRequest) this.detail.setText(error.message);
        }
    }

    onClose() { this.historyOpen = false; this.previewRequest++; this.contentEl.empty(); }
}
