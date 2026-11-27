import {diffIndices} from "node-diff3";
import {isDrawingText, isMarkdownNote, maxPreviewBytes} from "./compare.js";
import {blobOid} from "./oid.js";

function edits(base, side, name) {
    return diffIndices(base, side).map(({buffer1: [start, count], buffer2Content}) =>
        ({start, end: start + count, lines: buffer2Content, name}));
}

function applyEdits(base, start, end, changes) {
    const lines = [];
    let cursor = start;
    for (const edit of changes) {
        lines.push(...base.slice(cursor, edit.start), ...edit.lines);
        cursor = edit.end;
    }
    return lines.concat(base.slice(cursor, end));
}

function lineEnding(text) {
    const first = text.match(/\r\n|\r|\n/)?.[0];
    if (!first) return "";
    return /[\r\n]/.test(text.split(first).join("")) ? null : first;
}

export function mergeText(baseText, localText, remoteText) {
    const [original, here, there] = [baseText, localText, remoteText].map(lineEnding);
    if ([original, here, there].includes(null)) return null;
    if (here && there && here !== there && here !== original && there !== original) return null;
    const eol = (here === original ? there : here) || there || original || "\n";
    const [base, local, remote] = [baseText, localText, remoteText].map(text => text.split(/\r\n|\n|\r/));
    if (Math.max(base.length, local.length, remote.length) > 10000) return null;
    const changes = [...edits(base, local, "local"), ...edits(base, remote, "remote")]
        .sort((a, b) => a.start - b.start || a.end - b.end);
    const parts = [];
    let cursor = 0, overlaps = 0;
    for (let i = 0; i < changes.length;) {
        const first = changes[i++];
        let end = first.end;
        const group = [first];
        // Half-open ranges let an insertion just after a replaced line survive.
        // Two insertions at the same boundary require an explicit order.
        while (i < changes.length && (changes[i].start < end ||
            (first.start === end && changes[i].start === end && changes[i].end === end))) {
            const next = changes[i++];
            group.push(next);
            end = Math.max(end, next.end);
        }
        if (cursor < first.start) parts.push({lines: base.slice(cursor, first.start)});
        const left = group.filter(edit => edit.name === "local");
        const right = group.filter(edit => edit.name === "remote");
        const localLines = applyEdits(base, first.start, end, left);
        const remoteLines = applyEdits(base, first.start, end, right);
        if (!left.length || !right.length ||
            (localLines.length === remoteLines.length && localLines.every((line, j) => line === remoteLines[j]))) {
            parts.push({lines: left.length ? localLines : remoteLines});
        } else {
            parts.push({index: overlaps++, line: first.start + 1, base: base.slice(first.start, end),
                local: localLines, remote: remoteLines});
        }
        cursor = end;
    }
    if (cursor < base.length) parts.push({lines: base.slice(cursor)});
    return {parts, overlaps, eol};
}

export function mergeResult(model, sides = []) {
    return model.parts.flatMap(part => {
        if (part.lines) return part.lines;
        const choice = sides[part.index];
        if (choice !== "local" && choice !== "remote") throw new Error("Choose a version for every overlapping edit.");
        return part[choice];
    }).join(model.eol);
}

export async function prepareMerge(change, adapter, api, remoteSize) {
    if (!isMarkdownNote(change.path) || !change.before || !change.here || !change.there ||
        remoteSize > maxPreviewBytes) return null;
    await adapter.flush?.(change.path);
    const stat = await adapter.stat(change.path);
    if (stat?.type !== "file" || stat.size > maxPreviewBytes) return null;
    const bytes = await adapter.readBinary(change.path);
    if (bytes.byteLength > maxPreviewBytes) return null;
    if (await blobOid(bytes) !== change.here) throw new Error("Edited during review. Run sync again: " + change.path);
    const decode = value => {
        if (value.byteLength > maxPreviewBytes) return null;
        try {
            const text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(value);
            return text.includes("\0") || isDrawingText(text) ? null : text;
        } catch { return null; }
    };
    const local = decode(bytes);
    if (local === null) return null;
    let ancestor;
    try { ancestor = await api.readBlob(change.before); }
    catch (error) { if (error.status === 404) return null; throw error; }
    const base = decode(ancestor);
    if (base === null) return null;
    const remote = decode(await api.readBlob(change.there));
    if (remote === null) return null;
    const model = mergeText(base, local, remote);
    return model && {...model, originalLocal: local};
}
