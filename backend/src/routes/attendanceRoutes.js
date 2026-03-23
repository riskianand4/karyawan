const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceController");
const { auth, adminOnly } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.get("/", auth, ctrl.getAttendance);
router.post("/clock-in", auth, ctrl.clockIn);
router.post("/clock-out", auth, ctrl.clockOut);
router.post("/webhook", ctrl.handleWebhook); // No auth — from biometric device
router.get("/leave-requests", auth, ctrl.getLeaveRequests);
router.post("/leave-requests", auth, ctrl.createLeaveRequest);
router.put("/leave-requests/:id", auth, adminOnly, ctrl.approveLeaveRequest);
router.get("/leave-balance/:userId?", auth, ctrl.getLeaveBalance);
router.get("/leave-balances", auth, adminOnly, ctrl.getLeaveBalances);

module.exports = router;
