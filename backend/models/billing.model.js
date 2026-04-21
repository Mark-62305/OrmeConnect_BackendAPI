const db = require("../config/db");

const Billing = {
  getRates() {
    return db.query("SELECT * FROM billing_rates ORDER BY effective_from DESC");
  },

  createRate({ effective_from, effective_to, rate_per_kwh, description }) {
    return db.query(
      "INSERT INTO billing_rates (effective_from, effective_to, rate_per_kwh, description) VALUES (?,?,?,?)",
      [effective_from, effective_to || null, rate_per_kwh, description || null]
    );
  },

  updateRate(id, { effective_from, effective_to, rate_per_kwh, description }) {
    return db.query(
      "UPDATE billing_rates SET effective_from=?, effective_to=?, rate_per_kwh=?, description=? WHERE id=?",
      [effective_from, effective_to || null, rate_per_kwh, description || null, id]
    );
  },

  deleteRate(id) {
    return db.query("DELETE FROM billing_rates WHERE id=?", [id]);
  }
};

module.exports = Billing;
