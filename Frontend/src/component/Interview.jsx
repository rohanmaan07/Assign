import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { FaceMesh } from '@mediapipe/face_mesh';

// --- Gaze detection helper function ---
const checkGaze = (landmarks) => {
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  const nose = landmarks[1];
  if (!leftEar || !rightEar || !nose) return false;
  
  const faceSpan = rightEar.x - leftEar.x;
  const noseToLeft = nose.x - leftEar.x;
  const poseRatio = noseToLeft / faceSpan;

  if (poseRatio < 0.3 || poseRatio > 0.7) {
    return true; // User is looking away
  }
  return false; // User is looking center
};

const InterviewScreen = () => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  
  // State management
  const [status, setStatus] = useState('Initializing...');
  const [events, setEvents] = useState([]);
  
  // Use useRef for interviewId to avoid stale state issues in callbacks
  const interviewIdRef = useRef(null);
  
  // Model states
  const [faceMeshModel, setFaceMeshModel] = useState(null);
  const [objectModel, setObjectModel] = useState(null);
  
  // Refs for timers and flags
  const noFaceTimer = useRef(null);
  const lookingAwayTimer = useRef(null);
  const [multiFaceFlagged, setMultiFaceFlagged] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const isDetectingObjects = useRef(false);

  // --- Main Functions ---

  // 1. Flags an event, updates UI, and sends log to the backend
  const flagEvent = async (eventType) => {
    if (!interviewIdRef.current) return;

    console.log("FLAGGING EVENT:", eventType);
    const newEvent = { time: new Date().toLocaleTimeString(), event: eventType };
    setEvents(prevEvents => [newEvent, ...prevEvents]);

    try {
      await axios.post('/api/log', { 
        eventType, 
        interviewId: interviewIdRef.current 
      });
      console.log('Event logged to backend:', eventType);
    } catch (err) {
      console.error("Error logging event to backend:", err);
    }
  };

  // 2. Loads the CV/ML models
  const loadModels = async () => {
    setStatus('Loading CV Models...');
    try {
      await tf.ready();
      const loadedObjectModel = await cocoSsd.load({ base: 'mobilenet_v2' });
      setObjectModel(loadedObjectModel);
      console.log('COCO-SSD Model Loaded');

      const loadedFaceMeshModel = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      loadedFaceMeshModel.setOptions({
        maxNumFaces: 5,
        refineLandmarks: true, 
        minDetectionConfidence: 0.5,
      });
      loadedFaceMeshModel.onResults(onFaceMeshResults);
      setFaceMeshModel(loadedFaceMeshModel);
      console.log('MediaPipe Face Mesh Model Loaded');

      setStatus('Models Loaded. Camera ON.');
    } catch (err) {
      console.error("Error loading models:", err);
      setStatus('ERROR: Could not load CV models.');
    }
  };

  // --- Callbacks for Detection Results ---

  // 3. Handles results from the MediaPipe Face Mesh model
  const onFaceMeshResults = (results) => {
    const faces = results.multiFaceLandmarks;

    // No Face logic
    if (!faces || faces.length === 0) {
      if (!noFaceTimer.current) {
        noFaceTimer.current = setTimeout(() => {
          flagEvent('NO_FACE_DETECTED (10s)');
          noFaceTimer.current = null; 
        }, 10000);
      }
    } else {
      if (noFaceTimer.current) clearTimeout(noFaceTimer.current);
      noFaceTimer.current = null;
    }

    // Multi-face logic
    if (faces && faces.length > 1) {
      if (!multiFaceFlagged) {
        flagEvent('MULTIPLE_FACES_DETECTED');
        setMultiFaceFlagged(true); 
      }
    } else {
      if (multiFaceFlagged) setMultiFaceFlagged(false); 
    }
    
    // Gaze logic
    if (faces && faces.length === 1) {
      const isLookingAway = checkGaze(faces[0]);
      if (isLookingAway) {
        if (!lookingAwayTimer.current) {
          lookingAwayTimer.current = setTimeout(() => {
            flagEvent('LOOKING_AWAY (5s)');
            lookingAwayTimer.current = null;
          }, 5000);
        }
      } else {
        if (lookingAwayTimer.current) clearTimeout(lookingAwayTimer.current);
        lookingAwayTimer.current = null;
      }
    } else {
      if (lookingAwayTimer.current) clearTimeout(lookingAwayTimer.current);
      lookingAwayTimer.current = null;
    }
  };

  // 4. Handles results from the TensorFlow.js COCO-SSD model
  const handleObjectDetections = (predictions) => {
    console.log("Detection Results:", predictions);
    const detectedClasses = new Set(predictions.map(p => p.class));

    if (detectedClasses.has('cell phone')) flagEvent('PHONE_DETECTED');
    if (detectedClasses.has('book')) flagEvent('BOOK_DETECTED');
    if (detectedClasses.has('laptop') || detectedClasses.has('tv')) flagEvent('EXTRA_DEVICE_DETECTED');
  };

  // --- React Hooks ---

  // 5. useEffect to start the interview process on component mount
  useEffect(() => {
    const startInterview = async () => {
      try {
        const res = await axios.post('/api/interview/start', { candidateName: 'TestUser' });
        interviewIdRef.current = res.data._id; // Set the ref value

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: true 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            loadModels(); 
            startRecording(stream);
          };
        }
      } catch (err) {
        console.error("Could not start interview:", err);
        setStatus('ERROR: Could not start interview.');
      }
    };
    
    startInterview();
    
    return () => { // Cleanup function when component unmounts
      stopRecording();
    }
  }, []); 

  // 6. useEffect to run detection loops after models are loaded
  useEffect(() => {
    const faceDetectionInterval = setInterval(() => {
      if (faceMeshModel && videoRef.current?.readyState === 4) {
        faceMeshModel.send({ image: videoRef.current });
      }
    }, 500);

    const objectDetectionInterval = setInterval(async () => {
      if (objectModel && videoRef.current?.readyState === 4 && !isDetectingObjects.current) {
        isDetectingObjects.current = true;
        try {
          const predictions = await objectModel.detect(videoRef.current, 20, 0.4);
          handleObjectDetections(predictions);
        } catch (err) {
          console.error("Object detection error:", err);
        } finally {
          isDetectingObjects.current = false;
        }
      }
    }, 5000);

    return () => {
      clearInterval(faceDetectionInterval);
      clearInterval(objectDetectionInterval);
    };
  }, [faceMeshModel, objectModel]); 

  
  // --- Video Recording Functions --- 
  const uploadVideo = async (videoBlob) => {
    console.log('Uploading video...');
    setStatus('Uploading video...');
    const formData = new FormData();
    formData.append('video', videoBlob, 'candidate-recording.webm');
    formData.append('interviewId', interviewIdRef.current); 

    try {
      await axios.post('/api/upload-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Video uploaded successfully!');
      setStatus('Video Uploaded. Redirecting to report...');
      navigate(`/interview/${interviewIdRef.current}`);
    } catch (err) {
      console.error('Error uploading video:', err);
      setStatus('ERROR: Could not upload video.');
    }
  };

  const startRecording = (stream) => {
    recordedChunksRef.current = [];
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    mediaRecorderRef.current.onstop = () => {
      console.log('Recording stopped. Creating blob...');
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      uploadVideo(videoBlob);
    };
    mediaRecorderRef.current.start();
    console.log('Recording started');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('Recording stopped');
    }
  };

  // --- JSX for UI ---
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6">Proctoring Interview Screen</h1>
      
      <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-2xl overflow-hidden relative">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          width="640"
          height="480"
          className="w-full h-auto"
        />
      </div>

      <div className="mt-4">
        <button 
          onClick={stopRecording}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Stop Interview & Save Recording
        </button>
      </div>

      <div className="mt-6 w-full max-w-3xl p-4 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-2">Live Status</h2>
        <p className={`text-lg ${status.includes('ERROR') ? 'text-red-400' : 'text-green-400'}`}>
          {status}
        </p>
      </div>

      <div className="mt-4 w-full max-w-3xl p-4 bg-gray-700 rounded-lg shadow-lg" style={{ height: '200px', overflowY: 'auto' }}>
        <h3 className="text-lg font-semibold">Detected Events (Log):</h3>
        <ul className="mt-2 text-yellow-300">
          {events.length === 0 ? (
            <li className="text-gray-400">No events detected yet.</li>
          ) : (
            events.map((event, index) => (
              <li key={index}>
                <span className="font-bold">{event.time}</span>: {event.event}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default InterviewScreen;