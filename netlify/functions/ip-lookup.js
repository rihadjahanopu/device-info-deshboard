const https = require("https");

exports.handler = async (event) => {
	const ip = event.queryStringParameters?.ip || "";
	// ipapi.co ইউআরএল ফরম্যাট
	const url =
		ip ?
			`https://ipapi.co/${encodeURIComponent(ip)}/json/`
		:	`https://ipapi.co/json/`;

	return new Promise((resolve) => {
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
						const body = JSON.parse(data);
						// যদি API এরর দেয় (যেমন: Rate Limit)
						if (body.error) {
							resolve({
								statusCode: 400,
								headers: { "Access-Control-Allow-Origin": "*" },
								body: JSON.stringify({ error: body.reason || "API Error" }),
							});
						} else {
							resolve({
								statusCode: 200,
								headers: {
									"Access-Control-Allow-Origin": "*",
									"Content-Type": "application/json",
								},
								body: JSON.stringify(body),
							});
						}
					} catch (e) {
						resolve({
							statusCode: 500,
							body: JSON.stringify({ error: "JSON Parse Error" }),
						});
					}
				});
			}
		);

		req.on("error", (e) => {
			resolve({
				statusCode: 500,
				body: JSON.stringify({ error: e.message }),
			});
		});

		// ৫ সেকেন্ড টাইমআউট
		req.setTimeout(5000, () => {
			req.destroy();
			resolve({
				statusCode: 504,
				body: JSON.stringify({ error: "API Timeout" }),
			});
		});
	});
};
