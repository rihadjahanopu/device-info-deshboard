const https = require("https");

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

				res.on("data", (chunk) => (data += chunk));

				res.on("end", () => {
					try {
						resolve({
							status: res.statusCode,
							body: JSON.parse(data),
						});
					} catch (e) {
						reject(new Error("JSON parse error"));
					}
				});
			}
		);

		// ✅ timeout protection
		req.setTimeout(7000, () => {
			req.destroy();
			reject(new Error("Request timeout"));
		});

		req.on("error", reject);
	});
}

exports.handler = async (event) => {
	const ip = event.queryStringParameters?.ip || "";

	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Content-Type": "application/json",
	};

	// ✅ CORS preflight
	if (event.httpMethod === "OPTIONS") {
		return {
			statusCode: 204,
			headers,
			body: "",
		};
	}

	const apis = [
		{
			url:
				ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : `https://ipwho.is/`,
			parse: (raw) => {
				if (raw.success === false)
					throw new Error(raw.message || "ipwho failed");

				return {
					ip: raw.ip,
					country_name: raw.country,
					country_code: raw.country_code,
					city: raw.city,
					region: raw.region,
					latitude: raw.latitude,
					longitude: raw.longitude,
					timezone: raw.timezone?.id || raw.timezone,
					org: raw.connection?.isp || raw.connection?.org,
					asn: raw.connection?.asn ? "AS" + raw.connection.asn : null,
					network: raw.connection?.route,
					version: raw.type?.toUpperCase() || "IPv4",
				};
			},
		},
		{
			url:
				ip ?
					`https://ipapi.co/${encodeURIComponent(ip)}/json/`
				:	`https://ipapi.co/json/`,
			parse: (raw) => {
				if (raw.error) throw new Error(raw.reason || "ipapi failed");

				return {
					ip: raw.ip,
					country_name: raw.country_name,
					country_code: raw.country_code,
					city: raw.city,
					region: raw.region,
					latitude: raw.latitude,
					longitude: raw.longitude,
					timezone: raw.timezone,
					org: raw.org,
					asn: raw.asn,
					network: raw.network,
					version: raw.version || "IPv4",
				};
			},
		},
	];

	let lastError = "";

	for (const api of apis) {
		try {
			console.log("Calling:", api.url);

			const { status, body } = await httpsGet(api.url);

			if (status !== 200) throw new Error("HTTP " + status);

			const data = api.parse(body);

			if (!data.ip) throw new Error("Invalid response");

			return {
				statusCode: 200,
				headers,
				body: JSON.stringify(data),
			};
		} catch (err) {
			lastError = err.message;
			continue;
		}
	}

	return {
		statusCode: 502,
		headers,
		body: JSON.stringify({
			error: "All APIs failed",
			details: lastError,
		}),
	};
};
