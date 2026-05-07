/**
 * GOOGLE APPS SCRIPT - Enhanced with Admin Functions
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Replace the entire Code.gs content with this script
 * 4. Save and deploy as web app
 * 5. Set permissions: Execute as "Me", Access "Anyone"
 * 
 * REQUIRED SHEETS:
 * - Registrations: For storing user registrations
 * - Events: For managing events (optional, can be read-only)
 * - League: For managing leagues (optional, can be read-only)
 */

const SHEET_NAME = "Registrations";

/**
 * Handle POST requests (existing registration + new admin functions)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // Route to appropriate handler
    switch (action) {
      case 'getRegistrations':
        return getRegistrations();
      
      case 'updateRegistration':
        return updateRegistration(data);
      
      case 'deleteRegistration':
        return deleteRegistration(data);
      
      case 'createEvent':
        return createEvent(data);
      
      case 'updateEvent':
        return updateEvent(data);
      
      case 'deleteEvent':
        return deleteEvent(data);
      
      case 'createLeague':
        return createLeague(data);
      
      case 'updateLeague':
        return updateLeague(data);
      
      case 'deleteLeague':
        return deleteLeague(data);
      
      default:
        // Default: handle registration submission (backward compatible)
        return handleRegistration(data);
    }

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "error", 
        message: err.message 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for fetching data)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'getRegistrations':
        return getRegistrations();
      
      case 'getEvents':
        return getEvents();
      
      case 'getLeagues':
        return getLeagues();
      
      default:
        return ContentService
          .createTextOutput(JSON.stringify({ 
            status: "error", 
            message: "Invalid action" 
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "error", 
        message: err.message 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * EXISTING FUNCTION: Handle registration submission
 * Columns: A=timestamp, B=Driver Tag, C=Discord, D=Car Class, E=Event
 */
function handleRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  sheet.appendRow([
    data.timestamp    || new Date().toISOString(),
    data.driverTag    || "",
    data.discord      || "",
    data.carClass     || "",
    data.event        || data.league || ""
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Get all registrations
 */
function getRegistrations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  const headers = data[0];
  const rows = data.slice(1);
  
  const registrations = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok", 
      registrations: registrations 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Update a registration
 * Columns: A=timestamp, B=Driver Tag, C=Discord, D=Car Class, E=Event
 */
function updateRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rowIndex = data.rowIndex; // 1-based index (including header)
  
  if (!rowIndex || rowIndex < 2) {
    throw new Error("Invalid row index");
  }

  // Update specific cells based on actual column structure
  if (data.driverTag) sheet.getRange(rowIndex, 2).setValue(data.driverTag); // Column B
  if (data.discord) sheet.getRange(rowIndex, 3).setValue(data.discord);     // Column C
  if (data.carClass) sheet.getRange(rowIndex, 4).setValue(data.carClass);   // Column D
  if (data.event) sheet.getRange(rowIndex, 5).setValue(data.event);         // Column E

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Registration updated"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Delete a registration
 */
function deleteRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rowIndex = data.rowIndex; // 1-based index (including header)
  
  if (!rowIndex || rowIndex < 2) {
    throw new Error("Invalid row index");
  }

  sheet.deleteRow(rowIndex);

  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok", 
      message: "Registration deleted" 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Create a new event
 * Columns: A=id, B=name, C=sim, D=status, E=track, F=startDate, G=endDate,
 *          H=format, I=drivers, J=maxDrivers, K=rounds, L=season, M=description,
 *          N=trackMod, O=carMod, P=practiceServer, Q=carOptions
 */
function createEvent(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Events");
  
  if (!sheet) {
    throw new Error("Events sheet not found");
  }

  // Get next ID
  const lastRow = sheet.getLastRow();
  const nextId = lastRow > 1 ? parseInt(sheet.getRange(lastRow, 1).getValue()) + 1 : 1;

  sheet.appendRow([
    nextId,                           // A: id
    data.name || "",                  // B: name
    data.sim || "",                   // C: sim
    data.status || "upcoming",        // D: status
    data.track || "",                 // E: track
    data.startDate || "",             // F: startDate
    data.endDate || "",               // G: endDate
    data.format || "",                // H: format
    "0",                              // I: drivers
    data.maxDrivers || "30",          // J: maxDrivers
    data.rounds || "1",               // K: rounds
    data.season || "2026",            // L: season
    data.description || "",           // M: description
    data.trackMod || "",              // N: trackMod
    data.carMod || "",                // O: carMod
    data.practiceServer || "",        // P: practiceServer
    data.carOptions || ""             // Q: carOptions
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Event created",
      id: nextId
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Update an event
 * Columns: A=id, B=name, C=sim, D=status, E=track, F=startDate, G=endDate,
 *          H=format, I=drivers, J=maxDrivers, K=rounds, L=season, M=description,
 *          N=trackMod, O=carMod, P=practiceServer, Q=carOptions
 */
function updateEvent(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Events");
  
  if (!sheet) {
    throw new Error("Events sheet not found");
  }

  const eventId = data.id;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == eventId) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("Event not found");
  }

  // Update fields based on actual column structure
  if (data.name) sheet.getRange(rowIndex, 2).setValue(data.name);           // B: name
  if (data.sim) sheet.getRange(rowIndex, 3).setValue(data.sim);             // C: sim
  if (data.status) sheet.getRange(rowIndex, 4).setValue(data.status);       // D: status
  if (data.track) sheet.getRange(rowIndex, 5).setValue(data.track);         // E: track
  if (data.startDate) sheet.getRange(rowIndex, 6).setValue(data.startDate); // F: startDate
  if (data.endDate) sheet.getRange(rowIndex, 7).setValue(data.endDate);     // G: endDate
  if (data.format) sheet.getRange(rowIndex, 8).setValue(data.format);       // H: format
  if (data.maxDrivers) sheet.getRange(rowIndex, 10).setValue(data.maxDrivers); // J: maxDrivers
  if (data.description) sheet.getRange(rowIndex, 13).setValue(data.description); // M: description
  if (data.carOptions) sheet.getRange(rowIndex, 17).setValue(data.carOptions);   // Q: carOptions

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Event updated"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Delete an event (soft delete by changing status)
 */
function deleteEvent(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Events");
  
  if (!sheet) {
    throw new Error("Events sheet not found");
  }

  const eventId = data.id;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == eventId) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("Event not found");
  }

  // Soft delete: change status to 'closed'
  sheet.getRange(rowIndex, 4).setValue("closed");

  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok", 
      message: "Event deleted" 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Create a new league
 * Columns: A=id, B=name, C=sim, D=status, E=startDate, F=endDate,
 *          G=format, H=season, I=championshipId, J=blobStore
 */
function createLeague(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("League");
  
  if (!sheet) {
    throw new Error("League sheet not found");
  }

  // Get next ID
  const lastRow = sheet.getLastRow();
  const nextId = lastRow > 1 ? parseInt(sheet.getRange(lastRow, 1).getValue()) + 1 : 1;

  sheet.appendRow([
    nextId,                        // A: id
    data.name || "",               // B: name
    data.sim || "",                // C: sim
    data.status || "upcoming",     // D: status
    data.startDate || "",          // E: startDate
    data.endDate || "",            // F: endDate
    data.format || "",             // G: format
    data.season || "2026",         // H: season
    data.championshipId || "",     // I: championshipId
    data.blobStore || ""           // J: blobStore
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "League created",
      id: nextId
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Update a league
 * Columns: A=id, B=name, C=sim, D=status, E=startDate, F=endDate,
 *          G=format, H=season, I=championshipId, J=blobStore
 */
function updateLeague(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("League");
  
  if (!sheet) {
    throw new Error("League sheet not found");
  }

  const leagueId = data.id;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == leagueId) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("League not found");
  }

  // Update fields based on actual column structure
  if (data.name) sheet.getRange(rowIndex, 2).setValue(data.name);                   // B: name
  if (data.sim) sheet.getRange(rowIndex, 3).setValue(data.sim);                     // C: sim
  if (data.status) sheet.getRange(rowIndex, 4).setValue(data.status);               // D: status
  if (data.season) sheet.getRange(rowIndex, 8).setValue(data.season);               // H: season
  if (data.championshipId) sheet.getRange(rowIndex, 9).setValue(data.championshipId); // I: championshipId
  if (data.blobStore) sheet.getRange(rowIndex, 10).setValue(data.blobStore);        // J: blobStore

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "League updated"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Delete a league (soft delete by changing status)
 */
function deleteLeague(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("League");
  
  if (!sheet) {
    throw new Error("League sheet not found");
  }

  const leagueId = data.id;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == leagueId) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("League not found");
  }

  // Soft delete: change status to 'closed'
  sheet.getRange(rowIndex, 4).setValue("closed");

  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok", 
      message: "League deleted" 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Get all events
 */
function getEvents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Events");
  
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Events sheet not found" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const events = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok", 
      events: events 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ADMIN FUNCTION: Get all leagues
 */
function getLeagues() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("League");
  
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "League sheet not found" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const leagues = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "ok", 
      leagues: leagues 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function to verify setup
 */
function testSetup() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  Logger.log("Connected to sheet: " + sheet.getName());
  Logger.log("Last row: " + sheet.getLastRow());
}

// Made with Bob