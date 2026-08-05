import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Dynamic Island pill */}
    <div className="dynamic-island" />
    {/* Screen content */}
    <div className="phone-screen">
      <App />
    </div>
  </React.StrictMode>,
)
