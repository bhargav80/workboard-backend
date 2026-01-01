const mongoose = require("mongoose");

const taskStatusHistorySchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
    },
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
    fromStatus: {
        type: String,
        enum: ["Blocked", "Pending", "In Progress", "Testing", "Completed"],
        required: true
    },
    toStatus: {
        type: String,
        enum: ["Blocked", "Pending", "In Progress", "Testing", "Completed"],
        required: true
    }, manualHours: {
        type: Number,
        min: 0,
        max: 24,
        default: 0
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    changedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
})

module.exports = mongoose.model("TaskStatusHistory", taskStatusHistorySchema);