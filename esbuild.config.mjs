import {build} from "esbuild";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const license = await readFile(join(root, "node_modules/ignore/LICENSE-MIT"), "utf8");
await build({
    absWorkingDir: root,
    entryPoints: ["src/plugin.js"], outfile: "main.js",
    bundle: true, platform: "browser", format: "cjs", target: "safari15",
    external: ["obsidian"], legalComments: "none",
    banner: {js: "/* Includes node-ignore.\n" + license.trimEnd() + "\n*/"},
    footer: {js: "module.exports = module.exports.default;"}
});
