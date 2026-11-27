import {validOid} from "./oid.js";

// Vault.createBinary is create-only. A second window may create the same
// name while an older version is downloading; allocate another suffix then.
export async function restoreCopy(vault, originalPath, commit, bytes) {
    if (!validOid(commit) || !/\.md$/i.test(originalPath)) throw new Error("Invalid Markdown revision.");
    const stem = originalPath.slice(0, -3) + " (history " + commit.slice(0, 12);
    for (let n = 1; ; n++) {
        const path = stem + (n > 1 ? "-" + n : "") + ").md";
        if (await vault.adapter.exists(path)) continue;
        try { return await vault.createBinary(path, bytes); }
        catch (error) { if (!(await vault.adapter.exists(path))) throw error; }
    }
}
