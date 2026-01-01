const Project = require('../models/project');
const User = require("../models/Users");
const Task = require("../models/task");
const Sprint = require("../models/sprint");
const Employee = require("../models/Employees");
const calculateAvailableHours = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) return 0;
  const diffInMs = end - start;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;

  return diffInDays * 7;
};


exports.getProjects = async (req, res) => {
  try {
    //console.log("USER:", req.user);

    let filter = {};


    if (req.user.role === "manager") {
      filter.managerId = req.user._id;
    }

    const projects = await Project.find(filter)
      .populate("managerId", "username email",)
      .populate("createdBy", "email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: projects.length,
      data: projects
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: err.message
    });
  }
};



exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      managerId,
      status,
      startDate,
      endDate, budget, allocatedHours
    } = req.body;


    if (!name || !managerId) {
      return res.status(400).json({
        status: "fail",
        message: "Project name and managerId are required"
      });
    }


    const manager = await User.findById(managerId);
    if (!manager || manager.role !== "manager") {
      return res.status(400).json({
        status: "fail",
        message: "managerId must belong to a valid manager"
      });
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

    const project = await Project.create({
      name,
      description,
      managerId,
      status,
      startDate,
      endDate, budget, allocatedHours,
      createdBy: req.user.id
    });

    res.status(201).json({
      status: "success",
      data: project
    });

  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: "Failed to create project",
      error: err.message
    });
  }
};


exports.updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;


    const project = await Project.findOne({
      _id: projectId,
      //isDeleted: false
    });

    if (!project) {
      return res.status(404).json({
        status: "fail",
        message: "Project not found"
      });
    }

    const { managerId, startDate, endDate, allocatedHours, budget } = req.body;


    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager || manager.role !== "manager") {
        return res.status(400).json({
          status: "fail",
          message: "managerId must belong to a valid manager"
        });
      }
    }


    const finalStartDate = startDate || project.startDate;
    const finalEndDate = endDate || project.endDate;

    if (finalStartDate && finalEndDate) {
      if (new Date(finalStartDate) > new Date(finalEndDate)) {
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

    if (startDate || endDate) {
      const projectStart = new Date(finalStartDate);
      const projectEnd = new Date(finalEndDate);

      const misalignedSprint = await Sprint.findOne({
        projectId: projectId,
        $or: [
          { startDate: { $lt: projectStart } },
          { endDate: { $gt: projectEnd } }
        ]
      });

      if (misalignedSprint) {
        return res.status(400).json({
          status: "fail",
          message:
            "Project date change would misalign existing sprint dates. Update sprints first."
        });
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: "success",
      data: updatedProject
    });

  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: "Failed to update project",
      error: err.message
    });
  }
};


exports.getProjectDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id)
      .populate("managerId", "username email")
      .populate("createdBy", "email");

    if (!project) {
      return res.status(404).json({
        status: "fail",
        message: "Project not found"
      });
    }


    const tasks = await Task.find({ projectId: id })
      .select("title status priority dueDate")
      .sort({ createdAt: 1 });


    const sprints = await Sprint.find({ projectId: id })
      .select("name startDate endDate status")
      .sort({ startDate: 1 });


    res.status(200).json({
      status: "success",
      data: {
        ...project.toObject(),
        tasks,
        sprints
      }
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch project details",
      error: err.message
    });
  }
};


exports.deleteProject = async (req, res) => {
  const projectId = req.params.id;

  const project = await Project.findById(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }


  await Task.deleteMany({ projectId });
  await Sprint.deleteMany({ projectId });

  await Project.findByIdAndDelete(projectId);

  res.status(200).json({
    status: "success",
    message: "Project and related tasks deleted"
  });
};


exports.getMyProjects = async (req, res) => {
  try {
    
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee profile not found"
      });
    }

    
    const projectIds = await Task.distinct("projectId", {
      assignedTo: employee._id
    });

    const projects = await Project.find({
      _id: { $in: projectIds }
    })
      .select("name description status createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: projects.length,
      data: projects
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: err.message
    });
  }
};

exports.getProjectSummary = async (req, res) => {
  const { id } = req.params;

  const project = await Project.findById(id).select("name status");
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  
  if (req.user.role === "employee") {
    const employee = await Employee.findOne({ userId: req.user.id });

    const hasTask = await Task.exists({
      projectId: id,
      assignedTo: employee._id
    });

    if (!hasTask) {
      return res.status(403).json({
        message: "You are not assigned to this project"
      });
    }
  }

  res.status(200).json({
    status: "success",
    data: project
  });
};

