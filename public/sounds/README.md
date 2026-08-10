# 효과음 / 배경음 (Soundscape)

| 파일 | 용도 |
|------|------|
| `bgm-day.wav` | 낮·대기 메인 BGM (멜로디·패드) |
| `bgm-night.wav` | 밤 메인 BGM (으스스한 마이너) |
| `env-birds.wav` | 낮 환경음 — 새소리 |
| `env-stream.wav` | 낮 환경음 — 시냇물 |
| `env-crow.wav` | 밤 환경음 — 까마귀 |
| `env-rain.wav` | 밤 환경음 — 비 (30% 확률 오버레이) |
| `gunshot.wav` / `gunshot.mp3` | 아침 마피아 습격 총소리 |
| `camera-shutter.wav` | 기자 취재 셔터 |
| `newspaper-rustle.wav` | 신문 펼치는 소리 |

`lib/audioManager.ts`는 `.mp3` 경로를 먼저 시도하고, 없으면 위 `.wav` 파일을 사용합니다.

## 다시 생성

```bash
node scripts/generate-bgm.mjs
```

루프는 약 36초이며 끝·시작이 크로스페이드되어 끊김이 적습니다.
