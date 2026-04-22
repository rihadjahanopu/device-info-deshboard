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

	const url =
		ip ?
			`https://ipapi.co/${encodeURIComponent(ip)}/json/`
		:	`https://ipapi.co/json/`;

	try {
		const { status, body } = await httpsGet(url);

		// Handle API errors (e.g., rate limits or invalid IPs)
		if (status !== 200 || body.error) {
			return {
				statusCode: status === 200 ? 400 : status,
				headers,
				body: JSON.stringify({
					error: body.reason || "Failed to fetch data from ipapi.co",
				}),
			};
		}

		// Parse the required data
		const data = {
			ip: body.ip,
			country_name: body.country_name,
			country_code: body.country_code,
			city: body.city,
			region: body.region,
			latitude: body.latitude,
			longitude: body.longitude,
			timezone: body.timezone,
			org: body.org,
			asn: body.asn,
			network: body.network,
			version: body.version,
		};

		return {
			statusCode: 200,
			headers,
			body: JSON.stringify(data),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ error: "Network or Server Error" }),
		};
	}
};
