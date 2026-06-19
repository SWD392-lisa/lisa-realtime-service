# Recorder Layout

Tai lieu nay mo ta layout recorder cho Phase 8.

## Muc tieu

- Tao giao dien classroom on dinh de webpage recording co the quay duoc mot bo cuc ro rang
- Giu trai nghiem giong lop hoc online hoac Zoom o muc demo
- Uu tien screen share neu dang active

## Main Classroom UI

Layout demo thong thuong gom:

- Top bar
  - session title
  - current role
  - recording status
- Main stage
  - screen share neu co
  - neu khong co screen share thi uu tien active speaker hoac camera chinh
- Side panel
  - participants
  - hand raise queue
  - media status
- Bottom control bar
  - mic
  - camera
  - share screen
  - raise hand
  - start or stop recording cho `SUPER`

## Recorder Route

Route:

`/recorder/session/:sessionId`

Tinh chat:

- Read-only
- Khong co button dieu khien
- On dinh hon cho webpage recording

Route nay hien:

- main stage
- screen share neu dang co
- active speaker video
- participant strip
- session title va watermark recorder

## Composite vs Webpage

- Composite recording
  - Layout do Agora render o server-side
  - Phu hop khi muon mot output video tron don gian

- Webpage recording
  - Layout do frontend route `/recorder/session/:sessionId` render
  - De giai thich hon khi muon quay giao dien giong Zoom hoac classroom UI
  - Huu ich cho bai hoc sinh vien vi nhin thay stage, strip, status, watermark ro rang

## Data Source

- Route recorder uu tien lay state that tu Socket.IO va Agora subscriptions
- Neu sau nay co pipeline rieng, route nay co the doi sang feed state read-only khong doi giao dien
