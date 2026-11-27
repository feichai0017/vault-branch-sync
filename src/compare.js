import {blobOid} from "./engine.js";

const maxPreviewBytes = 512 * 1024;
const maxCells = 160_000;

export function isMarkdownNote(path) {
    return /\.md$/i.test(path) && !/\.excalidraw\.md$/i.test(path);
}

export function compareParagraphs(local, remote) {
    const paragraphs = text => text ? text.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/) : [];
    const leftText = paragraphs(local), rightText = paragraphs(remote);
    let start = 0, leftEnd = leftText.length, rightEnd = rightText.length;
    while (start < leftEnd && start < rightEnd && leftText[start] === rightText[start]) start++;
    while (leftEnd > start && rightEnd > start && leftText[leftEnd - 1] === rightText[rightEnd - 1]) {
        leftEnd--; rightEnd--;
    }
    const left = leftText.slice(start, leftEnd), right = rightText.slice(start, rightEnd);
    const width = right.length + 1;
    if ((left.length + 1) * width > maxCells) {
        return {kind: "excerpts", number: start + 1,
            local: left.join("\n\n").slice(0, 3500), remote: right.join("\n\n").slice(0, 3500)};
    }
    // The longest common subsequence aligns repeated and moved paragraphs.
    const lengths = new Uint32Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--) {
        for (let j = right.length - 1; j >= 0; j--) {
            const pos = i * width + j;
            lengths[pos] = left[i] === right[j] ? 1 + lengths[pos + width + 1] :
                Math.max(lengths[pos + width], lengths[pos + 1]);
        }
    }
    const changes = [];
    let i = 0, j = 0;
    while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length && left[i] === right[j]) {
            i++; j++;
        } else if (i < left.length && (j === right.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
            changes.push({side: "local", number: start + i + 1, text: left[i++]});
        } else {
            changes.push({side: "remote", number: start + j + 1, text: right[j++]});
        }
    }
    return {kind: "paragraphs", changes};
}

export async function compareNote(change, adapter, api, remoteSize) {
    if (!isMarkdownNote(change.path)) return {kind: "attachment"};
    await adapter.flush?.(change.path);
    const stat = await adapter.stat(change.path);
    if (Boolean(stat) !== Boolean(change.here) || stat?.type === "folder") {
        throw new Error("Local file changed. Reopen the review: " + change.path);
    }
    if (stat?.size > maxPreviewBytes || remoteSize > maxPreviewBytes) return {kind: "large"};
    const [local, remote] = await Promise.all([
        change.here ? adapter.readBinary(change.path) : null,
        change.there ? api.readBlob(change.there) : null
    ]);
    if (local && await blobOid(local) !== change.here) throw new Error("Local file changed. Reopen the review: " + change.path);
    if (local?.byteLength > maxPreviewBytes || remote?.byteLength > maxPreviewBytes) return {kind: "large"};
    const decoder = new TextDecoder("utf-8", {fatal: true});
    let left, right;
    try {
        left = local ? decoder.decode(local) : "";
        right = remote ? decoder.decode(remote) : "";
    } catch { return {kind: "attachment"}; }
    // Some Excalidraw drawings use a plain .md extension.
    const drawing = text => {
        const header = text.slice(0, 2000).replace(/\r\n/g, "\n").split("\n---")[0];
        return header.startsWith("---\n") && /^excalidraw-plugin:/m.test(header);
    };
    if (drawing(left) || drawing(right)) return {kind: "attachment"};
    return compareParagraphs(left, right);
}
