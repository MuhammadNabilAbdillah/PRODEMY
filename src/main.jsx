import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './portal.css';
import './responsive.css';
import { watchTableLabels } from './lib/tableLabels';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

watchTableLabels();
