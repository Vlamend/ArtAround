import mongoose from "mongoose";

mongoose.connect("mongodb://mongo:27017/museum", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB connected");
}).catch(err => {
  console.error("Mongo connection error:", err);
});
