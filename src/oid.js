const utf8 = new TextEncoder();
export const validOid = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);

export async function blobOid(data) {
    const bytes = new Uint8Array(data);
    const header = utf8.encode("blob " + bytes.length + "\0");
    const blob = new Uint8Array(header.length + bytes.length);
    blob.set(header);
    blob.set(bytes, header.length);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", blob));
    return Array.from(digest, n => n.toString(16).padStart(2, "0")).join("");
}
