const express = require("express");
const router = express.Router();
const sprintController = require("../controllers/sprintController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");


router.get("/",protect, restrictTo("admin", "manager","employee"),sprintController.getSprints)
router.get("/:id",protect, restrictTo("admin", "manager","employee"),sprintController.getSprintDetails)

router.post(
  "/",
  protect,
  restrictTo("admin", "manager"),
  sprintController.createSprint
);

router.post(
  "/add-task",
  protect,
  restrictTo("admin", "manager"),
  sprintController.addTaskToSprint
);

router.patch("/:id",protect,
  restrictTo("admin", "manager"),
  sprintController.updateSprint)
router.patch("/:id.complete",protect,
  restrictTo("admin", "manager"),
  sprintController.completeSprint)

  
router.delete("/:id",protect,
  restrictTo("admin", "manager"),
  sprintController.deleteSprint)

module.exports = router;