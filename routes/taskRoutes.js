const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

router.post(
  "/",
  protect,
  restrictTo("manager"),
  taskController.createTask
);
router.get(
  "/",
  protect,
  restrictTo("admin", "manager", "employee"),
  taskController.getTasks
);

router.get("/details/:id",protect,taskController.getTaskDetails)
router.get("/kanban/:projectId",protect,taskController.getKanbanTasks)
router.patch("/:id",protect,restrictTo("manager"),taskController.updateTask)
router.patch("/:id/status",protect,restrictTo("admin", "manager", "employee"),taskController.updateTaskStatus)
router.patch("/:id/remove-from-sprint",protect,restrictTo("admin","manager"),taskController.removeTaskFromSprint)
router.delete("/:id",protect,restrictTo("manager"),taskController.deleteTask)
module.exports = router;
