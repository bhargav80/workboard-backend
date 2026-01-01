const Task = require("../models/task");
const Project = require("../models/project");
const Employee = require("../models/Employees");
const Sprint = require("../models/sprint")
const TaskStatusHistory = require("../models/taskStatusHistory");
const hasCircularDependency = require("../utils/checkCircularDependency");



async function hasPendingDependencies(dependsOn) {
    if (!dependsOn || dependsOn.length === 0) return false;

    const count = await Task.countDocuments({
        _id: { $in: dependsOn },
        status: { $ne: "Completed" }
    });

    return count > 0;
}

const calculateAvailableHours = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) return 0;
    const diffInMs = end - start;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;

    return diffInDays * 7;
};

exports.createTask = async (req, res) => {
    try {
        const managerId = req.user.id;

        const {
            projectId,
            sprintId,
            assignedTo,
            title,
            description,
            status,
            dependsOn,
            startDate,
            endDate,
            allocatedHours
        } = req.body;


        if (req.user.role !== "manager") {
            return res.status(403).json({
                message: "Only managers can create tasks"
            });
        }


        const project = await Project.findOne({
            _id: projectId,
            managerId
        });

        if (project.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot add task to a completed project"
            });
        }

        if (!project) {
            return res.status(403).json({
                message: "You are not allowed to create tasks for this project"
            });
        }


        let employee = null;

        if (assignedTo) {
            employee = await Employee.findOne({
                _id: assignedTo,
                managerId
            });

            if (!employee) {
                return res.status(403).json({
                    message: "You can assign tasks only to your own employees"
                });
            }
        }


        if (dependsOn && dependsOn.length > 0) {
            const invalidDeps = await Task.find({
                _id: { $in: dependsOn },
                projectId: { $ne: projectId }
            });

            if (invalidDeps.length > 0) {
                return res.status(400).json({
                    message: "Dependent tasks must belong to the same project"
                });
            }
        }
        if (startDate && endDate) {
            if (new Date(startDate) < project.startDate ||
                new Date(endDate) > project.endDate) {
                return res.status(400).json({
                    message: `Task dates must be within project dates (${project.startDate.toISOString().slice(0, 10)} - ${project.endDate.toISOString().slice(0, 10)})`
                });
            }

            if (new Date(endDate) < new Date(startDate)) {
                return res.status(400).json({
                    message: "Task due date cannot be earlier than start date"
                });
            }
        }

        if (startDate && endDate) {
            if (new Date(startDate) > new Date(endDate)) {
                return res.status(400).json({
                    status: "fail",
                    message: "startDate must be earlier than endDate"
                });
            }
        }
        const availableHours = calculateAvailableHours(startDate, endDate);

        if (allocatedHours > availableHours) {
            return res.status(400).json({
                status: "fail",
                message: `Allocated hours (${allocatedHours}) cannot exceed available hours (${availableHours})`
            });
        }
        let finalStatus = status || "Pending";


        if (finalStatus === "Blocked") {
            return res.status(400).json({
                message: "Blocked status is system controlled"
            });
        }

        if (dependsOn && dependsOn.length > 0) {
            const blocked = await hasPendingDependencies(dependsOn);

            if (blocked) {
                finalStatus = "Blocked";
            }
        }

        const task = await Task.create({
            projectId,
            sprintId: sprintId || null,
            assignedTo: assignedTo || null,
            title,
            description,
            allocatedHours,
            dependsOn, status: finalStatus,
            startDate,
            endDate,
            createdBy: managerId
        });

        res.status(201).json({
            status: "success",
            data: task
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to create task",
            error: err.message
        });
    }
};

