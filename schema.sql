-- Database schema for the Parking Lot System.
-- This file defines the tables necessary to run the application in a MySQL database.
-- For SQLite, an equivalent table is automatically created by the backend on startup.

CREATE DATABASE IF NOT EXISTS parking_lot;
USE parking_lot;

CREATE TABLE IF NOT EXISTS tickets (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id      VARCHAR(20) UNIQUE NOT NULL,        -- e.g. TKT-1001
  vehicle_number VARCHAR(20) NOT NULL,
  vehicle_type   ENUM('bike','car','truck') NOT NULL,
  entry_time     DATETIME NOT NULL,
  exit_time      DATETIME DEFAULT NULL,              -- NULL while parked
  amount         DECIMAL(6,2) DEFAULT NULL,          -- filled in on exit
  status         ENUM('parked','exited') NOT NULL DEFAULT 'parked'
);
