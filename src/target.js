export function repositoryName(value) {
    let name = value.trim();
    if (name.startsWith("https://github.com/")) {
        name = name.slice("https://github.com/".length).replace(/\/$/, "").replace(/\.git$/, "");
    }
    const parts = name.split("/");
    if (parts.length !== 2 || !/^[\w-]+$/.test(parts[0]) ||
        !/^[\w.-]+$/.test(parts[1]) || [".", ".."].includes(parts[1])) {
        throw new Error("Enter a GitHub repository as owner/name.");
    }
    return parts.join("/");
}

export function branchName(value) {
    const branch = value.trim();
    if (!branch || branch === "@" || branch === "HEAD" || branch.startsWith("-") ||
        branch.endsWith(".") || /[\x00-\x20\x7f~^:?*[\]\\]/.test(branch) ||
        branch.includes("@{") || branch.includes("..") ||
        branch.split("/").some(part => !part || part.startsWith(".") || part.endsWith(".lock"))) {
        throw new Error("Enter a valid Git branch name.");
    }
    return branch;
}

export function sameTarget(left, right) {
    return left?.repository?.toLowerCase() === right?.repository?.toLowerCase() &&
        left?.branch === right?.branch;
}

const portableSettings = new Set(["app.json", "appearance.json", "backlink.json", "bookmarks.json",
    "daily-notes.json", "graph.json", "hotkeys.json", "templates.json", "types.json"]);

export function fileScope(settings = false, configDir = ".obsidian") {
    function allowed(path, folder = false) {
        if (typeof path !== "string" || !path || /[\\\x00-\x1f\x7f]/.test(path) || /^[A-Za-z]:/.test(path)) return false;
        const parts = path.split("/");
        if (parts.some(p => !p || p === "." || p === "..")) return false;
        if (parts[0] !== configDir) return !parts.some(p => p.startsWith("."));
        if (!settings || parts.slice(1).some(p => p.startsWith("."))) return false;
        if (parts.length === 1) return folder;
        if (parts.length === 2 && portableSettings.has(parts[1])) return !folder;
        if (parts[1] === "snippets") return folder ? parts.length === 2 : parts.length === 3 && path.endsWith(".css");
        if (parts[1] === "themes") return folder ? parts.length <= 3 :
            parts.length === 4 && ["manifest.json", "theme.css", "LICENSE"].includes(parts[3]);
        return false;
    }
    return {settings, configDir, allowed};
}