exports.getTasks = async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === "manager") {

            const projects = await Project.find(
                { managerId: req.user.id },
                "_id"
            );

            const projectIds = projects.map(p => p._id);

            filter.projectId = { $in: projectIds };
        }

        if (req.user.role === "employee") {

            const employee = await Employee.findOne({ userId: req.user.id });

            if (!employee) {
                return res.status(404).json({
                    message: "Employee record not found"
                });
            }

            filter.assignedTo = employee._id;
        }

        const tasks = await Task.find(filter)
            .populate("projectId", "name startDate endDate")
            .populate("assignedTo", "name email")
            .populate("createdBy", "email role")
            .populate("dependsOn", "title status")
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            results: tasks.length,
            data: tasks
        });

    } catch (err) {
        res.status(500).json({
            status: "fail",
            message: "Failed to fetch tasks",
            error: err.message
        });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const managerId = req.user.id;
        const taskId = req.params.id;

        if (req.user.role !== "manager") {
            return res.status(403).json({
                message: "Only managers can update tasks"
            });
        }

        const {
            title,
            description,
            assignedTo,
            dependsOn = [],
            startDate,
            endDate,
            allocatedHours = 0,
            status,
            category
        } = req.body;
        if (status === "Blocked") {
            return res.status(400).json({
                message: "Blocked status is system controlled"
            });
        }

        const safeAllocatedHours = Number(allocatedHours) || 0;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }


        const project = await Project.findOne({
            _id: task.projectId,
            managerId
        });

        if (!project) {
            return res.status(403).json({
                message: "You are not allowed to update this task"
            });
        }

        if (project.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot modify data for a completed project"
            });
        }
        if (assignedTo) {
            const employee = await Employee.findOne({
                _id: assignedTo,
                managerId
            });

            if (!employee) {
                return res.status(403).json({
                    message: "Invalid assigned employee"
                });
            }
        }


        if (dependsOn.length > 0) {
            const invalidDeps = await Task.find({
                _id: { $in: dependsOn },
                projectId: { $ne: task.projectId }
            });

            if (invalidDeps.length > 0) {
                return res.status(400).json({
                    message: "Dependent tasks must belong to the same project"
                });
            }
        }
        if (dependsOn?.includes(taskId)) {
            return res.status(400).json({
                message: "Task cannot depend on itself"
            });
        }


        if (dependsOn && dependsOn.length > 0) {
            const uniqueDeps = [...new Set(dependsOn.map(id => id.toString()))];
            if (uniqueDeps.length !== dependsOn.length) {
                return res.status(400).json({
                    message: "Duplicate task dependencies are not allowed"
                });
            }
        }


        if (dependsOn.length > 0) {
            const invalidDeps = await Task.find({
                _id: { $in: dependsOn },
                projectId: { $ne: task.projectId }
            });

            if (invalidDeps.length > 0) {
                return res.status(400).json({
                    message: "Dependent tasks must belong to the same project"
                });
            }
        }


        if (dependsOn && dependsOn.length > 0) {
            const isCircular = await hasCircularDependency(dependsOn, taskId);
            if (isCircular) {
                return res.status(400).json({
                    message: "Circular dependency detected"
                });
            }
        }

        if (startDate && endDate) {
            if (
                new Date(startDate) < project.startDate ||
                new Date(endDate) > project.endDate
            ) {
                return res.status(400).json({
                    message: "Task dates must be within project duration"
                });
            }

            if (new Date(endDate) < new Date(startDate)) {
                return res.status(400).json({
                    message: "endDate cannot be earlier than startDate"
                });
            }

            const availableHours = calculateAvailableHours(startDate, endDate);
            if (safeAllocatedHours > availableHours) {
                return res.status(400).json({
                    message: `Allocated hours exceed available hours (${availableHours})`
                });
            }
        }

        if (task.sprintId) {
            const sprint = await Sprint.findById(task.sprintId);

            if (!sprint) {
                return res.status(400).json({
                    message: "Associated sprint not found"
                });
            }


            if (sprint.status === "Completed") {
                return res.status(400).json({
                    message: "Cannot update tasks in a completed sprint"
                });
            }


            const finalStartDate = startDate ?? task.startDate;
            const finalEndDate = endDate ?? task.endDate;

            if (
                new Date(finalStartDate) < sprint.startDate ||
                new Date(finalEndDate) > sprint.endDate
            ) {
                return res.status(400).json({
                    message: "Task dates must be within sprint duration"
                });
            }
        }

        let finalStatus = status ?? task.status;

        // remember last active status before blocking
        if (task.status !== "Blocked") {
            task.lastActiveStatus = task.status;
        }

        if (dependsOn && dependsOn.length > 0) {
            const blocked = await hasPendingDependencies(dependsOn);

            if (blocked) {
                finalStatus = "Blocked";
            } else if (task.status === "Blocked") {
                // dependencies cleared → unblock
                finalStatus = task.lastActiveStatus || "Pending";
            }
        } else {
            // no dependencies at all
            if (task.status === "Blocked") {
                finalStatus = task.lastActiveStatus || "Pending";
            }
        }

        task.title = title ?? task.title;
        task.description = description ?? task.description;
        task.assignedTo = assignedTo ?? task.assignedTo;
        task.dependsOn = dependsOn;
        task.startDate = startDate ?? task.startDate;
        task.endDate = endDate ?? task.endDate;
        task.allocatedHours = safeAllocatedHours;
        task.status = finalStatus;
        task.category = category ?? task.category;

        await task.save();

        res.status(200).json({
            status: "success",
            data: task
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to update task",
            error: err.message
        });
    }
}


