const https = require("https");

// ─── HTTPS helper ─────────────────────────────
function httpsGet(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(
			url,
			{
				headers: {
					"User-Agent": "Mozilla/5.0",
					Accept: "application/json",
				},
			},
			(res) => {
				let data = "";
				res.on("data", (c) => (data += c));
				res.on("end", () => {
					try {
						resolve({ status: res.statusCode, body: JSON.parse(data) });
					} catch {
						reject(new Error("JSON parse error"));
					}
				});
			}
		);

		req.setTimeout(7000, () => {
			req.destroy();
			reject(new Error("Timeout"));
		});

		req.on("error", reject);
	});
}

// ─── Score system (BEST API select করবে) ─────────────────
function scoreData(d) {
	let score = 0;
	if (d.ip) score += 2;
	if (d.country_name) score += 3;
	if (d.country_code) score += 2;
	if (d.city) score += 2;
	if (d.latitude && d.longitude) score += 2;
	if (d.org) score += 1;
	if (d.timezone) score += 1;
	return score;
}

// ─── MAIN ─────────────────────────────
exports.handler = async (event) => {
	const realIP =
		event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
		event.headers["client-ip"] ||
		"";

	const queryIP = event.queryStringParameters?.ip;
	const ip = queryIP || realIP;

	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json",
	};

	if (event.httpMethod === "OPTIONS") {
		return { statusCode: 204, headers, body: "" };
	}

	const apis = [
		{
			name: "ipwho",
			url:
				ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : `https://ipwho.is/`,
			parse: (r) => {
				if (r.success === false) throw new Error();
				return {
					ip: r.ip,
					country_name: r.country,
					country_code: r.country_code,
					city: r.city,
					region: r.region,
					latitude: r.latitude,
					longitude: r.longitude,
					timezone: r.timezone?.id,
					org: r.connection?.isp,
				};
			},
		},
		{
			name: "ipapi",
			url:
				ip ?
					`https://ipapi.co/${encodeURIComponent(ip)}/json/`
				:	`https://ipapi.co/json/`,
			parse: (r) => {
				if (r.error) throw new Error();
				return {
					ip: r.ip,
					country_name: r.country_name,
					country_code: r.country_code,
					city: r.city,
					region: r.region,
					latitude: r.latitude,
					longitude: r.longitude,
					timezone: r.timezone,
					org: r.org,
				};
			},
		},
	];

	let bestData = null;
	let bestScore = -1;

	// ─── Auto select best API ─────────────────
	for (const api of apis) {
		try {
			const { status, body } = await httpsGet(api.url);
			if (status !== 200) continue;

			const data = api.parse(body);
			const s = scoreData(data);

			console.log(api.name, "score:", s);

			if (s > bestScore) {
				bestScore = s;
				bestData = data;
			}
		} catch {}
	}

	if (!bestData) {
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ error: "All APIs failed" }),
		};
	}

	return {
		statusCode: 200,
		headers,
		body: JSON.stringify(bestData),
	};
};
