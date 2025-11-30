import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  objectId: String,
  textShort: String,
  textMedium: String,
  textLong: String
});

export default mongoose.model("Item", ItemSchema);
