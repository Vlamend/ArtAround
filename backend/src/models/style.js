import { Schema, model } from 'mongoose';
import { textEntrySchema } from './textEntry.js';

/* --------------------------------------------------
 Style

 Rappresenta uno stile/movimento artistico (es. Manierismo).
 Riusabile tra più Artwork: lo stesso stile ricorre in tante
 opere, anche di musei diversi.
----------------------------------------------------- */
const styleSchema = new Schema({
  name: { type: String, required: true, trim: true },

  description: {
    type: [textEntrySchema],
    default: []
  },

  period: { type: String, default: '' } // es. "XVI secolo"
}, { timestamps: true });

styleSchema.index({ name: 1 });

export default model('Style', styleSchema);
