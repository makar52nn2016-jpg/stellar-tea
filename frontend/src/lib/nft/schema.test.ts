import { describe, expect, it } from "vitest";

import {
  GENERATIVE_METADATA_VERSION,
  buildTeaMetadata,
  resolveManifestUrl,
  toIpfsUri,
  type BuildMetadataInput,
  type FlavorStats,
  type TeaColorway,
} from "@/lib/nft/schema";

const solidColorway: TeaColorway = { mode: "solid", color: "#ff0000" };
const baseStats: FlavorStats = { body: 40, caffeine: 30, sweetness: 50 };

const baseInput: BuildMetadataInput = {
  name: "Test Tea",
  description: "Test description",
  imageCid: "bafytestimage",
  seed: "seed-aaa",
  rank: 1,
  rarity: "Common",
  flavorProfile: "Floral",
  infusion: "Aurora",
  colorway: solidColorway,
  layers: [
    { categoryId: "base", variantId: "classic", label: "Classic", order: 0, assetUri: "ipfs://bafybase" },
  ],
  lineage: { generation: 0, parents: [] },
  stats: baseStats,
  mixCount: 0,
};

describe("toIpfsUri", () => {
  it("leaves an existing ipfs:// URI untouched", () => {
    expect(toIpfsUri("ipfs://abc")).toBe("ipfs://abc");
    expect(toIpfsUri("ipfs://bafybeihunter12345/path/file.json")).toBe(
      "ipfs://bafybeihunter12345/path/file.json",
    );
  });

  it("prefixes a bare CID with ipfs://", () => {
    expect(toIpfsUri("abc")).toBe("ipfs://abc");
    expect(toIpfsUri("bafybeihunter12345")).toBe("ipfs://bafybeihunter12345");
  });

  it("documents the documented double-prefix outcome for a /-rooted path", () => {
    // The current implementation unconditionally prefixes `ipfs://` to anything that
    // is not already prefixed with it. A `/`-rooted path is therefore miscoded as
    // `ipfs:///<path>` rather than resolved against the local asset path.
    // This test pins that documented behaviour so a future change to support
    // local paths intentionally breaks it (rather than silently changing semantics).
    expect(toIpfsUri("/local/asset.png")).toBe("ipfs:///local/asset.png");
  });
});

describe("buildTeaMetadata", () => {
  const metadata = buildTeaMetadata(baseInput);

  it("sets properties.version === GENERATIVE_METADATA_VERSION", () => {
    expect(metadata.properties.version).toBe(GENERATIVE_METADATA_VERSION);
    expect(metadata.properties.version).toBe("1.0.0");
  });

  it("carries the rank, rarity and flavor profile through to the properties block", () => {
    expect(metadata.properties.rank).toBe(1);
    expect(metadata.properties.rarity).toBe("Common");
    expect(metadata.properties.flavorProfile).toBe("Floral");
  });

  it("emits all nine baseline attributes (with rank, rarity, flavor attributes)", () => {
    // The 9 baseline attributes are: Rank, Rarity, Flavor Profile, Infusion,
    // Body, Caffeine, Sweetness, Generation, Mix Count.
    const traitTypes = metadata.attributes.map((a) => a.trait_type);
    expect(traitTypes).toContain("Rank");
    expect(traitTypes).toContain("Rarity");
    expect(traitTypes).toContain("Flavor Profile");
    expect(traitTypes).toContain("Infusion");
    expect(traitTypes).toContain("Body");
    expect(traitTypes).toContain("Caffeine");
    expect(traitTypes).toContain("Sweetness");
    expect(traitTypes).toContain("Generation");
    expect(traitTypes).toContain("Mix Count");
    expect(metadata.attributes.length).toBeGreaterThanOrEqual(9);
  });

  it("includes the seed, colorway, layers, lineage, stats and mixCount in properties", () => {
    expect(metadata.properties.seed).toBe("seed-aaa");
    expect(metadata.properties.colorway).toEqual(solidColorway);
    expect(metadata.properties.layers).toHaveLength(1);
    expect(metadata.properties.lineage.generation).toBe(0);
    expect(metadata.properties.stats).toEqual(baseStats);
    expect(metadata.properties.mixCount).toBe(0);
  });

  it("prefixes the image and animation_url with ipfs://", () => {
    expect(metadata.image).toBe("ipfs://bafytestimage");
    expect(metadata.animation_url).toBeUndefined();

    const withAnimation = buildTeaMetadata({ ...baseInput, animationCid: "bafyanim" });
    expect(withAnimation.animation_url).toBe("ipfs://bafyanim");
  });

  it("sets a parseable ISO8601 generatedAt timestamp", () => {
    expect(metadata.properties.generatedAt).toBeTruthy();
    const parsed = new Date(metadata.properties.generatedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

describe("resolveManifestUrl", () => {
  it("honours a custom gatewayBaseUrl, trimming a trailing slash", () => {
    expect(
      resolveManifestUrl({ manifestCid: "bafy123", gatewayBaseUrl: "https://example.com/ipfs/" }),
    ).toBe("https://example.com/ipfs/bafy123");
    expect(
      resolveManifestUrl({ manifestCid: "bafy123", gatewayBaseUrl: "https://example.com/ipfs" }),
    ).toBe("https://example.com/ipfs/bafy123");
    expect(
      resolveManifestUrl({ manifestCid: "bafy123", gatewayBaseUrl: "https://example.com/" }),
    ).toBe("https://example.com/bafy123");
  });

  it("falls back to the filebase.io gateway when no gatewayBaseUrl is provided", () => {
    expect(resolveManifestUrl({ manifestCid: "bafy123" })).toBe(
      "https://ipfs.filebase.io/ipfs/bafy123",
    );
  });
});
