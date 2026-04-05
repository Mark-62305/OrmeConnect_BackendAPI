const nodemailer = require("nodemailer");
require("dotenv").config();

/**
 * Email service for sending benefit application notifications to admin
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Send benefit application email to admin
   * @param {Object} options - Email options
   * @param {string} options.applicantName - Name of the person applying
   * @param {string} options.benefitName - Name of the benefit being applied for
   * @param {number} options.userId - User ID
   * @param {number} options.applicationId - Application ID
   * @param {Array} options.attachments - Array of file attachments
   * @returns {Promise}
   */
  async sendBenefitApplicationEmail({
    applicantName,
    benefitName,
    userId,
    applicationId,
    attachments = [],
  }) {
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      throw new Error("ADMIN_EMAIL not configured in environment variables");
    }

    const subject = `Benefit Application: ${benefitName} - ${applicantName}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .footer { margin-top: 20px; padding: 10px; text-align: center; font-size: 12px; color: #777; }
          .attachments { margin-top: 15px; padding: 10px; background-color: #fff3cd; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Benefit Application Received</h2>
          </div>
          <div class="content">
            <div class="info-row">
              <span class="label">Applicant Name:</span>
              <span class="value">${applicantName}</span>
            </div>
            <div class="info-row">
              <span class="label">Benefit Type:</span>
              <span class="value">${benefitName}</span>
            </div>
            <div class="info-row">
              <span class="label">User ID:</span>
              <span class="value">${userId}</span>
            </div>
            <div class="info-row">
              <span class="label">Application ID:</span>
              <span class="value">${applicationId}</span>
            </div>
            <div class="info-row">
              <span class="label">Date Submitted:</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
            
            ${
              attachments.length > 0
                ? `
              <div class="attachments">
                <strong>📎 Attached Documents:</strong>
                <ul>
                  ${attachments.map((att) => `<li>${att.filename}</li>`).join("")}
                </ul>
              </div>
            `
                : ""
            }
          </div>
          <div class="footer">
            <p>This is an automated email from the ORMECO Benefits System.</p>
            <p>Please review the application and attached documents in the admin portal.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
New Benefit Application Received

Applicant Name: ${applicantName}
Benefit Type: ${benefitName}
User ID: ${userId}
Application ID: ${applicationId}
Date Submitted: ${new Date().toLocaleString()}

${attachments.length > 0 ? `Attached Documents:\n${attachments.map((att) => `- ${att.filename}`).join("\n")}` : "No attachments"}

This is an automated email from the ORMECO Benefits System.
Please review the application and attached documents in the admin portal.
    `;

    const mailOptions = {
      from: `"ORMECO Benefits System" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
      attachments: attachments,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  /**
   * Verify email configuration
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log("Email server connection verified successfully");
      return true;
    } catch (error) {
      console.error("Email server connection failed:", error);
      return false;
    }
  }
}

module.exports = new EmailService();