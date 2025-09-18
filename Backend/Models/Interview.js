const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
  candidateName: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  integrityScore: { type: Number, default: 100 },
  recordingUrl: { type: String, default: '' },
  logs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Log'
  }]
});

module.exports = mongoose.model('Interview', InterviewSchema);