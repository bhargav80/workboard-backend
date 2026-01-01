const Task = require("../models/task");
const Project = require("../models/project");
const User = require("../models/Users");
const Employee = require("../models/Employees");
const TaskStatusHistory = require("../models/taskStatusHistory");
const mongoose = require("mongoose")


exports.employeeDashboard = async (req, res) => {
  try {
    const now = new Date();

    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee profile not found"
      });
    }

    
    const tasks = await Task.find({ assignedTo: employee._id })
      .select("title status endDate allocatedHours")
      .lean();

    const tasksInProgress = [];
    const blockedTasks = [];
    const testingTasks = [];
    const completedTasks = [];
    const overdueTasks = [];
    const upcomingDeadlines = [];

    let totalEstimated = 0;

    tasks.forEach(task => {
      totalEstimated += task.allocatedHours || 0;

      if (task.status === "In Progress") tasksInProgress.push(task);
      if (task.status === "Blocked") blockedTasks.push(task);
      if (task.status === "Testing") testingTasks.push(task);
      if (task.status === "Completed") completedTasks.push(task);

      if (task.endDate) {
        const end = new Date(task.endDate);

        if (end < now && task.status !== "Completed") {
          overdueTasks.push(task);
        }

        if (
          end >= now &&
          end <= new Date(now.getTime() + 7 * 86400000) &&
          task.status !== "Completed"
        ) {
          upcomingDeadlines.push(task);
        }
      }
    });

   const taskIds = tasks.map(
  t => new mongoose.Types.ObjectId(t._id)
);
console.log(taskIds[1], typeof taskIds[0]);


    const hoursAgg = await TaskStatusHistory.aggregate([
      {
        $match: {
          taskId: { $in: taskIds } 
        }
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: "$manualHours" }
        }
      }
    ]);
    console.log(hoursAgg)
    const totalHoursWorked = hoursAgg[0]?.totalHours || 0;

   
    const efficiencyPercentage =
      totalHoursWorked > 0
        ? Math.min(
            100,
            Math.round((totalEstimated / totalHoursWorked) * 100)
          )
        : 0;

    res.status(200).json({
      role: "employee",
      name: req.user.username,
      tasksInProgress,
      blockedTasks,
      testingTasks,
      completedTasks,
      overdueTasks,
      upcomingDeadlines,
      totalHoursWorked,
      efficiencyPercentage
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.managerDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === "admin";

        const projectFilter = isAdmin ? {} : { managerId: userId };

        const projects = await Project.find(projectFilter)
            .select("name status endDate")
            .lean();

        const projectIds = projects.map(p => p._id);

        const tasks = await Task.find({ projectId: { $in: projectIds } })
            .select("title status dueDate")
            .lean();

        const projectsInProgress = [];
        const completedProjects = [];

        projects.forEach(p => {
            if (p.status === "Completed") completedProjects.push(p);
            else projectsInProgress.push(p);
        });

        const tasksInProgress = [];
        const blockedTasks = [];
        const testingTasks = [];

        tasks.forEach(task => {
            if (task.status === "In Progress") tasksInProgress.push(task);
            if (task.status === "Blocked") blockedTasks.push(task);
            if (task.status === "Testing") testingTasks.push(task);
        });

        const totalEmployees = await User.countDocuments({ role: "employee" });

        res.status(200).json({
            role: req.user.role,
            username: req.user.username,

            totalProjects: projects.length,
            projectsInProgress,
            completedProjects,

            tasksInProgress,
            blockedTasks,
            testingTasks,

            totalEmployees
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};