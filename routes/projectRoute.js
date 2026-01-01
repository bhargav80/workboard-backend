const express = require("express");
const projectController = require("../controllers/projectController")
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();


router.get("/", protect, restrictTo("admin", "manager"), projectController.getProjects)
router.post(
  "/",
  protect,
  restrictTo("admin"),
  projectController.createProject
);
router.get(
  "/my",
  protect,
  restrictTo("employee"),
  projectController.getMyProjects
);
router.get("/:id", protect, projectController.getProjectDetails);
router.get("/:id/summary", protect, projectController.getProjectSummary);

router.patch("/:id", protect, restrictTo("admin"), projectController.updateProject)
router.delete("/:id", protect, restrictTo("admin"), projectController.deleteProject)
module.exports = router;