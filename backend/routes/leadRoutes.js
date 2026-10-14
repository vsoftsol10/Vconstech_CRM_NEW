const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const leadWorkHistoryController = require("../controllers/leadWorkHistoryController");
const subscriptionController = require("../controllers/subscriptionController");
const { requireAuthenticated } = require("../middleware/auth");

// ── Leads CRUD Routes ──────────────────────────────────────────────────────
router.post("/", leadController.createLead);
router.get("/", leadController.getAllLeads);
router.get("/:id", leadController.getLeadById);
router.put("/:id", leadController.updateLead);
router.delete("/:id", requireAuthenticated, leadController.deleteLead);

// ── Lead Work History Routes ───────────────────────────────────────────────
router.post("/work-history", leadWorkHistoryController.createLeadWorkHistory);
router.get("/work-history/:leadId", leadWorkHistoryController.getLeadWorkHistory);

// ── Lead Updates Routes ────────────────────────────────────────────────────
router.post("/updates", leadWorkHistoryController.createLeadUpdate);
router.get("/updates/:leadId", leadWorkHistoryController.getLeadUpdates);

// ── Convert Lead to Customer ───────────────────────────────────────────────
router.post("/:id/convert-to-customer", subscriptionController.convertLeadToCustomer);

module.exports = router;
