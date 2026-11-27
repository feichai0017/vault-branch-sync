import test from "node:test";
import assert from "node:assert/strict";
import {relatedFigures} from "../src/attachments.js";
import {restoreCopy} from "../src/history.js";
import {GitHub} from "../src/github.js";

test("figure choices use resolved links, drawing export pairs and only eligible outgoing assets", () => {
    const files=new Set(["图/路由.excalidraw.md","图/路由.excalidraw.svg","图/路由.png","图/路由.dark.svg",
        "attachments/hand.svg","attachments/hand.md","draft.md","图/unrelated.png"]);
    const paths=new Map([["../图/路由.excalidraw.svg","图/路由.excalidraw.svg"],["路由","图/路由.excalidraw.md"],
        ["hand","attachments/hand.md"],["other","draft.md"],["unchanged","图/unchanged.png"]]);
    const meta={links:[{link:"路由"},{link:"other"},{link:"unchanged"}],embeds:[{link:"../图/路由.excalidraw.svg"},{link:"hand"}]};
    const drawing=path=>path.endsWith(".excalidraw.md") || path==="attachments/hand.md";
    assert.deepEqual(relatedFigures("Paper.md",files,meta,link=>paths.get(link),drawing),
        ["图/路由.excalidraw.md","图/路由.excalidraw.svg","图/路由.png","图/路由.dark.svg","attachments/hand.svg","attachments/hand.md"].sort());
    files.delete("图/路由.excalidraw.svg");
    assert.deepEqual(relatedFigures("Paper.md",files,{embeds:[meta.embeds[0]]},link=>paths.get(link),drawing),["图/路由.excalidraw.md"]);
    assert.deepEqual(relatedFigures("图/路由.excalidraw.md",files,meta,link=>paths.get(link),drawing),[]);
});

test("history pins pagination to an immutable head, encodes the exact path and recognizes deleted revisions", async () => {
    const commit="a".repeat(40), blob="b".repeat(40), path="AI Infra/图 #?%.md", calls=[];
    const responses=[{status:200,json:[{sha:commit,commit:{message:"First\nbody",author:{date:"2026-11-27"}}}]},
        {status:200,json:[]},{status:200,json:{type:"file",path,sha:blob,size:256}}, {status:404,json:{}}];
    const api=new GitHub({repository:"example/notes",branch:"main"},"test",async options=>{
        calls.push(new URL(options.url));assert.equal(options.method,"GET");return responses.shift();
    });
    assert.deepEqual(await api.noteHistory(path,commit),[{sha:commit,message:"First",date:"2026-11-27"}]);
    await api.noteHistory(path,commit,2);
    assert.equal(calls[0].searchParams.get("path"),path);assert.equal(calls[1].searchParams.get("sha"),commit);
    assert.equal(calls[1].searchParams.get("page"),"2");
    assert.deepEqual(await api.noteRevision(path,commit),{sha:blob,size:256});
    assert(calls[2].pathname.endsWith("/AI%20Infra/%E5%9B%BE%20%23%3F%25.md"));
    assert.equal(await api.noteRevision(path,commit),null);
    await assert.rejects(api.noteHistory(".git/config",commit),/Invalid/);
});

test("restoring a historical copy preserves raw bytes, original, and existing or concurrently-created copies", async () => {
    const commit="a".repeat(40), files=new Map([["notes/N.md","current"],["notes/N (history aaaaaaaaaaaa).md","edited copy"]]);
    let raced=false;
    const vault={adapter:{exists:async p=>files.has(p)},createBinary:async(path,bytes)=>{
        if (!raced) {raced=true;files.set(path,"other window");throw Error("already exists");}
        files.set(path,bytes);return {path};
    }};
    const bytes=Uint8Array.from([239,187,191,65,13,10]).buffer;
    const copy=await restoreCopy(vault,"notes/N.md",commit,bytes);
    assert.equal(copy.path,"notes/N (history aaaaaaaaaaaa-3).md");
    assert.equal(files.get(copy.path),bytes); assert.equal(files.get("notes/N.md"),"current");
    assert.equal(files.get("notes/N (history aaaaaaaaaaaa).md"),"edited copy");
    await assert.rejects(restoreCopy(vault,"notes/N.md","invalid",bytes), /Invalid/);
});
