import { Schema } from 'mongoose';

/* --------------------------------------------------
 Sotto-schema condiviso: singolo testo con durata

 Usato da Content (testo su un'opera), Author (bio) e
 Style (descrizione) — stessa identica logica di durata
 (3s/15s/40s/1min/4min) ovunque, così "dimmi di più" /
 "dimmi di meno" funziona allo stesso modo indipendentemente
 da cosa si sta descrivendo.
----------------------------------------------------- */
export const textEntrySchema = new Schema({
  duration: {
    type: String,
    enum: ['3s', '15s', '40s', '1min', '4min'],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false });
