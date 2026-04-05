const db = require("../config/db");

async function getRates(req, res) {
  try {
    const [rows] = await db.query("SELECT * FROM billing_rates ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("getRates error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function createRate(req, res) {
  try {
    const { effective_from, effective_to, rate_per_kwh, description } = req.body;

    const [r] = await db.query(
      "INSERT INTO billing_rates (effective_from, effective_to, rate_per_kwh, description) VALUES (?, ?, ?, ?)",
      [effective_from, effective_to, rate_per_kwh, description]
    );

    res.json({ id: r.insertId });
  } catch (err) {
    console.error("createRate error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function updateRate(req, res) {
  try {
    const { id } = req.params;
    const { effective_from, effective_to, rate_per_kwh, description } = req.body;

    await db.query(
      "UPDATE billing_rates SET effective_from=?, effective_to=?, rate_per_kwh=?, description=? WHERE id=?",
      [effective_from, effective_to, rate_per_kwh, description, id]
    );

    res.json({ message: "Updated" });
  } catch (err) {
    console.error("updateRate error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

async function deleteRate(req, res) {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM billing_rates WHERE id=?", [id]);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteRate error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getRates,
  createRate,
  updateRate,
  deleteRate,
};

