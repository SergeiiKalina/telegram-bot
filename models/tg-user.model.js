const { Schema, model } = require('mongoose');

const TgUserSchema = new Schema({
    name: { type: String },
    tgId: { type: String },
    lastConnect: { type: Date, default: Date.now }
})

TgUserSchema.post('findOne', async function (doc) {
    if (doc) {
        doc.lastConnect = new Date();
        await doc.save();
    }
});

module.exports = model('TgUser', TgUserSchema)