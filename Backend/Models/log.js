const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  candidateName: {
    type: String,
    required: true,
    default: 'TestUser'
  },
  eventType: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
    required: true
  }
});

module.exports = mongoose.model('Log', LogSchema);