import { readRender } from "@/lib/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "content-type": "video/mp4",
  "accept-ranges": "bytes",
  "cache-control": "no-store",
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const jobId = id.replace(/\.mp4$/i, "");
  const data = await readRender(jobId);
  if (!data) {
    return new Response("Rendu introuvable.", { status: 404 });
  }

  const range = request.headers.get("range");
  if (!range) {
    return new Response(new Uint8Array(data), {
      headers: { ...HEADERS, "content-length": String(data.length) },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response("Range invalide.", { status: 416 });
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : data.length - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= data.length) {
    return new Response("Range hors limites.", {
      status: 416,
      headers: { "content-range": `bytes */${data.length}` },
    });
  }

  const slice = data.subarray(start, Math.min(end, data.length - 1) + 1);
  return new Response(new Uint8Array(slice), {
    status: 206,
    headers: {
      ...HEADERS,
      "content-length": String(slice.length),
      "content-range": `bytes ${start}-${start + slice.length - 1}/${data.length}`,
    },
  });
}
