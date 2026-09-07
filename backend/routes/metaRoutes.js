const express = require("express");
const metaController = require("../controllers/metaController");

const router = express.Router();

router.get("/webhook", metaController.verifyWebhook);
router.post("/webhook", metaController.receiveWebhook);
router.get("/register/:token", metaController.getRegistrationForm);
router.post("/register/:token", express.urlencoded({ extended: false }), metaController.submitRegistrationForm);
router.get("/api/meta/conversations", metaController.listInbox);
router.get("/api/meta/conversations/:id/messages", metaController.getInboxMessages);
router.post("/api/meta/conversations/:id/replies", metaController.sendInboxReply);

module.exports = router;
