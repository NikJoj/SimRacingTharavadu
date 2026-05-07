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
 */
function handleRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  sheet.appendRow([
    data.timestamp    || new Date().toISOString(),
    data.firstName    || "",
    data.lastName     || "",
    data.driverTag    || "",
    data.nationality  || "",
    data.email        || "",
    data.whatsapp     || "",
    data.discord      || "",
    data.platform     || "",
    data.wheel        || "",
    data.experience   || "",
    data.skillLevel   || "",
    data.carClass     || "",
    data.event        || "",
    data.league       || "",
    data.type         || "event"
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
 */
function updateRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rowIndex = data.rowIndex; // 1-based index (including header)
  
  if (!rowIndex || rowIndex < 2) {
    throw new Error("Invalid row index");
  }

  // Update specific cells
  if (data.driverTag) sheet.getRange(rowIndex, 4).setValue(data.driverTag);
  if (data.discord) sheet.getRange(rowIndex, 8).setValue(data.discord);
  if (data.carClass) sheet.getRange(rowIndex, 13).setValue(data.carClass);
  if (data.event) sheet.getRange(rowIndex, 14).setValue(data.event);
  if (data.league) sheet.getRange(rowIndex, 15).setValue(data.league);

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
    nextId,
    data.name || "",
    data.sim || "",
    data.status || "upcoming",
    data.track || "",
    data.startDate || "",
    data.endDate || "",
    data.format || "",
    "0", // drivers
    data.maxDrivers || "30",
    data.rounds || "1",
    data.season || "2026",
    data.description || "",
    data.trackMod || "",
    data.carMod || "",
    data.practiceServer || "",
    data.carOptions || ""
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

  // Update fields
  if (data.name) sheet.getRange(rowIndex, 2).setValue(data.name);
  if (data.sim) sheet.getRange(rowIndex, 3).setValue(data.sim);
  if (data.status) sheet.getRange(rowIndex, 4).setValue(data.status);
  if (data.track) sheet.getRange(rowIndex, 5).setValue(data.track);
  if (data.startDate) sheet.getRange(rowIndex, 6).setValue(data.startDate);
  if (data.endDate) sheet.getRange(rowIndex, 7).setValue(data.endDate);
  if (data.format) sheet.getRange(rowIndex, 8).setValue(data.format);
  if (data.maxDrivers) sheet.getRange(rowIndex, 10).setValue(data.maxDrivers);
  if (data.description) sheet.getRange(rowIndex, 13).setValue(data.description);
  if (data.carOptions) sheet.getRange(rowIndex, 17).setValue(data.carOptions);

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
    nextId,
    data.name || "",
    data.sim || "",
    data.status || "upcoming",
    data.startDate || "",
    data.endDate || "",
    data.format || "",
    data.season || "2026",
    data.championshipId || "",
    data.blobStore || ""
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

  // Update fields
  if (data.name) sheet.getRange(rowIndex, 2).setValue(data.name);
  if (data.sim) sheet.getRange(rowIndex, 3).setValue(data.sim);
  if (data.status) sheet.getRange(rowIndex, 4).setValue(data.status);
  if (data.season) sheet.getRange(rowIndex, 8).setValue(data.season);
  if (data.championshipId) sheet.getRange(rowIndex, 9).setValue(data.championshipId);
  if (data.blobStore) sheet.getRange(rowIndex, 10).setValue(data.blobStore);

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