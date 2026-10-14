const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const subscriptionController = require("../controllers/subscriptionController");
const { requireAuthenticated, requireAdminOrSales } = require("../middleware/auth");

router.post("/", requireAuthenticated, customerController.createCustomer);
router.post("/:id/resync", requireAuthenticated, requireAdminOrSales, customerController.resyncCustomer);
router.post("/:id/reset-credentials", requireAuthenticated, requireAdminOrSales, customerController.resetCredentials);
router.post("/:id/retry-erp-sync", requireAuthenticated, requireAdminOrSales, customerController.retryErpSubscriptionSync);
router.put("/:id/custom-plan", requireAuthenticated, customerController.updateCustomPlan);
router.get("/", requireAuthenticated, customerController.getAllCustomers);
router.get("/converted-leads", requireAuthenticated, customerController.getConvertedLeadCustomers);

router.post("/subscription-history/erp-sync", requireAuthenticated, requireAdminOrSales, subscriptionController.syncErpSubscriptionHistory);
router.get("/subscription-history/:customerId", requireAuthenticated, subscriptionController.getSubscriptionHistory);
router.get("/stats/monthly", requireAuthenticated, subscriptionController.getCustomerStats);

router.put("/:id/subscription", requireAuthenticated, customerController.updateCustomerSubscription);
router.get("/:id", requireAuthenticated, customerController.getCustomerById);
router.put("/:id", requireAuthenticated, customerController.updateCustomer);
router.patch("/:id/status", requireAuthenticated, requireAdminOrSales, customerController.updateCustomerStatus);
router.delete("/:id", requireAuthenticated, requireAdminOrSales, customerController.deleteCustomer);

router.get("/:id/renew-preview", requireAuthenticated, requireAdminOrSales, customerController.previewRenewal);
router.post("/:id/renew", requireAuthenticated, requireAdminOrSales, customerController.renewSubscription);
router.post("/:id/reminder", requireAuthenticated, requireAdminOrSales, customerController.sendReminder);
router.patch("/:id/reminder", requireAuthenticated, requireAdminOrSales, customerController.sendReminder);

module.exports = router;
