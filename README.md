# Dan Anxiety Auth Server (Fastify + Better Auth)

A minimal Fastify server providing authentication using Better Auth with SQLite.

## Prerequisites
- Node.js 18+

## Setup
1. Install deps
2. Run DB migration (optional: Better Auth manages its own schema internally; custom tables are created by our migrate script using mysql2)
3. Start server

## Scripts
- `npm run dev` — start with watch
- `npm start` — start
- `npm run migrate` — Better Auth CLI migrate (if using Better Auth's CLI-managed migrations)
- `npm run encode:hls` — offline HLS transcoder for videos in `/media/original`

## Environment Variables

Copy `.env.example` to `.env` and fill in real values (never commit the real `.env`).

Key groups:
- Auth: `BETTER_AUTH_SECRET`, `JWT_SECRET`
- Database: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- RevenueCat:
	- `REVENUECAT_SECRET_API_KEY` (server secret key for subscriber lookup)
	- `REVENUECAT_ENTITLEMENT_ID` (default: `Dan Fost Anxios Pro`)
	- `REVENUECAT_WEBHOOK_AUTH` (optional shared secret for webhook authorization)
- Media storage and caching:
	- `FileStorage__BasePath` (or `FILESTORAGE__BASEPATH` / `FILE_STORAGE_BASE_PATH`): absolute folder root, e.g. `/media`.
	- `MEDIA_CACHE_CONTROL`: optional override for media routes (default `public, max-age=86400, immutable`). For HLS VOD you can set `public, max-age=31536000, immutable`.
	- Optional tuning for the transcoder: `HLS_CRF` (default 22), `HLS_SCALE` (default `scale=-2:720`), `HLS_SEGMENT_TIME` (default 4 seconds).

The app-side RevenueCat product identifiers used by this project are:
- `dan_basic`
- `dan_premium`
- `dan_vip`

Main subscription endpoints:
- `GET /api/subscriptions/current`
- `GET /api/subscriptions/history`
- `POST /api/subscriptions/sync`
- `POST /api/subscriptions/start-trial` (3-day backend-managed free trial, independent of RevenueCat)
- `POST /api/subscriptions/webhook`

## Endpoints
- `GET /health` — quick check
- `GET/POST /api/auth/*` — Better Auth handler

## Client config example
Use `better-auth/client` in your app and set baseURL to the server or same-origin.

## Media pipeline (HLS, offline)

Folder layout under `FileStorage__BasePath` (example `/media` on the VPS):

```
/media
	/original           # drop source videos here (123.mp4, 124.mov, ...)
	/hls/<id>/master.m3u8
	/hls/<id>/segment_000.ts
```

Transcoder worker (`npm run encode:hls`):
- Scans `/media/original` for `.mp4` or `.mov` files.
- For each `<id>.mp4` (or `.mov`), if `/media/hls/<id>/master.m3u8` is missing, it runs ffmpeg with safe defaults for a 2 vCPU / 4GB box: `libx264`, `aac`, `-preset veryfast`, `-crf 22`, `-hls_time 4`, `-hls_list_size 0`, `scale=-2:720`.
- Idempotent: reruns with `--force` if you want to regenerate.

Example manual run on the VPS (ffmpeg must be installed):

```
NODE_ENV=production FileStorage__BasePath=/media npm run encode:hls -- --force
```

Suggested cron (logs to file, runs every 5 minutes):

```
*/5 * * * * /usr/bin/node /path/to/backend/src/encode-videos.js >> /var/log/encode-videos.log 2>&1
```

API additions:
- `GET /api/media/*` — unchanged: streams mp4/mov/m3u8/ts with Range/ETag/Cache-Control.
- `GET /api/videos/:id` — returns `{ id, hlsUrl }` if `/media/hls/<id>/master.m3u8` exists; otherwise 404.

React Native example (using `react-native-video`):

```jsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Video from 'react-native-video';

export default function MyVideoScreen() {
	const videoId = '123';
	const hlsUrl = `https://<your-domain>/api/media/hls/${videoId}/master.m3u8`;

	return (
		<View style={styles.container}>
			<Video
				source={{ uri: hlsUrl }}
				style={styles.video}
				controls
				resizeMode="contain"
				paused={false}
				ignoreSilentSwitch="ignore"
				playInBackground={false}
				playWhenInactive={false}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: 'black' },
	video: { flex: 1 },
});
```

Lifecycle for a new video `123.mp4`:
1) Place `123.mp4` into `/media/original` on the VPS (SCP/SFTP or other upload method).
2) Cron/worker (`encode-videos.js`) sees it and produces `/media/hls/123/master.m3u8` + segments.
3) Mobile app requests `https://<domain>/api/media/hls/123/master.m3u8` (served by the existing streaming route with Range/ETag/caching).
