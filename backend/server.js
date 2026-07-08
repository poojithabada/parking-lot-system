const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Fixed slot limits
const LIMITS = { bike: 5, car: 5, truck: 2 };

/**
 * Calculates the stay duration and fare.
 * Any fraction of an hour is rounded up.
 */
function calculateFare(entryTime, exitTime) {
  const entryDate = new Date(entryTime);
  const exitDate = new Date(exitTime);
  
  const ms = exitDate - entryDate;
  const hours = Math.ceil(ms / (1000 * 60 * 60));
  
  // Handle case where entry time is after exit time or duration is 0
  const durationHours = hours <= 0 ? 1 : hours;

  let amount = 30;
  if (durationHours <= 3) {
    amount = 30;
  } else if (durationHours <= 6) {
    amount = 85;
  } else {
    amount = 120;
  }

  return { durationHours, amount };
}

// 1. GET /api/slots
app.get('/api/slots', async (req, res) => {
  try {
    const db = await getDb();
    
    // Initialize active counts
    const occupiedCounts = { bike: 0, car: 0, truck: 0 };
    
    const rows = await db.all(`
      SELECT vehicle_type, COUNT(*) AS occupied 
      FROM tickets 
      WHERE status = 'parked' 
      GROUP BY vehicle_type
    `);
    
    rows.forEach(row => {
      const type = row.vehicle_type.toLowerCase();
      if (occupiedCounts.hasOwnProperty(type)) {
        occupiedCounts[type] = row.occupied;
      }
    });

    const response = {
      bike: { total: LIMITS.bike, available: Math.max(0, LIMITS.bike - occupiedCounts.bike) },
      car: { total: LIMITS.car, available: Math.max(0, LIMITS.car - occupiedCounts.car) },
      truck: { total: LIMITS.truck, available: Math.max(0, LIMITS.truck - occupiedCounts.truck) }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching slots:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 2. POST /api/park
app.post('/api/park', async (req, res) => {
  try {
    const db = await getDb();
    const { vehicleNumber, vehicleType, entryTime } = req.body;

    // Validation: Empty request body or missing fields
    if (!vehicleNumber || !vehicleType) {
      return res.status(400).json({ success: false, message: 'Vehicle number and vehicle type are required' });
    }

    const type = vehicleType.toLowerCase().trim();
    const plate = vehicleNumber.toUpperCase().trim();

    // Validation: Invalid vehicle type
    if (!LIMITS.hasOwnProperty(type)) {
      return res.status(400).json({ success: false, message: 'Invalid vehicle type. Allowed types: bike, car, truck' });
    }

    // Validation: Vehicle already parked
    const alreadyParked = await db.get(
      'SELECT id FROM tickets WHERE vehicle_number = ? AND status = "parked" LIMIT 1',
      [plate]
    );
    if (alreadyParked) {
      return res.status(400).json({ success: false, message: `Vehicle ${plate} is already parked` });
    }

    // Validation: Parking Full
    const activeQuery = await db.get(
      'SELECT COUNT(*) AS occupied FROM tickets WHERE vehicle_type = ? AND status = "parked"',
      [type]
    );
    const occupiedCount = activeQuery ? activeQuery.occupied : 0;
    
    if (occupiedCount >= LIMITS[type]) {
      return res.status(409).json({ success: false, message: 'Parking Full' });
    }

    // Default entry time to current UTC time if not provided
    const parkTime = entryTime || new Date().toISOString();

    // Insert new ticket using a temporary ID to ensure UNIQUE NOT NULL database constraint
    const tempTicketId = `TKT-TEMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const result = await db.run(
      `INSERT INTO tickets (ticket_id, vehicle_number, vehicle_type, entry_time, status) 
       VALUES (?, ?, ?, ?, 'parked')`,
      [tempTicketId, plate, type, parkTime]
    );

    const insertId = result.lastID;
    const ticketId = `TKT-${1000 + insertId}`;
    
    await db.run('UPDATE tickets SET ticket_id = ? WHERE id = ?', [ticketId, insertId]);

    return res.status(201).json({
      success: true,
      ticket: {
        ticketId: ticketId,
        vehicleNumber: plate,
        vehicleType: type,
        entryTime: parkTime
      }
    });
  } catch (error) {
    console.error('Error parking vehicle:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 3. POST /api/exit
app.post('/api/exit', async (req, res) => {
  try {
    const db = await getDb();
    const { ticketId, vehicleNumber, exitTime } = req.body;

    if (!ticketId && !vehicleNumber) {
      return res.status(400).json({ success: false, message: 'Ticket ID or Vehicle Number is required' });
    }

    let ticket = null;
    if (ticketId) {
      ticket = await db.get(
        'SELECT * FROM tickets WHERE ticket_id = ? AND status = "parked"',
        [ticketId.toUpperCase().trim()]
      );
    } else if (vehicleNumber) {
      ticket = await db.get(
        'SELECT * FROM tickets WHERE vehicle_number = ? AND status = "parked"',
        [vehicleNumber.toUpperCase().trim()]
      );
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found or already exited' });
    }

    // Default exit time to current UTC time if not provided
    const checkoutTime = exitTime || new Date().toISOString();

    // Verify exit time is not before entry time
    if (new Date(checkoutTime) < new Date(ticket.entry_time)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Exit time cannot be before entry time. Please adjust the simulation.' 
      });
    }

    const { durationHours, amount } = calculateFare(ticket.entry_time, checkoutTime);

    // Update database record
    await db.run(
      `UPDATE tickets 
       SET exit_time = ?, amount = ?, status = 'exited' 
       WHERE id = ?`,
      [checkoutTime, amount, ticket.id]
    );

    return res.status(200).json({
      success: true,
      receipt: {
        ticketId: ticket.ticket_id,
        vehicleNumber: ticket.vehicle_number,
        entryTime: ticket.entry_time,
        exitTime: checkoutTime,
        durationHours: durationHours,
        amount: amount
      }
    });
  } catch (error) {
    console.error('Error exiting vehicle:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 4. GET /api/parked
app.get('/api/parked', async (req, res) => {
  try {
    const db = await getDb();
    
    const rows = await db.all(`
      SELECT ticket_id, vehicle_number, vehicle_type, entry_time 
      FROM tickets 
      WHERE status = 'parked' 
      ORDER BY entry_time DESC
    `);

    const response = rows.map(row => ({
      ticketId: row.ticket_id,
      vehicleNumber: row.vehicle_number,
      vehicleType: row.vehicle_type,
      entryTime: row.entry_time
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching parked list:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add a test endpoint for verifying connection
app.get('/api/test', async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT 1 + 1 AS result');
    return res.json({ success: true, database: db.type, connectionResult: row.result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
