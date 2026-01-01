const mongoose = require("mongoose");

const sprintSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    actualEndDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ["Planned","Active","Completed","Expired"],
      default: "Planned"
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sprint", sprintSchema);
