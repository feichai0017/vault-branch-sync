import test from "node:test";
import assert from "node:assert/strict";
import {mergeText, mergeResult, prepareMerge} from "../src/merge.js";
import {blobOid} from "../src/oid.js";

test("merge keeps neighboring replacements and appends at either end of an edited line", () => {
    for (const [base, local, remote, expected] of [
        ["公式 A", "公式 A\n\n我们的思考", "公式 B", "公式 B\n\n我们的思考"],
        ["a\nb\n", "A\nb\n", "a\nB\n", "A\nB\n"],
        ["a\nb", "a", "a\nb\nnew", "a\nnew"],
        ["a", "prefix\na", "A", "prefix\nA"],
        ["\uFEFF开头\r\n\r\n公式\r\n", "\uFEFF开头\r\n\r\n公式\r\n\r\n思考\r\n", "\uFEFF开头\r\n\r\n手算\r\n", "\uFEFF开头\r\n\r\n手算\r\n\r\n思考\r\n"],
        ["one\ntwo\n", "one\r\ntwo\r\n", "ONE\ntwo\n", "ONE\r\ntwo\r\n"],
        ["x\n", "x", "X\n", "X"]
    ]) {
        const model = mergeText(base, local, remote);
        assert.equal(model.overlaps, 0);
        assert.equal(mergeResult(model), expected);
        assert.equal(mergeResult(mergeText(base, remote, local)), expected);
    }
});

test("overlapping regions require independent choices and keep the surrounding changes", () => {
    const base = "First\n\nmiddle\n\nLast\n\nend";
    const local = "Phone one\n\nmiddle\n\nPhone two\n\nend\n\nnew";
    const remote = "Mac one\n\nmiddle\n\nMac two\n\nend";
    const model = mergeText(base, local, remote);
    assert.equal(model.overlaps, 2);
    assert.deepEqual(model.parts.filter(p => !p.lines).map(p => p.base), [["First"], ["Last"]]);
    assert.throws(() => mergeResult(model, ["local"]), /every/);
    assert.equal(mergeResult(model, ["local", "remote"]), "Phone one\n\nmiddle\n\nMac two\n\nend\n\nnew");
    assert.equal(mergeResult(mergeText(base, local, local)), local);
    assert.equal(mergeText("top\nend", "top\none\nend", "top\ntwo\nend").overlaps, 1);
    assert.equal(mergeText("a\nb\nc", "a\nc", "a\nB\nc").overlaps, 1);
    assert.equal(mergeResult(mergeText("repeat\nr\nrepeat\nend", "repeat\nR\nrepeat\nend", "repeat\nr\nrepeat\nEND")),
        "repeat\nR\nrepeat\nEND");
});

test("binary data, drawings, missing ancestors and large or mixed-line-ending files keep file-level choices", async () => {
    const bytes = s => new TextEncoder().encode(s).buffer;
    const docs = new Map();
    async function put(value) { const data = bytes(value), sha = await blobOid(data); docs.set(sha, data); return sha; }
    const change = {path:"N.md", before:await put("base"), here:await put("local"), there:await put("remote")};
    const adapter = {stat: async () => ({type:"file",size:10}), readBinary:async () => docs.get(change.here)};
    let reads = 0;
    const api = {readBlob:async sha => {reads++; return docs.get(sha);}};
    assert.equal(await prepareMerge({...change, before:null}, adapter, api), null);
    assert.equal(await prepareMerge({...change, path:"fig.excalidraw.md"}, adapter, api), null);
    assert.equal(await prepareMerge(change, adapter, api, 600_000), null);
    assert.equal(reads, 0);
    for (const unsupported of ["---\nexcalidraw-plugin: parsed\n---\nDrawing", "invalid\0note", "a".repeat(530000)]) {
        assert.equal(await prepareMerge({...change,before:await put(unsupported)}, adapter, api), null);
    }
    assert.equal(await prepareMerge(change, adapter, {readBlob:async () => {throw Object.assign(Error("missing"), {status:404});}}), null);
    assert.equal(mergeText("one\ntwo\r\n", "a", "b"), null);
    assert.equal(mergeText("a\n".repeat(10001), "a", "b"), null);
});
