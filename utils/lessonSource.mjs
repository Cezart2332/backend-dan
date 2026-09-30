// Only the published HLS stream is used, including listening-only mode.
export async function resolveLessonSource(videoFile, baseUrl, fetcher, signal) {
  const id = videoFile.replace(/\.[^.]+$/, '');
  const response = await fetcher(`${baseUrl}/api/videos/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) throw new Error('Lecția nu este disponibilă momentan.');
  const { hlsUrl } = await response.json();
  if (typeof hlsUrl !== 'string' || !hlsUrl.trim()) throw new Error('Fluxul video nu este disponibil.');
  const url = new URL(hlsUrl, `${baseUrl}/`);
  if (!['https:', 'http:'].includes(url.protocol) || !url.pathname.toLowerCase().endsWith('.m3u8')) throw new Error('Fluxul video nu este disponibil.');
  return url.href;
}
