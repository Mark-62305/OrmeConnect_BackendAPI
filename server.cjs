require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * MOBILE ROUTES
 */
app.use("/api/mobile", require("./routes/mobile.signup.routes.js"));
app.use("/api/mobile", require("./routes/mobile.login.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_profile.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_meters.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_meter_history.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_billing_rates.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_incidents.routes.js"));
app.use("/api/mobile", require("./routes/mobile.qr_login.routes.js"));
app.use("/api/mobile", require("./routes/mobile.report_incident.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_benefits.routes.js"));
app.use("/api/mobile", require("./routes/mobile.seminar_schedule.routes"));
app.use("/api/mobile", require("./routes/mobile.apply_benefit.routes.js"));
app.use("/api/mobile", require("./routes/mobile.get_benefit_status.routes.js"));
app.use("/api/mobile", require("./routes/mobile.generate_hash.routes.js"));

/**
 * WEB/ADMIN ROUTES
 */
app.use("/api/auth", require("./routes/auth.routes.js"));
app.use("/api/users", require("./routes/users.routes.js"));
app.use("/api/meters", require("./routes/meters.routes.js")); // ✅ keep only once
app.use("/api/incidents", require("./routes/incidents.routes.js"));
app.use("/api/benefits", require("./routes/benefits.routes.js"));
app.use("/api/billing", require("./routes/billing.routes.js"));
app.use("/api/announcements", require("./routes/announcements.routes.js"));
app.use("/api/dashboard", require("./routes/dashboard.routes.js"));


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
