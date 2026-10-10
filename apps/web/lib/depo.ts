import { del, get, list, put } from "@vercel/blob";

export function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function writePrivate(pathname: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  const view = body instanceof Uint8Array ? body : new Uint8Array(body);
  const copy = Buffer.alloc(view.byteLength);
  copy.set(view);
  await put(pathname, copy, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType
  });
}

export async function readPrivate(pathname: string) {
  if (!blobReady()) return null;
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return result.stream;
}

export async function wipeUser(userId: string) {
  if (!blobReady()) return;
  let cursor: string | undefined;
  for (;;) {
    const page = await list({ prefix: `u/${userId}/`, limit: 1000, cursor });
    if (page.blobs.length) await del(page.blobs.map((item) => item.pathname));
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
}
