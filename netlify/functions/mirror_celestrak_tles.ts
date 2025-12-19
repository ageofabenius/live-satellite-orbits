import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const CELESTRAK_ACTIVE_TLES_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"

export const config: Config = {
    schedule: "@hourly"
}

export default async function mirror_celestrak() {
    const tles_str = await fetch_tles_from_celestrak()
    const size_raw = tles_str.length.toLocaleString('en-US')
    console.log(`Fetched TLEs from Celestrak, ${size_raw}B`)

    const tles_str_gz = await gzip_string(tles_str)
    const size_compressed = tles_str_gz.byteLength.toLocaleString('en-US')
    console.log(`Compressed TLEs, from ${size_raw} Bytes to ${size_compressed} Bytes`)

    const store = getStore("celestrak-active-tles")

    await store.set('active.txt.gz', tles_str_gz, {
        metadata: {
            fetched_at: new Date().toISOString(),
        }
    })
    console.log(`Stored TLEs under 'active.txt.gz'`)

    return await new Response(`Fetched and stored active.txt.gz (${size_compressed} Bytes from ${size_raw} Bytes raw)`, {
        status: 200,
    })
}

async function fetch_tles_from_celestrak(): Promise<string> {
    console.log("Fetching TLEs from Celestrak...")
    console.time("Fetched TLEs from Celestrak...")
    const res = await fetch(CELESTRAK_ACTIVE_TLES_URL)
    const str = await res.text()

    console.timeEnd("Fetched TLEs from Celestrak...")

    return str
}

async function gzip_string(str: string): Promise<ArrayBuffer> {
    return await new Response(
        new Blob([str])
            .stream()
            .pipeThrough(new CompressionStream('gzip'))
    ).arrayBuffer();
}

