export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=5",
      "Vary": "Origin"
    };

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "GET") {
      return respond({ error: "Use GET requests." }, 405);
    }

    if (url.pathname === "/") {
      return respond({
        name: "AcarsAero Aircraft API",
        status: "online",
        endpoint: "/aircraft?lat=39.10&lon=-84.51&radius=50",
        radiusUnit: "nautical miles",
        maxRadius: 250
      });
    }

    if (url.pathname !== "/aircraft") {
      return respond({ error: "Endpoint not found." }, 404);
    }

    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const radius = Number(url.searchParams.get("radius") ?? 50);

    if (
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      !Number.isFinite(radius) ||
      lat < -90 || lat > 90 ||
      lon < -180 || lon > 180 ||
      radius < 1 || radius > 250
    ) {
      return respond({
        error: "Invalid coordinates or radius.",
        example: "/aircraft?lat=39.10&lon=-84.51&radius=50",
        allowedRadius: "1–250 nautical miles"
      }, 400);
    }

    const upstream =
      `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radius}`;

    try {
      const response = await fetch(upstream, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return respond({
          error: "Aircraft data provider returned an error.",
          providerStatus: response.status
        }, 502);
      }

      const data = await response.json();
      const aircraft = data.aircraft ?? [];

      return respond({
        source: "ADS-B.lol",
        center: { lat, lon },
        radius,
        fetchedAt: new Date().toISOString(),
        count: aircraft.length,
        aircraft
      });
    } catch {
      return respond({
        error: "Unable to retrieve aircraft data. Try again shortly."
      }, 502);
    }
  }
};
