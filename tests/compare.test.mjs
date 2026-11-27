import test from "node:test";
import assert from "node:assert/strict";
import {compareNote, compareParagraphs, isMarkdownNote} from "../src/compare.js";
import {blobOid} from "../src/engine.js";

test("paragraph comparison aligns shared text, including repeated paragraphs and CRLF", () => {
    const result = compareParagraphs("开头\r\n\r\n甲\r\n\r\n中间\r\n\r\n甲\r\n\r\n尾",
        "开头\n\n乙\n\n中间\n\n甲\n\n尾");
    assert.deepEqual(result.changes, [{side:"local", number:2, text:"甲"}, {side:"remote", number:2, text:"乙"}]);
    assert.deepEqual(compareParagraphs("", "new").changes, [{side:"remote", number:1, text:"new"}]);
    assert.deepEqual(compareParagraphs("a\r\nb", "a\nb").changes, []);
    const long = Array.from({length:600}, (_, i) => "para " + i).join("\n\n");
    assert.deepEqual(compareParagraphs(long, long + "!").changes.map(c => c.number), [600, 600]);
    assert.equal(compareParagraphs(long, long.replaceAll("para", "changed")).kind, "excerpts");
});

test("preview reads the reviewed versions and excludes binary, drawings and oversized assets", async () => {
    const bytes = s => new TextEncoder().encode(s).buffer;
    const local = bytes("local"), remote = bytes("remote");
    const change = {path:"Note.md", here:await blobOid(local), there:await blobOid(remote)};
    let requests = 0;
    const api = {readBlob: async () => { requests++; return remote; }};
    const adapter = {stat: async () => ({size:local.byteLength}), readBinary: async () => local};
    assert.deepEqual((await compareNote(change, adapter, api, 6)).changes.map(x => x.text), ["local", "remote"]);
    assert.equal((await compareNote({...change, path:"figure.excalidraw.md"}, adapter, api)).kind, "attachment");
    assert.equal(isMarkdownNote("photo.png"), false);
    assert.equal((await compareNote(change, adapter, api, 600_000)).kind, "large");
    assert.equal(requests, 1);
    const drawing = bytes("---\nexcalidraw-plugin: parsed\n---\nraw");
    assert.equal((await compareNote({...change, here:await blobOid(drawing)},
        {...adapter, readBinary:async () => drawing}, api)).kind, "attachment");
    await assert.rejects(compareNote(change, {...adapter, readBinary:async () => bytes("new edit")}, api), /changed/);
});
