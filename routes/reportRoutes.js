const express = require("express");
const reportController = require("../controllers/reportController")
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();




router.get(
    "/employee-summary",
    protect,
    restrictTo("admin", "manager"),
    reportController.getEmployeeSummary
);

router.get(
    "/projects/overall",
    protect,
    restrictTo("admin", "manager"),
    reportController.getOverallProjectStatusReport
);
router.get(
    "/graphs/employee-hours",
    protect,
    restrictTo("admin", "manager"),
    reportController.getEmployeeHoursGraph
);
router.get(
    "/graphs",
    protect,
    restrictTo("admin", "manager"),
    reportController.getGraphReport
);
router.get(
    "/projects/pending",
    protect,
    restrictTo("admin", "manager"),
    reportController.getPendingProjectsReport
);

router.get(
    "/projects/completed",
    protect,
    restrictTo("admin", "manager"),
    reportController.getCompletedProjectsReport
);

router.get(
    "/tasks/pending",
    protect,
    restrictTo("admin", "manager"),
    reportController.getPendingTasksReport
);
router.get(
    "/tasks/completed",
    protect,
    restrictTo("admin", "manager"),
    reportController.getCompletedTasksReport
);
router.get(
    "/projects",
    protect,
    restrictTo("admin", "manager"),
    reportController.getProjectReport
);
router.get(
    "/project/:projectId",
    protect,
    restrictTo("admin", "manager"),
    reportController.getProjectDetailReport
);
router.get(
    "/velocity/:projectId",
    protect,
    restrictTo("admin", "manager"),
    reportController.getVelocityChart
);

router.get("/burndown/:sprintId",protect,restrictTo("admin","manager"),reportController.getBurndownChart)
router.get("/employee-details/:employeeId",protect,restrictTo("admin","manager"),reportController.getEmployeeDetailReport);

module.exports = router; 