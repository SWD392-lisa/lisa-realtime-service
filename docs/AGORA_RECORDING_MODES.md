# Agora Recording Modes

Tai lieu nay mo ta 3 mode chinh cua Agora Cloud Recording cho Phase 6.

## Composite Recording

Mota:

- Tron nhieu stream thanh 1 output video
- Phu hop voi classroom recording co stage chinh

Uu diem:

- De phat lai
- De demo
- Output don gian

Nhuoc diem:

- It linh hoat hon neu muon edit tung participant rieng

## Individual Recording

Mota:

- Ghi tung stream rieng
- Moi participant co output rieng

Uu diem:

- Tot cho hau ky
- De xu ly AI/video pipeline sau nay

Nhuoc diem:

- Quan ly file phuc tap hon
- Demo playback kho hon

## Webpage Recording

Mota:

- Ghi lai mot webpage layout hoan chinh
- Co the ghi toan bo classroom UI, screen stage, participant strip, badge, overlay

Uu diem:

- Gan voi trai nghiem frontend that
- Tot cho demo va branded classroom layout

Nhuoc diem:

- Can route web on dinh
- Can toi uu layout recorder rieng

## Khuyen nghi cho demo

- Demo nhanh: `composite`
- Demo giao dien classroom day du: `webpage`

Trong repo nay:

- Route recorder co san: `/recorder/session/:sessionId`
- Route nay la read-only classroom view de lam diem vao cho webpage recording sau nay
