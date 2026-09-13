import axios, { type AxiosInstance } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./http", () => ({
  apiGatewayUrl: "http://gateway.test",
}));

import { useAuthStore } from "@/features/auth/store";
import { setupInterceptors } from "./interceptors";

const user = {
  id: "user-1",
  email: "member@example.test",
  roles: ["MEMBER"],
};

function makeAxiosInstance() {
  let responseErrorHandler: ((error: unknown) => Promise<unknown>) | undefined;
  const responseUse = vi.fn((_: unknown, onRejected: (error: unknown) => Promise<unknown>) => {
    responseErrorHandler = onRejected;
    return 1;
  });
  const instance = Object.assign(vi.fn(), {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: responseUse },
    },
  }) as unknown as AxiosInstance;

  return {
    instance,
    responseErrorHandler: () => responseErrorHandler,
  };
}

describe("authenticated 401 refresh/replay", () => {
  it("deduplicates concurrent 401 refreshes and replays both requests", async () => {
    let resolveRefresh!: (value: never) => void;
    const refresh = vi.spyOn(axios, "post").mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const fake = makeAxiosInstance();
    setupInterceptors(fake.instance);
    const reject = fake.responseErrorHandler()!;
    const first = reject({ response: { status: 401 }, config: { headers: {} } });
    const second = reject({ response: { status: 401 }, config: { headers: {} } });
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh({ data: { accessToken: "fresh", user } } as never);
    await Promise.all([first, second]);
    expect(fake.instance).toHaveBeenCalledTimes(2);
  });

  it("clears the session after a failed refresh without replaying the request", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 401 } });
    const fake = makeAxiosInstance();
    setupInterceptors(fake.instance);
    const error = { response: { status: 401 }, config: { headers: {} } };
    await expect(fake.responseErrorHandler()!(error)).rejects.toBe(error);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(fake.instance).not.toHaveBeenCalled();
  });

  it("does not refresh again when the replay also returns 401", async () => {
    const refresh = vi.spyOn(axios, "post");
    const fake = makeAxiosInstance();
    setupInterceptors(fake.instance);
    const error = { response: { status: 401 }, config: { headers: {}, _retry: true } };
    await expect(fake.responseErrorHandler()!(error)).rejects.toBe(error);
    expect(refresh).not.toHaveBeenCalled();
    expect(fake.instance).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      accessToken: "expired-access-token",
      isAuthenticated: true,
      isHydrated: true,
      user,
    });
  });

  it("refreshes and replays a request that Gateway rejected before business execution", async () => {
    const refresh = vi.spyOn(axios, "post").mockResolvedValue({
      data: { accessToken: "fresh-access-token", user },
    } as never);
    const fakeAxios = makeAxiosInstance();
    setupInterceptors(fakeAxios.instance);
    const reject = fakeAxios.responseErrorHandler();

    if (!reject) {
      throw new Error("Response interceptor was not registered");
    }

    await expect(
      reject({
        response: { status: 401 },
        config: { headers: {} },
      }),
    ).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledWith(
      "http://gateway.test/api/auth/refresh",
      undefined,
      { withCredentials: true },
    );
    expect(fakeAxios.instance).toHaveBeenCalledWith(
      expect.objectContaining({
        _retry: true,
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-access-token",
        }),
      }),
    );
  });
});
