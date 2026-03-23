const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/noteController");
const { auth, adminOnly } = require("../middleware/auth");

// Daily notes
router.get("/daily", auth, ctrl.getDailyNotes);
router.post("/daily", auth, ctrl.createDailyNote);
router.put("/daily/:id", auth, ctrl.updateDailyNote);
router.delete("/daily/:id", auth, ctrl.deleteDailyNote);

// Admin notes
router.get("/admin", auth, ctrl.getAdminNotes);
router.post("/admin", auth, adminOnly, ctrl.createAdminNote);
router.delete("/admin/:id", auth, adminOnly, ctrl.deleteAdminNote);

// Boss notes
router.get("/boss", auth, adminOnly, ctrl.getBossNotes);
router.get("/boss/:employeeId", auth, adminOnly, ctrl.getBossNote);
router.put("/boss/:employeeId", auth, adminOnly, ctrl.upsertBossNote);

module.exports = router;
