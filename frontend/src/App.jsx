import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function App() {
  // Database/API States
  const [slots, setSlots] = useState({
    bike: { total: 5, available: 5 },
    car: { total: 5, available: 5 },
    truck: { total: 2, available: 2 }
  });
  const [parkedVehicles, setParkedVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [parkNumber, setParkNumber] = useState('');
  const [parkType, setParkType] = useState('car');
  const [parkSimHours, setParkSimHours] = useState(0); // 0 = Now, 2 = 2 hrs ago, 5 = 5 hrs ago, 8 = 8 hrs ago

  const [exitQuery, setExitQuery] = useState('');

  // active output ticket / receipt
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Notification State
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  // Fetch initial data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [slotsRes, parkedRes] = await Promise.all([
        fetch(`${API_URL}/api/slots`),
        fetch(`${API_URL}/api/parked`)
      ]);

      if (slotsRes.ok && parkedRes.ok) {
        const slotsData = await slotsRes.json();
        const parkedData = await parkedRes.json();
        setSlots(slotsData);
        setParkedVehicles(parkedData);
      } else {
        showToast('Failed to sync dashboard stats with server', 'error');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Cannot connect to backend server. Make sure it is running.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Park submit handler
  const handleParkSubmit = async (e) => {
    e.preventDefault();
    if (!parkNumber.trim()) {
      showToast('Please enter a vehicle license plate number', 'error');
      return;
    }

    // Calculate simulated entry time
    let entryTime = new Date().toISOString();
    if (parkSimHours > 0) {
      const mockMs = Date.now() - parkSimHours * 60 * 60 * 1000;
      entryTime = new Date(mockMs).toISOString();
    }

    try {
      const response = await fetch(`${API_URL}/api/park`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleNumber: parkNumber.trim(),
          vehicleType: parkType,
          entryTime
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(`Vehicle ${data.ticket.vehicleNumber} parked successfully!`, 'success');
        setActiveTicket(data.ticket);
        setActiveReceipt(null); // Clear receipt when generating new ticket
        setParkNumber(''); // Clear form
        setParkSimHours(0); // Reset simulation hours
        fetchDashboardData(); // Refresh slots and parked list
      } else {
        showToast(data.message || 'Failed to park vehicle', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Error communicating with park server', 'error');
    }
  };

  // Exit submit handler
  const handleExitSubmit = async (e) => {
    e.preventDefault();
    if (!exitQuery.trim()) {
      showToast('Please enter a Ticket ID or License Plate Number', 'error');
      return;
    }

    try {
      const payload = {};
      const query = exitQuery.trim().toUpperCase();
      if (query.startsWith('TKT-')) {
        payload.ticketId = query;
      } else {
        payload.vehicleNumber = query;
      }

      const response = await fetch(`${API_URL}/api/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(`Vehicle ${data.receipt.vehicleNumber} checked out!`, 'success');
        setActiveReceipt(data.receipt);
        setActiveTicket(null); // Clear ticket when receipt is active
        setExitQuery(''); // Clear form
        fetchDashboardData(); // Refresh slots and parked list
      } else {
        showToast(data.message || 'Vehicle not found or already exited', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Error communicating with exit server', 'error');
    }
  };

  // Handler to quick-fill exit query from the table
  const handleQuickExit = (identifier) => {
    setExitQuery(identifier);
    // Scroll smoothly to checkout form
    const checkoutCard = document.getElementById('checkout-card');
    if (checkoutCard) {
      checkoutCard.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Format Date string to readable local string
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter parked vehicles based on search bar
  const filteredParkedList = parkedVehicles.filter(v => {
    const query = searchQuery.toLowerCase();
    return (
      v.ticketId.toLowerCase().includes(query) ||
      v.vehicleNumber.toLowerCase().includes(query) ||
      v.vehicleType.toLowerCase().includes(query)
    );
  });

  // Calculate percentage used for donut progress
  const getProgressPercentage = (item) => {
    const used = item.total - item.available;
    return Math.round((used / item.total) * 100);
  };

  // Determine status pill class & text
  const getStatusPillInfo = (avail, total) => {
    if (avail === 0) return { className: 'status-full', text: 'Full' };
    if (avail === 1) return { className: 'status-warning', text: 'Critical' };
    return { className: 'status-available', text: 'Available' };
  };

  return (
    <div className="app-container">
      {/* Toast Alert popup */}
      {toast && (
        <div className={`alert-popup ${toast.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <span style={{ fontSize: '1.2rem' }}>
            {toast.type === 'success' ? '✓' : '⚠'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">P</div>
          <div className="brand-title-group">
            <h1>Parking Valet</h1>
            <p>Smart Parking Space Management System</p>
          </div>
        </div>
        <div className="live-indicator">
          <div className="pulse-dot"></div>
          <span>Server Database Connected</span>
        </div>
      </header>

      {/* Dashboard Grid Layout */}
      <div className="dashboard-grid">
        
        {/* Row 1: Slot Availability Cards */}
        <section className="availability-container">
          {Object.entries(slots).map(([type, data]) => {
            const pct = getProgressPercentage(data);
            const status = getStatusPillInfo(data.available, data.total);
            // Circle parameters
            const radius = 30;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (pct / 100) * circumference;

            return (
              <div key={type} className={`glass-card slot-card ${type}`}>
                <div className="slot-info">
                  <span className="slot-type-label">
                    {type === 'bike' ? '🚴 Bike Slots' : type === 'car' ? '🚗 Car Slots' : '🚚 Truck Slots'}
                  </span>
                  <div className="slot-avail-count">
                    {data.available} <span style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-secondary)' }}>free</span>
                  </div>
                  <div className="slot-total-count">Capacity: {data.total} slots</div>
                  <span className={`slot-status-pill ${status.className}`}>
                    {status.text}
                  </span>
                </div>

                <div className="progress-visualizer">
                  <svg className="progress-circle">
                    <circle className="progress-circle-bg" cx="40" cy="40" r={radius} />
                    <circle 
                      className="progress-circle-bar" 
                      cx="40" 
                      cy="40" 
                      r={radius} 
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="progress-percentage">{pct}%</div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Column A: Interactive Forms */}
        <div className="form-column">
          
          {/* Card: Park Vehicle */}
          <div className="glass-card">
            <h2 className="card-title">
              <span style={{ color: 'var(--primary)' }}>✙</span> Check-In Vehicle
            </h2>
            <form onSubmit={handleParkSubmit}>
              
              {/* License plate input */}
              <div className="form-group">
                <label htmlFor="vehicle-plate">License Plate Number</label>
                <div className="input-wrapper">
                  <span className="input-icon">⚙</span>
                  <input
                    id="vehicle-plate"
                    type="text"
                    className="form-control"
                    placeholder="e.g. KA01AB1234"
                    value={parkNumber}
                    onChange={(e) => setParkNumber(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>

              {/* Vehicle Type Radio Cards */}
              <div className="form-group">
                <label>Vehicle Type</label>
                <div className="vehicle-type-select">
                  <div 
                    className={`type-radio-card ${parkType === 'bike' ? 'active' : ''}`}
                    onClick={() => setParkType('bike')}
                  >
                    <span className="radio-icon">🚴</span>
                    <span className="radio-label">Bike</span>
                  </div>
                  <div 
                    className={`type-radio-card ${parkType === 'car' ? 'active' : ''}`}
                    onClick={() => setParkType('car')}
                  >
                    <span className="radio-icon">🚗</span>
                    <span className="radio-label">Car</span>
                  </div>
                  <div 
                    className={`type-radio-card ${parkType === 'truck' ? 'active' : ''}`}
                    onClick={() => setParkType('truck')}
                  >
                    <span className="radio-icon">🚚</span>
                    <span className="radio-label">Truck</span>
                  </div>
                </div>
              </div>

              {/* Simulation helper */}
              <div className="form-group">
                <label>Simulate Stay Duration (Set Entry Time)</label>
                <div className="simulation-bar">
                  <button 
                    type="button" 
                    className={`btn-sim ${parkSimHours === 0 ? 'active' : ''}`}
                    onClick={() => setParkSimHours(0)}
                  >
                    Current Time (Now)
                  </button>
                  <button 
                    type="button" 
                    className={`btn-sim ${parkSimHours === 2 ? 'active' : ''}`}
                    onClick={() => setParkSimHours(2)}
                  >
                    2 Hours Ago (₹30)
                  </button>
                  <button 
                    type="button" 
                    className={`btn-sim ${parkSimHours === 5 ? 'active' : ''}`}
                    onClick={() => setParkSimHours(5)}
                  >
                    5 Hours Ago (₹85)
                  </button>
                  <button 
                    type="button" 
                    className={`btn-sim ${parkSimHours === 8 ? 'active' : ''}`}
                    onClick={() => setParkSimHours(8)}
                  >
                    8 Hours Ago (₹120)
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
                Generate Ticket & Park
              </button>
            </form>
          </div>

          {/* Card: Exit Vehicle */}
          <div id="checkout-card" className="glass-card">
            <h2 className="card-title">
              <span style={{ color: 'var(--danger)' }}>⚡</span> Check-Out / Exit Lot
            </h2>
            <form onSubmit={handleExitSubmit}>
              <div className="form-group">
                <label htmlFor="exit-search">Ticket ID or Vehicle Number</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔍</span>
                  <input
                    id="exit-search"
                    type="text"
                    className="form-control"
                    placeholder="Enter TKT-1001 or KA01AB1234..."
                    value={exitQuery}
                    onChange={(e) => setExitQuery(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ 
                  background: 'linear-gradient(135deg, var(--danger), #be123c)',
                  boxShadow: '0 4px 15px var(--danger-glow)' 
                }}
              >
                Process Checkout & Bill
              </button>
            </form>
          </div>

        </div>

        {/* Column B: Active Ticket / Receipt Display */}
        <section className="ticket-column">
          <div className="ticket-wrapper">
            
            {/* 1. Show Exit Receipt if available */}
            {activeReceipt && (
              <div className="ticket-receipt-card">
                <div className="ticket-header">
                  <div className="ticket-notch-left"></div>
                  <div className="ticket-notch-right"></div>
                  <div className="ticket-logo-area">
                    <span className="ticket-logo">RECEIPT</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Valet Services</span>
                  </div>
                  <span className="ticket-type-tag" style={{ color: 'var(--danger)' }}>Exited</span>
                </div>
                
                <div className="ticket-body">
                  <div className="ticket-id-large">{activeReceipt.ticketId}</div>
                  
                  <div className="ticket-details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Vehicle Plate</span>
                      <span className="detail-value" style={{ fontSize: '1.05rem', color: '#60a5fa' }}>
                        {activeReceipt.vehicleNumber}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Stay Duration</span>
                      <span className="detail-value">{activeReceipt.durationHours} hrs (rounded)</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Entry Time</span>
                      <span className="detail-value" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {formatTime(activeReceipt.entryTime)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Exit Time</span>
                      <span className="detail-value" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {formatTime(activeReceipt.exitTime)}
                      </span>
                    </div>
                  </div>

                  <div className="ticket-fare-area">
                    <span className="fare-label">Total Amount Paid</span>
                    <span className="fare-amount">₹{activeReceipt.amount}</span>
                  </div>

                  <div className="barcode-sim">
                    <div className="barcode-lines"></div>
                    <div className="barcode-text">TRANSACTION COMPLETED</div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Show Parking Ticket if available */}
            {activeTicket && !activeReceipt && (
              <div className="ticket-receipt-card" style={{ border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                <div className="ticket-header">
                  <div className="ticket-notch-left"></div>
                  <div className="ticket-notch-right"></div>
                  <div className="ticket-logo-area">
                    <span className="ticket-logo" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>PARK TICKET</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Valet Services</span>
                  </div>
                  <span className="ticket-type-tag" style={{ color: 'var(--success)' }}>Parked</span>
                </div>
                
                <div className="ticket-body">
                  <div className="ticket-id-large" style={{ color: 'var(--primary)' }}>{activeTicket.ticketId}</div>
                  
                  <div className="ticket-details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Vehicle Plate</span>
                      <span className="detail-value" style={{ fontSize: '1.05rem', color: '#34d399' }}>{activeTicket.vehicleNumber}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Vehicle Type</span>
                      <span className="detail-value" style={{ textTransform: 'capitalize' }}>{activeTicket.vehicleType}</span>
                    </div>
                    <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="detail-label">Entry Time</span>
                      <span className="detail-value">{formatTime(activeTicket.entryTime)}</span>
                    </div>
                  </div>

                  <div className="barcode-sim">
                    <div className="barcode-lines"></div>
                    <div className="barcode-text">{activeTicket.ticketId}</div>
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                    * Present this ticket at exit to pay and checkout.
                  </p>
                </div>
              </div>
            )}

            {/* 3. Empty State */}
            {!activeTicket && !activeReceipt && (
              <div className="empty-ticket-state">
                <div className="empty-ticket-icon">🎟</div>
                <h3>Active Bill & Ticket Console</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Park a vehicle or search checkout to view generated ticket and billing info here.
                </p>
              </div>
            )}

          </div>
        </section>

        {/* Row 3: Full-width Parked Vehicles List */}
        <section className="glass-card parked-vehicles-card">
          <div className="table-header-row">
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🚗 Live Parked Vehicles</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Showing currently parked vehicles in the lot
              </p>
            </div>
            
            <div className="search-input-wrapper">
              <div className="input-wrapper">
                <span className="input-icon">🔍</span>
                <input
                  type="text"
                  className="form-control"
                  style={{ padding: '0.6rem 1rem 0.6rem 2.2rem', fontSize: '0.85rem' }}
                  placeholder="Search by Plate, Ticket..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            {filteredParkedList.length > 0 ? (
              <table className="parked-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Vehicle Plate</th>
                    <th>Type</th>
                    <th>Entry Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParkedList.map((vehicle) => (
                    <tr key={vehicle.ticketId}>
                      <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{vehicle.ticketId}</td>
                      <td style={{ fontWeight: 700, letterSpacing: '0.05em' }}>{vehicle.vehicleNumber}</td>
                      <td>
                        <span className={`table-badge-type badge-${vehicle.vehicleType}`}>
                          {vehicle.vehicleType === 'bike' ? '🚴 Bike' : vehicle.vehicleType === 'car' ? '🚗 Car' : '🚚 Truck'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatTime(vehicle.entryTime)}</td>
                      <td>
                        <button 
                          className="action-btn-exit"
                          onClick={() => handleQuickExit(vehicle.ticketId)}
                        >
                          Checkout
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-table-state">
                <span style={{ fontSize: '2rem' }}>✔</span>
                <h3>No Vehicles Parked</h3>
                <p style={{ fontSize: '0.85rem' }}>
                  {searchQuery ? 'No match found for your search query.' : 'Parking lot is currently empty.'}
                </p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
