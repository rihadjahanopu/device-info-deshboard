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
		ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : `https://ipwho.is/`;

	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

		const raw = await res.json();

		if (!raw.success && raw.success !== undefined) {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ error: raw.message || "Invalid IP" }),
			};
		}

		const data = {
			ip: raw.ip,
			country_name: raw.country,
			country_code: raw.country_code,
			city: raw.city,
			region: raw.region,
			latitude: raw.latitude,
			longitude: raw.longitude,
			timezone: raw.timezone?.id,
			org: raw.connection?.isp || raw.connection?.org,
			asn: "AS" + raw.connection?.asn,
			network: raw.connection?.route,
			version: raw.type?.toUpperCase() || "IPv4",
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
