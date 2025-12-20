import { getStore } from "@netlify/blobs";

export default async function fetch_mirrored_tles(): Promise<Response> {
    const store = getStore("celestrak-active-tles")
    const blob = await store.getWithMetadata("active.txt.gz", {
        type: "arrayBuffer"
    })

    if (!blob) {
        return new Response('Unable to load TLEs from Blob', { status: 503 })
    }

    const mirrored_at = blob.metadata?.mirrored_at;

    const bytes = blob.data

    return new Response(bytes, {
        headers: {
            'content-type': 'text/plain; charset=utf-8',
            'content-encoding': 'gzip',

            ...(mirrored_at ? { 'etag': `"${mirrored_at}"` } : {})
        }
    })
}