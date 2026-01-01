const Sprint = require("../models/sprint");
const Project = require("../models/project");
const Task = require("../models/task");
const Employee = require("../models/Employees")


exports.createSprint = async (req, res) => {
    try {
        const { name, projectId, startDate, endDate } = req.body;
        if (!name || !projectId || !startDate || !endDate) {
            return res.status(400).json({
                status: "fail",
                message: "Name, projectId, startDate and endDate are required"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid date format"
            });
        }

        if (start >= end) {
            return res.status(400).json({
                status: "fail",
                message: "End date must be after start date"
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                status: "fail",
                message: "Project not found"
            });
        }

        if (
            req.user.role === "manager" &&
            project.managerId.toString() !== req.user.id
        ) {
            return res.status(403).json({
                status: "fail",
                message: "You are not allowed to create sprint for this project"
            });
        }

        if (project.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot add sprint to a completed project"
            });
        }

        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);


        if (start < projectStart) {
            return res.status(400).json({
                status: "fail",
                message: "Sprint start date cannot be before project start date"
            });
        }


        if (end > projectEnd) {
            return res.status(400).json({
                status: "fail",
                message: "Sprint end date cannot be after project end date"
            });
        }


        const existingSprint = await Sprint.findOne({
            projectId,
            name: { $regex: `^${name}$`, $options: "i" }
        });

        if (existingSprint) {
            return res.status(409).json({
                status: "fail",
                message: "Sprint with same name already exists in this project"
            });
        }


        const overlappingSprint = await Sprint.findOne({
            projectId,
            status: { $in: ["Planned", "Active"] },
            $or: [
                { startDate: { $lte: end }, endDate: { $gte: start } }
            ]
        });

        if (overlappingSprint) {
            return res.status(400).json({
                status: "fail",
                message:
                    "Sprint dates overlap with an existing planned or active sprint"
            });
        }


        const sprint = await Sprint.create({
            name,
            projectId,
            startDate: start,
            endDate: end,
            status: "Planned",
            createdBy: req.user.id
        });


        res.status(201).json({
            status: "success",
            message: "Sprint created successfully",
            data: sprint
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Failed to create sprint",
            error: err.message
        });
    }
};



exports.addTaskToSprint = async (req, res) => {
    try {
        const { sprintId, taskId } = req.body;

        if (!sprintId || !taskId) {
            return res.status(400).json({
                status: "fail",
                message: "sprintId and taskId are required"
            });
        }


        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return res.status(404).json({
                status: "fail",
                message: "Sprint not found"
            });
        }

        if (sprint.status === "Completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot add tasks to a completed sprint"
            });
        }


        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                status: "fail",
                message: "Task not found"
            });
        }

        if (task.projectId.toString() !== sprint.projectId.toString()) {
            return res.status(400).json({
                status: "fail",
                message: "Task and sprint must belong to the same project"
            });
        }


        const project = await Project.findById(sprint.projectId);

        if (
            req.user.role === "manager" &&
            project.managerId.toString() !== req.user.id
        ) {
            return res.status(403).json({
                status: "fail",
                message: "You are not allowed to modify this sprint"
            });
        }


        if (task.sprintId) {
            return res.status(400).json({
                status: "fail",
                message: "Task is already assigned to a sprint"
            });
        }
        const sprintStart = new Date(sprint.startDate);
        const sprintEnd = new Date(sprint.endDate);


        const taskStart = task.startDate
            ? new Date(task.startDate)
            : null;

        const taskEnd = task.endDate
            ? new Date(task.endDate)
            : null;

        // If task already has dates → validate
        if (taskStart && taskStart < sprintStart) {
            return res.status(400).json({
                status: "fail",
                message: "Task start date cannot be before sprint start date"
            });
        }

        if (taskEnd && taskEnd > sprintEnd) {
            return res.status(400).json({
                status: "fail",
                message: "Task end date cannot be after sprint end date"
            });
        }

        if (taskStart && taskEnd && taskStart > taskEnd) {
            return res.status(400).json({
                status: "fail",
                message: "Task start date cannot be after task end date"
            });
        }



        task.sprintId = sprintId;
        await task.save();

        res.status(200).json({
            status: "success",
            message: "Task added to sprint successfully",
            data: task
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Failed to add task to sprint",
            error: err.message
        });
    }
};

exports.getSprints = async (req, res) => {
    try {
        const { projectId, status, mine } = req.query;

        const query = {};


        if (projectId) query.projectId = projectId;
        if (status) query.status = status;

        if (req.user.role === "employee") {


            const employee = await Employee.findOne({ userId: req.user.id });

            if (!employee) {
                return res.status(404).json({
                    status: "fail",
                    message: "Employee profile not found"
                });
            }


            const taskSprintIds = await Task.distinct("sprintId", {
                assignedTo: employee._id,
                sprintId: { $ne: null }
            });

            query._id = { $in: taskSprintIds };
        }
        if (req.user.role === "manager") {
            const projects = await Project.find(
                { managerId: req.user.id },
                "_id"
            );
            const projectIds = projects.map(p => p._id);
            query.projectId = { $in: projectIds };
        }


        const sprints = await Sprint.find(query)
            .populate({
                path: "projectId",
                select: "name startDate endDate status managerId"
            });

        res.status(200).json({
            status: "success",
            results: sprints.length,
            data: sprints
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Failed to fetch sprints",
            error: err.message
        });
    }
};

