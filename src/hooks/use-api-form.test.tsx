import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { toFormErrors, useApiForm } from "./use-api-form";

describe("toFormErrors", () => {
  it("uses field details from validation errors", () => {
    const error = new ApiClientError(422, "VALIDATION_ERROR", "Invalid", { name: ["Required"] });
    expect(toFormErrors(error)).toEqual({ name: ["Required"] });
  });

  it("falls back to a form-level message", () => {
    expect(toFormErrors(new ApiClientError(500, "INTERNAL_ERROR", "Something went wrong"))).toEqual({
      _form: ["Something went wrong"],
    });
    expect(toFormErrors("weird")).toEqual({ _form: ["Something went wrong"] });
  });
});

describe("useApiForm", () => {
  it("returns the result and clears errors on success", async () => {
    const { result } = renderHook(() => useApiForm());
    let value: string | undefined;
    await act(async () => {
      value = await result.current.submit(async () => "saved");
    });
    expect(value).toBe("saved");
    expect(result.current.errors).toEqual({});
    expect(result.current.pending).toBe(false);
  });

  it("exposes field errors when the request fails", async () => {
    const { result } = renderHook(() => useApiForm());
    await act(async () => {
      await result.current.submit(async () => {
        throw new ApiClientError(422, "VALIDATION_ERROR", "Invalid", { email: ["Enter a valid email address"] });
      });
    });
    expect(result.current.error("email")).toBe("Enter a valid email address");
    expect(result.current.error("name")).toBeUndefined();
  });
});
