import axios from "axios";

/**
 * If running inside Electron (window.electronAPI exists),
 * override axios adapter to route all requests through IPC
 * instead of HTTP. This lets the same React code work in both
 * web (via FastAPI backend) and desktop (via Electron IPC).
 */
export function setupElectronAdapter() {
  if (typeof window === "undefined" || !window.electronAPI) return false;

  axios.defaults.adapter = async (config) => {
    const method = (config.method || "get").toUpperCase();

    // Extract path from URL (strip base URL)
    let url = config.url || "";
    if (config.baseURL && url.startsWith(config.baseURL)) {
      url = url.slice(config.baseURL.length);
    }
    // If URL is absolute with http(s), strip origin
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const u = new URL(url);
        url = u.pathname + u.search;
      }
    } catch (e) {
      /* ignore */
    }

    // Parse body data
    let data = config.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        /* keep as string */
      }
    }

    const response = await window.electronAPI.request({ method, url, data });

    const httpResponse = {
      data: response.data,
      status: response.status || 200,
      statusText: response.status >= 400 ? "Error" : "OK",
      headers: { "content-type": "application/json" },
      config,
      request: {},
    };

    if (httpResponse.status >= 400) {
      const error = new Error(
        (response.data && response.data.detail) || "Request failed"
      );
      error.response = httpResponse;
      error.config = config;
      throw error;
    }

    return httpResponse;
  };

  return true;
}
