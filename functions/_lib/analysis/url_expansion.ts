export async function expandUrl(url: string): Promise<string> {
    // List of common shorteners to prioritize (optional optimization, but we'll try to expand all URLs)
    const SHORTENER_PATTERNS = [
        /bit\.ly/, /goo\.gl/, /tinyurl\.com/, /t\.co/, /is\.gd/, /buff\.ly/, /adf\.ly/, /ow\.ly/, /j\.mp/, /r\.brand\.ly/
    ];

    try {
        // Validation check before expansion to avoid trying to expand non-URLs or invalid ones
        const urlObj = new URL(url);

        // Simple optimization: if it's very long, probably not a shortener?
        // But some shorteners wrap long URLs.

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        // We use HEAD to follow redirects without downloading content
        // Note: cloudflare workers 'fetch' with redirect: 'follow' will return the final URL in response.url
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Solveya-Link-Expander/1.0',
                'Accept': '*/*'
            },
            redirect: 'follow',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.url && response.url !== url) {
            // Check if final URL is valid
            try {
                const finalUrl = new URL(response.url);
                return finalUrl.href;
            } catch (e) {
                return url; // Fallback to original if expansion result is weird
            }
        }

    } catch (e) {
        // Timeout, network error, or invalid URL - return original
        console.warn('URL expansion failed', e);
    }

    return url;
}
