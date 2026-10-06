import { describe, expect, it } from "vitest";
import { attachmentProblem, encodeFile, formatBytes } from "./attachments";

const limits = { max_file_bytes: 1000, max_files: 2, max_total_bytes: 1500 };
const file = (name: string, size: number) => ({ name, size });

describe("attachmentProblem", () => {
  it("accepts files within the limits, and anything while the limits are unknown", () => {
    expect(attachmentProblem([file("a", 900), file("b", 500)], limits)).toBeNull();
    expect(attachmentProblem([file("a", 99999999)], undefined)).toBeNull();
  });
  it("names the limit that is broken", () => {
    expect(attachmentProblem([file("a", 1), file("b", 1), file("c", 1)], limits)).toMatch(/At most 2 files/);
    expect(attachmentProblem([file("big.bin", 1001)], limits)).toMatch(/big\.bin is larger/);
    expect(attachmentProblem([file("a", 900), file("b", 900)], limits)).toMatch(/together/);
  });
});

describe("encodeFile", () => {
  it("gives base64 with no data: prefix, and keeps the name and type", async () => {
    const out = await encodeFile(new File(["hello"], "hi.txt", { type: "text/plain" }));
    expect(out).toEqual({ name: "hi.txt", content_type: "text/plain", data: "aGVsbG8=" });
    expect((await encodeFile(new File([""], "x"))).content_type).toBeUndefined();
  });
});

describe("formatBytes", () => {
  it("reads sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });
});
