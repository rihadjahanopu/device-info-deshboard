const https = require("https");

function httpsGet(url) {
	return new Promise((resolve, reject) => {
		const options = {
			headers: {
				"User-Agent": "Mozilla/5.0",
				Accept: "application/json",
			},
		};
		https
			.get(url, options, (res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					try {
						resolve({ status: res.statusCode, body: JSON.parse(data) });
					} catch (e) {
						reject(new Error("JSON parse error: " + data.slice(0, 100)));
					}
				});
			})
			.on("error", reject);
	});
}

exports.handler = async function (event) {
	const ip = event.queryStringParameters?.ip || "";

	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Content-Type": "application/json",
	};

	if (event.httpMethod === "OPTIONS") {
		return { statusCode: 204, headers, body: "" };
	}

	// দুটো API try করবে, একটা fail করলে আরেকটা
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
					timezone:
						raw.timezone && raw.timezone.id ? raw.timezone.id : raw.timezone,
					org: raw.connection ? raw.connection.isp || raw.connection.org : null,
					asn: raw.connection ? "AS" + raw.connection.asn : null,
					network: raw.connection ? raw.connection.route : null,
					version: raw.type ? raw.type.toUpperCase() : "IPv4",
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
			const { status, body } = await httpsGet(api.url);
			if (status !== 200) throw new Error(`HTTP ${status}`);
			const data = api.parse(body);
			if (!data.ip) throw new Error("No IP in response");
			return { statusCode: 200, headers, body: JSON.stringify(data) };
		} catch (err) {
			lastError = err.message;
			continue;
		}
	}

	return {
		statusCode: 502,
		headers,
		body: JSON.stringify({ error: "All APIs failed: " + lastError }),
	};
};
