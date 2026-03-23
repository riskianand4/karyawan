const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/settingsController");
const { auth, adminOnly } = require("../middleware/auth");

router.get("/menu", auth, ctrl.getMenuSettings);
router.put("/menu", auth, adminOnly, ctrl.updateMenuSettings);
router.get("/position-access", auth, ctrl.getPositionAccess);
router.put("/position-access", auth, adminOnly, ctrl.updatePositionAccess);

module.exports = router;
