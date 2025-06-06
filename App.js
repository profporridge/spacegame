import React from 'react';

function App() {
  return (
    <React.Fragment>
      <div id="dragImage"></div>
      <div id="pageContainer">
        <h1>2D Spacecraft - Modular (V9.1s)</h1>

        <div id="gameAndUiContainer">
          <div id="shipBuilderPanel">
            <div id="partPalette">
              <h3>Part Palette</h3>
              <div className="part-category">
                <button className="part-button" draggable="true" data-part-type="pod" data-part-name="Std. Pod">Command Pod</button>
                <button className="part-button" draggable="true" data-part-type="tank" data-part-name="Med. Tank">Fuel Tank (M)</button>
                <button className="part-button" draggable="true" data-part-type="engine" data-part-name="Main Engine">Main Engine</button>
                <button className="part-button" draggable="true" data-part-type="fairing" data-part-name="Payload Fairing">Fairing</button>
              </div>
            </div>
            <div id="stagingArea">
              <h3>Staging Area</h3>
              <canvas id="stagingCanvas"></canvas>
            </div>
            <div id="stagingStats">
              <h4>Current Build</h4>
              <p>Total Mass: <span id="stagingMass">0.00</span> kg</p>
              <p>Total Thrust: <span id="stagingThrust">0.00</span> N</p>
              <p>Total Δv (Vac): <span id="stagingDeltaV">0.00</span> m/s</p>
            </div>
            <div id="builderActions">
              <button id="undoLastPartButton">Undo Part</button>
              <button id="clearStagingButton">Clear All</button>
            </div>
            <div id="builderActions">
              <button id="launchCurrentBuildButton" style={{ width: '100%' }}>Launch This Build!</button>
            </div>
            <div id="designSelectorContainer">
              <label htmlFor="designSelect">Load Template: </label>
              <select id="designSelect"></select>
            </div>
          </div>

          <div id="leftPanel">
            <div id="mainContainer">
              <canvas id="gameCanvas"></canvas>
              <canvas id="insetCanvas"></canvas>
              <div id="uiOverlay">
                <div id="stats" style={{ display: 'none' }}>
                  {/* Stats content will be populated by JS or can be simplified */}
                  <div className="stat-item"><span className="stat-label">Time:</span> <span id="time">0.0</span> s</div>
                  <div className="stat-item"><span className="stat-label">Apoapsis:</span> <span id="apoapsis">0.00</span> m</div>
                  <div className="stat-item"><span className="stat-label">Periapsis:</span> <span id="periapsis">0.00</span> m</div>
                  <div className="stat-item"><span className="stat-label">Angle (World):</span> <span id="angle">0.00</span> deg</div>
                  <div className="stat-item"><span className="stat-label">Gimbal Angle:</span> <span id="gimbal">0.00</span> deg</div>
                  <div className="stat-item"><span className="stat-label">Thrust:</span> <span id="thrust">0.00</span> N</div>
                  <div className="stat-item"><span className="stat-label">Mass:</span> <span id="mass">0.00</span> kg</div>
                  <div className="stat-item"><span className="stat-label">Zoom:</span> <span id="zoomLevel">0.1</span> PPM</div>
                </div>
                <div id="fuelGaugeContainer">
                  <div id="fuelGaugeBar"></div>
                  <span id="fuelText">Fuel: 100%</span>
                </div>
              </div>
            </div>
            <div id="controls">
              <button id="resetButton">Reset Sim</button>
              <button id="muteButton">Mute 🔇</button>
              <div className="control-group">
                <button id="rotateLeftButton" title="Gimbal Left (Q/←)">⬅️ Gimbal</button>
                <button id="rotateRightButton" title="Gimbal Right (E/→)">Gimbal ➡️</button>
              </div>
              <div className="control-group">
                <button id="zoomOutButton" title="Zoom Out (-)">➖ Zoom</button>
                <button id="zoomInButton" title="Zoom In (+)">➕ Zoom</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Crash Notification Modal */}
      <div id="crashModal" className="modal-overlay" style={{ display: 'none' }}>
        <div className="modal-content">
          <h2 className="modal-title">Mission Failed!</h2>
          <p className="modal-message">
            Your spacecraft has crashed. The impact was too severe for the landing gear to handle.
          </p>
          <div className="modal-buttons">
            <button className="modal-button primary" id="restartButton">Try Again</button>
            <button className="modal-button secondary" id="designButton">New Design</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

export default App;
