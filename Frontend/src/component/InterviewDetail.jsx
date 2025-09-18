// client/src/components/InterviewDetail.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const InterviewDetail = () => {
  const [interview, setInterview] = useState(null);
  // --- FIX 1: Add dedicated loading and error states ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // ----------------------------------------------------
  
  const { id } = useParams();
  const reportRef = useRef(null);

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        setLoading(true); // Loading start
        setError(''); // Clear previous errors
        
        const res = await axios.get(`/api/interview/${id}`);
        setInterview(res.data);

      } catch (err) {
        setError('Could not fetch the report. The interview ID might be invalid or the server is down.');
        console.error("Error fetching report:", err);
      } finally {
        setLoading(false); // Loading finish (chahe success ho ya error)
      }
    };

    fetchInterview();
  }, [id]);

  // Function to download report as PDF
  const handleDownloadPdf = () => {
    const input = reportRef.current;
    if (input) {
      html2canvas(input, { scale: 2 })
        .then((canvas) => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`proctoring-report-${interview.candidateName}-${id}.pdf`);
        });
    }
  };

  // --- FIX 3: Add a helper function for score color ---
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-500';
  };
  // ----------------------------------------------------

  // --- Better Loading and Error UI ---
  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center text-xl">Loading Report...</div>;
  }
  if (error) {
    return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center text-xl text-red-400">{error}</div>;
  }
  if (!interview) {
    return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center text-xl">No report data found.</div>;
  }
  // -------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div ref={reportRef} className="p-4"> {/* Inner div for PDF capture */}
        <h1 className="text-4xl font-bold mb-6 text-center">Proctoring Report</h1>
        <h2 className="text-2xl text-gray-400 mb-8 text-center">Candidate: {interview.candidateName}</h2>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h3 className="text-xl font-semibold mb-4">Final Integrity Score</h3>
            <p className={`text-7xl font-bold text-center ${getScoreColor(interview.integrityScore)}`}>
              {interview.integrityScore} / 100
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h3 className="text-xl font-semibold mb-4">Event Breakdown</h3>
            {/* Logic to create breakdown from logs */}
            {/* This is a more robust way to display the summary */}
            <ul className="space-y-2">
                <li className="flex justify-between">Phone Detections: <span className="font-bold text-red-400">{interview.logs.filter(l => l.eventType === 'PHONE_DETECTED').length}</span></li>
                <li className="flex justify-between">Multiple Face Detections: <span className="font-bold text-red-400">{interview.logs.filter(l => l.eventType === 'MULTIPLE_FACES_DETECTED').length}</span></li>
                <li className="flex justify-between">Book Detections: <span className="font-bold text-yellow-400">{interview.logs.filter(l => l.eventType === 'BOOK_DETECTED').length}</span></li>
                <li className="flex justify-between">No Face Detections: <span className="font-bold text-yellow-400">{interview.logs.filter(l => l.eventType.startsWith('NO_FACE')).length}</span></li>
                <li className="flex justify-between">Looking Away Detections: <span className="font-bold text-yellow-400">{interview.logs.filter(l => l.eventType.startsWith('LOOKING_AWAY')).length}</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="md:col-span-2 bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Recorded Video</h2>
            {interview.recordingUrl ? (
              <video src={interview.recordingUrl} controls className="w-full rounded-lg"></video>
            ) : (
              <p className="text-gray-400">Video is still processing or was not recorded.</p>
            )}
          </div>
          <div className="md:col-span-1 bg-gray-800 p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Raw Event Log</h3>
            <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
              <ul className="text-sm text-yellow-300 space-y-1">
                {/* --- FIX 2: Handle empty logs case --- */}
                {interview.logs.length === 0 ? (
                  <li className="text-gray-400">No suspicious events were detected.</li>
                ) : (
                  interview.logs.map(log => (
                    <li key={log._id}>
                      <span className="font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>: {log.eventType}
                    </li>
                  ))
                )}
                {/* -------------------------------------- */}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto text-center mt-6">
          <button 
            onClick={handleDownloadPdf}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Download Report as PDF
          </button>
      </div>

    </div>
  );
};

export default InterviewDetail;