exports.deleteTask = async (req, res) => {
    try {
        const managerId = req.user.id;
        const taskId = req.params.id;
        if (req.user.role !== "manager") {
            return res.status(403).json({
                message: "Only managers can delete tasks"
            });
        }


        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }


        const project = await Project.findOne({
            _id: task.projectId,
            managerId
        });

        if (!project) {
            return res.status(403).json({
                message: "You are not allowed to delete this task"
            });
        }

        if (project.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot delete task for a completed project"
            });
        }

        const dependentTasks = await Task.find({
            dependsOn: taskId
        });

        if (dependentTasks.length > 0) {
            return res.status(400).json({
                message: "Cannot delete task because other tasks depend on it"
            });
        }


        await Task.findByIdAndDelete(taskId);

        res.status(200).json({
            status: "success",
            message: "Task deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to delete task",
            error: err.message
        });
    }
};
exports.getTaskDetails = async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId)
            .populate("projectId", "name")
            .populate("sprintId", "name")
            .populate("assignedTo", "name")

            .populate("dependsOn", "title");

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }


        const response = {
            _id: task._id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority || "Normal",
            allocatedHours: task.allocatedHours || null,

            startDate: task.startDate,
            dueDate: task.endDate,
            actualStartDate: task.actualStartDate || null,
            actualEndDate: task.actualEndDate || null,

            projectName: task.projectId?.name || "N/A",
            sprintName: task.sprintId?.name || "N/A",


            assignedEmployeeName: task.assignedTo?.name || "Unassigned",

            dependencies: task.dependsOn?.map(dep => ({
                dependsOnTaskTitle: dep.title
            })) || []
        };

        res.status(200).json({
            status: "success",
            data: response
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to fetch task details",
            error: err.message
        });
    }
};


exports.removeTaskFromSprint = async (req, res) => {
    try {
        const { taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                status: "fail",
                message: "Task not found"
            });
        }


        if (!task.sprintId) {
            return res.status(400).json({
                status: "fail",
                message: "Task is not assigned to any sprint"
            });
        }

        const sprint = await Sprint.findById(task.sprintId);
        if (!sprint) {
            return res.status(404).json({
                status: "fail",
                message: "Associated sprint not found"
            });
        }

        const project = await Project.findById(task.projectId);


        if (project.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot modify tasks of a completed project"
            });
        }


        if (sprint.status === "Completed") {
            return res.status(400).json({
                status: "fail",
                message: "Cannot remove tasks from a completed sprint"
            });
        }


        if (
            req.user.role === "manager" &&
            project.managerId.toString() !== req.user.id
        ) {
            return res.status(403).json({
                status: "fail",
                message: "You are not allowed to modify this task"
            });
        }


        task.sprintId = null;
        await task.save();

        res.status(200).json({
            status: "success",
            message: "Task removed from sprint successfully",
            data: task
        });

    } catch (err) {
        res.status(500).json({
            status: "fail",
            message: "Failed to remove task from sprint",
            error: err.message
        });
    }
};


