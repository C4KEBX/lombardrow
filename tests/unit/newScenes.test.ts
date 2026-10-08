import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import factsJson from "../../fixtures/ledger.facts.json";
import sbJson from "../../fixtures/ledger.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { fetchAssets, type FetchDeps } from "../../src/pipeline/fetchAssets";
import { findAssets, loadSceneImages } from "../../src/pipeline/assets";
import { assertAssets, parseAssets } from "../../src/schema/assets";
import { factIdsOf, parseStoryboard } from "../../src/schema/storyboard";
import { synthWords } from "../../src/voice/synthWords";

const IMAGES: Record<string, { src: string; credit: string }> = { "page-standin": { src: "data:image/jpeg;base64,", credit: "Stand-in" } };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const build = (sb: unknown = sbJson, facts: unknown = factsJson, images = IMAGES) =>
  buildVideo(sb, facts, (s) => Object.fromEntries(s.scenes.map((x) => [x.id, synthWords(x.narration)])), 30, undefined, undefined, images);
const scene = (sb: any, id: string) => sb.scenes.find((s: any) => s.id === id);

describe("ledger demo (archival, flow-diagram, ledger-page)", () => {
  it("builds with one cue per step and per row, inside their scenes", () => {
    const built = build();
    expect(built.scenes.map((s) => s.scene.type)).toEqual(["archival", "flow-diagram", "ledger-page"]);
    expect(built.scenes[1].cues).toHaveLength(4);
    expect(built.scenes[2].cues).toHaveLength(2);
    for (const s of built.scenes) for (const c of s.cues) expect(c.frame).toBeLessThan(s.durationFrames);
  });
  it("passes on only the images its scenes use", () => {
    expect(Object.keys(build(sbJson, factsJson, { ...IMAGES, spare: { src: "x", credit: "y" } }).images)).toEqual(["page-standin"]);
  });
  it("refuses an archival scene whose image was not loaded", () => {
    expect(() => build(sbJson, factsJson, {})).toThrow(/asset "page-standin", but no image was loaded/);
  });
  it("keeps the year counter off archival scenes", () => {
    const sb = clone(sbJson);
    scene(sb, "page").year = 1494;
    expect(() => build(sb)).toThrow(/archival uses that space/);
  });
  it("archival names no facts of its own; flow and ledger name their factId", () => {
    const sb = parseStoryboard(sbJson);
    expect(factIdsOf(sb.scenes[0])).toEqual(["f-summa"]);
    expect(factIdsOf(sb.scenes[1])).toEqual(["f-double"]);
    expect(factIdsOf(sb.scenes[2])).toEqual(["f-daybook"]);
  });
  it("defaults the archival camera to a slow push-in", () => {
    const sb = clone(sbJson);
    delete scene(sb, "page").props.from;
    delete scene(sb, "page").props.to;
    const props = (parseStoryboard(sb).scenes[0] as any).props;
    expect(props.from).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(props.to).toEqual({ x: 0.5, y: 0.5, zoom: 1.15 });
  });
});

describe("on-screen figures trace to facts", () => {
  it("rejects a flow step number no named fact states", () => {
    const sb = clone(sbJson);
    scene(sb, "doubling").props.steps[2].label = "Wait 12 years";
    expect(() => build(sb)).toThrow(/shows "12", which no fact it names states/);
  });
  it("rejects a flow diagram with numbers and no factId", () => {
    const sb = clone(sbJson);
    delete scene(sb, "doubling").props.factId;
    expect(() => build(sb)).toThrow(/flow-diagram\) shows "\$1,000"/);
  });
  it("rejects a ledger amount that does not match the fact", () => {
    const sb = clone(sbJson);
    scene(sb, "accounts").props.total.amount = "210 duc.";
    expect(() => build(sb)).toThrow(/shows "210"/);
  });
  it("accepts a rounded figure (about $2,000 for a fact of 1,999)", () => {
    expect(() => build()).not.toThrow();
  });
});

describe("flow-diagram and ledger-page shape", () => {
  it("needs one arrow label per gap between steps", () => {
    const sb = clone(sbJson);
    scene(sb, "doubling").props.arrows = ["one", "two"];
    expect(() => parseStoryboard(sb)).toThrow(/one label per gap between steps \(3\)/);
  });
  it("needs exactly one emphasize cue per step", () => {
    const sb = clone(sbJson);
    scene(sb, "doubling").cues.pop();
    expect(() => build(sb)).toThrow(/exactly one emphasize cue per step \(4\); got 3/);
  });
  it("needs rows spoken in order", () => {
    const sb = clone(sbJson);
    scene(sb, "accounts").narration = "First the pepper, then the cloth, then he rules off what he spent in all that day.";
    expect(() => build(sb)).toThrow(/rows must be spoken in order/);
  });
  it("rejects a ledger scene too short to write its total", () => {
    const sb = clone(sbJson);
    scene(sb, "accounts").narration = "The cloth, the pepper.";
    expect(() => build(sb)).toThrow(/too short|rows must be spoken/);
  });
});

