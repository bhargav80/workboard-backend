const express = require("express");

const dashboardController = require("../controllers/dashboardController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

const router = express.Router();
router.get(
    "/employee",
    protect,
    restrictTo("employee"),
    dashboardController.employeeDashboard
);
router.get(
    "/manager",
    protect,
    restrictTo("admin","manager"),
    dashboardController.managerDashboard
);


module.exports = router;