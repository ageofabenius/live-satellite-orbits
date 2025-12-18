import { getStore } from '@netlify/blobs'
import { readFileSync } from 'fs'

const DEV = false

export const GET = async (): Promise<Response> => {
    if (DEV) {
        return await load_test_tles()
    } else {
        return await load_from_netlify_blob()

    }
}

async function load_from_netlify_blob(): Promise<Response> {
    const store = getStore("celestrak-active-tles")
    const blob = await store.getWithMetadata('active.txt.gz', { type: 'arrayBuffer' })

    if (!blob) {
        return new Response('Not found', { status: 404 })
    }

    const fetched_at = blob.metadata?.fetched_at;

    const bytes = blob.data

    return new Response(await bytes, {
        headers: {
            'content-type': 'application/gzip',
            'content-encoding': 'gzip',
            // 'cache-control': 'public, max-age=3600, s-maxage=3600',
            'content-disposition': 'inline; filename="active.txt.gz"',

            ...(fetched_at ? { 'etag': `"${fetched_at}"` } : {})
        }
    })
}

async function load_test_tles(): Promise<Response> {
    const bytes = readFileSync("test/test_data/active.txt.gz")
    const fetched_at = new Date()

    return new Response(await bytes, {
        headers: {
            'content-type': 'application/gzip',
            'content-encoding': 'gzip',
            // 'cache-control': 'public, max-age=3600, s-maxage=3600',
            'content-disposition': 'inline; filename="active.txt.gz"',

            ...(fetched_at ? { 'etag': `"${fetched_at}"` } : {})
        }
    })
}