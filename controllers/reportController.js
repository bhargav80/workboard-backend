const Project = require("../models/project");
const Task = require("../models/task");
const Employee = require("../models/Employees");
const TaskStatusHistory = require("../models/taskStatusHistory");
const Sprint = require("../models/sprint");
const mongoose = require("mongoose");

const User = require("../models/Users")
exports.getOverallProjectStatusReport = async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;


        const now = new Date();

        let filterStartDate = new Date(0);
        if (period) {
            switch (period.toLowerCase()) {
                case "weekly":
                    filterStartDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case "monthly":
                    filterStartDate = new Date(now.setDate(now.getDate() - 30));
                    break;
                case "quarterly":
                    filterStartDate = new Date(now.setDate(now.getDate() - 90));
                    break;
                case "yearly":
                    filterStartDate = new Date(now.setDate(now.getDate() - 365));
                    break;
            }
        }

        const filterEndDate = new Date();


        if (!["admin", "manager"].includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }




        const projectQuery = userRole === "admin"
            ? {}
            : { managerId: userId };

        const allProjects = await Project.find(projectQuery).lean();


        const completedProjects = allProjects.filter(p =>
            p.status?.toLowerCase() === "completed" &&
            ((p.actualEndDate || p.endDate) >= filterStartDate &&
                (p.actualEndDate || p.endDate) <= filterEndDate)
        );

        const pendingProjects = allProjects.filter(p =>
            p.startDate <= filterEndDate &&
            p.status?.toLowerCase() !== "completed"
        );

        const totalProjectsCompleted = completedProjects.length;
        const totalProjectsPending = pendingProjects.length;

        const projectIds = [
            ...new Set([
                ...completedProjects.map(p => p._id),
                ...pendingProjects.map(p => p._id)
            ])
        ];


        const allTasks = await Task.find({
            projectId: { $in: projectIds }
        }).lean();

        const completedTasks = allTasks.filter(t =>
            t.status?.toLowerCase() === "completed" &&
            t.actualEndDate &&
            t.actualEndDate >= filterStartDate &&
            t.actualEndDate <= filterEndDate
        );

        const pendingTasks = allTasks.filter(t =>
            t.status?.toLowerCase() !== "completed" &&
            t.startDate <= filterEndDate
        );

        const progressTasks = allTasks.filter(t =>
            t.status?.toLowerCase() === "in progress" &&
            t.startDate <= filterEndDate
        );


        return res.status(200).json({
            status: "success",
            data: {
                totalProjectsCompleted,
                totalProjectsPending,
                totalTasksCompleted: completedTasks.length,
                totalTasksPending: pendingTasks.length,
                totalProgressTasks: progressTasks.length
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: "error",
            message: err.message || "Failed to fetch overall project status report"
        });
    }
};

