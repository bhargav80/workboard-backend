const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    budget:{
      type:Number
      },
      allocatedHours:{
        type:Number,
        required:true
      },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true
    },
    startDate: Date,
    endDate: Date,
    actualEndDate:Date,
    createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
    status: {
      type: String,
      enum: ["active", "completed", "on-hold"],
      default: "active"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
