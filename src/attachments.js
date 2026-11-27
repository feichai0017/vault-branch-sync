import {isMarkdownNote} from "./compare.js";

const picture = /\.(?:svg|png|jpe?g|webp|gif|bmp|avif|heic|tiff?)$/i;

export function relatedFigures(note, eligible, metadata, resolve, isDrawing) {
    if (!isMarkdownNote(note) || isDrawing(note) || !metadata) return [];
    const related = new Set();
    const add = path => { if (eligible.has(path)) related.add(path); };
    for (const {link} of [...(metadata.embeds || []), ...(metadata.links || [])]) {
        const path = resolve(link, note);
        if (!path) continue;
        if (isDrawing(path)) {
            add(path);
            const stem = path.replace(/\.md$/i, "");
            for (const name of new Set([stem, stem.replace(/\.excalidraw$/i, "")])) {
                for (const ending of [".svg", ".dark.svg", ".light.svg", ".png"]) add(name + ending);
            }
        } else if (picture.test(path)) {
            add(path);
            const stem = path.replace(/(?:\.(?:dark|light))?\.[^.]+$/i, "");
            for (const candidate of [stem + ".md", stem + ".excalidraw.md", stem + ".excalidraw"]) {
                if (eligible.has(candidate) && isDrawing(candidate)) add(candidate);
            }
        }
    }
    return [...related].sort();
}
