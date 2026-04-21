const https = require("https");

function httpsGet(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, { headers: { "User-Agent": "netlify-function" } }, (res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						reject(new Error("JSON parse error"));
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

	const url =
		ip ?
			`https://ipapi.co/${encodeURIComponent(ip)}/json/`
		:	`https://ipapi.co/json/`;

	try {
		const raw = await httpsGet(url);

		if (raw.error) {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ error: raw.reason || "Invalid IP" }),
			};
		}

		const data = {
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

		return { statusCode: 200, headers, body: JSON.stringify(data) };
	} catch (err) {
		return {
			statusCode: 502,
			headers,
			body: JSON.stringify({ error: err.message }),
		};
	}
};
