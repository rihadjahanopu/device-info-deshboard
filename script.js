// Global state
let battery = null;
let currentSession = null;
let sessionRateInterval = null;

const store = {
	get(key, fallback) {
		try {
			const v = localStorage.getItem(key);
			return v !== null ? v : String(fallback);
		} catch {
			return String(fallback);
		}
	},
	set(key, val) {
		try {
			localStorage.setItem(key, String(val));
		} catch {}
	},
	clear() {
		try {
			localStorage.clear();
		} catch {}
	},
};

let batteryData = {
	sessions: JSON.parse(store.get("batterySessions", "[]")),
	totalChargingTime: parseInt(store.get("totalChargingTime", "0")),
	totalDischargingTime: parseInt(store.get("totalDischargingTime", "0")),
	chargeCycles: parseFloat(store.get("chargeCycles", "0")),
};

// Init
document.addEventListener("DOMContentLoaded", async () => {
	updateTimestamp();
	await initBattery();
	updateAllInfo();
	renderHistory();
	estimateHealth();
	fetchIPInfo();

	setInterval(() => {
		updateTimestamp();
		updateBatteryUI();
	}, 5000);
});

function showTab(btn, tabName) {
	document
		.querySelectorAll(".tab")
		.forEach((t) => t.classList.remove("active"));
	document
		.querySelectorAll(".tab-content")
		.forEach((t) => t.classList.remove("active"));
	btn.classList.add("active");
	document.getElementById(tabName).classList.add("active");
}

function updateTimestamp() {
	const now = new Date();
	document.getElementById("timestamp").textContent =
		"🕐 " +
		now.toLocaleString("bn-BD", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
}

// Battery
async function initBattery() {
	if (!("getBattery" in navigator)) return;
	try {
		battery = await navigator.getBattery();
		setupBatteryListeners();
		startNewSession();
	} catch (e) {
		console.warn("Battery API error:", e);
	}
}

function setupBatteryListeners() {
	battery.addEventListener("levelchange", () => {
		updateBatteryUI();
		updateSessionRate();
	});
	battery.addEventListener("chargingchange", () => {
		updateBatteryUI();
		endSession();
		startNewSession();
	});
}

function updateAllInfo() {
	const bi = detectBrowser();
	document.getElementById("browser-name").textContent =
		bi.browser + " " + bi.version;
	document.getElementById("os-name").textContent = detectOS();
	document.getElementById("platform").textContent = navigator.platform;

	document.getElementById("online-status").innerHTML =
		navigator.onLine ?
			'<span class="status-badge status-online">🟢 Online</span>'
		:	'<span class="status-badge status-offline">🔴 Offline</span>';

	document.getElementById("cpu-cores").textContent =
		navigator.hardwareConcurrency || "N/A";
	document.getElementById("cpu-cores-main").textContent =
		navigator.hardwareConcurrency || "--";
	document.getElementById("ram").textContent =
		navigator.deviceMemory ? navigator.deviceMemory + " GB" : "N/A";
	document.getElementById("ram-main").textContent =
		navigator.deviceMemory || "--";
	document.getElementById("device-memory").textContent =
		navigator.deviceMemory ? navigator.deviceMemory + " GB" : "N/A";
	document.getElementById("touch-points").textContent =
		navigator.maxTouchPoints || "0";
	document.getElementById("touch-main").textContent =
		"ontouchstart" in window ? "Yes" : "No";

	document.getElementById("resolution").textContent =
		screen.width + " x " + screen.height;
	document.getElementById("resolution-main").textContent =
		screen.width + "×" + screen.height;
	document.getElementById("screen-width").textContent = screen.width;
	document.getElementById("screen-height").textContent = screen.height;
	document.getElementById("avail-resolution").textContent =
		screen.availWidth + " x " + screen.availHeight;
	document.getElementById("color-depth").textContent =
		screen.colorDepth + "-bit";
	document.getElementById("pixel-ratio").textContent =
		window.devicePixelRatio + "x";
	document.getElementById("pixel-ratio-main").textContent =
		window.devicePixelRatio + "x";
	document.getElementById("orientation").textContent =
		screen.orientation ? screen.orientation.type : "N/A";
	document.getElementById("touch-support").textContent =
		"ontouchstart" in window ? "Yes" : "No";

	updateStorage();
	updateNetwork();

	document.getElementById("user-agent").textContent =
		navigator.userAgent.substring(0, 80) + "...";
	document.getElementById("vendor").textContent = navigator.vendor || "N/A";
	document.getElementById("language").textContent = navigator.language;
	document.getElementById("languages").textContent =
		navigator.languages.join(", ");
	document.getElementById("webdriver").textContent =
		navigator.webdriver ? "Yes (Automation)" : "No";
	document.getElementById("pdf-viewer").textContent =
		navigator.pdfViewerEnabled ? "Yes" : "No";
	document.getElementById("clipboard").textContent =
		"clipboard" in navigator ? "Available" : "N/A";
	document.getElementById("notifications").textContent =
		"Notification" in window ? "Available" : "N/A";
	document.getElementById("geolocation").textContent =
		"geolocation" in navigator ? "Available" : "N/A";
	document.getElementById("cookies-enabled").textContent =
		navigator.cookieEnabled ? "Yes" : "No";
	document.getElementById("dnt").textContent =
		navigator.doNotTrack === "1" ? "Enabled" : "Disabled";
	document.getElementById("protocol").textContent = window.location.protocol;
	document.getElementById("timezone").textContent =
		Intl.DateTimeFormat().resolvedOptions().timeZone;

	const navEntries = performance.getEntriesByType("navigation");
	if (navEntries.length > 0) {
		const nav = navEntries[0];
		document.getElementById("load-time").textContent =
			Math.round(nav.duration) + " ms";
		document.getElementById("nav-type").textContent = nav.type || "navigate";
		document.getElementById("redirects").textContent = nav.redirectCount;
	} else {
		// Graceful fallback for older browsers
		document.getElementById("load-time").textContent = "N/A";
		document.getElementById("nav-type").textContent = "N/A";
		document.getElementById("redirects").textContent = "N/A";
	}

	updateBatteryUI();
}

function updateBatteryUI() {
	if (!battery) {
		["battery-level-main", "battery-level-detail"].forEach(
			(id) => (document.getElementById(id).textContent = "N/A")
		);
		["charging-status-main", "charging-status-detail"].forEach(
			(id) => (document.getElementById(id).textContent = "Not supported")
		);
		return;
	}

	const level = Math.round(battery.level * 100);
	const charging = battery.charging;
	const barClass =
		level > 50 ? "good"
		: level > 20 ? "warning"
		: "danger";

	["battery-level-main", "battery-level-detail"].forEach(
		(id) => (document.getElementById(id).textContent = level + "%")
	);
	["battery-bar-main", "battery-bar-detail"].forEach((id) => {
		const bar = document.getElementById(id);
		bar.style.width = level + "%";
		bar.textContent = level + "%";
		bar.className = "progress-fill " + barClass;
	});

	const statusText = charging ? "⚡ Charging" : "🔋 Discharging";
	["charging-status-main", "charging-status-detail"].forEach(
		(id) => (document.getElementById(id).textContent = statusText)
	);

	const timeToFull =
		charging && isFinite(battery.chargingTime) ?
			formatTime(battery.chargingTime)
		:	"N/A";
	const timeRemaining =
		!charging && isFinite(battery.dischargingTime) ?
			formatTime(battery.dischargingTime)
		:	"N/A";

	document.getElementById("time-to-full").textContent = timeToFull;
	document.getElementById("time-remaining-main").textContent = timeRemaining;
	document.getElementById("time-remaining-detail").textContent = timeRemaining;
}

async function updateStorage() {
	if (!("storage" in navigator && "estimate" in navigator.storage)) {
		document.getElementById("storage-used").textContent = "Not supported";
		return;
	}
	try {
		const est = await navigator.storage.estimate();
		const used = formatBytes(est.usage || 0);
		const quota = formatBytes(est.quota || 0);
		const percent = est.quota ? Math.round((est.usage / est.quota) * 100) : 0;

		document.getElementById("storage-used").textContent = used;
		document.getElementById("storage-quota").textContent = quota;
		document.getElementById("storage-bar").style.width = percent + "%";
		document.getElementById("storage-bar").textContent = percent + "%";
		document.getElementById("cookies").textContent =
			navigator.cookieEnabled ? "Yes" : "No";
	} catch {
		document.getElementById("storage-used").textContent = "Error";
	}
}

function updateNetwork() {
	document.getElementById("net-status").innerHTML =
		navigator.onLine ?
			'<span class="status-badge status-online">🟢 Online</span>'
		:	'<span class="status-badge status-offline">🔴 Offline</span>';

	const conn =
		navigator.connection ||
		navigator.mozConnection ||
		navigator.webkitConnection;
	if (conn) {
		document.getElementById("conn-type").textContent = conn.type || "Unknown";
		document.getElementById("effective-type").textContent =
			conn.effectiveType || "Unknown";
		document.getElementById("downlink").textContent =
			conn.downlink ? conn.downlink + " Mbps" : "Unknown";
		document.getElementById("rtt").textContent =
			conn.rtt ? conn.rtt + " ms" : "Unknown";
		document.getElementById("save-data").textContent =
			conn.saveData ? "Yes" : "No";
	} else {
		["conn-type", "effective-type", "downlink", "rtt", "save-data"].forEach(
			(id) => (document.getElementById(id).textContent = "N/A")
		);
	}
}

async function fetchIPInfo() {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5000);
	try {
		const res = await fetch("/.netlify/functions/ip-lookup", {
			signal: controller.signal,
		});
		clearTimeout(timer);
		const data = await res.json();
		document.getElementById("public-ip").textContent = data.ip || "N/A";
		document.getElementById("city").textContent = data.city || "N/A";
		document.getElementById("country").textContent = data.country_name || "N/A";
		document.getElementById("isp").textContent = data.org || "N/A";
	} catch (e) {
		clearTimeout(timer);
		const msg = e.name === "AbortError" ? "Timeout" : "Failed";
		["public-ip", "city", "country", "isp"].forEach(
			(id) => (document.getElementById(id).textContent = msg)
		);
	}
}

