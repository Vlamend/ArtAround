import mongoose from "mongoose";

const VisitSchema = new mongoose.Schema({
  title: String,
  items: [String]
});

export default mongoose.model("Visit", VisitSchema);
