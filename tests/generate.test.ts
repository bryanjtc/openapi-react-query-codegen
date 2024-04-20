import { readFileSync, rmdirSync } from "node:fs";
import path from "node:path";
import type { UserConfig } from "@hey-api/openapi-ts";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { generate } from "../src/generate.mjs";

const readOutput = (fileName: string) => {
  return readFileSync(
    path.join(__dirname, "outputs", "queries", fileName),
    "utf-8",
  );
};

describe("generate", () => {
  beforeAll(async () => {
    const options: UserConfig = {
      input: path.join(__dirname, "inputs", "petstore.yaml"),
      output: path.join("tests", "outputs"),
    };
    await generate(options, "1.0.0");
  });

  afterAll(() => {
    // cleanup
    rmdirSync(path.join(__dirname, "outputs"), { recursive: true });
  });

  test("common.ts", () => {
    expect(readOutput("common.ts")).toMatchSnapshot();
  });

  test("queries.ts", () => {
    expect(readOutput("queries.ts")).toMatchSnapshot();
  });

  test("index.ts", () => {
    expect(readOutput("index.ts")).toMatchSnapshot();
  });

  test("suspense.ts", () => {
    expect(readOutput("suspense.ts")).toMatchSnapshot();
  });
});
