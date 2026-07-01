import axios from "axios";

import { setupInterceptors } from "./interceptors";

export const apiGatewayUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:3000";

export const http = axios.create({
  baseURL: apiGatewayUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

setupInterceptors(http);
