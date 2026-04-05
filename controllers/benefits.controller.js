const db = require("../config/db");

async function getAllBenefits(req, res) {
  try {
    const [rows] = await db.query("SELECT * FROM benefits");
    res.json(rows);
  } catch (err) {
    console.error("getAllBenefits error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function createBenefit(req, res) {
  try {
    const { name, description, is_active } = req.body;

    const [r] = await db.query(
      `INSERT INTO benefits (name, description, is_active)
       VALUES (?, ?, ?)`,
      [name, description, is_active ? 1 : 0]
    );

    res.json({ id: r.insertId });
  } catch (err) {
    console.error("createBenefit error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function updateBenefit(req, res) {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    await db.query(
      `UPDATE benefits 
       SET name=?, description=?, is_active=? 
       WHERE id=?`,
      [name, description, is_active ? 1 : 0, id]
    );

    res.json({ message: "Updated" });
  } catch (err) {
    console.error("updateBenefit error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function deleteBenefit(req, res) {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM benefits WHERE id=?", [id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteBenefit error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function getApplications(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT ba.*, u.full_name, b.name 
       FROM benefit_applications ba
       JOIN users u ON u.id = ba.user_id
       JOIN benefits b ON b.id = ba.benefit_id`
    );
    res.json(rows);
  } catch (err) {
    console.error("getApplications error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function updateApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, remarks, reviewed_by } = req.body;

    await db.query(
      `UPDATE benefit_applications
       SET status=?, remarks=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=?`,
      [status, remarks, reviewed_by, id]
    );

    res.json({ message: "Application updated" });
  } catch (err) {
    console.error("updateApplicationStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getAllBenefits,
  createBenefit,
  updateBenefit,
  deleteBenefit,
  getApplications,
  updateApplicationStatus,
};
