import path from "node:path";
import { describe, expect, it } from "vitest";

import { faceFileName, isWoff2, latinBlocks, parseFace } from "../../../scripts/font-faces";

const GSTATIC = "https://fonts.gstatic.com/s/montserrat/v1/abc.woff2";

function block(weight: string, url = GSTATIC, style = "normal") {
  return `@font-face {
  font-family: 'Montserrat';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url(${url}) format('woff2');
}`;
}

describe("latinBlocks", () => {
  it("keeps only the latin subset of labeled css2 output", () => {
    const css = `/* cyrillic */\n${block("400")}\n/* latin */\n${block("700")}`;
    const blocks = latinBlocks(css);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("font-weight: 700");
  });

  it("keeps every block of unlabeled legacy output", () => {
    expect(latinBlocks(`${block("400")}\n${block("700")}`)).toHaveLength(2);
  });
});

describe("parseFace", () => {
  it("accepts a single weight and a variable range from fonts.gstatic.com", () => {
    expect(parseFace(block("400"), "Montserrat")).toEqual({
      family: "Montserrat",
      weight: "400",
      style: "normal",
      url: GSTATIC,
    });
    expect(parseFace(block("400 700"), "Montserrat")?.weight).toBe("400 700");
  });

  it("rejects a weight that could inject a path or CSS", () => {
    expect(parseFace(block("400/../../x"), "Montserrat")).toBeNull();
    expect(parseFace(block("400} body{color:red"), "Montserrat")).toBeNull();
  });

  it("rejects an unexpected font-style", () => {
    expect(parseFace(block("400", GSTATIC, "oblique 10deg"), "Montserrat")).toBeNull();
  });

  it("rejects font files hosted anywhere but fonts.gstatic.com", () => {
    expect(parseFace(block("400", "https://evil.example/x.woff2"), "Montserrat")).toBeNull();
    expect(
      parseFace(block("400", "https://fonts.gstatic.com.evil.example/x.woff2"), "Montserrat"),
    ).toBeNull();
  });

  it("rejects a malformed URL and a block with no woff2 source", () => {
    expect(parseFace(block("400", "https://[bad.woff2"), "Montserrat")).toBeNull();
    expect(parseFace("@font-face { font-weight: 400; }", "Montserrat")).toBeNull();
  });
});

describe("isWoff2", () => {
  it("checks the wOF2 signature", () => {
    expect(isWoff2(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00]))).toBe(true);
    expect(isWoff2(new TextEncoder().encode("<html>rate limited</html>"))).toBe(false);
    expect(isWoff2(new Uint8Array([0x77, 0x4f]))).toBe(false);
  });
});

describe("faceFileName", () => {
  const outDir = path.join("/tmp", "fonts");

  it("slugs the family and encodes a weight range with underscores", () => {
    expect(faceFileName(outDir, "Fredoka One", "400 700")).toBe("fredoka-one-400_700.woff2");
  });

  it("refuses names that would escape the output directory", () => {
    expect(() => faceFileName(outDir, "../../etc", "400")).toThrow(/Refusing/);
  });
});
