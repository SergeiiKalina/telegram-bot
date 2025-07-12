const { Schema, model } = require('mongoose');

const sliderSchema = new Schema({
  img: { type: String },
  alt: { type: String },
});

module.exports = model('Slide', sliderSchema);
