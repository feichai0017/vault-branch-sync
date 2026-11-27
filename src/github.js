import {HeadMoved, blobOid, validOid} from "./engine.js";
import {branchName, fileScope, repositoryName} from "./target.js";

const host = "https://api.github.com";
const moveRef = "mutation UpdateBranch($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }";
const encodePath = path => path.split("/").map(encodeURIComponent).join("/");

function checkedOid(value) {
    if (!validOid(value)) throw new Error("GitHub returned an invalid Git object identifier.");
    return value;
}

class GitHubError extends Error {
    constructor(status) {
        const messages = {
            401: "GitHub rejected the token. Reconnect in the plugin settings.",
            403: "GitHub refused the request. Check the token's Contents permission, branch rules and API rate limit.",
            404: "Repository, branch or file not found. Check the repository name and the token's access.",
            409: "The GitHub repository or branch has changed. Sync again.",
            413: "GitHub rejected a file because of its size.",
            422: "GitHub rejected the proposed change. Check the branch rules and file size.",
            429: "GitHub is rate-limiting requests. Try again later."
        };
        super(messages[status] || "GitHub request failed (HTTP " + status + ").");
        this.status = status;
    }
}

export class GitHub {
    constructor({repository, branch}, token, request, base64, scope = fileScope()) {
        this.name = repositoryName(repository);
        this.branch = branch ? branchName(branch) : "";
        this.root = "/repos/" + encodePath(this.name);
        this.token = token;
        this.request = request;
        this.base64 = base64;
        this.scope = scope;
    }

