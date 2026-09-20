import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Bench } from './pages/Bench';
import { Demo } from './pages/Demo';
import { Join } from './pages/Join';
import { Landing } from './pages/Landing';
import { Play } from './pages/Play';
import { Standard } from './pages/Standard';

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/play" element={<Play />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/standard" element={<Standard />} />
      <Route path="/hardware" element={<Standard doc="hardware" />} />
      <Route path="/bench" element={<Bench />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
