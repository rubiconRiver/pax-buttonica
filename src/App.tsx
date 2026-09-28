import { useLayoutEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Bench } from './pages/Bench';
import { ButtonConcept } from './pages/ButtonConcept';
import { Demo } from './pages/Demo';
import { Join } from './pages/Join';
import { Me } from './pages/Me';
import { Parts } from './pages/Parts';
import { Landing } from './pages/Landing';
import { Play } from './pages/Play';
import { Standard } from './pages/Standard';

export function App() {
  const { pathname } = useLocation();
  // A new page starts at the top: before it paints, and without the browser putting the old scroll position back.
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/play" element={<Play />} />
      <Route path="/me" element={<Me />} />
      <Route path="/parts" element={<Parts />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/standard" element={<Standard />} />
      <Route path="/hardware" element={<Standard doc="hardware" />} />
      <Route path="/button" element={<ButtonConcept />} />
      <Route path="/bench" element={<Bench />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
