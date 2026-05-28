import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Experiments from './pages/Experiments';
import NewRun from './pages/NewRun';
import RunLive from './pages/RunLive';
import RunReport from './pages/RunReport';
import Datasets from './pages/Datasets';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Experiments />} />
          <Route path="/new" element={<NewRun />} />
          <Route path="/runs/:id/live" element={<RunLive />} />
          <Route path="/runs/:id" element={<RunReport />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
