const { Schema, model } = require('mongoose');

const coachSchema = new Schema({
  name: { type: String },
  jobTitle: { type: String },
  img: { type: String },
  linkOnForm: { type: String },
  experience: { type: String },
});

module.exports = model('Coach', coachSchema);
