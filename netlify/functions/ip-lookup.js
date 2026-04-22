const https = require("https");

function httpsGet(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(
			url,
			{
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					Accept: "application/json",
				},
			},
			(res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					try {
						resolve({ status: res.statusCode, body: JSON.parse(data) });
					} catch {
						reject(new Error("JSON parse error"));
					}
				});
			}
		);

		req.on("error", reject);
		req.on("timeout", () => {
			req.destroy();
			reject(new Error("Timeout"));
		});
		req.setTimeout(7000);
	});
}

exports.handler = async (event) => {
	const ip = event.queryStringParameters?.ip || "";

	// IP validation (IPv4 + IPv6)
	const isValidIP = (ip) => {
		if (!ip) return true;
		const ipv4 =
			/^(?:(?:25[0-5]|2[0-4]\d|1?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1?\d\d?)$/;
		const ipv6 =
			/^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$|^::1$/;
		return ipv4.test(ip) || ipv6.test(ip);
	};

	if (ip && !isValidIP(ip)) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Content-Type",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ error: "Invalid IP format" }),
		};
	}

	const url =
		ip ?
			`https://ipapi.co/${encodeURIComponent(ip)}/json/`
		:	`https://ipapi.co/json/`;

	try {
		const { status, body } = await httpsGet(url);

		if (status !== 200) throw new Error(`API returned ${status}`);
		if (body.error) throw new Error(body.reason || body.error || "API failed");

		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Content-Type",
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
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Content-Type",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ error: e.message }),
		};
	}
};
