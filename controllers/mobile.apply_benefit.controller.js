// controllers/mobile.apply_benefit.controller.js
const pool9 = require("../db.cjs");
const emailService = require("../services/email.services");

/**
 * POST /api/mobile/benefits/apply
 * body: user_id, benefit_id
 * files: files[] or files (optional)
 */
async function applyBenefit(req, res) {
  const userId = Number.parseInt(String(req.body?.user_id ?? "0"), 10);
  const benefitId = Number.parseInt(String(req.body?.benefit_id ?? "0"), 10);

  if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(benefitId) || benefitId <= 0) {
    return res.status(400).json({ status: "error", message: "Missing required fields: user_id or benefit_id" });
  }

  try {
    // Get user information
    const [userRows] = await pool9.execute("SELECT full_name, email FROM users WHERE id = ?", [userId]);

    if (!Array.isArray(userRows) || userRows.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    // ✅ FIX: use full_name (query selects full_name, not name)
    const userName = userRows[0].full_name || "Unknown User";

    // Get benefit information
    const [benefitRows] = await pool9.execute("SELECT name FROM benefits WHERE id = ?", [benefitId]);

    if (!Array.isArray(benefitRows) || benefitRows.length === 0) {
      return res.status(404).json({ status: "error", message: "Benefit not found" });
    }

    const benefitName = benefitRows[0].name || "Unknown Benefit";

    // Insert benefit application
    const [insertResult] = await pool9.execute(
      `
        INSERT INTO benefit_applications (user_id, benefit_id, status)
        VALUES (?, ?, 'pending')
      `,
      [userId, benefitId]
    );

    const applicationId = insertResult.insertId;

    // Prepare attachments from uploaded files (if any)
    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files
      .filter((f) => f && f.path)
      .map((f) => ({
        filename: f.originalname || f.filename || "attachment",
        path: f.path, // should be absolute due to diskStorage destination
        contentType: f.mimetype,
      }));

    // Send email notification to admin
    try {
      await emailService.sendBenefitApplicationEmail({
        applicantName: userName,
        benefitName,
        userId,
        applicationId,
        attachments,
      });
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // don't fail the request if email fails
    }

    return res.json({
      status: "success",
      message: "Application submitted successfully",
      application_id: applicationId,
      uploaded_files: attachments.length,
    });
  } catch (err) {
    console.error("Error in applyBenefit:", err);
    return res.status(500).json({
      status: "error",
      message: "Database error occurred while processing application",
    });
  }
}

module.exports = { applyBenefit };