exports.completeSprint = async (req, res) => {
    try {
        const { id } = req.params;

        const sprint = await Sprint.findById(id);

        if (!sprint) {
            return res.status(404).json({
                status: "fail",
                message: "Sprint not found"
            });
        }

        if (sprint.status === "Completed") {
            return res.status(400).json({
                status: "fail",
                message: "Sprint is already completed"
            });
        }


        const pendingTasks = await Task.find({
            sprintId: id,
            status: { $ne: "Completed" }
        });

        if (pendingTasks.length > 0) {
            return res.status(400).json({
                status: "fail",
                message:
                    "Cannot complete sprint while some tasks are still incomplete"
            });
        }

        sprint.status = "Completed";
        sprint.actualEndDate = new Date();
        await sprint.save();

        res.status(200).json({
            status: "success",
            message: "Sprint marked as completed",
            data: sprint
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Failed to complete sprint",
            error: err.message
        });
    }
};


exports.updateSprint = async (req, res) => {
    try {
        const sprintId = req.params.id;
        const { name, startDate, endDate } = req.body;

        /* ==============================
           1. FETCH SPRINT
        ============================== */
        const sprint = await Sprint.findById(sprintId);

        if (!sprint) {
            return res.status(404).json({
                status: "fail",
                message: "Sprint not found"
            });
        }

        const project = await Project.findById(sprint.projectId);
        if (project.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot modify data for a completed project"
            });
        }

        if (
            req.user.role === "manager" &&
            project.managerId.toString() !== req.user.id
        ) {
            return res.status(403).json({
                status: "fail",
                message: "You are not allowed to update this sprint"
            });
        }


        if (sprint.status === "Completed") {
            return res.status(400).json({
                status: "fail",
                message: "Completed sprints cannot be edited"
            });
        }


        if (sprint.status === "Active") {
            if (startDate || endDate) {
                return res.status(400).json({
                    status: "fail",
                    message: "Cannot modify dates of an active sprint"
                });
            }

            sprint.name = name || sprint.name;
            await sprint.save();

            return res.status(200).json({
                status: "success",
                data: sprint
            });
        }

        const finalStartDate = startDate || sprint.startDate;
        const finalEndDate = endDate || sprint.endDate;

        if (new Date(finalStartDate) > new Date(finalEndDate)) {
            return res.status(400).json({
                status: "fail",
                message: "Sprint startDate must be before endDate"
            });
        }

        if (
            new Date(finalStartDate) < new Date(project.startDate) ||
            new Date(finalEndDate) > new Date(project.endDate)
        ) {
            return res.status(400).json({
                status: "fail",
                message: "Sprint dates must fall within project dates"
            });
        }


        if (startDate || endDate) {
            const misalignedTask = await Task.findOne({
                sprintId,
                $or: [
                    { startDate: { $lt: new Date(finalStartDate) } },
                    { endDate: { $gt: new Date(finalEndDate) } }
                ]
            });

            if (misalignedTask) {
                return res.status(400).json({
                    status: "fail",
                    message:
                        "Sprint date change would misalign existing task dates. Update tasks first."
                });
            }
        }


        sprint.name = name || sprint.name;
        sprint.startDate = finalStartDate;
        sprint.endDate = finalEndDate;

        await sprint.save();

        res.status(200).json({
            status: "success",
            data: sprint
        });

    } catch (err) {
        res.status(500).json({
            status: "fail",
            message: "Failed to update sprint",
            error: err.message
        });
    }
};

exports.deleteSprint = async (req, res) => {
    try {
        const { id } = req.params;

        const sprint = await Sprint.findById(id);

        if (!sprint) {
            return res.status(404).json({
                status: "fail",
                message: "Sprint not found"
            });
        }

        if (sprint.status !== "Planned") {
            return res.status(400).json({
                status: "fail",
                message: "Only planned sprints can be deleted"
            });
        }

        const tasksCount = await Task.countDocuments({ sprintId: id });

        if (tasksCount > 0) {
            return res.status(400).json({
                status: "fail",
                message: "Cannot delete sprint with assigned tasks"
            });
        }

        await sprint.deleteOne();

        res.status(200).json({
            status: "success",
            message: "Sprint deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Failed to delete sprint",
            error: err.message
        });
    }
};

exports.getSprintDetails = async (req, res) => {
    try {
        const sprintId = req.params.id;


        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return res.status(404).json({
                message: "Sprint not found"
            });
        }


        const project = await Project.findById(sprint.projectId);
        if (!project) {
            return res.status(404).json({
                message: "Associated project not found"
            });
        }


        if (
            req.user.role === "manager" &&
            project.managerId.toString() !== req.user.id
        ) {
            return res.status(403).json({
                message: "You are not allowed to view this sprint"
            });
        }


        const tasks = await Task.find({ sprintId: sprint._id })
            .populate("assignedTo", "name")
            .populate("dependsOn", "title")
            .sort({ createdAt: 1 });


        const formattedTasks = tasks.map(task => ({
            _id: task._id,
            title: task.title,
            status: task.status,
            assignedEmployeeName: task.assignedTo?.name || null,
            dependencies: task.dependsOn?.map(depTask => ({
                dependsOnTaskTitle: depTask.title
            })) || []
        }));


        res.status(200).json({
            _id: sprint._id,
            name: sprint.name,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            status: sprint.status,
            projectId: project._id,
            projectName: project.name,
            tasks: formattedTasks
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to fetch sprint details",
            error: err.message
        });
    }
};