const ALLOWED_TRANSITIONS = {
    "Pending": ["In Progress"],
    "In Progress": ["Testing"],
    "Testing": ["Completed", "In Progress"],
    "Completed": []
};

exports.updateTaskStatus = async (req, res) => {
    const { id: taskId } = req.params;
    const { status: newStatus, manualHours = 0 } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
        return res.status(404).json({ message: "Task not found" });
    }

    const currentStatus = task.status;


    if (currentStatus === newStatus) {
        return res.status(400).json({
            message: "Task is already in this status"
        });
    }


    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
        return res.status(400).json({
            message: `Invalid status transition from ${currentStatus} to ${newStatus}`
        });
    }

      if (currentStatus === "Pending" && newStatus === "In Progress") {
        if (!task.actualStartDate) {
            task.actualStartDate = new Date();
        }
    }

   
    if (currentStatus === "In Progress" && newStatus === "Completed") {
        if (!task.actualEndDate) {
            task.actualEndDate = new Date();
        }
    }



    if (task.dependsOn && task.dependsOn.length > 0) {
        const pendingDeps = await Task.find({
            _id: { $in: task.dependsOn },
            status: { $ne: "Completed" }
        }).select("title status");

        if (pendingDeps.length > 0) {
            return res.status(400).json({
                message: "Cannot move task. All dependent tasks must be completed first.",
                pendingDependencies: pendingDeps.map(t => ({
                    id: t._id,
                    title: t.title,
                    status: t.status
                }))
            });
        }
    }

    if (manualHours < 0 || manualHours > 24) {
        return res.status(400).json({
            message: "manualHours must be between 0 and 24"
        });
    }


    await TaskStatusHistory.create({
        taskId: task._id,
        projectId: task.projectId,
        sprintId: task.sprintId || null,
        fromStatus: currentStatus,
        toStatus: newStatus,
        manualHours,
        changedBy: req.user.id
    });


    task.status = newStatus;
    await task.save();
    if (newStatus === "Completed") {
        const dependentTasks = await Task.find({
            dependsOn: task._id,
            status: "Blocked"
        });

        for (const depTask of dependentTasks) {
            const stillPending = await Task.find({
                _id: { $in: depTask.dependsOn },
                status: { $ne: "Completed" }
            });

            if (stillPending.length === 0) {
                const oldStatus = depTask.status;
                depTask.status = "Pending"; // or "Pending"
                await depTask.save();

                await TaskStatusHistory.create({
                    taskId: depTask._id,
                    projectId: depTask.projectId,
                    sprintId: depTask.sprintId || null,
                    fromStatus: oldStatus,
                    toStatus: "Pending",
                    manualHours: 0,
                    changedBy: req.user.id
                });
            }
        }
    }


    res.status(200).json({
        message: "Task status updated successfully"
    });
};

exports.getKanbanTasks = async (req, res) => {
    try {
        const { projectId } = req.params;

        let filter = { projectId };


        if (req.user.role === "employee") {
            const employee = await Employee.findOne({ userId: req.user.id });
            if (!employee) {
                return res.status(404).json({ message: "Employee not found" });
            }
            filter.assignedTo = employee._id;
        }

        const tasks = await Task.find(filter)
            .populate("assignedTo", "name")
            .select("title status priority endDate assignedTo category changeRequestId")


            .sort({ createdAt: 1 });

        res.status(200).json({
            status: "success",
            tasks
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Failed to fetch kanban tasks",
            error: err.message
        });
    }
};
