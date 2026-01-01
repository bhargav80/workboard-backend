const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null 
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee"
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    status: {
      type: String,
      enum: ["Blocked", "Pending", "In Progress", "Testing", "Completed"],
      default: "Pending"
    },
    startDate: Date,
    endDate: Date,
    actualStartDate: Date,
    actualEndDate: Date,
    allocatedHours:Number,
    createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true
},
dependsOn: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task"
  }
]

  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