    async call(path, method = "GET", body, binary = false) {
        const response = await this.request({
            url: host + path, method, throw: false,
            headers: {Authorization: "Bearer " + this.token,
                Accept: binary ? "application/vnd.github.raw+json" : "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                ...(body ? {"Content-Type": "application/json"} : {})},
            ...(body ? {body: JSON.stringify(body)} : {})
        });
        if (response.status < 200 || response.status >= 300) throw new GitHubError(response.status);
        return binary ? response.arrayBuffer : response.json;
    }

    async repository() {
        const info = await this.call(this.root);
        if (info.private !== true || info.full_name?.toLowerCase() !== this.name.toLowerCase() || !info.node_id) {
            throw new Error("Choose a private GitHub repository that you own or can access.");
        }
        this.defaultBranch = branchName(info.default_branch);
        this.branch ||= this.defaultBranch;
        return info;
    }

    async head() {
        try {
            const ref = await this.call(this.root + "/git/ref/heads/" + encodePath(this.branch));
            if (ref.ref !== "refs/heads/" + this.branch) throw new Error("The response names a different Git branch.");
            return checkedOid(ref.object?.sha);
        } catch (error) {
            if (![404, 409].includes(error.status)) throw error;
            const branches = await this.call(this.root + "/branches?per_page=1");
            if (Array.isArray(branches) && !branches.length && this.branch === this.defaultBranch) return null;
            throw new Error("Branch not found. Select an existing branch, or the default branch of a new repository.");
        }
    }

    async readBlob(sha) {
        const bytes = await this.call(this.root + "/git/blobs/" + checkedOid(sha), "GET", undefined, true);
        if (await blobOid(bytes) !== sha) throw new Error("The downloaded file failed Git's integrity check.");
        return bytes;
    }

    async noteHistory(path, head, page = 1) {
        if (!this.scope.allowed(path) || !Number.isSafeInteger(page) || page < 1) throw new Error("Invalid note history request.");
        const query = new URLSearchParams({sha: checkedOid(head), path, per_page: "20", page: String(page)});
        const rows = await this.call(this.root + "/commits?" + query);
        return rows.map(row => ({sha: checkedOid(row.sha), message: row.commit.message.split("\n")[0],
            date: row.commit.author?.date || row.commit.committer?.date || ""}));
    }

    async noteRevision(path, commit) {
        if (!this.scope.allowed(path)) throw new Error("This path is outside the sync scope.");
        let item;
        try { item = await this.call(this.root + "/contents/" + encodePath(path) + "?ref=" + checkedOid(commit)); }
        catch (error) { if (error.status === 404) return null; throw error; }
        if (item.type !== "file" || item.path !== path || item.submodule_git_url || item.target) {
            throw new Error("This revision is not a regular file.");
        }
        return {sha: checkedOid(item.sha), size: item.size};
    }

    async allEntries(tree) {
        const answer = await this.call(this.root + "/git/trees/" + tree + "?recursive=1");
        if (!answer.truncated) return answer.tree;
        const result = [];
        const visit = async (id, prefix) => {
            const level = await this.call(this.root + "/git/trees/" + checkedOid(id));
            if (level.truncated) throw new Error("GitHub could not return the complete directory listing.");
            for (const item of level.tree) {
                const path = prefix + item.path;
                if (item.type === "tree") {
                    if (this.scope.allowed(path, true)) await visit(item.sha, path + "/");
                } else result.push({...item, path});
            }
        };
        await visit(tree, "");
        return result;
    }

    async snapshot(knownHead) {
        const info = await this.repository();
        const head = await this.head();
        if (head && head === knownHead) return {head, unchanged: true};
        const entries = new Map(), rules = new Map(), blocked = new Set();
        let tree = null;
        if (head) {
            const commit = await this.call(this.root + "/git/commits/" + head);
            tree = checkedOid(commit.tree?.sha);
            for (const item of await this.allEntries(tree)) {
                const {path, type, mode} = item;
                if (type === "tree") continue;
                if (type === "blob" && mode === "100644" && (path === ".gitignore" ||
                    (path.endsWith("/.gitignore") && this.scope.allowed(path.slice(0, -11), true)))) {
                    rules.set(path, new TextDecoder().decode(await this.readBlob(item.sha)));
                }
                if (!this.scope.allowed(path) && !this.scope.allowed(path, true)) continue;
                if (type !== "blob" || !["100644", "100755"].includes(mode)) blocked.add(path);
                else if (this.scope.allowed(path)) entries.set(path, {mode, sha: checkedOid(item.sha), size: item.size});
            }
        }
        return {head, tree, entries, rules, blocked, node: info.node_id};
    }

    encoded(bytes) {
        if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("A file exceeds GitHub's 100 MiB blob limit.");
        return this.base64(bytes);
    }

    async initialize(path, bytes, expected) {
        if (await this.head()) throw new HeadMoved("The branch already has a first commit.");
        try {
            const result = await this.call(this.root + "/contents/" + encodePath(path), "PUT", {
                branch: this.branch, message: "Add " + path, content: this.encoded(bytes)
            });
            if (result.content?.sha !== expected) throw new Error("The first uploaded file failed its integrity check.");
            return checkedOid(result.commit?.sha);
        } catch (error) {
            if ([409, 422].includes(error.status) && await this.head()) throw new HeadMoved("The branch changed.");
            throw error;
        }
    }

    async putBlob(bytes, expected) {
        const result = await this.call(this.root + "/git/blobs", "POST", {content: this.encoded(bytes), encoding: "base64"});
        if (result.sha !== expected) throw new Error("The uploaded file failed its integrity check.");
    }

    async commit(snapshot, changes) {
        const tree = await this.call(this.root + "/git/trees", "POST", {base_tree: snapshot.tree, tree: changes});
        const commit = await this.call(this.root + "/git/commits", "POST", {
            message: "Sync vault files", tree: checkedOid(tree.sha), parents: [snapshot.head]
        });
        const after = checkedOid(commit.sha);
        const result = await this.call("/graphql", "POST", {query: moveRef, variables: {input: {
            repositoryId: snapshot.node,
            refUpdates: [{name: "refs/heads/" + this.branch, beforeOid: snapshot.head, afterOid: after, force: false}]
        }}});
        if (!result.data?.updateRefs || result.errors?.length) {
            if (await this.head() !== snapshot.head) throw new HeadMoved("Another device pushed first.");
            throw new Error("GitHub could not update the branch. Check its rules and the token's Contents write permission.");
        }
        return after;
    }
}
