function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
  var rowData = [
    new Date(), 
    e.parameter.name, 
    e.parameter.category, 
    e.parameter.grade, 
    e.parameter.score,
    Utilities.formatDate(new Date(), "GMT+5:30", "MMMM")
  ];
  sheet.appendRow(rowData);
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Registrations'); // Ensure your tab is named this
  
  var newRow = [
    new Date(),               // Timestamp
    e.parameter.id,           // Student/Intern ID
    e.parameter.name,         // Full Name
    e.parameter.dept,         // Department
    e.parameter.attendance,   // Attendance %
    "Active"                  // Default Status
  ];
  
  sheet.appendRow(newRow);
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}