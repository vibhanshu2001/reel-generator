import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

/**
 * Downloads a file from a URL to a local destination path.
 */
export async function downloadFile(
  url: string,
  dest: string,
  contentTypePrefix?: string,
  timeoutMs: number = 8000
): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    }, (response) => {
      // Validate content type if requested
      const contentType = response.headers['content-type'] || '';
      if (response.statusCode !== 200 || (contentTypePrefix && !contentType.startsWith(contentTypePrefix))) {
        file.close();
        fs.unlink(dest, () => {});
        resolve(false);
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      console.error(`[Download] Error for ${url}:`, err.message);
      resolve(false);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      file.close();
      fs.unlink(dest, () => {});
      console.warn(`[Download] Timeout for ${url}`);
      resolve(false);
    });
  });
}

/**
 * Scrapes Google Images for the given search query and returns the top matching URLs.
 */
export async function scrapeGoogleImageUrls(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
    console.log(`🔍 [ImageSearch] Scraping Google Images for: "${query}"`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`[ImageSearch] Google Images returned status ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Regex to find high-res image URLs in script block JSON arrays.
    // Google Images embeds original URLs in arrays like ["https://example.com/image.jpg", 1000, 800]
    const imgUrlRegex = /(https?:\/\/[^"\s>]+?\.(?:jpg|jpeg|png|webp))/gi;
    const matches = html.match(imgUrlRegex) || [];

    const uniqueUrls: string[] = [];
    const seen = new Set<string>();

    for (const url of matches) {
      // Exclude google CDN thumbnails, tracking pixels, google domains, and common logos
      if (
        url.includes('gstatic.com') ||
        url.includes('google.com') ||
        url.includes('google-analytics') ||
        url.includes('doubleclick') ||
        url.includes('avatar') ||
        url.includes('profile') ||
        url.includes('logo')
      ) {
        continue;
      }

      // De-duplicate
      const cleanUrl = url.replace(/\\/g, ''); // strip escaping characters if any
      if (!seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        uniqueUrls.push(cleanUrl);
      }
    }

    console.log(`🔍 [ImageSearch] Found ${uniqueUrls.length} potential image URLs.`);
    return uniqueUrls;
  } catch (error: any) {
    console.error('[ImageSearch] Scraper failed:', error.message);
    return [];
  }
}

/**
 * Scrapes Unsplash for the given search query.
 */
export async function scrapeUnsplashImageUrls(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
    console.log(`🔍 [ImageSearch] Scraping Unsplash for: "${query}"`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`[ImageSearch] Unsplash search returned status ${response.status}`);
      return [];
    }

    const html = await response.text();
    const imgUrlRegex = /https:\/\/images\.unsplash\.com\/photo-[^\"\s>]+/g;
    const matches = html.match(imgUrlRegex) || [];

    const uniqueUrls: string[] = [];
    const seen = new Set<string>();

    for (const url of matches) {
      // Decode HTML entities
      let cleanUrl = url.replace(/&amp;/g, '&');
      
      // Upgrade resolution
      cleanUrl = cleanUrl
        .replace(/w=\d+/, 'w=1080')
        .replace(/fit=crop/, 'fit=max')
        .replace(/q=\d+/, 'q=85');

      if (!seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        uniqueUrls.push(cleanUrl);
      }
    }

    console.log(`🔍 [ImageSearch] Found ${uniqueUrls.length} potential Unsplash image URLs.`);
    return uniqueUrls;
  } catch (error: any) {
    console.error('[ImageSearch] Unsplash scraping failed:', error.message);
    return [];
  }
}

/**
 * Scrapes DuckDuckGo Images for the given search query.
 */
export async function scrapeDuckDuckGoImageUrls(query: string): Promise<string[]> {
  try {
    console.log(`🔍 [ImageSearch] Scraping DuckDuckGo Images for: "${query}"`);
    
    // 1. Fetch search page to get VQD token
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      console.warn(`[ImageSearch] DuckDuckGo search page returned status ${response.status}`);
      return [];
    }

    const html = await response.text();
    const vqdRegexes = [
      /vqd=([\d-]+)/,
      /vqd\s*=\s*['"]([^'"]+)['"]/,
      /vqd\s*:\s*['"]([^'"]+)['"]/
    ];

    let vqd: string | null = null;
    for (const regex of vqdRegexes) {
      const match = html.match(regex);
      if (match && match[1]) {
        vqd = match[1];
        break;
      }
    }

    if (!vqd) {
      console.warn(`[ImageSearch] Could not find VQD token in DuckDuckGo HTML.`);
      return [];
    }

    // 2. Fetch images JSON from i.js
    const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json&l=us-en`;
    const imgResponse = await fetch(imagesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://duckduckgo.com/'
      }
    });

    if (!imgResponse.ok) {
      console.warn(`[ImageSearch] DuckDuckGo images endpoint returned status ${imgResponse.status}`);
      return [];
    }

    const data: any = await imgResponse.json();
    if (data.results && Array.isArray(data.results)) {
      const urls = data.results.map((r: any) => r.image).filter(Boolean);
      console.log(`🔍 [ImageSearch] DuckDuckGo returned ${urls.length} image URLs.`);
      return urls;
    }
    
    return [];
  } catch (error: any) {
    console.error('[ImageSearch] DuckDuckGo scraper failed:', error.message);
    return [];
  }
}

/**
 * Orchestrates searching for an image and downloading the first successful match.
 * Falls back to returning null if no matches succeed.
 */
export async function runImageSearch(
  query: string,
  projectId: string,
  outputsDir: string
): Promise<string | null> {
  const filename = `${projectId}_scene_1.png`;
  const localDestPath = path.join(outputsDir, filename);

  console.log(`🔍 [ImageSearch] Searching images for query: "${query}"`);

  let urls = await scrapeDuckDuckGoImageUrls(query);
  if (urls.length === 0) {
    console.log(`🔍 [ImageSearch] DuckDuckGo search returned 0 results. Trying Google...`);
    urls = await scrapeGoogleImageUrls(query);
  }
  if (urls.length === 0) {
    console.log(`🔍 [ImageSearch] Google search returned 0 results. Trying Unsplash...`);
    urls = await scrapeUnsplashImageUrls(query);
  }

  if (urls.length === 0) {
    console.warn(`[ImageSearch] No candidate URLs found in DuckDuckGo, Google, or Unsplash.`);
    return null;
  }

  // Try the top 5 image candidates
  const candidates = urls.slice(0, 5);
  for (let i = 0; i < candidates.length; i++) {
    const candidateUrl = candidates[i];
    console.log(`📥 [ImageSearch] Trying candidate ${i + 1}/${candidates.length}: ${candidateUrl}`);
    
    const success = await downloadFile(candidateUrl, localDestPath, 'image/');
    if (success) {
      // Confirm the file actually has non-zero size
      try {
        const stats = fs.statSync(localDestPath);
        if (stats.size > 2048) { // bigger than 2KB to ignore empty/corrupted files
          console.log(`🎯 [ImageSearch] Successfully downloaded high-res image to ${localDestPath}`);
          return `/outputs/${filename}`;
        } else {
          try { fs.unlinkSync(localDestPath); } catch {}
        }
      } catch (e) {
        console.error('[ImageSearch] Error checking file size:', e);
      }
    }
  }

  console.warn(`[ImageSearch] Failed to download any working images for: "${query}"`);
  return null;
}
