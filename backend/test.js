const { getDb } = require('./db');

// Duplicate of pricing rules from server.js for validation
function calculateFare(entryTime, exitTime) {
  const entryDate = new Date(entryTime);
  const exitDate = new Date(exitTime);
  const ms = exitDate - entryDate;
  const hours = Math.ceil(ms / (1000 * 60 * 60));
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

async function runTests() {
  console.log('--- STARTING BACKEND TESTING ---');
  let db;
  try {
    db = await getDb();
    console.log('✔ DB initialization successful. Database type:', db.type);
    
    // 1. Test calculation fare logic
    console.log('\nTesting Fare Calculations:');
    const tests = [
      { entry: '2026-07-07T10:00:00Z', exit: '2026-07-07T10:30:00Z', expectedHrs: 1, expectedFare: 30 }, // 30m
      { entry: '2026-07-07T10:00:00Z', exit: '2026-07-07T13:00:00Z', expectedHrs: 3, expectedFare: 30 }, // 3h
      { entry: '2026-07-07T10:00:00Z', exit: '2026-07-07T13:05:00Z', expectedHrs: 4, expectedFare: 85 }, // 3h 5m
      { entry: '2026-07-07T10:00:00Z', exit: '2026-07-07T16:00:00Z', expectedHrs: 6, expectedFare: 85 }, // 6h
      { entry: '2026-07-07T10:00:00Z', exit: '2026-07-07T16:01:00Z', expectedHrs: 7, expectedFare: 120 } // 6h 1m
    ];

    tests.forEach((t, idx) => {
      const result = calculateFare(t.entry, t.exit);
      if (result.durationHours === t.expectedHrs && result.amount === t.expectedFare) {
        console.log(`  Test ${idx + 1}: Passed! (${t.expectedHrs} hrs = ₹${t.expectedFare})`);
      } else {
        console.error(`  Test ${idx + 1}: Failed! Expected: ${t.expectedHrs}h/₹${t.expectedFare}, Got: ${result.durationHours}h/₹${result.amount}`);
        process.exit(1);
      }
    });

    // 2. Clear previous test records to prevent conflict
    await db.run("DELETE FROM tickets WHERE vehicle_number = 'TEST-999'");

    // 3. Test insert and check occupancy count
    console.log('\nTesting DB Insertion and Slots Count:');
    const initialSlots = await db.get("SELECT COUNT(*) AS count FROM tickets WHERE status = 'parked' AND vehicle_type = 'car'");
    const initialCount = initialSlots ? initialSlots.count : 0;
    console.log('  Initial parked cars:', initialCount);

    // Insert dummy car
    const entryTime = new Date().toISOString();
    await db.run(
      `INSERT INTO tickets (ticket_id, vehicle_number, vehicle_type, entry_time, status) 
       VALUES ('TKT-TEST-999', 'TEST-999', 'car', ?, 'parked')`,
      [entryTime]
    );
    console.log('  ✔ Inserted test vehicle TEST-999');

    // Recheck slots count
    const postInsertSlots = await db.get("SELECT COUNT(*) AS count FROM tickets WHERE status = 'parked' AND vehicle_type = 'car'");
    const postInsertCount = postInsertSlots ? postInsertSlots.count : 0;
    console.log('  Post-insert parked cars:', postInsertCount);
    if (postInsertCount !== initialCount + 1) {
      console.error('  Failed: Occupancy count did not increment!');
      process.exit(1);
    }
    console.log('  ✔ Occupancy count incremented correctly');

    // 4. Test Check out updates
    console.log('\nTesting checkout details update:');
    const exitTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours later
    const fare = calculateFare(entryTime, exitTime);
    
    await db.run(
      `UPDATE tickets 
       SET exit_time = ?, amount = ?, status = 'exited' 
       WHERE vehicle_number = 'TEST-999' AND status = 'parked'`,
      [exitTime, fare.amount]
    );
    console.log('  ✔ Checked out TEST-999');

    // Confirm is not in parked list anymore
    const finalSlots = await db.get("SELECT COUNT(*) AS count FROM tickets WHERE status = 'parked' AND vehicle_type = 'car'");
    const finalCount = finalSlots ? finalSlots.count : 0;
    if (finalCount !== initialCount) {
      console.error('  Failed: Occupancy count did not decrement on checkout!');
      process.exit(1);
    }
    console.log('  ✔ Occupancy count decremented correctly');

    // Clean up
    await db.run("DELETE FROM tickets WHERE vehicle_number = 'TEST-999'");
    console.log('  ✔ Test database records cleaned up');

    console.log('\n✔ ALL TESTS COMPLETED SUCCESSFULLY!');
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Testing crashed with error:', error);
    process.exit(1);
  }
}

runTests();