exports.getEmployeeHoursGraph = async (req, res) => {
    try {
        const { period = "quarterly" } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const today = new Date();
        let startDate;

        switch (period.toLowerCase()) {
            case "weekly":
                startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case "monthly":
                startDate = new Date(today);
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case "yearly":
                startDate = new Date(today);
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case "quarterly":
            default:
                startDate = new Date(today);
                startDate.setMonth(startDate.getMonth() - 3);
        }


        const employeeQuery =
            userRole === "admin"
                ? {}
                : { managerId: userId };

        const employees = await Employee.find(employeeQuery)
            .select("_id name userId")
            .lean();


        const validEmployees = employees.filter(e => e.userId);

        const employeeUserIds = validEmployees.map(e => e.userId.toString());


        const historyEntries = await TaskStatusHistory.find({
            changedAt: { $gte: startDate },
            manualHours: { $ne: null },
            changedBy: { $in: employeeUserIds }
        }).lean();


        const months = [];
        const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

        while (cursor <= today) {
            months.push(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }


        const result = months.map(month => {
            const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);


            let workingDays = 0;
            for (
                let d = new Date(monthStart);
                d < monthEnd;
                d.setDate(d.getDate() + 1)
            ) {
                const day = d.getDay();
                if (day !== 0 && day !== 6) {
                    workingDays++;
                }
            }

            const availableHours = workingDays * 8;

            const employeeData = validEmployees.map(emp => {
                const empHours = historyEntries
                    .filter(h =>
                        h.changedBy.toString() === emp.userId.toString() &&
                        h.changedAt >= monthStart &&
                        h.changedAt < monthEnd
                    )
                    .reduce((sum, h) => sum + h.manualHours, 0);

                return {
                    employeeId: emp._id,
                    name: emp.name,
                    hoursWorked: Number(empHours.toFixed(1))
                };
            });

            return {
                month: monthStart.toLocaleString("en-US", {
                    month: "short",
                    year: "numeric"
                }),
                availableHours,
                employees: employeeData
            };
        });

        return res.status(200).json({
            status: "success",
            data: result
        });

    } catch (error) {
        console.error("EMPLOYEE HOURS GRAPH ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

exports.getGraphReport = async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const today = new Date();


        const day = today.getDay();
        const diffToLastMonday = (day + 6) % 7 + 7;
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - diffToLastMonday);
        lastMonday.setHours(0, 0, 0, 0);

        const lastFriday = new Date(lastMonday);
        lastFriday.setDate(lastMonday.getDate() + 4);
        lastFriday.setHours(23, 59, 59, 999);


        let filterStartDate = new Date(0);
        let filterEndDate = today;

        if (period) {
            switch (period.toLowerCase()) {
                case "weekly":
                    filterStartDate = lastMonday;
                    filterEndDate = lastFriday;
                    break;
                case "monthly":
                    filterStartDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "quarterly":
                    filterStartDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case "yearly":
                    filterStartDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
        }


        if (!["admin", "manager"].includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }


        const projectQuery =
            userRole === "admin"
                ? {}
                : { managerId: userId };

        const allProjects = await Project.find(projectQuery).lean();


        const completedProjects = allProjects.filter(p =>
            p.status?.toLowerCase() === "completed" &&
            ((p.actualEndDate || p.endDate) >= filterStartDate &&
                (p.actualEndDate || p.endDate) <= filterEndDate)
        );

        const inProgressProjects = allProjects.filter(p =>
            p.startDate <= filterEndDate &&
            p.status?.toLowerCase() !== "completed"
        );


        const projectIds = allProjects.map(p => p._id);

        const allTasks = await Task.find({
            projectId: { $in: projectIds }
        }).lean();

        const tasksCompleted = allTasks.filter(t =>
            t.status?.toLowerCase() === "completed" &&
            t.actualEndDate &&
            t.actualEndDate >= filterStartDate &&
            t.actualEndDate <= filterEndDate
        ).length;

        const tasksInProgress = allTasks.filter(t =>
            !["pending", "completed", "blocked"].includes(t.status?.toLowerCase()) &&
            t.startDate <= filterEndDate
        ).length;

        const tasksPending = allTasks.filter(t =>
            ["pending", "blocked"].includes(t.status?.toLowerCase()) &&
            t.startDate <= filterEndDate
        ).length;

        return res.status(200).json({
            status: "success",
            data: {
                tasks: {
                    completed: tasksCompleted,
                    inProgress: tasksInProgress,
                    pending: tasksPending
                },
                projects: {
                    completed: completedProjects.length,
                    inProgress: inProgressProjects.length
                }
            }
        });

    } catch (error) {
        console.error("GRAPH REPORT ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

exports.getPendingProjectsReport = async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const today = new Date();

        let filterStartDate = new Date(0);
        let filterEndDate = today;

        if (period) {
            switch (period.toLowerCase()) {
                case "weekly":
                    filterStartDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "monthly":
                    filterStartDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "quarterly":
                    filterStartDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case "yearly":
                    filterStartDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
        }


        if (!["admin", "manager"].includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }


        const projectQuery =
            userRole === "admin"
                ? {}
                : { managerId: userId };

        const allProjects = await Project.find(projectQuery).lean();


        const pendingProjects = allProjects.filter(p =>
            p.startDate <= filterEndDate &&
            p.status?.toLowerCase() !== "completed" &&
            (
                !period ||
                (p.startDate >= filterStartDate || p.endDate >= filterStartDate)
            )
        );
        const projectIds = pendingProjects.map(p => p._id);
        const tasks = await Task.find({
            projectId: { $in: projectIds }
        }).select("projectId status").lean();
        const result = pendingProjects.map(project => {
            const projectTasks = tasks.filter(
                t => t.projectId.toString() === project._id.toString()
            );

            const totalTasks = projectTasks.length;
            const completedTasks = projectTasks.filter(
                t => t.status?.toLowerCase() === "completed"
            ).length;

            const percentageCompleted =
                totalTasks === 0
                    ? 0
                    : Math.round((completedTasks / totalTasks) * 100);

            return {
                ...project,
                percentageCompleted
            };
        });

        return res.status(200).json({
            status: "success",
            data: result
        });

    } catch (error) {
        console.error("PENDING PROJECTS REPORT ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};


exports.getCompletedProjectsReport = async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const today = new Date();


        let filterStartDate = new Date(0);
        let filterEndDate = today;

        if (period) {
            switch (period.toLowerCase()) {
                case "weekly":
                    filterStartDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "monthly":
                    filterStartDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "quarterly":
                    filterStartDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case "yearly":
                    filterStartDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
        }

        if (!["admin", "manager"].includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }


        const projectQuery =
            userRole === "admin"
                ? { status: "completed" }
                : { status: "completed", managerId: userId };

        const allCompletedProjects = await Project.find(projectQuery).populate("managerId", "username").lean();


        const completedProjects = allCompletedProjects.filter(p => {
            const endDate = p.actualEndDate || p.endDate;
            return endDate >= filterStartDate && endDate <= filterEndDate;
        });

        const projectIds = completedProjects.map(p => p._id);

        const tasks = await Task.find({
            projectId: { $in: projectIds }
        }).select("projectId status").lean();

        const result = completedProjects.map(project => {
            const projectTasks = tasks.filter(
                t => t.projectId.toString() === project._id.toString()
            );

            const totalTasks = projectTasks.length;
            const completedTasks = projectTasks.filter(
                t => t.status?.toLowerCase() === "completed"
            ).length;

            const percentageCompleted =
                totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100);

            return {
                ...project,
                percentageCompleted
            };
        });

        return res.status(200).json({
            status: "success",
            data: result
        });

    } catch (error) {
        console.error("COMPLETED PROJECTS REPORT ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

exports.getPendingTasksReport = async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const today = new Date();


        let filterStartDate = new Date(0);
        let filterEndDate = today;

        if (period) {
            switch (period.toLowerCase()) {
                case "weekly":
                    filterStartDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "monthly":
                    filterStartDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "quarterly":
                    filterStartDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case "yearly":
                    filterStartDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
        }

        if (!["admin", "manager"].includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }


        const projectQuery =
            userRole === "admin"
                ? {}
                : { managerId: userId };

        const projects = await Project.find(projectQuery)
            .select("_id")
            .lean();

        const projectIds = projects.map(p => p._id);


        const pendingTasks = await Task.find({
            projectId: { $in: projectIds },
            status: { $in: ["Blocked", "Pending", "In Progress", "Testing"] },
            startDate: { $lte: filterEndDate }
        }).populate("projectId", "name").lean();

        return res.status(200).json({
            status: "success",
            data: pendingTasks
        });

    } catch (error) {
        console.error("PENDING TASKS REPORT ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

exports.getCompletedTasksReport = async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const today = new Date();


        let filterStartDate = new Date(0);
        let filterEndDate = today;

        if (period) {
            switch (period.toLowerCase()) {
                case "weekly":
                    filterStartDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "monthly":
                    filterStartDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "quarterly":
                    filterStartDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case "yearly":
                    filterStartDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
        }


        if (!["admin", "manager"].includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }


        const projectQuery =
            userRole === "admin"
                ? {}
                : { managerId: userId };

        const projects = await Project.find(projectQuery)
            .select("_id")
            .lean();

        const projectIds = projects.map(p => p._id);
        console.log(projectIds)

        const completedTasks = await Task.find({
            projectId: { $in: projectIds },
            status: "Completed",
            actualEndDate: {
                $gte: filterStartDate,
                $lte: filterEndDate
            }
        }).populate("projectId", "name").lean();

        return res.status(200).json({
            status: "success",
            data: completedTasks
        });

    } catch (error) {
        console.error("COMPLETED TASKS REPORT ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

exports.getProjectReport = async (req, res) => {
    try {
        const { start, end, status } = req.query;

        const projectFilter = {};

        if (start && end) {
            projectFilter.startDate = {
                $gte: new Date(start),
                $lte: new Date(end),
            };
        }

        if (status) {
            projectFilter.status = status;
        }

        const projects = await Project.aggregate([
            { $match: projectFilter },

            {
                $lookup: {
                    from: "tasks",
                    localField: "_id",
                    foreignField: "projectId",
                    as: "tasks",
                },
            },

            {
                $addFields: {
                    totalTasks: { $size: "$tasks" },
                    completedTasks: {
                        $size: {
                            $filter: {
                                input: "$tasks",
                                as: "task",
                                cond: { $eq: ["$$task.status", "Completed"] },
                            },
                        },
                    },
                },
            },


            {
                $addFields: {
                    completionPercentage: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$totalTasks", 0] },
                                    { $eq: ["$status", "completed"] }
                                ]
                            },
                            100,
                            {
                                $cond: [
                                    { $eq: ["$totalTasks", 0] },
                                    0,
                                    {
                                        $round: [
                                            {
                                                $multiply: [
                                                    { $divide: ["$completedTasks", "$totalTasks"] },
                                                    100,
                                                ],
                                            },
                                            0,
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            },

            // 3️⃣ NOW project only required fields
            {
                $project: {
                    name: 1,
                    startDate: 1,
                    endDate: 1,
                    status: 1,
                    completionPercentage: 1,
                },
            },

            { $sort: { createdAt: -1 } },
        ]);


        res.status(200).json({
            status: "success",
            projects,
        });

    } catch (err) {
        console.error("Project report error:", err);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch project report",
        });
    }
};


exports.getProjectDetailReport = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { start, end } = req.query;

        const today = new Date();
        const startFilter = start
            ? new Date(start)
            : new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        const endFilter = end ? new Date(end) : new Date();


        const project = await Project.findById(projectId).lean();
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }


        const sprints = await Sprint.find({ projectId }).lean();


        const projectTasks = await Task.find({
            projectId,
            $or: [
                { actualStartDate: { $gte: startFilter, $lte: endFilter } },
                { startDate: { $gte: startFilter, $lte: endFilter } },
                { actualEndDate: { $gte: startFilter, $lte: endFilter } },
                {
                    actualEndDate: { $exists: false },
                    dueDate: { $gte: startFilter, $lte: endFilter }
                }
            ]
        }).lean();

        const taskIds = projectTasks.map(t => t._id);

        const taskStatusHistories = await TaskStatusHistory.find({
            taskId: { $in: taskIds },

        }).lean();


        const employees = await Employee.find({})
            .select("_id name userId")
            .lean();

        const userToEmployeeMap = {};
        employees.forEach(emp => {
            if (emp.userId) {
                userToEmployeeMap[String(emp.userId)] = String(emp._id);
            }
        });

        const userWorkHours = {};

        taskStatusHistories.forEach(h => {
            if (!h.changedBy) return;

            const userId = String(h.changedBy);
            userWorkHours[userId] =
                (userWorkHours[userId] || 0) + (h.manualHours || 0);
        });
        const employeeWorkHours = {};

        Object.entries(userWorkHours).forEach(([userId, hours]) => {
            const empId = userToEmployeeMap[userId];
            if (empId) {
                employeeWorkHours[empId] =
                    (employeeWorkHours[empId] || 0) + hours;
            }
        });

        //console.log(employeeWorkHours)
        const totalHoursWorked = Object.values(employeeWorkHours).reduce((a, b) => a + b, 0);
        const totalAvailableHours = projectTasks.reduce(
            (sum, t) => sum + (t.allocatedHours || 0),
            0
        );


        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(
            t => t.status?.toLowerCase() === "completed"
        ).length;

        const pendingTasks = totalTasks - completedTasks;
        const percentageCompleted =
            totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;


        const taskStatusBreakdown = Object.values(
            projectTasks.reduce((acc, t) => {
                acc[t.status] = acc[t.status] || { status: t.status, count: 0 };
                acc[t.status].count++;
                return acc;
            }, {})
        );


        const months = [];
        const cursor = new Date(startFilter);

        while (cursor <= endFilter) {
            months.push(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const monthlyHoursSummary = months.map(month => {
            const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
            const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);

            const workingDays = Array.from(
                { length: (monthEnd - monthStart) / 86400000 },
                (_, i) => new Date(monthStart.getTime() + i * 86400000)
            ).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;

            const hoursWorked = taskStatusHistories
                .filter(h => h.changedAt >= monthStart && h.changedAt < monthEnd)
                .reduce((sum, h) => sum + (h.manualHours || 0), 0);

            return {
                month: monthStart.toLocaleString("en-US", {
                    month: "short",
                    year: "numeric"
                }),
                availableHours: workingDays * 8,
                hoursWorked: Number(hoursWorked.toFixed(1))
            };
        });


        const sprintDetails = sprints.map(s => ({
            sprintId: s._id,
            sprintName: s.name,
            startDate: s.startDate,
            endDate: s.endDate,
            tasks: projectTasks
                .filter(t => String(t.sprintId) === String(s._id))
                .map(t => ({
                    taskId: t._id,
                    taskTitle: t.title,
                    status: t.status,
                    assignedTo: employees.find(
                        e => String(e._id) === String(t.assignedTo)
                    )?.name
                }))
        }));


        const taskDetails = projectTasks.map(task => ({
            taskId: task._id,
            taskTitle: task.title,
            status: task.status,
            startDate: task.startDate,
            dueDate: task.endDate,
            allocatedHours: task.allocatedHours || 0,
            hoursWorked: taskStatusHistories
                .filter(h => String(h.taskId) === String(task._id))
                .reduce((sum, h) => sum + (h.manualHours || 0), 0),
            assignedTo: employees.find(
                e => String(e._id) === String(task.assignedTo)
            )?.name,
            sprintName:
                sprints.find(s => String(s._id) === String(task.sprintId))?.name ||
                "Unassigned"
        }));


        const employeeStats = employees
            .filter(emp => projectTasks.some(t => String(t.assignedTo) === String(emp._id)))
            .map(emp => ({
                employeeId: emp._id,
                employeeName: emp.name,
                hoursWorked: employeeWorkHours[emp._id] || 0,
                totalAvailableHours: projectTasks
                    .filter(t => String(t.assignedTo) === String(emp._id))
                    .reduce((sum, t) => sum + (t.allocatedHours || 0), 0)
            }));


        res.status(200).json({
            projectId: project._id,
            projectName: project.name,
            startDate: project.startDate,
            endDate: project.endDate,
            totalHoursWorked: Number(totalHoursWorked.toFixed(2)),
            totalAvailableHours: Number(totalAvailableHours.toFixed(2)),
            employees: employeeStats,
            taskStatusBreakdown,
            monthlyHoursSummary,
            sprints: sprintDetails,
            regularTasks: {
                totalTasks,
                completedTasks,
                pendingTasks,
                percentageCompleted,
                taskDetails
            }
        });

    } catch (err) {
        console.error("Project report error:", err);
        res.status(500).json({ message: "Failed to generate project report" });
    }
};

exports.getVelocityChart = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { start, end } = req.query;
        console.log("Velocity API HIT");
        console.log("projectId param:", req.params.projectId);
        const project = await Project.findById(projectId).lean();
        if (!project) {
            return res.status(404).json({ message: "Project not found." });
        }

        let sprintQuery = { projectId };
        console.log(sprintQuery)
        if (start && end) {
            sprintQuery.startDate = { $gte: new Date(start) };
            sprintQuery.endDate = { $lte: new Date(end) };
        }

        const sprints = await Sprint.find(sprintQuery)
            .sort({ startDate: 1 })
            .lean();
        console.log("Sprints found:", sprints.length);
        const sprintVelocity = await Promise.all(
            sprints.map(async sprint => {
                const completedTasks = await Task.countDocuments({
                    sprintId: sprint._id,
                    status: "Completed"
                });

                return {
                    sprintId: sprint._id,
                    sprintName: sprint.name,
                    startDate: sprint.startDate,
                    completedTasks
                };
            })
        );

        res.status(200).json(sprintVelocity);

    } catch (err) {
        console.error("Velocity chart error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


exports.getBurndownChart = async (req, res) => {
    try {
        const { sprintId } = req.params;
        const { start, end } = req.query;


        const sprint = await Sprint.findById(sprintId).lean();
        if (!sprint) {
            return res.status(404).json({ message: "Sprint not found." });
        }

        const startDate = start ? new Date(start) : new Date(sprint.startDate);
        const endDate = end ? new Date(end) : new Date(sprint.endDate);

        if (endDate < startDate) {
            return res.status(400).json({
                message: "End date cannot be before Start date."
            });
        }


        const tasks = await Task.find({
            sprintId,
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).lean();

        if (!tasks.length) {
            return res.status(200).json([]);
        }

        const taskIds = tasks.map(t => t._id);


        const histories = await TaskStatusHistory.find({
            taskId: { $in: taskIds }
        })
            .sort({ changedAt: 1 })
            .lean();


        const historyLookup = {};
        histories.forEach(h => {
            if (!historyLookup[h.taskId]) {
                historyLookup[h.taskId] = [];
            }
            historyLookup[h.taskId].push(h);
        });

        const totalAllocated = tasks.reduce(
            (sum, t) => sum + (t.allocatedHours || 0),
            0
        );

        const totalDays =
            Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        const idealDailyBurn =
            totalDays > 0 ? totalAllocated / totalDays : 0;

        const burndown = [];
        let currentDate = new Date(startDate);
        let dayIndex = 0;

        // 🔹 Loop day-by-day
        while (currentDate <= endDate) {
            let remainingHours = 0;

            const endOfDay = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
                23, 59, 59, 999
            );

            tasks.forEach(task => {
                const taskHistories = historyLookup[task._id] || [];

                const uptoToday = taskHistories.filter(
                    h => new Date(h.changedAt) <= endOfDay
                );

                const totalWorked = uptoToday.reduce(
                    (sum, h) => sum + (h.manualHours || 0),
                    0
                );

                const latestStatus =
                    uptoToday
                        .slice()
                        .reverse()
                        .find(h => h.newStatus)?.newStatus || task.status;

                if (latestStatus === "Completed") return;

                remainingHours += Math.max(
                    (task.allocatedHours || 0) - totalWorked,
                    0
                );
            });

            const idealRemaining =
                dayIndex === totalDays - 1
                    ? 0
                    : Math.max(
                        totalAllocated - idealDailyBurn * dayIndex,
                        0
                    );

            burndown.push({
                date: currentDate.toISOString().split("T")[0],
                remainingHours: Number(remainingHours.toFixed(2)),
                idealHours: Number(idealRemaining.toFixed(2))
            });

            currentDate.setDate(currentDate.getDate() + 1);
            dayIndex++;
        }

        return res.status(200).json(burndown);

    } catch (err) {
        console.error("Burndown chart error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};


exports.getEmployeeSummary = async (req, res) => {
    try {
        // console.log("QUERY PARAMS:", req.user);
        const { startDate, endDate, projectId, employeeId } = req.query;
        const userId = req.user.id;
        const role = req.user.role;
        const isAdmin = role === "admin";


        let currentManager = null;
        if (!isAdmin) {
            currentManager = await Employee.findById(req.user.employeeId);
            if (!currentManager) {
                return res.status(401).json({ message: "Manager profile not found" });
            }
        }


        if (projectId && !isAdmin) {
            const allowed = await Project.exists({
                _id: projectId,
                managerId: currentManager.userId
            });
            if (!allowed) {
                return res.status(403).json({
                    message: "You are not authorized to view this project's data"
                });
            }
        }
        console.log(currentManager)

        if (employeeId && !isAdmin) {
            const allowed = await Employee.exists({
                _id: employeeId,
                managerId: currentManager.userId
            });
            if (!allowed) {
                return res.status(403).json({
                    message: "You are not authorized to view this employee's data"
                });
            }
        }


        const projectFilter = {};
        if (!isAdmin) projectFilter.managerId = userId;
        if (projectId) projectFilter._id = projectId;

        const projects = await Project.find(projectFilter)
            .select("_id name")
            .lean();

        //console.log(projects)
        const projectIds = projects.map(p => p._id);


        const employeeFilter = {};
        if (!isAdmin) employeeFilter.managerId = userId;
        if (employeeId) employeeFilter._id = employeeId;

        const employees = await Employee.find(employeeFilter).lean();
        const employeeIds = employees.map(e => e._id);


        const taskFilter = {
            projectId: { $in: projectIds },
            assignedTo: { $in: employeeIds }
        };

        if (startDate || endDate) {
            taskFilter.$expr = {
                $and: [
                    startDate
                        ? [{
                            $gte: [
                                { $ifNull: ["$actualEndDate", { $ifNull: ["$actualStartDate", "$dueDate"] }] },
                                new Date(startDate)
                            ]
                        }]
                        : [],
                    endDate
                        ? [{
                            $lte: [
                                { $ifNull: ["$actualEndDate", { $ifNull: ["$actualStartDate", "$dueDate"] }] },
                                new Date(endDate)
                            ]
                        }]
                        : []
                ]
            };
        }

        const tasks = await Task.find(taskFilter).lean();


        const summaries = employees.map(emp => {
            const projectsSummary = projects.map(project => {
                const empTasks = tasks.filter(
                    t =>
                        t.projectId.toString() === project._id.toString() &&
                        t.assignedTo.toString() === emp._id.toString()
                );

                const completed = empTasks.filter(t => t.status === "Completed").length;
                const pending = empTasks.length - completed;
                const total = completed + pending;

                if (total === 0) return null;

                return {
                    projectId: project._id,
                    projectName: project.name,
                    completedTasks: completed,
                    pendingTasks: pending,
                    completionPercentage: Number(((completed / total) * 100).toFixed(2))
                };
            }).filter(Boolean);

            return {
                employeeId: emp._id,
                name: emp.name,
                designation: emp.designation,
                projects: projectsSummary
            };
        });
        console.log(summaries)
        res.status(200).json({
            status: "success",
            count: summaries.length,
            data: summaries
        });

    } catch (error) {
        console.error("Employee Summary Error:", error);
        res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
};


exports.getEmployeeDetailReport = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate, projectId } = req.query;

        const userId = req.user._id;
        const isAdmin = req.user.role === "admin";

        let currentManager = null;

        if (!isAdmin) {
            currentManager = await Employee.findOne({ userId });
            if (!currentManager)
                return res.status(401).json({ message: "Manager profile not found" });

            const managedEmployee = await Employee.findOne({
                _id: employeeId,
                managerId: currentManager.userId,
            });

            if (!managedEmployee)
                return res.status(403).json({ message: "Access denied" });
        }

        const employee = await Employee.findById(employeeId).populate("userId", "name email role")
            .populate("managerId", "name email");
        if (!employee)
            return res.status(404).json({ message: "Employee not found" });

        const today = new Date();
        const startFilter = startDate ? new Date(startDate) : new Date(today.setFullYear(today.getFullYear() - 1));
        const endFilter = endDate ? new Date(endDate) : new Date();

        let taskQuery = {
            assignedTo: employee._id,
            $or: [
                { actualStartDate: { $gte: startFilter, $lte: endFilter } },
                { startDate: { $gte: startFilter, $lte: endFilter } },
                { actualEndDate: { $gte: startFilter, $lte: endFilter } },
                { actualEndDate: null, dueDate: { $gte: startFilter, $lte: endFilter } }
            ]
        };

        if (projectId) taskQuery.projectId = projectId;

        const tasks = await Task
            .find(taskQuery)
            .populate("projectId","name");

        const totalTasks = tasks.length;

        const statusCount = status =>
            tasks.filter(t => t.status === status).length;

        const completedTasks = statusCount("Completed");
        const pendingTasks = statusCount("Pending");
        const testingTasks = statusCount("Testing");
        const inProgressTasks = statusCount("In Progress");
        const blockedTasks = statusCount("Blocked");

        const completionRate = totalTasks === 0
            ? 0
            : Math.round((completedTasks / totalTasks) * 100 * 100) / 100;

        const taskBreakdown = Object.values(
            tasks.reduce((acc, t) => {
                acc[t.status] = acc[t.status] || { status: t.status, count: 0 };
                acc[t.status].count++;
                return acc;
            }, {})
        );

        const taskPerMonth = Object.values(
            tasks.reduce((acc, t) => {
                const m = new Date(t.dueDate).getMonth() + 1;
                acc[m] = acc[m] || { month: m, count: 0 };
                acc[m].count++;
                return acc;
            }, {})
        );

        const timeEntries = await TaskStatusHistory.find({
            changedBy: employee.userId,
            changedAt: { $gte: startFilter, $lte: endFilter },
            manualHours: { $ne: null }
        });


        const months = [];
        let cursor = new Date(startFilter.getFullYear(), startFilter.getMonth(), 1);
        while (cursor <= endFilter) {
            months.push(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const monthlyHours = months.map(month => {
            const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);

            let workingDays = 0;
            for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0 && day !== 6) workingDays++;
            }

            const availableHours = workingDays * 8;

            const hoursWorked = timeEntries
                .filter(h => h.changedAt >= monthStart && h.changedAt < monthEnd)
                .reduce((sum, h) => sum + h.manualHours, 0);

            return {
                month: monthStart.toLocaleString("en-US", { month: "short", year: "numeric" }),
                availableHours,
                hoursWorked: Math.round(hoursWorked * 10) / 10
            };
        });


        res.json({
            id: employee._id,
            name: employee.name,
            designation: employee.designation,
            totalTasks,
            completedTasks,
            pendingTasks,
            inProgressTasks,
            testingTasks,
            blockedTasks,
            completionRate,
            taskStatusBreakdown: taskBreakdown,
            taskDistributionByMonth: taskPerMonth,
            monthlyHoursSummary: monthlyHours,
            tasks: tasks.map(t => ({
                id: t._id,
                title: t.title,
                status: t.status,
                dueDate: t.dueDate,
                actualStartDate: t.actualStartDate,
                actualEndDate: t.actualEndDate,
                allocatedHours: t.allocatedHours,
                projectName: t.project?.name
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};
