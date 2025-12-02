import mongoose from "mongoose";

const VisitSchema = new mongoose.Schema({
  museumId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Museum",
  required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  itemsSeen: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  }],
  date: { type: Date, default: Date.now }
});

export default mongoose.model("Visit", VisitSchema);
