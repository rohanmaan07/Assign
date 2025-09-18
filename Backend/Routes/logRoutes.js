// server/routes/logRoutes.js
const express = require('express');
const router = express.Router();
const Log = require('../Models/log'); // CORRECTED PATH & CASING
const upload = require('../Middlewares/multer'); // CORRECTED PATH & CASING
const cloudinary = require('../cloudinary');
const Interview = require('../Models/Interview');
// ... (Baaki saara route code waisa hi rahega)

// --- API 1: Naya Interview Start Karein ---
router.post('/interview/start', async (req, res) => {
  try {
    const { candidateName } = req.body;
    const newInterview = new Interview({ candidateName });
    await newInterview.save();
    // Frontend ko naye interview ki ID bhejein
    res.status(201).json(newInterview);
  } catch (err) {
    console.error("Error starting interview:", err.message);
    res.status(500).send('Server Error');
  }
});
// --- API 2: Event ko Log karein (Updated) ---
router.post('/log', async (req, res) => {
  try {
    // Ab frontend se interviewId bhi aayega
    const { eventType, interviewId } = req.body;
    if (!eventType || !interviewId) {
      return res.status(400).json({ msg: 'Event type and interviewId are required' });
    }

    const newLog = new Log({ eventType, interview: interviewId });
    await newLog.save();

    // Log ko parent Interview document mein bhi add karein
    await Interview.findByIdAndUpdate(interviewId, { $push: { logs: newLog._id } });

    res.status(201).json(newLog);
  } catch (err) {
    console.error("Error in /api/log:", err.message);
    res.status(500).send('Server Error');
  }
});

// --- API 3: Video Upload Karein (Updated) ---
router.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    // Ab frontend se interviewId bhi aayega
    const { interviewId } = req.body;
    if (!req.file || !interviewId) {
      return res.status(400).json({ msg: 'No video file or interviewId' });
    }

    cloudinary.uploader.upload_stream(
      { resource_type: 'video', folder: 'proctoring_videos' },
      async (error, result) => {
        if (error) {
          return res.status(500).json({ msg: 'Error uploading to Cloudinary' });
        }
        
        // Video URL ko Interview document mein save karein
        await Interview.findByIdAndUpdate(interviewId, {
          recordingUrl: result.secure_url,
          endTime: Date.now()
        });

        res.status(201).json({ url: result.secure_url });
      }
    ).end(req.file.buffer);
  } catch (err) {
    console.error("Error in /api/upload-video:", err.message);
    res.status(500).send('Server Error');
  }
});
// --- API 4: Admin ke liye saare Interviews laayein ---
router.get('/interviews', async (req, res) => {
  try {
    const interviews = await Interview.find().sort({ startTime: -1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});


// --- API 5: Ek single Interview ki poori detail laayein ---
router.get('/interview/:id', async (req, res) => {
  try {
    // .populate('logs') saare logs ki detail bhi le aayega
    const interview = await Interview.findById(req.params.id).populate('logs');
    if (!interview) {
      return res.status(404).json({ msg: 'Interview not found' });
    }
    // Yahaan score on-the-fly calculate hoga
    let integrityScore = 100;
    interview.logs.forEach(log => {
        switch (log.eventType) {
            case 'PHONE_DETECTED': integrityScore -= 10; break;
            case 'BOOK_DETECTED': integrityScore -= 5; break;
            case 'LOOKING_AWAY (5s)': integrityScore -= 2; break;
            case 'NO_FACE_DETECTED (10s)': integrityScore -= 5; break;
            case 'MULTIPLE_FACES_DETECTED': integrityScore -= 15; break;
            default: break;
        }
    });
    if (integrityScore < 0) integrityScore = 0;
    interview.integrityScore = integrityScore;

    res.json(interview);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});


module.exports = router;