const ASSET = {
  id: "summa", file: "assets/summa.jpg", sourceUrl: "https://commons.wikimedia.org/wiki/File:Summa.jpg",
  downloadUrl: "https://upload.wikimedia.org/summa.jpg", license: "public-domain", credit: "Pacioli, 1494. Public domain.", depicts: "Title page",
};

describe("assets.json", () => {
  it("accepts public-domain and CC0 only", () => {
    expect(parseAssets({ assets: [ASSET] }).assets[0].id).toBe("summa");
    expect(() => parseAssets({ assets: [{ ...ASSET, license: "cc-by-sa" }] })).toThrow(/public-domain or cc0/);
  });
  it("keeps files inside the video folder and ids unique", () => {
    expect(() => parseAssets({ assets: [{ ...ASSET, file: "../../etc/x.jpg" }] })).toThrow(/inside the video folder/);
    expect(() => parseAssets({ assets: [ASSET, ASSET] })).toThrow(/duplicate asset id/);
  });
  it("checks every archival scene has a listed, downloaded asset", () => {
    const sb = parseStoryboard(sbJson);
    const assets = parseAssets({ assets: [{ ...ASSET, id: "page-standin" }] });
    expect(() => assertAssets(sb, undefined, () => true)).toThrow(/needs assets.json/);
    expect(() => assertAssets(sb, parseAssets({ assets: [ASSET] }), () => true)).toThrow(/not in assets.json/);
    expect(() => assertAssets(sb, assets, () => false)).toThrow(/is missing; run npm run assets/);
    expect(() => assertAssets(sb, assets, () => true)).not.toThrow();
  });
  it("loads downloaded images as data URIs and finds assets.json next to the storyboard", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assets-"));
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets/summa.jpg"), Buffer.from([1, 2, 3]));
    fs.writeFileSync(path.join(dir, "assets.json"), JSON.stringify({ assets: [ASSET, { ...ASSET, id: "other", file: "assets/other.png" }] }));
    const found = findAssets(path.join(dir, "x.storyboard.json"))!;
    const images = loadSceneImages(found.file, found.assets);
    expect(images.summa).toEqual({ src: "data:image/jpeg;base64,AQID", credit: ASSET.credit });
    expect(images.other).toBeUndefined();
    expect(findAssets(path.join(os.tmpdir(), "nowhere", "x.storyboard.json"))).toBeUndefined();
  });
});

describe("fetchAssets", () => {
  const setup = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-"));
    return { dir, file: path.join(dir, "assets.json") };
  };
  const deps = (over: Partial<FetchDeps> = {}): FetchDeps & { calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      fetch: (async (url: URL) => {
        calls.push(String(url));
        return new Response(new Uint8Array([9, 9]), { headers: { "content-type": "image/jpeg" } });
      }) as unknown as typeof fetch,
      resolve: async () => ["208.80.154.240"],
      resize: async (input, output) => fs.copyFileSync(input, output),
      ...over,
    };
  };
  it("downloads a missing image, resizes it and leaves no temporary file", async () => {
    const { dir, file } = setup();
    const d = deps();
    const report = await fetchAssets(file, parseAssets({ assets: [ASSET] }), {}, d);
    expect(report[0]).toMatch(/^fetched\s+summa/);
    expect(fs.readFileSync(path.join(dir, "assets/summa.jpg"))).toEqual(Buffer.from([9, 9]));
    expect(fs.readdirSync(path.join(dir, "assets"))).toEqual(["summa.jpg"]);
    expect(await fetchAssets(file, parseAssets({ assets: [ASSET] }), {}, d)).toEqual([expect.stringMatching(/^have/)]);
    expect(d.calls).toHaveLength(1);
  });
  it("sends a generic user agent", async () => {
    const { file } = setup();
    let ua = "";
    await fetchAssets(file, parseAssets({ assets: [ASSET] }), {}, deps({
      fetch: (async (_u: URL, init: RequestInit) => {
        ua = (init.headers as Record<string, string>)["user-agent"];
        return new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } });
      }) as unknown as typeof fetch,
    }));
    expect(ua).toBe("lombard-row-assets/1.0");
  });
  it("refuses private addresses and non-images", async () => {
    const { file } = setup();
    const assets = parseAssets({ assets: [ASSET] });
    await expect(fetchAssets(file, assets, {}, deps({ resolve: async () => ["10.0.0.5"] }))).rejects.toThrow(/refusing to fetch/);
    await expect(fetchAssets(file, assets, {}, deps({
      fetch: (async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch,
    }))).rejects.toThrow(/is text\/html/);
  });
  it("reports an asset with no downloadUrl instead of failing", async () => {
    const { file } = setup();
    const { downloadUrl: _, ...noUrl } = ASSET;
    expect(await fetchAssets(file, parseAssets({ assets: [noUrl] }), {}, deps())).toEqual([expect.stringMatching(/^missing\s+summa\s+no downloadUrl/)]);
  });
});
