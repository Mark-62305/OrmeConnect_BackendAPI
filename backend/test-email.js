require("dotenv").config();
const emailService = require("./services/email.services");

/**
 * Test script to verify email configuration
 * Run with: node test-email.js
 */
async function testEmail() {
  console.log("=".repeat(50));
  console.log("ORMECO Email Configuration Test");
  console.log("=".repeat(50));
  
  console.log("\n📧 Email Settings:");
  console.log(`   Host: ${process.env.EMAIL_HOST}`);
  console.log(`   Port: ${process.env.EMAIL_PORT}`);
  console.log(`   User: ${process.env.EMAIL_USER}`);
  console.log(`   Admin: ${process.env.ADMIN_EMAIL}`);
  
  console.log("\n🔍 Testing email server connection...");
  
  try {
    const isConnected = await emailService.verifyConnection();
    
    if (!isConnected) {
      console.error("\n❌ Email connection failed!");
      console.error("\nTroubleshooting:");
      console.error("1. Check EMAIL_USER and EMAIL_PASS in .env");
      console.error("2. Ensure you're using a Gmail App Password (not regular password)");
      console.error("3. Enable 2FA on your Gmail account");
      console.error("4. Generate App Password at: https://myaccount.google.com/apppasswords");
      return;
    }
    
    console.log("✅ Email connection successful!");
    
    console.log("\n📤 Sending test benefit application email...");
    
    const result = await emailService.sendBenefitApplicationEmail({
      applicantName: "Juan Dela Cruz (TEST)",
      benefitName: "Senior Citizen Discount",
      userId: 12345,
      applicationId: 67890,
      attachments: [],
    });
    
    console.log("\n✅ Test email sent successfully!");
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`\n📬 Check your inbox at: ${process.env.ADMIN_EMAIL}`);
    console.log("\n" + "=".repeat(50));
    
  } catch (error) {
    console.error("\n❌ Failed to send test email!");
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      console.error("\n🔐 Authentication Error:");
      console.error("   Your email/password is incorrect.");
      console.error("   Make sure you're using a Gmail App Password.");
    } else if (error.code === 'ECONNECTION') {
      console.error("\n🌐 Connection Error:");
      console.error("   Cannot connect to email server.");
      console.error("   Check your internet connection.");
    } else {
      console.error("\n   Full error:", error);
    }
    
    console.log("\n" + "=".repeat(50));
  }
}

testEmail();