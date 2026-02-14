import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Datasets from './pages/Datasets';
import Results from './pages/Results';
import Settings from './pages/Settings';
import Playground from './pages/Playground';
import Comparison from './pages/Comparison';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/results" element={<Results />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/compare" element={<Comparison />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
