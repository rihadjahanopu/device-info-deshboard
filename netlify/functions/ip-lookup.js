const https = require("https");

function httpsGet(url) {
	return new Promise((resolve, reject) => {
		https
			.get(
				url,
				{
					headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
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
			)
			.on("error", reject)
			.setTimeout(7000, () => reject(new Error("Timeout")));
	});
}

exports.handler = async (event) => {
	const ip = event.queryStringParameters?.ip || "";
	const url =
		ip ?
			`https://ipapi.co/${encodeURIComponent(ip)}/json/`
		:	`https://ipapi.co/json/`;

	try {
		const { status, body } = await httpsGet(url);
		if (status !== 200 || body.error) throw new Error("API failed");

		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
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
			}),
		};
	} catch (e) {
		return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
	}
};
