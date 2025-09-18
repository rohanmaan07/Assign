import React from 'react'
import Interview from './component/Interview'
import Admin from './component/Admin';
import InterviewDetail from './component/InterviewDetail';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Interview />} />
        {/* Admin Routes */}
        <Route path="/admin" element={<Admin />} />
        <Route path="/interview/:id" element={<InterviewDetail />} />
      </Routes>
    </div>
  );
}

export default App