// Helpers
function detectBrowser() {
	const ua = navigator.userAgent;
	if (ua.includes("Edg"))
		return {
			browser: "Edge",
			version: ua.match(/Edg\/([0-9.]+)/)?.[1] || "",
		};
	if (ua.includes("Firefox"))
		return {
			browser: "Firefox",
			version: ua.match(/Firefox\/([0-9.]+)/)?.[1] || "",
		};
	if (ua.includes("Chrome"))
		return {
			browser: "Chrome",
			version: ua.match(/Chrome\/([0-9.]+)/)?.[1] || "",
		};
	if (ua.includes("Safari"))
		return {
			browser: "Safari",
			version: ua.match(/Version\/([0-9.]+)/)?.[1] || "",
		};
	return { browser: "Unknown", version: "" };
}

function detectOS() {
	const ua = navigator.userAgent;
	if (ua.includes("Windows NT 10.0")) return "Windows 10/11";
	if (ua.includes("Windows NT 6.3")) return "Windows 8.1";
	if (ua.includes("Mac OS X")) return "macOS";
	if (ua.includes("Android")) return "Android";
	if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
	if (ua.includes("Linux")) return "Linux";
	return navigator.platform;
}

function formatBytes(bytes) {
	if (!bytes || bytes === 0) return "0 B";
	const k = 1024,
		sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTime(seconds) {
	if (!isFinite(seconds) || seconds < 0) return "N/A";
	if (seconds < 60) return Math.round(seconds) + "s";
	if (seconds < 3600) return Math.round(seconds / 60) + "m";
	return (
		Math.floor(seconds / 3600) + "h " + Math.round((seconds % 3600) / 60) + "m"
	);
}

// Battery session tracking
function startNewSession() {
	if (!battery) return;
	currentSession = {
		startTime: new Date(),
		startLevel: battery.level,
		charging: battery.charging,
		id: Date.now(),
	};

	clearInterval(sessionRateInterval);
	sessionRateInterval = setInterval(updateSessionRate, 30000);
}

function updateSessionRate() {
	if (!currentSession || !battery) return;
	const elapsed = (Date.now() - currentSession.startTime) / 1000;
	if (elapsed < 1) return;
	const levelChange = battery.level - currentSession.startLevel;
	const rate = (levelChange / elapsed) * 3600 * 100; // %/hr

	if (battery.charging) {
		document.getElementById("charge-rate").textContent =
			"+" + rate.toFixed(1) + "%/hr";
		document.getElementById("discharge-rate").textContent = "--";
	} else {
		document.getElementById("charge-rate").textContent = "--";
		document.getElementById("discharge-rate").textContent =
			rate.toFixed(1) + "%/hr";
	}
}

function endSession() {
	clearInterval(sessionRateInterval);
	if (!currentSession || !battery) return;

	const now = new Date();
	const duration = Math.round((now - currentSession.startTime) / 1000);
	const levelChange = battery.level - currentSession.startLevel;
	const rate =
		duration > 0 ? ((levelChange / duration) * 3600 * 100).toFixed(2) : 0;

	const session = {
		id: currentSession.id,
		timestamp: currentSession.startTime.toISOString(),
		endTime: now.toISOString(),
		startLevel: Math.round(currentSession.startLevel * 100),
		endLevel: Math.round(battery.level * 100),
		charging: currentSession.charging,
		duration,
		rate,
	};

	batteryData.sessions.unshift(session);
	if (batteryData.sessions.length > 20)
		batteryData.sessions = batteryData.sessions.slice(0, 20);

	if (currentSession.charging && levelChange > 0) {
		batteryData.totalChargingTime += duration;
		batteryData.chargeCycles += levelChange;
	} else if (!currentSession.charging) {
		batteryData.totalDischargingTime += duration;
	}

	saveBatteryData();
	renderHistory();
	estimateHealth();
}

function estimateHealth() {
	const sessions = batteryData.sessions;
	let health = 100,
		wear = 0;

	const dischargeRates = sessions
		.filter((s) => !s.charging && parseFloat(s.rate) < 0)
		.map((s) => Math.abs(parseFloat(s.rate)));

	if (dischargeRates.length > 0) {
		const avg =
			dischargeRates.reduce((a, b) => a + b, 0) / dischargeRates.length;
		if (avg > 25) {
			health -= 15;
			wear += 15;
		} else if (avg > 20) {
			health -= 8;
			wear += 8;
		}
	}

	health = Math.max(50, Math.min(100, health));
	wear = Math.min(50, Math.max(0, wear));

	document.getElementById("health-percentage").textContent = health + "%";
	const hBar = document.getElementById("health-bar");
	hBar.style.width = health + "%";
	hBar.textContent = health + "%";
	hBar.className =
		"progress-fill " +
		(health > 80 ? "good"
		: health > 60 ? "warning"
		: "danger");

	document.getElementById("cycle-count").textContent = Math.floor(
		batteryData.chargeCycles
	);
	document.getElementById("wear-level").textContent = wear + "%";

	const statusEl = document.getElementById("health-status-text");
	if (health > 85) {
		statusEl.textContent = "Excellent";
		statusEl.style.color = "var(--secondary)";
	} else if (health > 70) {
		statusEl.textContent = "Good";
		statusEl.style.color = "var(--primary)";
	} else if (health > 50) {
		statusEl.textContent = "Fair";
		statusEl.style.color = "var(--warning)";
	} else {
		statusEl.textContent = "Poor";
		statusEl.style.color = "var(--danger)";
	}

	const chargeSessions = sessions.filter((s) => s.charging).length;
	const dischargeSessions = sessions.filter((s) => !s.charging).length;
	if (chargeSessions > 0)
		document.getElementById("avg-charge-time").textContent =
			Math.round(batteryData.totalChargingTime / chargeSessions / 60) + " min";
	if (dischargeSessions > 0)
		document.getElementById("avg-usage-time").textContent =
			Math.round(batteryData.totalDischargingTime / dischargeSessions / 60) +
			" min";
	document.getElementById("total-sessions").textContent = sessions.length;
}

function renderHistory() {
	const tbody = document.getElementById("history-body");
	if (batteryData.sessions.length === 0) {
		tbody.innerHTML =
			'<tr><td colspan="5" style="text-align:center;color:#888">No sessions recorded yet</td></tr>';
		return;
	}

	tbody.innerHTML = batteryData.sessions
		.map((s) => {
			const d = new Date(s.timestamp);
			const dateStr =
				d.toLocaleDateString("en-GB") +
				" " +
				d.toLocaleTimeString("en-GB", {
					hour: "2-digit",
					minute: "2-digit",
				});
			const rateStr =
				(parseFloat(s.rate) > 0 && s.charging ? "+" : "") + s.rate + "%/hr";
			return `<tr>
						<td>${dateStr}</td>
						<td>${s.startLevel}% → ${s.endLevel}%</td>
						<td>${s.charging ? "⚡ Charge" : "🔋 Discharge"}</td>
						<td>${formatTime(s.duration)}</td>
						<td>${rateStr}</td>
					</tr>`;
		})
		.join("");
}

function saveBatteryData() {
	store.set("batterySessions", JSON.stringify(batteryData.sessions));
	store.set("totalChargingTime", batteryData.totalChargingTime);
	store.set("totalDischargingTime", batteryData.totalDischargingTime);
	store.set("chargeCycles", batteryData.chargeCycles);
}

function refreshAll() {
	location.reload();
}

function exportData() {
	const data = {
		exportDate: new Date().toISOString(),
		device: {
			browser: detectBrowser(),
			os: detectOS(),
			platform: navigator.platform,
		},
		battery: batteryData,
	};
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `device-report-${new Date().toISOString().split("T")[0]}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

function clearAllData() {
	if (confirm("Clear all saved data?")) {
		store.clear();
		location.reload();
	}
}

window.addEventListener("online", updateAllInfo);
window.addEventListener("offline", updateAllInfo);

// BATTERY HEALTH CALCULATOR
let hcActiveMethod = "method-capacity";

function hcSwitchMethod(btn, methodId) {
	document
		.querySelectorAll(".hc-tab")
		.forEach((t) => t.classList.remove("active"));
	document
		.querySelectorAll(".hc-method")
		.forEach((m) => m.classList.remove("active"));
	btn.classList.add("active");
	document.getElementById(methodId).classList.add("active");
	hcActiveMethod = methodId;
	hcClearResult();
}

function hcRecalcActive() {
	if (hcActiveMethod === "method-capacity") hcCalcCapacity();
	else if (hcActiveMethod === "method-cycle") hcCalcCycle();
	else if (hcActiveMethod === "method-voltage") hcCalcVoltage();
	else if (hcActiveMethod === "method-time") hcCalcTime();
}

// ---- Method 1: Capacity ----
function hcCalcCapacity() {
	const design = parseFloat(document.getElementById("hc-design-cap").value);
	const current = parseFloat(document.getElementById("hc-current-cap").value);
	if (!design || !current || design <= 0 || current <= 0) {
		hcClearResult();
		return;
	}
	if (current > design * 1.15) {
		hcShowError(
			"Current capacity cannot exceed design capacity by more than 15%."
		);
		return;
	}
	const raw = (current / design) * 100;
	hcShowResult(raw, "Capacity Formula");
}

// ---- Method 2: Cycle count ----
function hcCalcCycle() {
	const cycles = parseFloat(document.getElementById("hc-cycles").value);
	const maxCycles = parseFloat(document.getElementById("hc-max-cycles").value);
	const degrad = parseFloat(document.getElementById("hc-degrad").value);
	if (isNaN(cycles) || isNaN(maxCycles) || isNaN(degrad) || maxCycles <= 0) {
		hcClearResult();
		return;
	}
	const raw = Math.max(0, 100 - (cycles / maxCycles) * degrad);
	hcShowResult(raw, "Cycle Count Formula");
}

function hcAutoFillCycles() {
	const val = document.getElementById("hc-batt-type").value;
	if (!val) return;
	const [max, deg] = val.split(":");
	document.getElementById("hc-max-cycles").value = max;
	document.getElementById("hc-degrad").value = deg;
	hcCalcCycle();
}

// ---- Method 3: Voltage ----
function hcCalcVoltage() {
	const vCur = parseFloat(document.getElementById("hc-v-current").value);
	const vMax = parseFloat(document.getElementById("hc-v-max").value);
	const vMin = parseFloat(document.getElementById("hc-v-min").value);
	if (isNaN(vCur) || isNaN(vMax) || isNaN(vMin)) {
		hcClearResult();
		return;
	}
	if (vMax <= vMin) {
		hcShowError("Max voltage must be greater than min voltage.");
		return;
	}
	if (vCur < vMin || vCur > vMax) {
		hcShowError("Current voltage must be between min and max.");
		return;
	}
	const raw = ((vCur - vMin) / (vMax - vMin)) * 100;
	hcShowResult(raw, "Voltage Formula");
}

function hcAutoFillVoltage() {
	const val = document.getElementById("hc-volt-preset").value;
	if (!val) return;
	const [vmax, vmin] = val.split(":");
	document.getElementById("hc-v-max").value = vmax;
	document.getElementById("hc-v-min").value = vmin;
	hcCalcVoltage();
}

// ---- Method 4: Discharge time ----
function hcCalcTime() {
	const rated = parseFloat(document.getElementById("hc-rated-time").value);
	const actual = parseFloat(document.getElementById("hc-actual-time").value);
	const factor =
		parseFloat(document.getElementById("hc-temp-factor").value) || 1.0;
	if (!rated || !actual || rated <= 0 || actual <= 0) {
		hcClearResult();
		return;
	}
	const raw = ((actual * factor) / rated) * 100;
	hcShowResult(raw, "Discharge Time Formula");
}

// ---- Core result renderer ----
function hcShowResult(rawScore, methodName) {
	rawScore = Math.min(100, Math.max(0, rawScore));

	// Extra penalties
	const ageMo = parseFloat(document.getElementById("hc-age").value) || 0;
	const tempC = parseFloat(document.getElementById("hc-temp").value) || 25;

	let agePenalty = ageMo > 24 ? (ageMo - 24) * 0.3 : 0;
	let tempPenalty = tempC > 30 ? (tempC - 30) * 0.2 : 0;
	agePenalty = Math.min(agePenalty, 20);
	tempPenalty = Math.min(tempPenalty, 10);

	const final = Math.max(0, Math.min(100, rawScore - agePenalty - tempPenalty));

	// Grade
	let grade, gradeColor, adviceClass, adviceText;
	if (final >= 90) {
		grade = "🟢 Excellent";
		gradeColor = "var(--secondary)";
		adviceClass = "good";
		adviceText =
			"<strong>Your battery is in excellent condition.</strong> Capacity is near original. Keep using normally, avoid prolonged 100% charge and avoid draining below 10% frequently.";
	} else if (final >= 75) {
		grade = "🔵 Good";
		gradeColor = "var(--primary)";
		adviceClass = "good";
		adviceText =
			"<strong>Battery health is good with minor wear.</strong> Performance is still reliable. Try to keep charge between 20–80% for daily use to slow future degradation.";
	} else if (final >= 50) {
		grade = "🟡 Fair";
		gradeColor = "var(--warning)";
		adviceClass = "warning";
		adviceText =
			"<strong>Battery shows noticeable degradation.</strong> You may notice shorter runtimes. Avoid heat exposure, keep the battery cool, and consider a replacement within the next 6–12 months.";
	} else {
		grade = "🔴 Poor";
		gradeColor = "var(--danger)";
		adviceClass = "danger";
		adviceText =
			"<strong>Battery health is poor.</strong> Significant capacity loss detected. Unexpected shutdowns may occur. <u>Replacement is strongly recommended</u> to avoid damage to device or data loss.";
	}

	// Meter color
	const meterColor =
		final >= 75 ? "linear-gradient(90deg,#00ff88,#00cc6a)"
		: final >= 50 ? "linear-gradient(90deg,#ffc107,#ff9800)"
		: "linear-gradient(90deg,#ff4757,#ff6348)";

	document.getElementById("hc-result-pct").textContent =
		Math.round(final) + "%";
	document.getElementById("hc-result-grade").textContent = grade;
	document.getElementById("hc-result-grade").style.color = gradeColor;
	document.getElementById("hc-meter-fill").style.width = final + "%";
	document.getElementById("hc-meter-fill").style.background = meterColor;

	// Breakdown
	document.getElementById("hcb-raw").textContent = Math.round(rawScore) + "%";
	document.getElementById("hcb-age").textContent =
		agePenalty > 0 ? "−" + agePenalty.toFixed(1) + "pt" : "0pt";
	document.getElementById("hcb-temp").textContent =
		tempPenalty > 0 ? "−" + tempPenalty.toFixed(1) + "pt" : "0pt";
	document.getElementById("hcb-final").textContent = Math.round(final) + "%";
	document.getElementById("hc-breakdown").style.display = "grid";

	// Advice
	const adv = document.getElementById("hc-advice");
	adv.className = "hc-advice " + adviceClass;
	adv.innerHTML = adviceText;
	adv.style.display = "block";
}

function hcShowError(msg) {
	hcClearResult();
	const adv = document.getElementById("hc-advice");
	adv.className = "hc-advice danger";
	adv.innerHTML = "⚠️ " + msg;
	adv.style.display = "block";
}

function hcClearResult() {
	document.getElementById("hc-result-pct").textContent = "--%";
	document.getElementById("hc-result-grade").textContent =
		"Enter values to calculate";
	document.getElementById("hc-result-grade").style.color = "#555";
	document.getElementById("hc-meter-fill").style.width = "0%";
	document.getElementById("hc-breakdown").style.display = "none";
	document.getElementById("hc-advice").style.display = "none";
}

function hcReset() {
	[
		"hc-design-cap",
		"hc-current-cap",
		"hc-cycles",
		"hc-max-cycles",
		"hc-degrad",
		"hc-v-current",
		"hc-v-max",
		"hc-v-min",
		"hc-rated-time",
		"hc-actual-time",
		"hc-age",
		"hc-temp",
	].forEach((id) => {
		const el = document.getElementById(id);
		if (el) el.value = "";
	});
	document.getElementById("hc-batt-type").value = "";
	document.getElementById("hc-volt-preset").value = "";
	document.getElementById("hc-temp-factor").value = "1.00";
	document.getElementById("hc-degrad").value = "20";
	hcClearResult();
}

// Auto-fill Method 1 from live Battery API data if available
function hcAutoFillFromLive() {
	if (!battery) {
		alert("Live battery data not available on this device/browser.");
		return;
	}
	// Switch to capacity method
	const btn = document.querySelector(".hc-tab");
	hcSwitchMethod(btn, "method-capacity");

	// We can read battery.level; we cannot read mAh directly.
	// Use discharge time as a proxy for time method instead.
	if (isFinite(battery.dischargingTime) && battery.dischargingTime > 0) {
		// Switch to time method
		const timBtn = document.querySelectorAll(".hc-tab")[3];
		hcSwitchMethod(timBtn, "method-time");

		const currentMins = Math.round(battery.dischargingTime / 60);
		document.getElementById("hc-actual-time").value = currentMins;

		// Prompt for rated time
		const rated = prompt(
			"Enter your device's original rated battery life in minutes (e.g. 480 for 8 hours):"
		);
		if (rated && !isNaN(rated)) {
			document.getElementById("hc-rated-time").value = rated;
			hcCalcTime();
		}
	} else {
		alert(
			"Discharging time is not available right now (device may be charging or browser restricts this). Try the Capacity or Cycle method manually."
		);
	}
}

// ============================================================
// BENCHMARK ENGINE
// ============================================================
let bmRunning = false;

const bmTests = [
	{
		name: "Integer Arithmetic",
		key: "cpu",
		run: () => {
			let s = 0;
			for (let i = 0; i < 5000000; i++) s += (i * 3) % 7;
			return s;
		},
	},
	{
		name: "Float Operations",
		key: "float",
		run: () => {
			let s = 0;
			for (let i = 1; i < 1000000; i++) s += Math.sqrt(i) * Math.log(i);
			return s;
		},
	},
	{
		name: "String Processing",
		key: "str",
		run: () => {
			let s = "";
			for (let i = 0; i < 20000; i++) s += i % 10;
			return s.length;
		},
	},
	{
		name: "Array Sort",
		key: "mem",
		run: () => {
			const a = [...Array(50000)].map((_, i) => 50000 - i);
			a.sort((x, y) => x - y);
			return a[0];
		},
	},
	{
		name: "DOM Manipulation",
		key: "dom",
		run: () => {
			const d = document.createElement("div");
			for (let i = 0; i < 2000; i++) {
				const s = document.createElement("span");
				s.textContent = i;
				d.appendChild(s);
			}
			return d.childElementCount;
		},
	},
	{
		name: "Crypto SHA-256",
		key: "crypto",
		run: async () => {
			if (!crypto.subtle) return -1;
			const data = new TextEncoder().encode("benchmark".repeat(1000));
			await crypto.subtle.digest("SHA-256", data);
			return 1;
		},
	},
	{
		name: "JSON Parse/Stringify",
		key: "json",
		run: () => {
			const o = {
				a: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					val: Math.random(),
				})),
			};
			for (let i = 0; i < 500; i++) JSON.parse(JSON.stringify(o));
			return 1;
		},
	},
	{
		name: "Canvas 2D Draw",
		key: "canvas",
		run: () => {
			const c = document.createElement("canvas");
			c.width = 400;
			c.height = 400;
			const x = c.getContext("2d");
			for (let i = 0; i < 2000; i++) {
				x.fillStyle = `hsl(${i % 360},70%,50%)`;
				x.fillRect(Math.random() * 380, Math.random() * 380, 20, 20);
			}
			return 1;
		},
	},
];

async function bmStart() {
	if (bmRunning) return;
	bmRunning = true;
	document.getElementById("bm-start-btn").disabled = true;
	document.getElementById("bm-detail").style.display = "none";
	document.getElementById("bm-tbody").innerHTML = "";
	["bm-total", "bm-cpu", "bm-float", "bm-mem", "bm-dom", "bm-crypto"].forEach(
		(id) => (document.getElementById(id).textContent = "--")
	);

	const results = [];
	for (let i = 0; i < bmTests.length; i++) {
		const t = bmTests[i];
		const pct = Math.round((i / bmTests.length) * 100);
		document.getElementById("bm-progress").style.width = pct + "%";
		document.getElementById("bm-progress").textContent = pct + "%";
		document.getElementById("bm-status").textContent = `Running: ${t.name}...`;
		await new Promise((r) => setTimeout(r, 30));

		const start = performance.now();
		try {
			await t.run();
		} catch (e) {}
		const elapsed = performance.now() - start;
		const score = Math.max(1, Math.round(10000 / (elapsed + 1)));
		results.push({
			name: t.name,
			key: t.key,
			elapsed: elapsed.toFixed(1),
			score,
		});
	}

	document.getElementById("bm-progress").style.width = "100%";
	document.getElementById("bm-progress").textContent = "100%";

	const total = results.reduce((s, r) => s + r.score, 0);
	document.getElementById("bm-total").textContent = total;
	document.getElementById("bm-cpu").textContent =
		results.find((r) => r.key === "cpu")?.score || "--";
	document.getElementById("bm-float").textContent =
		results.find((r) => r.key === "float")?.score || "--";
	document.getElementById("bm-mem").textContent =
		results.find((r) => r.key === "mem")?.score || "--";
	document.getElementById("bm-dom").textContent =
		results.find((r) => r.key === "dom")?.score || "--";
	document.getElementById("bm-crypto").textContent =
		results.find((r) => r.key === "crypto")?.score || "--";

	const tbody = document.getElementById("bm-tbody");
	tbody.innerHTML = results
		.map((r) => {
			const badge =
				r.score > 2000 ? '<span class="badge-health badge-ex">Excellent</span>'
				: r.score > 800 ? '<span class="badge-health badge-gd">Good</span>'
				: r.score > 200 ? '<span class="badge-health badge-fr">Fair</span>'
				: '<span class="badge-health badge-pr">Slow</span>';
			return `<tr><td>${r.name}</td><td>${r.elapsed} ms</td><td>${r.score}</td><td>${badge}</td></tr>`;
		})
		.join("");

	const verdict =
		total > 15000 ?
			"🚀 <strong>High-end device.</strong> Excellent JS engine performance across all tests."
		: total > 8000 ?
			"✅ <strong>Mid-range performance.</strong> Solid for everyday tasks and web apps."
		: total > 3000 ?
			"⚠️ <strong>Budget/older device.</strong> Complex web apps may feel sluggish."
		:	"🐢 <strong>Very slow engine.</strong> Consider closing background tabs or upgrading device.";
	document.getElementById("bm-verdict").innerHTML = verdict;
	document.getElementById("bm-detail").style.display = "block";
	document.getElementById("bm-status").textContent =
		"✅ Benchmark complete! Total score: " + total;
	bmRunning = false;
	document.getElementById("bm-start-btn").disabled = false;
}

function bmReset() {
	bmRunning = false;
	document.getElementById("bm-start-btn").disabled = false;
	document.getElementById("bm-progress").style.width = "0%";
	document.getElementById("bm-progress").textContent = "0%";
	document.getElementById("bm-status").textContent =
		"Press Start to begin benchmark";
	document.getElementById("bm-detail").style.display = "none";
	["bm-total", "bm-cpu", "bm-float", "bm-mem", "bm-dom", "bm-crypto"].forEach(
		(id) => (document.getElementById(id).textContent = "--")
	);
}

// ============================================================
// LIVE CHART ENGINE
// ============================================================
let lcMode = "battery";
let lcRunning = false;
let lcTimer = null;
let lcData = [];
let lcLabels = [];
let lcFpsData = { last: 0, frames: 0, raf: null };
const LC_MAX = 60;

function lcSetMode(btn, mode) {
	document
		.querySelectorAll("#livechart .hc-tab")
		.forEach((t) => t.classList.remove("active"));
	btn.classList.add("active");
	lcMode = mode;
	lcClear();
	const lblMap = {
		battery: "Battery %",
		fps: "FPS",
		mem: "JS Heap (MB)",
	};
	document.getElementById("lc-current-lbl").textContent =
		lblMap[mode] || "Current";
}

function lcToggle() {
	lcRunning ? lcStop() : lcStartRec();
}

function lcStartRec() {
	lcRunning = true;
	document.getElementById("lc-toggle-btn").textContent = "■ Stop";
	const interval = parseInt(document.getElementById("lc-interval").value);
	lcCollect();
	lcTimer = setInterval(lcCollect, interval);
	if (lcMode === "fps") lcStartFps();
}

function lcStop() {
	lcRunning = false;
	clearInterval(lcTimer);
	if (lcFpsData.raf) cancelAnimationFrame(lcFpsData.raf);
	document.getElementById("lc-toggle-btn").textContent = "▶ Start";
}

function lcStartFps() {
	lcFpsData.last = performance.now();
	lcFpsData.frames = 0;
	function tick(now) {
		lcFpsData.frames++;
		if (now - lcFpsData.last >= 1000) {
			lcFpsData.currentFps = lcFpsData.frames;
			lcFpsData.frames = 0;
			lcFpsData.last = now;
		}
		if (lcRunning) lcFpsData.raf = requestAnimationFrame(tick);
	}
	lcFpsData.raf = requestAnimationFrame(tick);
}

async function lcCollect() {
	let value = null;
	if (lcMode === "battery") {
		if (battery) value = Math.round(battery.level * 100);
	} else if (lcMode === "fps") {
		value = lcFpsData.currentFps || 0;
	} else if (lcMode === "mem") {
		if (performance.memory)
			value = +(performance.memory.usedJSHeapSize / 1048576).toFixed(1);
	}
	if (value === null) {
		document.getElementById("lc-current").textContent = "N/A";
		return;
	}

	const now = new Date();
	lcData.push(value);
	lcLabels.push(
		now.toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
	);
	if (lcData.length > LC_MAX) {
		lcData.shift();
		lcLabels.shift();
	}

	const min = Math.min(...lcData),
		max = Math.max(...lcData);
	const avg = (lcData.reduce((a, b) => a + b, 0) / lcData.length).toFixed(1);
	const unit =
		lcMode === "battery" ? "%"
		: lcMode === "fps" ? " fps"
		: " MB";
	document.getElementById("lc-current").textContent = value + unit;
	document.getElementById("lc-min").textContent = min + unit;
	document.getElementById("lc-max").textContent = max + unit;
	document.getElementById("lc-avg").textContent = avg + unit;
	document.getElementById("lc-points").textContent = lcData.length;
	lcDraw();
}

function lcDraw() {
	const canvas = document.getElementById("lc-canvas");
	const ctx = canvas.getContext("2d");
	const W = canvas.offsetWidth || 600,
		H = 260;
	canvas.width = W;
	ctx.clearRect(0, 0, W, H);

	const pad = { t: 20, r: 20, b: 30, l: 50 };
	const gW = W - pad.l - pad.r;
	const gH = H - pad.t - pad.b;

	if (lcData.length < 2) return;
	const minV = Math.min(...lcData) - 2;
	const maxV = Math.max(...lcData) + 2;
	const range = maxV - minV || 1;

	// Grid
	ctx.strokeStyle = "rgba(255,255,255,0.05)";
	ctx.lineWidth = 1;
	for (let i = 0; i <= 4; i++) {
		const y = pad.t + (gH / 4) * i;
		ctx.beginPath();
		ctx.moveTo(pad.l, y);
		ctx.lineTo(pad.l + gW, y);
		ctx.stroke();
		const label = (maxV - (range / 4) * i).toFixed(1);
		ctx.fillStyle = "#555";
		ctx.font = "11px Courier New";
		ctx.textAlign = "right";
		ctx.fillText(label, pad.l - 5, y + 4);
	}

	// Gradient fill
	const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + gH);
	grad.addColorStop(0, "rgba(0,212,255,0.4)");
	grad.addColorStop(1, "rgba(0,212,255,0.01)");

	const xStep = gW / (lcData.length - 1);
	ctx.beginPath();
	lcData.forEach((v, i) => {
		const x = pad.l + i * xStep;
		const y = pad.t + gH - ((v - minV) / range) * gH;
		i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
	});
	ctx.strokeStyle = "#00d4ff";
	ctx.lineWidth = 2.5;
	ctx.stroke();

	// Fill area
	ctx.lineTo(pad.l + (lcData.length - 1) * xStep, pad.t + gH);
	ctx.lineTo(pad.l, pad.t + gH);
	ctx.closePath();
	ctx.fillStyle = grad;
	ctx.fill();

	// Dots & labels
	ctx.fillStyle = "#00d4ff";
	const step = Math.max(1, Math.floor(lcData.length / 8));
	lcData.forEach((v, i) => {
		const x = pad.l + i * xStep;
		const y = pad.t + gH - ((v - minV) / range) * gH;
		ctx.beginPath();
		ctx.arc(x, y, 3, 0, Math.PI * 2);
		ctx.fill();
		if (i % step === 0 || i === lcData.length - 1) {
			ctx.fillStyle = "#444";
			ctx.font = "10px Courier New";
			ctx.textAlign = "center";
			ctx.fillText(lcLabels[i], x, H - 5);
			ctx.fillStyle = "#00d4ff";
		}
	});
}

function lcClear() {
	lcData = [];
	lcLabels = [];
	const canvas = document.getElementById("lc-canvas");
	const ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	["lc-current", "lc-min", "lc-max", "lc-avg"].forEach(
		(id) => (document.getElementById(id).textContent = "--")
	);
	document.getElementById("lc-points").textContent = "0";
}

function lcChangeInterval() {
	if (lcRunning) {
		lcStop();
		lcStartRec();
	}
}

// ============================================================
// FINGERPRINT ENGINE
// ============================================================
async function fpGenerate() {
	const components = [];

	// Canvas fingerprint
	const c = document.getElementById("fp-canvas");
	const ctx = c.getContext("2d");
	ctx.fillStyle = "#0a0a0a";
	ctx.fillRect(0, 0, 300, 60);
	ctx.font = 'bold 16px "Courier New"';
	const grad = ctx.createLinearGradient(0, 0, 300, 0);
	grad.addColorStop(0, "#00d4ff");
	grad.addColorStop(1, "#00ff88");
	ctx.fillStyle = grad;
	ctx.fillText("Device Fingerprint 🔐", 10, 28);
	ctx.fillStyle = "rgba(255,255,255,0.3)";
	ctx.font = "11px sans-serif";
	ctx.fillText(navigator.userAgent.substring(0, 50), 10, 50);
	const canvasHash = c.toDataURL().slice(-32);
	components.push({ label: "🖼 Canvas Hash", value: canvasHash });

	// All components
	const raw = {
		ua: navigator.userAgent,
		lang: navigator.language,
		langs: navigator.languages?.join(",") || "",
		platform: navigator.platform,
		cores: navigator.hardwareConcurrency || 0,
		mem: navigator.deviceMemory || 0,
		touch: navigator.maxTouchPoints || 0,
		tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
		sw: screen.width,
		sh: screen.height,
		cd: screen.colorDepth,
		dpr: window.devicePixelRatio,
		vendor: navigator.vendor,
		plugins: navigator.plugins?.length || 0,
		canvas: canvasHash,
		webgl: fpGetWebGL(),
		fonts: await fpDetectFonts(),
	};

	const entries = [
		["🌐 User Agent", raw.ua.substring(0, 55) + "…"],
		["🗣 Language", raw.lang],
		["💻 Platform", raw.platform],
		["🧠 CPU Cores", raw.cores],
		["💾 Device Memory", raw.mem + " GB"],
		["👆 Touch Points", raw.touch],
		["🕐 Timezone", raw.tz],
		["🖥 Screen", raw.sw + "×" + raw.sh + " @" + raw.cd + "bit"],
		["🔍 Pixel Ratio", raw.dpr],
		["🏢 Vendor", raw.vendor || "N/A"],
		["🔌 Plugins", raw.plugins],
		["🎮 WebGL Renderer", raw.webgl],
		["🔤 Fonts Detected", raw.fonts],
	];

	const rows = document.getElementById("fp-rows");
	rows.innerHTML = entries
		.map(
			([l, v]) =>
				`<div class="info-row"><span class="info-label">${l}</span><span class="info-value" style="font-size:0.78rem;">${v}</span></div>`
		)
		.join("");

	// Build hash string
	const hashInput = Object.values(raw).join("|");
	const hash = await fpHash(hashInput);
	document.getElementById("fp-hash").textContent = hash;

	// Privacy score
	fpPrivacyScore(raw);
}

function fpGetWebGL() {
	try {
		const c = document.createElement("canvas");
		const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
		if (!gl) return "Not supported";
		const ext = gl.getExtension("WEBGL_debug_renderer_info");
		return ext ?
				gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).substring(0, 40)
			:	"Hidden";
	} catch {
		return "Error";
	}
}

async function fpDetectFonts() {
	const fonts = [
		"Arial",
		"Courier New",
		"Georgia",
		"Times New Roman",
		"Verdana",
		"Helvetica",
		"Tahoma",
		"Trebuchet MS",
		"Comic Sans MS",
		"Impact",
		"Palatino",
		"Garamond",
		"Bookman",
		"Avant Garde",
	];
	if (!document.fonts) return fonts.length + " (API N/A)";
	const detected = [];
	for (const f of fonts) {
		try {
			if (await document.fonts.check('12px "' + f + '"')) detected.push(f);
		} catch {}
	}
	return detected.length + "/" + fonts.length + " detected";
}

async function fpHash(str) {
	const buf = new TextEncoder().encode(str);
	const hash = await crypto.subtle.digest("SHA-256", buf);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.substring(0, 32);
}

function fpPrivacyScore(raw) {
	const checks = [
		{
			label: "🚫 Do Not Track",
			pass: navigator.doNotTrack === "1",
			good: "Enabled",
			bad: "Disabled",
		},
		{
			label: "🍪 Cookies",
			pass: !navigator.cookieEnabled,
			good: "Disabled (more private)",
			bad: "Enabled",
		},
		{
			label: "🤖 WebDriver",
			pass: !navigator.webdriver,
			good: "Not detected",
			bad: "Automation detected",
		},
		{
			label: "🔌 Plugins",
			pass: (navigator.plugins?.length || 0) < 3,
			good: "Few plugins",
			bad: (navigator.plugins?.length || 0) + " plugins expose info",
		},
		{
			label: "🌍 Timezone match",
			pass: Intl.DateTimeFormat().resolvedOptions().timeZone !== "",
			good: "Set",
			bad: "Missing",
		},
		{
			label: "🧠 Hardware Exposed",
			pass: !navigator.hardwareConcurrency,
			good: "Hidden",
			bad: "Exposed (" + navigator.hardwareConcurrency + " cores)",
		},
		{
			label: "💾 Memory Exposed",
			pass: !navigator.deviceMemory,
			good: "Hidden",
			bad: "Exposed (" + navigator.deviceMemory + " GB)",
		},
		{
			label: "🎮 WebGL Renderer",
			pass: fpGetWebGL() === "Hidden",
			good: "Hidden",
			bad: "Exposed",
		},
	];
	const score = Math.round(
		(checks.filter((c) => c.pass).length / checks.length) * 100
	);
	document.getElementById("fp-score").textContent = score;
	const bar = document.getElementById("fp-score-bar");
	bar.style.width = score + "%";
	bar.textContent = score + "%";
	bar.className =
		"progress-fill " +
		(score >= 70 ? "good"
		: score >= 40 ? "warning"
		: "danger");

	const el = document.getElementById("fp-privacy-checks");
	el.innerHTML = checks
		.map(
			(c) =>
				`<div class="info-row">
						<span class="info-label">${c.label}</span>
						<span class="info-value" style="color:${c.pass ? "var(--secondary)" : "var(--warning)"};">${c.pass ? c.good : c.bad}</span>
					</div>`
		)
		.join("");
}

function fpCopy() {
	const hash = document.getElementById("fp-hash").textContent;
	navigator.clipboard
		?.writeText(hash)
		.then(() => alert("Hash copied!"))
		.catch(() => alert("Copy failed"));
}

// ============================================================
// SENSORS ENGINE
// ============================================================
let sMotionHandler = null,
	sOrientHandler = null;
let geoWatchId = null;
let audioCtx = null,
	audioStream = null,
	audioAnimFrame = null;

function sensorsStart() {
	if (
		typeof DeviceMotionEvent !== "undefined" &&
		DeviceMotionEvent.requestPermission
	) {
		DeviceMotionEvent.requestPermission()
			.then((p) => {
				if (p === "granted") sAttachMotion();
			})
			.catch(() => sAttachMotion());
	} else {
		sAttachMotion();
	}

	if (
		typeof DeviceOrientationEvent !== "undefined" &&
		DeviceOrientationEvent.requestPermission
	) {
		DeviceOrientationEvent.requestPermission()
			.then((p) => {
				if (p === "granted") sAttachOrientation();
			})
			.catch(() => sAttachOrientation());
	} else {
		sAttachOrientation();
	}
}

function sAttachMotion() {
	sMotionHandler = (e) => {
		const a = e.acceleration || e.accelerationIncludingGravity || {};
		document.getElementById("s-ax").textContent = (a.x || 0).toFixed(2);
		document.getElementById("s-ay").textContent = (a.y || 0).toFixed(2);
		document.getElementById("s-az").textContent = (a.z || 0).toFixed(2);
	};
	window.addEventListener("devicemotion", sMotionHandler);
}

function sAttachOrientation() {
	sOrientHandler = (e) => {
		document.getElementById("s-rx").textContent =
			(e.alpha || 0).toFixed(1) + "°";
		document.getElementById("s-ry").textContent =
			(e.beta || 0).toFixed(1) + "°";
		document.getElementById("s-rz").textContent =
			(e.gamma || 0).toFixed(1) + "°";
		s3dDraw(e.alpha || 0, e.beta || 0, e.gamma || 0);
	};
	window.addEventListener("deviceorientation", sOrientHandler);
}

function sensorsStop() {
	if (sMotionHandler)
		window.removeEventListener("devicemotion", sMotionHandler);
	if (sOrientHandler)
		window.removeEventListener("deviceorientation", sOrientHandler);
	["s-ax", "s-ay", "s-az", "s-rx", "s-ry", "s-rz"].forEach(
		(id) => (document.getElementById(id).textContent = "--")
	);
}

function s3dDraw(alpha, beta, gamma) {
	const canvas = document.getElementById("s-3d");
	const ctx = canvas.getContext("2d");
	const W = 260,
		H = 160,
		cx = W / 2,
		cy = H / 2;
	ctx.clearRect(0, 0, W, H);

	const bRad = (beta * Math.PI) / 180;
	const gRad = (gamma * Math.PI) / 180;
	const w = 80,
		h = 120;

	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(gRad * 0.5);

	// Device body
	const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
	bodyGrad.addColorStop(0, "rgba(0,212,255,0.3)");
	bodyGrad.addColorStop(1, "rgba(0,255,136,0.1)");
	ctx.fillStyle = bodyGrad;
	ctx.strokeStyle = "rgba(0,212,255,0.7)";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.roundRect(-w / 2, -h / 2 + Math.sin(bRad) * 20, w, h, 8);
	ctx.fill();
	ctx.stroke();

	// Screen
	ctx.fillStyle = "rgba(0,0,0,0.5)";
	ctx.beginPath();
	ctx.roundRect(
		-w / 2 + 6,
		-h / 2 + 16 + Math.sin(bRad) * 20,
		w - 12,
		h - 28,
		4
	);
	ctx.fill();

	// Tilt indicator
	ctx.fillStyle = "rgba(0,212,255,0.8)";
	ctx.beginPath();
	ctx.arc(Math.sin(gRad) * 30, Math.sin(bRad) * 20, 6, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();

	// Labels
	ctx.fillStyle = "#555";
	ctx.font = "10px Courier New";
	ctx.textAlign = "center";
	ctx.fillText(`β:${beta.toFixed(0)}° γ:${gamma.toFixed(0)}°`, cx, H - 6);
}

function geoGet() {
	if (!navigator.geolocation) {
		alert("Geolocation not supported");
		return;
	}
	navigator.geolocation.getCurrentPosition(geoUpdate, geoErr, {
		enableHighAccuracy: true,
	});
}

function geoWatch() {
	if (!navigator.geolocation) {
		alert("Geolocation not supported");
		return;
	}
	geoWatchId = navigator.geolocation.watchPosition(geoUpdate, geoErr, {
		enableHighAccuracy: true,
	});
}

function geoStop() {
	if (geoWatchId !== null) {
		navigator.geolocation.clearWatch(geoWatchId);
		geoWatchId = null;
	}
}

function geoUpdate(pos) {
	const c = pos.coords;
	document.getElementById("geo-lat").textContent = c.latitude.toFixed(6);
	document.getElementById("geo-lon").textContent = c.longitude.toFixed(6);
	document.getElementById("geo-acc").textContent =
		c.accuracy?.toFixed(1) || "N/A";
	document.getElementById("geo-alt").textContent =
		c.altitude?.toFixed(1) || "N/A";
	document.getElementById("geo-heading").textContent =
		c.heading?.toFixed(1) || "N/A";
	document.getElementById("geo-speed").textContent =
		c.speed?.toFixed(2) || "N/A";
}

function geoErr(e) {
	alert("Location error: " + e.message);
}

function sensorsDetect() {
	// Light & Proximity (limited browser support)
	window.addEventListener(
		"devicelight",
		(e) => (document.getElementById("s-light").textContent = e.value + " lux"),
		{ once: true }
	);
	window.addEventListener(
		"deviceproximity",
		(e) => (document.getElementById("s-prox").textContent = e.value + " cm"),
		{ once: true }
	);
	document.getElementById("s-light").textContent =
		"AmbientLightSensor" in window ? "API available" : "Not supported";
	document.getElementById("s-prox").textContent =
		"ProximitySensor" in window ? "API available" : "Not supported";
	document.getElementById("s-vibrate").textContent =
		"vibrate" in navigator ? "Supported" : "Not supported";
	document.getElementById("s-audio").textContent =
		"AudioContext" in window || "webkitAudioContext" in window ?
			"Supported"
		:	"N/A";
	document.getElementById("s-gamepad").textContent =
		"getGamepads" in navigator ?
			navigator.getGamepads().length + " connected"
		:	"N/A";
	document.getElementById("s-pointer").textContent =
		window.matchMedia("(pointer:fine)").matches ? "Fine (mouse)"
		: window.matchMedia("(pointer:coarse)").matches ? "Coarse (touch)"
		: "None";

	// Camera & mic (enumerate devices without asking permission)
	if (navigator.mediaDevices?.enumerateDevices) {
		navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => {
				const cams = devices.filter((d) => d.kind === "videoinput").length;
				const mics = devices.filter((d) => d.kind === "audioinput").length;
				document.getElementById("s-cam").textContent = cams + " camera(s)";
				document.getElementById("s-mic").textContent = mics + " mic(s)";
			})
			.catch(() => {
				document.getElementById("s-cam").textContent = "Permission needed";
				document.getElementById("s-mic").textContent = "Permission needed";
			});
	}
}

function sTestVibrate() {
	if ("vibrate" in navigator) {
		navigator.vibrate([100, 50, 100, 50, 200]);
		alert("Vibration pattern sent (100ms, pause, 100ms, pause, 200ms)");
	} else {
		alert("Vibration not supported on this device");
	}
}

async function audioStart() {
	try {
		audioStream = await navigator.mediaDevices.getUserMedia({
			audio: true,
		});
		const AC = window.AudioContext || window.webkitAudioContext;
		audioCtx = new AC();
		const src = audioCtx.createMediaStreamSource(audioStream);
		const analyser = audioCtx.createAnalyser();
		analyser.fftSize = 256;
		src.connect(analyser);

		document.getElementById("s-samplerate").textContent =
			audioCtx.sampleRate + " Hz";

		const bufLen = analyser.frequencyBinCount;
		const data = new Uint8Array(bufLen);
		const canvas = document.getElementById("s-audio-canvas");
		const ctx = canvas.getContext("2d");

		function drawAudio() {
			audioAnimFrame = requestAnimationFrame(drawAudio);
			analyser.getByteFrequencyData(data);
			const W = canvas.offsetWidth || 400,
				H = 100;
			canvas.width = W;
			ctx.fillStyle = "rgba(0,0,0,0.3)";
			ctx.fillRect(0, 0, W, H);

			const barW = (W / bufLen) * 2;
			let x = 0;
			let sum = 0;
			for (let i = 0; i < bufLen; i++) {
				sum += data[i];
				const barH = (data[i] / 255) * H;
				const hue = (i / bufLen) * 120 + 180;
				ctx.fillStyle = `hsl(${hue},80%,55%)`;
				ctx.fillRect(x, H - barH, barW - 1, barH);
				x += barW;
			}
			const vol = Math.round((sum / bufLen / 255) * 100);
			document.getElementById("s-volume").textContent = vol + "%";
		}
		drawAudio();
	} catch (e) {
		alert("Mic access denied or not supported: " + e.message);
	}
}

function audioStop() {
	if (audioAnimFrame) cancelAnimationFrame(audioAnimFrame);
	if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
	if (audioCtx) audioCtx.close();
	audioCtx = null;
	audioStream = null;
	const canvas = document.getElementById("s-audio-canvas");
	canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
	document.getElementById("s-volume").textContent = "--";
	document.getElementById("s-samplerate").textContent = "--";
}

// Auto-run fingerprint and sensor detection on load
document.addEventListener("DOMContentLoaded", () => {
	fpGenerate();
	sensorsDetect();
});

// ================= MAP =================
const map = L.map("map", {
	center: [20, 0],
	zoom: 2,
	zoomControl: false,
	attributionControl: false,
});

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
	maxZoom: 19,
	attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

let currentMarker = null;

// ================= UTILITY =================
function escapeHtml(str) {
	if (str == null) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function isValidIP(ip) {
	if (!ip || ip === "") return true;
	const ipv4 =
		/^(?:(?:25[0-5]|2[0-4]\d|1?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1?\d\d?)$/;
	const ipv6 =
		/^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$|^::1$/;
	return ipv4.test(ip) || ipv6.test(ip);
}

// ================= FETCH =================
async function fetchWithFallback(ip = "") {
	setLoading(true);
	try {
		const url =
			ip ?
				`/.netlify/functions/ip-lookup?ip=${encodeURIComponent(ip)}`
			:	`/.netlify/functions/ip-lookup`;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);

		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (!res.ok) throw new Error(`Network error: ${res.status}`);

		const data = await res.json();
		if (data.error) throw new Error(data.error);

		return data;
	} catch (err) {
		if (err.name === "AbortError") {
			showToast("Request timeout");
		} else {
			showToast(err.message);
		}
		throw err;
	} finally {
		setLoading(false);
	}
}

// ================= UI ACTION =================
async function lookupIP() {
	const input = document.getElementById("ipInput");
	if (!input) return;

	const ip = input.value.trim();

	if (!isValidIP(ip)) {
		showToast("Invalid IP format");
		return;
	}

	try {
		const data = await fetchWithFallback(ip);
		updateUI(data);
		updateMap(data.latitude, data.longitude, data.city);
		addToLog(data);
	} catch (e) {
		console.error("Lookup failed:", e);
	}
}

async function trackMyIP() {
	try {
		const data = await fetchWithFallback();
		updateUI(data);
		updateMap(data.latitude, data.longitude, data.city);
		addToLog(data);
	} catch (e) {
		console.error("Auto IP detection failed:", e);
	}
}

function updateUI(d) {
	const setText = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.textContent = value || "-";
	};

	setText("currentIP", d.ip);
	setText(
		"country",
		d.country_name ? `${d.country_name} (${d.country_code})` : null
	);
	setText("city", d.city);
	setText("region", d.region);
	setText(
		"coords",
		d.latitude != null && d.longitude != null ?
			`${d.latitude}, ${d.longitude}`
		:	null
	);
	setText("timezone", d.timezone);
	setText("isp", d.org);
	setText("asn", d.asn);
	setText("route", d.network);
	setText("networkType", d.version || "IPv4");

	const lastUpdated = document.getElementById("lastUpdated");
	if (lastUpdated) {
		lastUpdated.textContent = new Date().toLocaleTimeString();
	}
}

function setLoading(loading) {
	const btn = document.getElementById("trackBtn");
	if (btn) btn.disabled = loading;

	const connText = document.getElementById("connectionText");
	if (connText) connText.textContent = loading ? "Loading..." : "Connected";
}

function showToast(msg) {
	const container = document.getElementById("toastContainer");
	if (!container) {
		console.error("Toast container missing:", msg);
		return;
	}

	const el = document.createElement("div");
	el.className = "error-toast";
	el.textContent = msg;
	container.appendChild(el);

	setTimeout(() => {
		if (el.parentNode) el.remove();
	}, 4000);
}

// ================= MAP =================
function updateMap(lat, lng, city) {
	if (lat == null || lng == null) return;

	if (currentMarker) map.removeLayer(currentMarker);

	currentMarker = L.marker([lat, lng]).addTo(map);
	map.setView([lat, lng], 10);

	currentMarker.bindPopup(escapeHtml(city) || "Unknown").openPopup();
}

// ================= LOG =================
function addToLog(d) {
	const table = document.getElementById("activityLog");
	if (!table) return;

	const tbody = table.querySelector("tbody") || table;
	const row = document.createElement("tr");

	row.innerHTML = `
        <td>${escapeHtml(new Date().toLocaleTimeString("bn-BD"))}</td>
        <td>${escapeHtml(d.ip)}</td>
        <td>${escapeHtml(d.city || "-")}, ${escapeHtml(d.country_code || "--")}</td>
        <td>Active</td>
    `;

	tbody.prepend(row);

	// Max 10 rows
	const rows = tbody.querySelectorAll("tr");
	if (rows.length > 10) {
		rows[rows.length - 1].remove();
	}
}

// ================= TRAFFIC (SIMULATION) =================
let trafficInterval = null;

function simulateTraffic() {
	const el = document.getElementById("activeConnections");
	const bar = document.getElementById("trafficBar");
	const rpm = document.getElementById("reqPerMin");
	const threats = document.getElementById("threatsBlocked");

	if (!el || !bar || !rpm || !threats) return;

	let count = parseInt(el.textContent) || 0;
	count = Math.max(0, count + Math.floor(Math.random() * 10) - 3);
	el.textContent = count;

	const percent = Math.min(100, (count / 200) * 100);
	bar.style.width = percent + "%";

	rpm.textContent = count * 12;

	if (Math.random() > 0.95) {
		threats.textContent = (parseInt(threats.textContent) || 0) + 1;
	}
}

function startTrafficSimulation() {
	if (trafficInterval) clearInterval(trafficInterval);
	trafficInterval = setInterval(simulateTraffic, 2000);
}

function stopTrafficSimulation() {
	if (trafficInterval) {
		clearInterval(trafficInterval);
		trafficInterval = null;
	}
}

// ================= PING (REAL) =================
async function runPingTest() {
	const el = document.getElementById("pingResult");
	if (!el) return;

	el.textContent = "Testing...";

	const urls = [
		"https://www.google.com/favicon.ico",
		"https://cloudflare.com/favicon.ico",
		"https://1.1.1.1/favicon.ico",
	];

	const url = urls[Math.floor(Math.random() * urls.length)];
	const start = performance.now();

	try {
		await fetch(url, {
			mode: "no-cors",
			cache: "no-store",
			method: "HEAD",
		});
		const latency = Math.floor(performance.now() - start);
		el.textContent = `${latency} ms`;
		el.className =
			latency < 100 ? "text-green-400"
			: latency < 300 ? "text-yellow-400"
			: "text-red-400";
	} catch {
		el.textContent = "Failed";
		el.className = "text-red-400";
	}
}

// ================= DNS (REAL) =================
async function checkDNS() {
	const el = document.getElementById("dnsResult");
	if (!el) return;

	el.textContent = "Resolving...";

	try {
		// DNS over HTTPS (Cloudflare)
		const res = await fetch(
			"https://1.1.1.1/dns-query?name=google.com&type=A",
			{
				headers: { Accept: "application/dns-json" },
			}
		);

		if (res.ok) {
			const data = await res.json();
			if (data.Answer && data.Answer.length > 0) {
				el.textContent = `1.1.1.1 (Cloudflare) → ${data.Answer[0].data}`;
				el.className = "text-green-400";
			} else {
				throw new Error("No DNS answer");
			}
		} else {
			throw new Error("DNS query failed");
		}
	} catch {
		// Fallback
		const list = [
			"8.8.8.8 (Google)",
			"1.1.1.1 (Cloudflare)",
			"9.9.9.9 (Quad9)",
		];
		el.textContent =
			list[Math.floor(Math.random() * list.length)] + " (fallback)";
		el.className = "text-yellow-400";
	}
}

// ================= SECURITY (REAL CHECK) =================
async function checkSecurity() {
	const el = document.getElementById("securityResult");
	if (!el) return;

	el.textContent = "Scanning...";
	el.className = "";

	try {
		// Check HTTPS
		const isHttps = window.location.protocol === "https:";

		// Check security headers via a simple fetch
		const res = await fetch(window.location.href, { method: "HEAD" });
		const csp = res.headers.get("content-security-policy");
		const xFrame = res.headers.get("x-frame-options");

		let score = 0;
		if (isHttps) score += 40;
		if (csp) score += 30;
		if (xFrame) score += 30;

		if (score >= 70) {
			el.textContent = `Secure (${score}%)`;
			el.className = "text-green-400";
		} else if (score >= 40) {
			el.textContent = `Moderate (${score}%)`;
			el.className = "text-yellow-400";
		} else {
			el.textContent = `Weak (${score}%)`;
			el.className = "text-red-400";
		}
	} catch {
		el.textContent = "Check failed";
		el.className = "text-gray-400";
	}
}

// ================= INIT =================
window.addEventListener("DOMContentLoaded", () => {
	const input = document.getElementById("ipInput");
	if (input) {
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter") lookupIP();
		});
	}

	// Auto-detect user IP
	trackMyIP();

	// Live Traffic
	startTrafficSimulation();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
	stopTrafficSimulation();
});
