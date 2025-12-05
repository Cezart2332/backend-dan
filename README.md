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
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Subscription mapping: `SUBSCRIPTION_PRICE_BASIC`, `SUBSCRIPTION_PRICE_PREMIUM`, `SUBSCRIPTION_PRICE_VIP`
- Media storage and caching:
	- `FileStorage__BasePath` (or `FILESTORAGE__BASEPATH` / `FILE_STORAGE_BASE_PATH`): absolute folder root, e.g. `/media`.
	- `MEDIA_CACHE_CONTROL`: optional override for media routes (default `public, max-age=86400, immutable`). For HLS VOD you can set `public, max-age=31536000, immutable`.
	- Optional tuning for the transcoder: `HLS_CRF` (default 22), `HLS_SCALE` (default `scale=-2:720`), `HLS_SEGMENT_TIME` (default 4 seconds).

Each subscription mapping var can be either:
1. A direct Stripe Price ID (e.g. `price_123`) — used as-is.
2. A Stripe Product ID (e.g. `prod_123`) — backend lazily resolves its `default_price` (or first active price) and caches it.

Diagnostic endpoint to verify resolution before attempting checkout:
`GET /api/subscriptions/prices`

Example response:
```
{
	"prices": {
		"basic": { "source": "prod_abc", "type": "product", "resolvedPriceId": "price_xyz", "ok": true, "reason": null },
		"premium": { "source": "price_def", "type": "price", "resolvedPriceId": "price_def", "ok": true, "reason": null },
		"vip": { "source": null, "type": null, "resolvedPriceId": null, "ok": false, "reason": "no env var set" }
	},
	"stripeConfigured": true
}
```

If a product returns `ok: false` with `reason: could not resolve default/active price`, ensure:
- The product has an active recurring price in Stripe.
- The price is not archived and is set to the desired billing interval.
- Consider setting the product's default price in the Stripe dashboard for faster resolution.

### Checkout Debugging
You can test plan resolution without creating a real session:
`POST /api/subscriptions/create-checkout?debug=1` with body `{ "plan": "basic" }`.
It returns the resolved price ID and mapping details.

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
