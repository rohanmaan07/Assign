// client/src/components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Admin = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        const res = await axios.get('/api/interviews');
        setInterviews(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchInterviews();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-6 text-center">Admin Dashboard</h1>
      <div className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl mb-4">All Interviews</h2>
        <ul className="divide-y divide-gray-700">
          {interviews.map(interview => (
            <li key={interview._id} className="py-3">
              <Link to={`/interview/${interview._id}`} className="hover:text-blue-400">
                <p className="font-bold">{interview.candidateName}</p>
                <p className="text-sm text-gray-400">
                  Started on: {new Date(interview.startTime).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Admin;