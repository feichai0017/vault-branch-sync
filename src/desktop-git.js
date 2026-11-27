import {t} from "./review.js";
import {blobOid} from "./oid.js";

const pendingPrefix = "vault-branch-sync.pending-push.v1.";

// Use the same checkout, Git executable, authentication and operation queue as Source Control.
// Keep the configured upstream and the exact local commit together across a failed push.
export async function syncStaged(app, provider) {
    const manager = provider.gitManager, git = manager?.git;
    if (!git?.raw || !git.commit || !manager.status || !manager.formatCommitMessage) {
        throw new Error(t("Desktop Git is not ready. Open Git's Source Control and try again.",
            "桌面 Git 尚未就绪，请先打开 Git 更改面板再试。"));
    }
    const changes = await manager.status();
    if (changes.conflicted.length || changes.conflictedOutsideVault) {
        throw new Error(t("Resolve the Git conflicts before syncing staged changes.", "请先在 Git 面板解决合并冲突，再同步暂存内容。"));
    }
    if (changes.stagedOutsideVault) {
        throw new Error(t("Files outside this vault are also staged. Review the Git staging area before syncing.",
            "暂存区里还有库外文件，请先在 Git 中核对要提交的范围。"));
    }
    let branch;
    try { branch = (await git.raw(["symbolic-ref", "--quiet", "HEAD"])).trim(); }
    catch { throw new Error(t("Check out a local Git branch before syncing.", "请先在 Git 面板切换到本地分支。")); }
    const key = pendingPrefix + branch;
    const pending = app.loadLocalStorage(key);
    const staged = changes.staged.length > 0;
    if (!staged && !pending) return t("Nothing staged. Use + in Git to select files or hunks.", "暂存区为空。在 Git 面板点 + 选文件，或在编辑器里暂存某一段。");

    // Git supplies both fields even for remotes and branch names containing slashes.
    const upstream = await git.raw(["for-each-ref", "--format=%(upstream:remotename)%00%(upstream:remoteref)", branch]);
    const [remote, ref] = upstream.trimEnd().split("\0");
    if (!remote || remote === "." || remote.startsWith("-") || !ref?.startsWith("refs/heads/")) {
        throw new Error(t("Set an upstream remote branch in Git before syncing.", "请先给当前 Git 分支设置要推送的远端跟踪分支。"));
    }
    if (provider.settings.disablePush) {
        throw new Error(t("Pushing is disabled in the Git plugin settings.", "Git 插件设置已禁用推送。"));
    }
    // A remote can be repointed under the same name. Store only a fingerprint of its push URLs.
    const urls = await git.raw(["remote", "get-url", "--push", "--all", "--", remote]);
    const destination = await blobOid(new TextEncoder().encode(urls.trimEnd()));
    let sha;
    if (staged) {
        const message = await manager.formatCommitMessage(provider.settings.commitMessage || t("Sync staged vault changes", "同步已暂存的笔记"));
        // With no paths and no -a, git commit snapshots the index, including partially staged files.
        const result = await git.commit(message);
        if (!result.commit) throw new Error(t("Git did not create a commit. Check the staging area.", "Git 没有创建提交，请检查暂存区。"));
        sha = (await git.raw(["rev-parse", "--verify", result.commit + "^{commit}"])).trim();
        app.saveLocalStorage(key, {remote, ref, sha, destination});
        app.workspace.trigger("obsidian-git:head-change");
    } else {
        sha = pending.sha;
    }
    const tip = (await git.raw(["rev-parse", "--verify", branch])).trim();
    if (tip !== sha || (!staged && (pending.remote !== remote || pending.ref !== ref || pending.destination !== destination))) {
        app.saveLocalStorage(key, null);
        throw new Error(t("The branch or its upstream changed. Review the local commits in Git and use Push.",
            "分支或上游已改变，请先在 Git 面板核对本地提交，再点 Push。"));
    }
    try {
        // SimpleGit appends --progress, so options must stay parseable after the explicit refspec.
        await git.raw(["push", "--no-follow-tags", "--recurse-submodules=no", remote, sha + ":" + ref]);
    } catch (error) {
        const divergence = /non-fast-forward|fetch first|\[rejected\]/i.test(error.message);
        throw new Error(t("Local commit ", "本地提交 ") + sha.slice(0, 7) + (divergence
            ? t(" was kept. The remote rejected the push. Fetch and review the branch in Git before pushing.", " 已保留。远端拒绝了推送，请在 Git 面板获取并核对远端改动后再推送。")
            : t(" was kept. Check the network and Git access, then click Sync to retry.", " 已保留。检查网络和 Git 访问权限后，再点 Sync 可重试。")));
    }
    app.saveLocalStorage(key, null);
    app.workspace.trigger("obsidian-git:refs-changed");
    return t("Pushed ", "已推送 ") + sha.slice(0, 7) + " → " + remote + "/" + ref.slice("refs/heads/".length);
}
