# Player test fixtures

`public/demo/player-sample.mp4` is a synthetic 24-second video generated from FFmpeg's `testsrc2` pattern and a quiet generated sine tone. It contains no course footage.

From the `web` directory, the fixture can be regenerated with FFmpeg:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=480x270:rate=12' \
  -f lavfi -i 'sine=frequency=440:sample_rate=44100' -t 24 \
  -vf 'format=yuv420p' -af 'volume=0.01' -c:v libx264 -preset veryfast \
  -crf 38 -c:a aac -b:a 32k -movflags +faststart public/demo/player-sample.mp4
```
