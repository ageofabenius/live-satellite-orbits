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
            'content-type': 'application/gzip',
            'content-encoding': 'gzip',
            // 'cache-control': 'public, max-age=3600, s-maxage=3600',
            'content-disposition': 'inline; filename="active.txt.gz"',

            ...(mirrored_at ? { 'etag': `"${mirrored_at}"` } : {})
        }
    })
}