import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("COMP-M1 React test setup", () => {
  it("renders accessible text", () => {
    render(<p>Foundation ready</p>);
    expect(screen.getByText("Foundation ready")).toBeTruthy();
  });
});
