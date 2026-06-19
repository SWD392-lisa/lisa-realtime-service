# Cloudflare Stream

Tai lieu nay mo ta private playback cua Phase 7.

## Vi sao dung Stream thay vi R2

Cloudflare Stream phu hop hon cho video playback private vi:

- Co Stream player san
- Co signed playback token / URL
- Co HLS va DASH playback
- Co video metadata va status phuc vu playback

R2 phu hop hon cho:

- Raw file backup
- Audio archive
- Original upload storage
- Asset pipeline phia sau

Noi ngan gon:

- Stream = playback product
- R2 = object storage product

## Env can cau hinh

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_STREAM_SIGNING_KEY=
CLOUDFLARE_STREAM_SIGNING_KEY_ID=
CLOUDFLARE_STREAM_CUSTOMER_CODE=
```

Bat buoc:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Optional:

- `CLOUDFLARE_STREAM_SIGNING_KEY`
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`

Neu co signing key, backend co the tu ky token.
Neu khong co, backend goi Cloudflare `/token` endpoint.

## Playback Flow

1. Frontend goi `GET /api/recordings/:recordingId/playback-url`
2. Backend check `AccessControlService`
3. Backend check recording:
   - `status = READY`
   - co `cloudflareVideoUid`
4. Backend tao signed playback token
5. Backend tra:
   - `playerUrl`
   - `hlsUrl`
   - `dashUrl`
   - `expiresIn`

## Demo voi fake hoac manual video UID

Neu chua co video that tu pipeline Agora -> Stream:

1. Tao recording nhu binh thuong
2. Dung endpoint register manual:

`POST /api/recordings/:recordingId/cloudflare-video`

Body:

```json
{
  "anonymousUserId": "SUPER-001",
  "videoUid": "your-cloudflare-video-uid"
}
```

3. Bam `Playback` tren web client

## Loi cau hinh

Neu thieu env:

- Backend tra `CLOUDFLARE_STREAM_NOT_CONFIGURED`
- App khong crash
- Frontend hien message loi
