"""Synthesize narration with Edge TTS (free, no key). Writes an mp3 and a JSON list of word events."""
import argparse
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

TICKS_PER_MS = 10_000  # Edge reports offsets in 100ns ticks


async def synth(text: str, voice: str):
    comm = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    audio, events = bytearray(), []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            events.append({
                "text": chunk["text"],
                "startMs": chunk["offset"] / TICKS_PER_MS,
                "endMs": (chunk["offset"] + chunk["duration"]) / TICKS_PER_MS,
            })
    return bytes(audio), events


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", required=True)
    parser.add_argument("--text-file", required=True)
    parser.add_argument("--out-mp3", required=True)
    parser.add_argument("--out-json", required=True)
    args = parser.parse_args()
    text = Path(args.text_file).read_text(encoding="utf-8").strip()
    if not text:
        print("narration is empty", file=sys.stderr)
        return 2
    try:
        audio, events = asyncio.run(synth(text, args.voice))
    except Exception as exc:
        print(f"edge-tts failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    if not audio or not events:
        print("edge-tts returned no audio or no word events", file=sys.stderr)
        return 1
    Path(args.out_mp3).write_bytes(audio)
    Path(args.out_json).write_text(json.dumps(events), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
