import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("standalone marketplace interface", () => {
  it("renders honest consumer benefits and participant and operator paths", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("A market you can inspect");
    expect(html).toContain("Know the deal");
    expect(html).toContain("Choose a fictional service");
    expect(html).toContain("Create simulated booking");
    expect(html).toContain("Operate the local market");
    expect(html).toContain("this is not production authentication");
  });
});
